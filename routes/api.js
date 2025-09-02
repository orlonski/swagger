const express = require('express');
const yaml = require('js-yaml');
const { Project, ApiSpec, ProjectVersion, VersionAssociation } = require('../models');
const router = express.Router();

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

module.exports = router;

