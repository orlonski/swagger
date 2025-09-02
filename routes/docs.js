const express = require('express');
const yaml = require('js-yaml');
const { Project, ProjectVersion, VersionAssociation, ApiSpec } = require('../models');
const router = express.Router();

// Rota principal da documentação, que renderiza a página com o seletor de versão
router.get('/:projectSlug', async (req, res) => {
    try {
        const project = await Project.findOne({ where: { slug: req.params.projectSlug } });
        if (!project) return res.status(404).send('Projeto não encontrado.');

        const versions = await ProjectVersion.findAll({ where: { ProjectId: project.id }, order: [['name', 'DESC']] });
        
        res.send(`
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
                <meta charset="UTF-8">
                <title>Documentação - ${project.name}</title>
                <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
                <style>
                    html, body { margin: 0; padding: 0; font-family: sans-serif; }
                    .topbar { background-color: #f8f9fa; padding: 10px 20px; border-bottom: 1px solid #dee2e6; display: flex; align-items: center; }
                    .topbar h1 { font-size: 1.5em; margin: 0; color: #343a40; }
                    .topbar select { margin-left: 25px; padding: 8px 12px; font-size: 1em; border: 1px solid #ced4da; border-radius: 4px; }
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
                        
                        // Limpa a UI se nenhuma versão for selecionada
                        if (!versionId) {
                            document.getElementById('swagger-ui').innerHTML = '';
                            return;
                        }
                        
                        const specUrl = '/api/docs/versions/' + versionId;
                        
                        if (ui) {
                            // Se a UI já existe, apenas atualiza a URL e recarrega
                            ui.specActions.updateUrl(specUrl);
                            ui.specActions.download();
                        } else {
                            // Senão, cria uma nova instância
                            ui = SwaggerUIBundle({
                                url: specUrl,
                                dom_id: '#swagger-ui',
                            });
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Erro ao gerar a página de documentação.');
    }
});


// Rota da API que gera o ficheiro OpenAPI "merged" para uma versão específica
router.get('/api/docs/versions/:versionId', async (req, res) => {
    try {
        const associations = await VersionAssociation.findAll({
            where: { ProjectVersionId: req.params.versionId },
            include: ApiSpec // Inclui o ficheiro YAML completo
        });

        if (associations.length === 0) {
            return res.json({ openapi: '3.0.0', info: { title: 'Nenhum endpoint associado a esta versão.', version: '1.0.0' }, paths: {} });
        }

        // Obtém o nome da versão e do projeto para o título
        const version = await ProjectVersion.findByPk(req.params.versionId, { include: Project });
        const title = version ? `${version.Project.name} - Versão ${version.name}` : 'Documentação Consolidada';

        const mergedSpec = {
            openapi: '3.0.0',
            info: {
                title: title,
                version: version ? version.name : '1.0.0'
            },
            paths: {},
            components: { schemas: {} }
        };

        const allSchemas = {};

        for (const assoc of associations) {
            const doc = yaml.load(assoc.ApiSpec.yaml);
            
            // Junta os schemas, evitando duplicados
            if (doc.components && doc.components.schemas) {
                Object.assign(allSchemas, doc.components.schemas);
            }

            const pathData = doc.paths[assoc.endpointPath];
            if (pathData && pathData[assoc.endpointMethod]) {
                if (!mergedSpec.paths[assoc.endpointPath]) {
                    mergedSpec.paths[assoc.endpointPath] = {};
                }
                mergedSpec.paths[assoc.endpointPath][assoc.endpointMethod] = pathData[assoc.endpointMethod];
            }
        }
        
        mergedSpec.components.schemas = allSchemas;
        res.json(mergedSpec);

    } catch (error) {
        res.status(500).json({ error: 'Não foi possível gerar a especificação OpenAPI.' });
    }
});


module.exports = router;

