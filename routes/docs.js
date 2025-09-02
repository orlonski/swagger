const express = require('express');
const yaml = require('js-yaml');
const { Project, ProjectVersion, VersionAssociation, ApiSpec } = require('../models');
const router = express.Router();

// --- Funções Auxiliares ---
function findRefsRecursively(obj, refsSet) {
    if (!obj || typeof obj !== 'object') return;
    for (const key in obj) {
        if (key === '$ref' && typeof obj[key] === 'string') {
            refsSet.add(obj[key]);
        } else {
            findRefsRecursively(obj[key], refsSet);
        }
    }
}

// Rota principal que serve a página HTML da documentação
router.get('/:projectSlug', async (req, res) => {
    try {
        const project = await Project.findOne({ where: { slug: req.params.projectSlug } });
        if (!project) return res.status(404).send('Projeto não encontrado.');

        const versions = await ProjectVersion.findAll({ where: { ProjectId: project.id }, order: [['name', 'DESC']] });
        
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Documentação - ${project.name}</title>
                <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
                <style>
                    html, body { margin: 0; padding: 0; font-family: sans-serif; }
                    .topbar { background-color: #f0f0f0; padding: 10px; border-bottom: 1px solid #ddd; display: flex; align-items: center; }
                    .topbar h1 { font-size: 1.2em; margin: 0; }
                    .topbar select { margin-left: 20px; padding: 5px; font-size: 1em; }
                </style>
            </head>
            <body>
                <div class="topbar">
                    <h1>${project.name}</h1>
                    <select id="version-selector">
                        <option value="">Selecione uma versão...</option>
                        ${versions.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}
                    </select>
                </div>
                <div id="swagger-ui"></div>
                <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"></script>
                <script>
                    const selector = document.getElementById('version-selector');
                    let ui;
                    selector.addEventListener('change', (event) => {
                        const versionId = event.target.value;
                        if (versionId) {
                            // CORREÇÃO: A URL agora aponta para o caminho público correto
                            const specUrl = '/docs/versions/' + versionId;
                            if (ui) {
                                ui.specActions.updateUrl(specUrl);
                                ui.specActions.download();
                            } else {
                                ui = SwaggerUIBundle({
                                    url: specUrl,
                                    dom_id: '#swagger-ui',
                                });
                            }
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error("Erro ao gerar a página de documentação:", error);
        res.status(500).send('Erro ao gerar a página de documentação.');
    }
});

// Rota PÚBLICA que gera o ficheiro OpenAPI "merged" para uma versão específica
router.get('/versions/:versionId', async (req, res) => {
    try {
        const version = await ProjectVersion.findByPk(req.params.versionId, { include: Project });
        if(!version) return res.status(404).json({error: 'Versão não encontrada.'});

        const associations = await VersionAssociation.findAll({
            where: { ProjectVersionId: req.params.versionId },
            include: ApiSpec
        });

        if (associations.length === 0) {
            return res.json({ openapi: '3.0.0', info: { title: `${version.Project.name} - ${version.name}`, description: 'Nenhum endpoint associado a esta versão.', version: version.name }, paths: {} });
        }

        const sourceDocs = new Map();
        associations.forEach(assoc => {
            if (assoc.ApiSpec && assoc.ApiSpec.yaml && !sourceDocs.has(assoc.ApiSpec.id)) {
                sourceDocs.set(assoc.ApiSpec.id, yaml.load(assoc.ApiSpec.yaml));
            }
        });

        const mergedSpec = {
            openapi: '3.0.0',
            info: {
                title: `${version.Project.name} - ${version.name}`,
                version: version.name,
                description: 'Documentação consolidada gerada pelo Hub de APIs.'
            },
            paths: {},
            components: {},
            tags: [],
            servers: []
        };
        const usedTags = new Set();
        const allRefs = new Set();

        for (const assoc of associations) {
            const doc = sourceDocs.get(assoc.ApiSpec.id);
            if (!doc) continue;
            const endpointData = doc.paths?.[assoc.endpointPath]?.[assoc.endpointMethod];
            if (endpointData) {
                if (!mergedSpec.paths[assoc.endpointPath]) mergedSpec.paths[assoc.endpointPath] = {};
                mergedSpec.paths[assoc.endpointPath][assoc.endpointMethod] = JSON.parse(JSON.stringify(endpointData));
                if (endpointData.tags) endpointData.tags.forEach(tag => usedTags.add(tag));
                findRefsRecursively(endpointData, allRefs);
            }
        }
        
        let newRefsFound = true;
        while (newRefsFound) {
            const currentRefsCount = allRefs.size;
            const refsToScan = [...allRefs];
            for (const ref of refsToScan) {
                if (!ref.startsWith('#/components/')) continue;
                const pathParts = ref.substring(2).split('/');
                const componentType = pathParts[1], componentName = pathParts[2];
                for (const doc of sourceDocs.values()) {
                    const definition = doc.components?.[componentType]?.[componentName];
                    if (definition) {
                        findRefsRecursively(definition, allRefs);
                        break;
                    }
                }
            }
            newRefsFound = allRefs.size > currentRefsCount;
        }

        for (const doc of sourceDocs.values()) {
            if(doc.servers) mergedSpec.servers.push(...doc.servers);
            if(doc.tags) doc.tags.forEach(tag => {
                if (usedTags.has(tag.name)) mergedSpec.tags.push(tag);
            });
        }

        allRefs.forEach(ref => {
            if (!ref.startsWith('#/components/')) return;
            const pathParts = ref.substring(2).split('/');
            const componentType = pathParts[1], componentName = pathParts[2];
            for (const doc of sourceDocs.values()) {
                const definition = doc.components?.[componentType]?.[componentName];
                if (definition) {
                    if (!mergedSpec.components[componentType]) mergedSpec.components[componentType] = {};
                    mergedSpec.components[componentType][componentName] = definition;
                    break;
                }
            }
        });

        mergedSpec.tags = mergedSpec.tags.filter((tag, index, self) => index === self.findIndex(t => t.name === tag.name));
        mergedSpec.servers = mergedSpec.servers.filter((server, index, self) => index === self.findIndex(s => s.url === server.url));
        
        res.json(mergedSpec);

    } catch (error) {
        console.error("Erro ao gerar spec:", error);
        res.status(500).json({ error: 'Não foi possível gerar a especificação OpenAPI.', details: error.message });
    }
});

module.exports = router;

