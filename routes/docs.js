const express = require('express');
const yaml = require('js-yaml');
const { sequelize, Project, ProjectVersion, VersionAssociation, ApiSpec } = require('../models');
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
        // Buscar projeto usando Oracle
        const [projects] = await sequelize.query(`
            SELECT modulo_id as "id", cod_modulo, nome as "name", 
                   NVL(LOWER(REPLACE(REPLACE(REGEXP_REPLACE(nome, '[^A-Za-z0-9 ]', ''), ' ', '-'), '--', '-')), 'projeto') as "slug"
            FROM kmm.v$modulo 
            WHERE NVL(LOWER(REPLACE(REPLACE(REGEXP_REPLACE(nome, '[^A-Za-z0-9 ]', ''), ' ', '-'), '--', '-')), 'projeto') = '${req.params.projectSlug}'
        `);
        
        if (projects.length === 0) return res.status(404).send('Projeto não encontrado.');
        
        const project = projects[0];
        
        // Buscar versões usando Oracle - CORRIGIDO: usar replacements como na API
        const [versions] = await sequelize.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY v.cod_modulo, v.versao ASC) as "id",
                v.cod_modulo as "cod_modulo", 
                v.versao as "name",
                NVL(a.endpoint_count, 0) as "endpointCount"
            FROM (
                SELECT DISTINCT cod_modulo, versao 
                FROM kmm.v$cliente_modulo_versao 
                WHERE cod_modulo = :codModulo
            ) v
            LEFT JOIN (
                SELECT 
                    cod_modulo,
                    versao,
                    COUNT(*) as endpoint_count
                FROM kmm.version_associations 
                WHERE cliente_id = 1
                GROUP BY cod_modulo, versao
            ) a ON v.cod_modulo = a.cod_modulo AND v.versao = a.versao
            ORDER BY v.cod_modulo, v.versao ASC
        `, {
            replacements: { codModulo: project.COD_MODULO }
        });
        
        // Debug: verificar se existem dados na tabela v$cliente_modulo_versao
        const [debugVersions] = await sequelize.query(`
            SELECT cod_modulo, versao, COUNT(*) as count
            FROM kmm.v$cliente_modulo_versao 
            WHERE cod_modulo = :codModulo
            GROUP BY cod_modulo, versao
        `, {
            replacements: { codModulo: project.COD_MODULO }
        });
        
        // Se não há versões, mostrar mensagem apropriada
        if (versions.length === 0) {
            return res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>Documentação - ${project.name}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; text-align: center; }
                        .message { background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 500px; }
                    </style>
                </head>
                <body>
                    <h1>${project.name}</h1>
                    <div class="message">
                        <h3>Nenhuma versão disponível</h3>
                        <p>Este projeto ainda não possui versões configuradas.</p>
                        <p><strong>Código do Módulo:</strong> ${project.COD_MODULO}</p>
                        <p><a href="/app.html">← Voltar ao painel administrativo</a></p>
                    </div>
                </body>
                </html>
            `);
        }
        
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
                            // CORREÇÃO: A URL agora inclui o projectSlug
                            const specUrl = '/docs/' + window.location.pathname.split('/')[2] + '/versions/' + versionId;
                            
                            // Testar a URL primeiro
                            fetch(specUrl)
                                .then(response => {
                                    return response.json();
                                })
                                .then(data => {
                                    if (ui) {
                                        ui.specActions.updateUrl(specUrl);
                                        ui.specActions.download();
                                    } else {
                                        ui = SwaggerUIBundle({
                                            url: specUrl,
                                            dom_id: '#swagger-ui',
                                        });
                                    }
                                })
                                .catch(error => {
                                    console.error('Erro ao carregar spec:', error);
                                });
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
router.get('/:projectSlug/versions/:versionId', async (req, res) => {
    try {
        const { projectSlug, versionId } = req.params;
        
        // Buscar projeto primeiro
        const [projects] = await sequelize.query(`
            SELECT modulo_id as "id", cod_modulo, nome as "name", 
                   NVL(LOWER(REPLACE(REPLACE(REGEXP_REPLACE(nome, '[^A-Za-z0-9 ]', ''), ' ', '-'), '--', '-')), 'projeto') as "slug"
            FROM kmm.v$modulo 
            WHERE NVL(LOWER(REPLACE(REPLACE(REGEXP_REPLACE(nome, '[^A-Za-z0-9 ]', ''), ' ', '-'), '--', '-')), 'projeto') = '${projectSlug}'
        `);
        
        if (projects.length === 0) return res.status(404).json({error: 'Projeto não encontrado.'});
        
        const project = projects[0];
        
        // Buscar versões apenas deste projeto
        const [projectVersions] = await sequelize.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY v.versao ASC) as "id",
                v.cod_modulo as "cod_modulo", 
                v.versao as "name"
            FROM (
                SELECT DISTINCT cod_modulo, versao 
                FROM kmm.v$cliente_modulo_versao
                WHERE cod_modulo = :codModulo
            ) v
            ORDER BY v.versao ASC
        `, {
            replacements: { codModulo: project.COD_MODULO }
        });
        
        const version = projectVersions.find(v => v.id == versionId);
        
        if(!version) return res.status(404).json({error: 'Versão não encontrada.'});

        // Buscar projeto para o nome
        const [projectData] = await sequelize.query(`
            SELECT nome as "name" FROM kmm.v$modulo WHERE cod_modulo = '${version.cod_modulo}'
        `);
        
        const projectName = projectData.length > 0 ? projectData[0].name : 'Projeto';

        // Buscar associações usando Oracle - CORRIGIDO: incluir filtro por versão
        const [associations] = await sequelize.query(`
            SELECT 
                va.API_SPEC_ID as "ApiSpecId",
                va.ENDPOINT_PATH as "endpointPath",
                va.ENDPOINT_METHOD as "endpointMethod",
                asp.yaml as "yaml"
            FROM kmm.version_associations va
            LEFT JOIN kmm.api_specs asp ON va.API_SPEC_ID = asp.id
            WHERE va.COD_MODULO = '${version.cod_modulo}' 
            AND va.VERSAO = '${version.name}'
            AND va.CLIENTE_ID = 1
        `);

        if (associations.length === 0) {
            return res.json({ openapi: '3.0.0', info: { title: `${projectName} - ${version.name}`, description: 'Nenhum endpoint associado a esta versão.', version: version.name }, paths: {} });
        }

        const sourceDocs = new Map();
        associations.forEach(assoc => {
            if (assoc.yaml && !sourceDocs.has(assoc.ApiSpecId)) {
                sourceDocs.set(assoc.ApiSpecId, yaml.load(assoc.yaml));
            }
        });

        const mergedSpec = {
            openapi: '3.0.0',
            info: {
                title: `${projectName} - ${version.name}`,
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
            const doc = sourceDocs.get(assoc.ApiSpecId);
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
