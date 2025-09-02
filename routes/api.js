const express = require('express');
const yaml = require('js-yaml');
const { Project, ApiSpec, ProjectVersion, VersionAssociation } = require('../models');
const router = express.Router();

// --- Funções Auxiliares ---

// Função para encontrar todas as referências ($ref) dentro de um objeto
function findRefsRecursively(obj, refsSet) {
    if (!obj || typeof obj !== 'object') {
        return;
    }
    for (const key in obj) {
        if (key === '$ref' && typeof obj[key] === 'string') {
            refsSet.add(obj[key]);
        } else {
            findRefsRecursively(obj[key], refsSet);
        }
    }
}

// --- Rotas de Projetos ---
router.get('/projects', async (req, res) => {
    try {
        const projects = await Project.findAll({ order: [['name', 'ASC']] });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar projetos.', details: error.message });
    }
});

router.post('/projects', async (req, res) => {
    try {
        const project = await Project.create({ name: req.body.name });
        res.status(201).json(project);
    } catch (error) {
        res.status(400).json({ error: 'Erro ao criar projeto.', details: error.message });
    }
});

router.put('/projects/:id', async (req, res) => {
    try {
        const project = await Project.findByPk(req.params.id);
        if (!project) return res.status(404).send('Projeto não encontrado.');
        await project.update({ name: req.body.name });
        res.status(200).json(project);
    } catch (error) {
        res.status(400).json({ error: 'Erro ao atualizar projeto.', details: error.message });
    }
});

router.delete('/projects/:id', async (req, res) => {
    try {
        await Project.destroy({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao apagar projeto.', details: error.message });
    }
});


// --- Rotas de Ficheiros YAML (ApiSpec) ---
router.get('/specs', async (req, res) => {
    try {
        const specs = await ApiSpec.findAll({ order: [['name', 'ASC']], attributes: ['id', 'name'] });
        res.json(specs);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar ficheiros YAML.' });
    }
});

router.get('/specs/:id', async (req, res) => {
     try {
        const spec = await ApiSpec.findByPk(req.params.id);
        if (!spec) return res.status(404).send('Ficheiro YAML não encontrado.');
        res.json(spec);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar ficheiro YAML.' });
    }
});

router.post('/specs', async (req, res) => {
    try {
        const spec = await ApiSpec.create({ name: req.body.name, yaml: req.body.yaml });
        res.status(201).json(spec);
    } catch (error) {
        res.status(400).json({ error: 'Erro ao criar ficheiro YAML.' });
    }
});

router.put('/specs/:id', async (req, res) => {
     try {
        await ApiSpec.update({ name: req.body.name, yaml: req.body.yaml }, { where: { id: req.params.id } });
        res.status(200).send();
    } catch (error) {
        res.status(400).json({ error: 'Erro ao atualizar ficheiro YAML.' });
    }
});

router.delete('/specs/:id', async (req, res) => {
    try {
        await ApiSpec.destroy({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao apagar ficheiro YAML.' });
    }
});

router.get('/specs/:id/endpoints', async (req, res) => {
    try {
        const spec = await ApiSpec.findByPk(req.params.id);
        if (!spec) return res.status(404).send('Ficheiro não encontrado.');
        
        const doc = yaml.load(spec.yaml);
        const endpoints = [];
        if (doc && doc.paths) {
            for (const path in doc.paths) {
                for (const method in doc.paths[path]) {
                    const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
                    if(validMethods.includes(method.toLowerCase())){
                        endpoints.push({ path, method });
                    }
                }
            }
        }
        res.json({ endpoints });

    } catch(error) {
        res.status(500).json({ error: 'Erro ao processar o ficheiro YAML.' });
    }
});


// --- Rotas de Versões de Projeto ---
router.get('/projects/:projectId/versions', async (req, res) => {
    try {
        const versions = await ProjectVersion.findAll({ where: { ProjectId: req.params.projectId }, order: [['name', 'ASC']] });
        res.json(versions);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar versões.' });
    }
});

router.post('/projects/:projectId/versions', async (req, res) => {
    try {
        const version = await ProjectVersion.create({ name: req.body.name, ProjectId: req.params.projectId });
        res.status(201).json(version);
    } catch (error) {
        res.status(400).json({ error: 'Erro ao criar versão.' });
    }
});

router.delete('/versions/:id', async (req, res) => {
    try {
        await ProjectVersion.destroy({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao apagar versão.' });
    }
});


// --- Rotas de Associações de Endpoints ---
router.get('/versions/:versionId/associations', async(req, res) => {
    try {
        const associations = await VersionAssociation.findAll({ where: { ProjectVersionId: req.params.versionId }});
        res.json(associations);
    } catch(error) {
        res.status(500).json({ error: 'Erro ao carregar associações.' });
    }
});

router.post('/versions/:versionId/associations', async(req, res) => {
    try {
        const { associations } = req.body;
        const versionId = req.params.versionId;

        await VersionAssociation.destroy({ where: { ProjectVersionId: versionId }});

        if(associations && associations.length > 0) {
            const newAssociations = associations.map(a => ({
                ProjectVersionId: versionId,
                ApiSpecId: a.apiSpecId,
                endpointPath: a.endpointPath,
                endpointMethod: a.endpointMethod
            }));
            await VersionAssociation.bulkCreate(newAssociations);
        }
        res.status(201).send();
    } catch(error) {
        res.status(500).json({ error: 'Erro ao salvar associações.' });
    }
});


// --- Rota de Geração de Documentação (LÓGICA CORRIGIDA) ---
router.get('/docs/versions/:versionId', async (req, res) => {
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

        const sourceDocs = new Map();
        associations.forEach(assoc => {
            if (assoc.ApiSpec && assoc.ApiSpec.yaml && !sourceDocs.has(assoc.ApiSpec.id)) {
                sourceDocs.set(assoc.ApiSpec.id, yaml.load(assoc.ApiSpec.yaml));
            }
        });

        const usedTags = new Set();
        const allRefs = new Set();

        // 1. Coleta os paths, tags e referências iniciais dos endpoints selecionados
        for (const assoc of associations) {
            const doc = sourceDocs.get(assoc.ApiSpec.id);
            if (!doc) continue;

            const endpointData = doc.paths?.[assoc.endpointPath]?.[assoc.endpointMethod];
            if (endpointData) {
                if (!mergedSpec.paths[assoc.endpointPath]) {
                    mergedSpec.paths[assoc.endpointPath] = {};
                }
                // CORREÇÃO: Usar uma cópia profunda para evitar referências cruzadas indesejadas
                mergedSpec.paths[assoc.endpointPath][assoc.endpointMethod] = JSON.parse(JSON.stringify(endpointData));

                if (endpointData.tags) {
                    endpointData.tags.forEach(tag => usedTags.add(tag));
                }
                findRefsRecursively(endpointData, allRefs);
            }
        }
        
        // 2. Resolve as referências de forma recursiva para encontrar dependências
        let newRefsFound = true;
        while (newRefsFound) {
            const currentRefsCount = allRefs.size;
            const refsToScan = [...allRefs];

            for (const ref of refsToScan) {
                if (!ref.startsWith('#/components/')) continue;
                const pathParts = ref.substring(2).split('/');
                const componentType = pathParts[1];
                const componentName = pathParts[2];
                
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

        // 3. Constrói a documentação final com os componentes e tags filtrados
        for (const doc of sourceDocs.values()) {
            // Adiciona servidores de todas as fontes
            if(doc.servers) mergedSpec.servers.push(...doc.servers);
            // Adiciona apenas as tags que foram usadas
            if(doc.tags) {
                doc.tags.forEach(tag => {
                    if (usedTags.has(tag.name)) {
                        mergedSpec.tags.push(tag);
                    }
                });
            }
        }

        // Adiciona apenas os componentes referenciados
        allRefs.forEach(ref => {
            if (!ref.startsWith('#/components/')) return;
            const pathParts = ref.substring(2).split('/');
            const componentType = pathParts[1];
            const componentName = pathParts[2];

            for (const doc of sourceDocs.values()) {
                const definition = doc.components?.[componentType]?.[componentName];
                if (definition) {
                    if (!mergedSpec.components[componentType]) {
                        mergedSpec.components[componentType] = {};
                    }
                    mergedSpec.components[componentType][componentName] = definition;
                    break;
                }
            }
        });

        // Remove duplicados de tags e servers
        mergedSpec.tags = mergedSpec.tags.filter((tag, index, self) => index === self.findIndex(t => t.name === tag.name));
        mergedSpec.servers = mergedSpec.servers.filter((server, index, self) => index === self.findIndex(s => s.url === server.url));
        
        res.json(mergedSpec);

    } catch (error) {
        console.error("Erro ao gerar spec:", error);
        res.status(500).json({ error: 'Não foi possível gerar a especificação OpenAPI.', details: error.message });
    }
});

module.exports = router;

