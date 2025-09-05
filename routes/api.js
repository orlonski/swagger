const express = require('express');
const yaml = require('js-yaml');
const { sequelize, Project, ApiSpec, ProjectVersion, VersionAssociation } = require('../models');
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

// --- Rotas de Projetos ---
router.get('/projects', async (req, res) => {
    try {
        // Buscar projetos da tabela kmm.v$modulo
        const [projects] = await sequelize.query(`
            SELECT 
                modulo_id as "id",
                cod_modulo as "cod_modulo",
                nome as "name",
                NVL(LOWER(REPLACE(REPLACE(REGEXP_REPLACE(nome, '[^A-Za-z0-9 ]', ''), ' ', '-'), '--', '-')), 'projeto') as "slug"
            FROM kmm.v$modulo 
            WHERE nome IS NOT NULL
            ORDER BY nome ASC
        `);
        
        res.json(projects);
    } catch (error) {
        console.error('Erro na API projects:', error);
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
        // Usar SQL direto para evitar cache do Sequelize
        const [specs] = await sequelize.query(`
            SELECT id, name FROM kmm.api_specs ORDER BY name ASC
        `);
        
        // Converter para formato esperado pelo frontend
        const formattedSpecs = specs.map(spec => ({
            id: spec.ID,
            name: spec.NAME
        }));
        
        res.json(formattedSpecs);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar ficheiros YAML.' });
    }
});

router.get('/specs/:id', async (req, res) => {
     try {
        // Usar SQL direto para buscar spec específica
        const [specs] = await sequelize.query(`
            SELECT id, name, yaml FROM kmm.api_specs WHERE id = :id
        `, {
            replacements: { id: req.params.id }
        });
        
        if (specs.length === 0) {
            return res.status(404).json({ error: 'Ficheiro YAML não encontrado.' });
        }
        
        res.json({
            id: specs[0].ID,
            name: specs[0].NAME,
            yaml: specs[0].YAML
        });
    } catch (error) {
        console.error('Erro ao carregar spec:', error);
        res.status(500).json({ error: 'Erro ao carregar ficheiro YAML.', details: error.message });
    }
});

router.post('/specs', async (req, res) => {
    try {
        console.log('Tentando inserir spec:', { name: req.body.name, yamlLength: req.body.yaml?.length });
        
        // Usar conexão Oracle direta para CLOB sem truncar
        const connection = await sequelize.connectionManager.getConnection();
        const oracledb = connection.oracledb || require('oracledb');
        
        const result = await connection.execute(
            `INSERT INTO kmm.api_specs (name, yaml) VALUES (:name, :yaml) RETURNING id INTO :id`,
            {
                name: req.body.name,
                yaml: { val: req.body.yaml, type: oracledb.CLOB },
                id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            },
            { autoCommit: true }
        );
        
        const insertedId = result.outBinds.id[0];
        console.log('Inserido com ID:', insertedId, 'tamanho original:', req.body.yaml?.length);
        
        res.status(201).json({
            id: insertedId,
            name: req.body.name
        });
        
        await sequelize.connectionManager.releaseConnection(connection);
        
    } catch (error) {
        console.error('Erro ao criar spec:', error);
        res.status(400).json({ error: 'Erro ao criar ficheiro YAML.', details: error.message });
    }
});

router.put('/specs/:id', async (req, res) => {
     try {
        // Usar conexão Oracle direta para CLOB sem truncar
        const connection = await sequelize.connectionManager.getConnection();
        const oracledb = connection.oracledb || require('oracledb');
        
        await connection.execute(
            `UPDATE kmm.api_specs SET name = :name, yaml = :yaml WHERE id = :id`,
            {
                name: req.body.name,
                yaml: { val: req.body.yaml, type: oracledb.CLOB },
                id: req.params.id
            },
            { autoCommit: true }
        );
        
        res.status(200).send();
        
        await sequelize.connectionManager.releaseConnection(connection);
        
    } catch (error) {
        console.error('Erro ao atualizar spec:', error);
        res.status(400).json({ error: 'Erro ao atualizar ficheiro YAML.', details: error.message });
    }
});

router.delete('/specs/:id', async (req, res) => {
    try {
        // Usar SQL direto para DELETE
        await sequelize.query(`
            DELETE FROM kmm.api_specs WHERE id = :id
        `, {
            replacements: { id: req.params.id }
        });
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar spec:', error);
        res.status(500).json({ error: 'Erro ao apagar ficheiro YAML.', details: error.message });
    }
});

router.get('/specs/:id/endpoints', async (req, res) => {
    try {
        // Usar SQL direto para buscar spec específica
        const [specs] = await sequelize.query(`
            SELECT id, name, yaml FROM kmm.api_specs WHERE id = :id
        `, {
            replacements: { id: req.params.id }
        });
        
        if (specs.length === 0) {
            return res.status(404).json({ error: 'Ficheiro não encontrado.' });
        }
        
        const doc = yaml.load(specs[0].YAML);
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
        console.error('Erro ao processar endpoints:', error);
        res.status(500).json({ error: 'Erro ao processar o ficheiro YAML.' });
    }
});


// --- Rotas de Versões de Projeto ---
router.get('/projects/:projectId/versions', async (req, res) => {
    try {
        // Buscar cod_modulo do projeto usando modulo_id
        const [projectData] = await sequelize.query(`
            SELECT cod_modulo FROM kmm.v$modulo WHERE modulo_id = :projectId
        `, {
            replacements: { projectId: req.params.projectId }
        });
        
        if (projectData.length === 0) {
            return res.status(404).json({ error: 'Projeto não encontrado.' });
        }
        
        const codModulo = projectData[0].COD_MODULO;
        
        console.log('Buscando versões para cod_modulo:', codModulo);
        
        // Buscar versões distintas para este cod_modulo com contador real de endpoints
        const [versions] = await sequelize.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY v.versao ASC) as "id",
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
            ORDER BY v.versao ASC
        `, {
            replacements: { codModulo }
        });
        
        console.log('Versões encontradas:', versions.length, versions);
        
        res.json(versions);
    } catch (error) {
        console.error('Erro na API versions:', error);
        res.status(500).json({ error: 'Erro ao carregar versões.', details: error.message });
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
        const versionId = req.params.versionId;
        const projectId = req.query.projectId;
        
        console.log('GET associations - versionId:', versionId, 'projectId:', projectId);
        
        if (!projectId) {
            console.log('ProjectId não fornecido');
            return res.json([]);
        }
        
        // Buscar cod_modulo do projeto
        const [projectData] = await sequelize.query(`
            SELECT cod_modulo FROM kmm.v$modulo WHERE modulo_id = :projectId
        `, {
            replacements: { projectId }
        });
        
        if (projectData.length === 0) {
            console.log('Projeto não encontrado');
            return res.json([]);
        }
        
        const codModulo = projectData[0].COD_MODULO;
        console.log('Cod_modulo do projeto:', codModulo);

        // Buscar versões específicas deste projeto
        const [projectVersions] = await sequelize.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY versao ASC) as "id",
                cod_modulo as "cod_modulo", 
                versao as "name"
            FROM (
                SELECT DISTINCT cod_modulo, versao 
                FROM kmm.v$cliente_modulo_versao 
                WHERE cod_modulo = :codModulo
            )
            ORDER BY versao ASC
        `, {
            replacements: { codModulo }
        });
        
        console.log('Versões do projeto encontradas:', projectVersions);
        
        const version = projectVersions.find(v => v.id == versionId);
        console.log('Versão selecionada:', version);
        
        if (!version) {
            return res.json([]);
        }
        
        // Buscar associações para este cod_modulo + versao específica
        const [associations] = await sequelize.query(`
            SELECT 
                API_SPEC_ID as "ApiSpecId",
                ENDPOINT_PATH as "endpointPath",
                ENDPOINT_METHOD as "endpointMethod"
            FROM kmm.version_associations 
            WHERE COD_MODULO = :codModulo AND VERSAO = :versao AND CLIENTE_ID = 1
        `, {
            replacements: { 
                codModulo: version.cod_modulo,
                versao: version.name
            }
        });
        
        console.log('Associações encontradas:', associations);
        res.json(associations);
    } catch(error) {
        console.error('Erro na API associations:', error);
        res.json([]);
    }
});

router.post('/versions/:versionId/associations', async(req, res) => {
    try {
        const { associations, projectId } = req.body;
        const versionId = req.params.versionId;

        console.log('POST associations - versionId:', versionId, 'projectId:', projectId);
        console.log('POST associations - associations:', associations);

        // Buscar cod_modulo do projeto
        const [projectData] = await sequelize.query(`
            SELECT cod_modulo FROM kmm.v$modulo WHERE modulo_id = :projectId
        `, {
            replacements: { projectId }
        });
        
        if (projectData.length === 0) {
            return res.status(404).json({ error: 'Projeto não encontrado.' });
        }
        
        const codModulo = projectData[0].COD_MODULO;
        console.log('Cod_modulo do projeto:', codModulo);

        // Buscar versões específicas deste projeto
        const [projectVersions] = await sequelize.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY versao ASC) as "id",
                cod_modulo as "cod_modulo", 
                versao as "name"
            FROM (
                SELECT DISTINCT cod_modulo, versao 
                FROM kmm.v$cliente_modulo_versao 
                WHERE cod_modulo = :codModulo
            )
            ORDER BY versao ASC
        `, {
            replacements: { codModulo }
        });
        
        console.log('Versões do projeto encontradas:', projectVersions);
        
        const version = projectVersions.find(v => v.id == versionId);
        console.log('Versão selecionada:', version);
        
        if (!version) {
            return res.status(404).json({ error: 'Versão não encontrada.' });
        }

        // Limpar associações existentes para este cod_modulo + versao específica
        await sequelize.query(`
            DELETE FROM kmm.version_associations 
            WHERE COD_MODULO = :codModulo AND VERSAO = :versao AND CLIENTE_ID = 1
        `, {
            replacements: { 
                codModulo: version.cod_modulo,
                versao: version.name
            }
        });

        // Inserir novas associações com versao
        if(associations && associations.length > 0) {
            for (const assoc of associations) {
                await sequelize.query(`
                    INSERT INTO kmm.version_associations 
                    (CLIENTE_ID, COD_MODULO, VERSAO, API_SPEC_ID, ENDPOINT_PATH, ENDPOINT_METHOD)
                    VALUES (1, :codModulo, :versao, :apiSpecId, :endpointPath, :endpointMethod)
                `, {
                    replacements: {
                        codModulo: version.cod_modulo,
                        versao: version.name,
                        apiSpecId: assoc.apiSpecId,
                        endpointPath: assoc.endpointPath,
                        endpointMethod: assoc.endpointMethod
                    }
                });
            }
        }

        res.status(201).send();
    } catch(error) {
        console.error('Erro na API POST associations:', error);
        res.status(500).json({ error: 'Erro ao salvar associações.', details: error.message });
    }
});

module.exports = router;

