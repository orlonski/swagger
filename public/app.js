document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos do DOM
    const pageContainer = document.getElementById('page-container');
    const navProjects = document.getElementById('nav-projects');
    const navApiSpecs = document.getElementById('nav-api-specs');
    const specEditorModal = document.getElementById('spec-editor-modal');

    // Estado da aplicação
    let state = {
        currentPage: 'projects',
        currentProject: null,
        currentVersion: null,
        editingSpecId: null,
        swaggerEditor: null,
        pendingAssociations: new Set() // Novo: Para guardar seleções temporárias
    };

    // --- Roteador Principal ---
    const navigate = (page) => {
        state.currentPage = page;
        updateNavStyles();
        render();
    };

    const updateNavStyles = () => {
        navProjects.classList.toggle('active', state.currentPage.startsWith('projects') || state.currentPage.startsWith('manage_'));
        navApiSpecs.classList.toggle('active', state.currentPage === 'api_specs');
    };

    const render = () => {
        pageContainer.innerHTML = '';
        switch (state.currentPage) {
            case 'projects':
                renderProjectsPage();
                break;
            case 'api_specs':
                renderApiSpecsPage();
                break;
            case 'manage_versions':
                renderManageVersionsPage();
                break;
            case 'manage_associations':
                renderManageAssociationsPage();
                break;
        }
    };

    // --- Renderizadores de Página ---
    const renderProjectsPage = async () => {
        pageContainer.innerHTML = `
            <div class="page-header">
                <h2 class="text-2xl font-bold">Projetos</h2>
                <button data-action="show-add-project-form" class="btn btn-primary">Novo Projeto</button>
            </div>
            <div id="add-project-form" class="hidden my-4 p-4 border rounded-md bg-white shadow-sm">
                <h3 class="text-lg font-semibold mb-2">Criar Novo Projeto</h3>
                <input type="text" id="new-project-name" class="input" placeholder="Nome do Projeto">
                <div class="mt-2 space-x-2">
                    <button data-action="save-new-project" class="btn btn-success">Salvar</button>
                    <button data-action="cancel-add-project" class="btn btn-secondary">Cancelar</button>
                </div>
            </div>
            <div id="projects-list" class="space-y-3 mt-6"></div>
        `;
        await loadProjects();
    };

    const renderApiSpecsPage = async () => {
        pageContainer.innerHTML = `
            <div class="page-header">
                <h2 class="text-2xl font-bold">Repositório de Ficheiros YAML</h2>
                <button data-action="show-add-spec-form" class="btn btn-primary">Nova API</button>
            </div>
            <div id="specs-list" class="space-y-3 mt-6"></div>
        `;
        await loadApiSpecs();
    };

    const renderManageVersionsPage = async () => {
        if (!state.currentProject) return navigate('projects');
        pageContainer.innerHTML = `
            <div class="page-header">
                <div>
                    <button data-action="back-to-projects" class="text-sm text-blue-600 hover:underline mb-2">&larr; Voltar aos Projetos</button>
                    <h2 class="text-2xl font-bold">Gerir Versões: <span class="text-indigo-600">${state.currentProject.name}</span></h2>
                </div>
                <button data-action="show-add-version-form" class="btn btn-primary">Nova Versão</button>
            </div>
             <div id="add-version-form" class="hidden my-4 p-4 border rounded-md bg-white shadow-sm">
                <h3 class="text-lg font-semibold mb-2">Criar Nova Versão</h3>
                <input type="text" id="new-version-name" class="input" placeholder="Nome da Versão (ex: 1.0.0)">
                <div class="mt-2 space-x-2">
                    <button data-action="save-new-version" class="btn btn-success">Salvar</button>
                    <button data-action="cancel-add-version" class="btn btn-secondary">Cancelar</button>
                </div>
            </div>
            <div id="versions-list" class="space-y-3 mt-6"></div>
        `;
        await loadVersionsForCurrentProject();
    };

    const renderManageAssociationsPage = async () => {
        if (!state.currentProject || !state.currentVersion) return navigate('projects');
        pageContainer.innerHTML = `
             <div class="page-header">
                 <div>
                    <button data-action="back-to-versions" class="text-sm text-blue-600 hover:underline mb-2">&larr; Voltar às Versões</button>
                    <h2 class="text-2xl font-bold">Gerir Endpoints para a Versão: <span class="text-indigo-600">${state.currentVersion.name}</span></h2>
                </div>
                <button data-action="save-associations" class="btn btn-success">Salvar Associações</button>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div class="bg-white p-4 rounded-lg shadow-md">
                    <h3 class="font-bold text-lg mb-2">Ficheiros YAML Disponíveis</h3>
                    <div id="assoc-specs-list" class="space-y-2"></div>
                </div>
                <div class="bg-white p-4 rounded-lg shadow-md">
                    <h3 class="font-bold text-lg mb-2">Endpoints do Ficheiro Selecionado</h3>
                    <div id="assoc-endpoints-list" class="min-h-[300px]">Selecione um ficheiro YAML à esquerda.</div>
                </div>
            </div>
        `;
        await loadDataForAssociationPage();
    };

    // --- Carregadores de Dados ---
    async function loadProjects() {
        const projectsList = document.getElementById('projects-list');
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) throw new Error('Falha ao carregar projetos do servidor.');
            const projects = await response.json();
            projectsList.innerHTML = projects.map(project => `
                <div class="project-item" id="project-item-${project.id}">
                    <div class="flex-grow">
                        <span class="font-bold text-lg" data-role="project-name">${project.name}</span>
                        <a href="/docs/${project.slug}" target="_blank" class="text-indigo-500 hover:underline ml-4 text-sm" data-role="project-slug">/docs/${project.slug}</a>
                    </div>
                    <div class="flex-shrink-0 space-x-2" data-role="project-actions">
                        <button class="btn btn-secondary btn-sm" data-action="edit-project" data-project-id="${project.id}">Editar</button>
                        <button class="btn btn-secondary btn-sm" data-action="manage-versions" data-project-id="${project.id}" data-project-name="${project.name}">Gerir Versões</button>
                        <button class="btn btn-danger btn-sm" data-action="delete-project" data-project-id="${project.id}">Apagar</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            projectsList.innerHTML = `<div class="error-banner">${error.message}</div>`;
        }
    }

    async function loadApiSpecs() {
        const specsList = document.getElementById('specs-list');
        try {
            const response = await fetch('/api/specs');
            if (!response.ok) throw new Error('Falha ao carregar APIs do servidor.');
            const specs = await response.json();
            specsList.innerHTML = specs.map(spec => `
                <div class="spec-item">
                    <span class="font-bold text-lg">${spec.name}</span>
                    <div class="space-x-2">
                        <button class="btn btn-secondary btn-sm" data-action="edit-spec" data-spec-id="${spec.id}">Editar</button>
                        <button class="btn btn-danger btn-sm" data-action="delete-spec" data-spec-id="${spec.id}">Apagar</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            specsList.innerHTML = `<div class="error-banner">${error.message}</div>`;
        }
    }

    async function loadVersionsForCurrentProject() {
        const versionsList = document.getElementById('versions-list');
        try {
            const response = await fetch(`/api/projects/${state.currentProject.id}/versions`);
            if (!response.ok) throw new Error('Falha ao carregar versões.');
            const versions = await response.json();
            versionsList.innerHTML = versions.map(v => `
                <div class="version-item">
                    <span class="font-bold text-lg">${v.name}</span>
                    <div class="space-x-2">
                        <button class="btn btn-secondary btn-sm" data-action="manage-associations" data-version-id="${v.id}" data-version-name="${v.name}">Gerir Endpoints</button>
                        <button class="btn btn-danger btn-sm" data-action="delete-version" data-version-id="${v.id}">Apagar</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            versionsList.innerHTML = `<div class="error-banner">${error.message}</div>`;
        }
    }

    async function loadDataForAssociationPage() {
        const [specsRes, assocRes] = await Promise.all([
            fetch('/api/specs'),
            fetch(`/api/versions/${state.currentVersion.id}/associations`)
        ]);
        const specs = await specsRes.json();
        const associations = await assocRes.json();
        const savedEndpoints = new Set(associations.map(a => `${a.ApiSpecId}:${a.endpointPath}:${a.endpointMethod}`));
        
        // CORREÇÃO: Inicializa o estado temporário com os dados salvos
        state.pendingAssociations = new Set(savedEndpoints);

        const specsListContainer = document.getElementById('assoc-specs-list');
        specsListContainer.innerHTML = specs.map(spec => `
            <div class="p-3 border rounded-lg cursor-pointer hover:bg-indigo-50 hover:border-indigo-300" data-action="select-spec-for-assoc" data-spec-id="${spec.id}">
                ${spec.name}
            </div>
        `).join('');
    }

    // --- Funções da Janela Modal do Editor ---
    async function openSpecEditorModal(spec = null) {
        const newApiTemplate = 'openapi: 3.0.0\ninfo:\n  title: Nova API\n  version: 1.0.0\npaths:\n';
        
        specEditorModal.classList.remove('hidden');

        if (!state.swaggerEditor) {
            state.swaggerEditor = SwaggerEditorBundle({
                dom_id: '#swagger-editor-container',
                layout: 'EditorLayout',
            });
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));

        if (spec) {
            state.editingSpecId = spec.id;
            document.getElementById('modal-title').textContent = 'Editar Ficheiro YAML';
            document.getElementById('modal-spec-name').value = spec.name;
            state.swaggerEditor.specActions.updateSpec(spec.yaml);
        } else {
            state.editingSpecId = null;
            document.getElementById('modal-title').textContent = 'Novo Ficheiro YAML';
            document.getElementById('modal-spec-name').value = '';
            state.swaggerEditor.specActions.updateSpec(newApiTemplate);
        }
    }

    function closeSpecEditorModal() {
        specEditorModal.classList.add('hidden');
    }

    // --- Manipulador de Eventos Central ---
    document.body.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;

        // Ações da Janela Modal (têm prioridade)
        if (action === 'close-spec-modal') {
            closeSpecEditorModal();
            return;
        }
        if (action === 'save-spec') {
            const name = document.getElementById('modal-spec-name').value;
            const yaml = state.swaggerEditor.specSelectors.specStr();
            if (name && yaml) {
                const url = state.editingSpecId ? `/api/specs/${state.editingSpecId}` : '/api/specs';
                const method = state.editingSpecId ? 'PUT' : 'POST';
                await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, yaml }),
                });
                closeSpecEditorModal();
                if (state.currentPage === 'api_specs') renderApiSpecsPage();
            }
            return;
        }
        
        // Ações de Navegação
        if (action === 'navigate-projects') {
             navigate('projects');
             return;
        }
        if (action === 'navigate-api-specs') {
             navigate('api_specs');
             return;
        }

        // Ações de Página
        switch (state.currentPage) {
            case 'projects':
                await handleProjectsPageClick(target, action);
                break;
            case 'api_specs':
                await handleApiSpecsPageClick(target, action);
                break;
            case 'manage_versions':
                await handleManageVersionsPageClick(target, action);
                break;
            case 'manage_associations':
                await handleManageAssociationsPageClick(target, action);
                break;
        }
    });
    
    // Bind dos links de navegação
    navProjects.dataset.action = 'navigate-projects';
    navApiSpecs.dataset.action = 'navigate-api-specs';


    async function handleProjectsPageClick(target, action) {
        if (action === 'show-add-project-form') {
            document.getElementById('add-project-form').classList.remove('hidden');
        }
        if (action === 'cancel-add-project') {
             document.getElementById('add-project-form').classList.add('hidden');
        }
        if (action === 'save-new-project') {
             const name = document.getElementById('new-project-name').value;
            if (name) {
                await fetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name }),
                });
                renderProjectsPage();
            }
        }
        if (action === 'delete-project') {
            if (confirm('Tem a certeza que deseja apagar este projeto e todas as suas versões?')) {
                await fetch(`/api/projects/${target.dataset.projectId}`, { method: 'DELETE' });
                renderProjectsPage();
            }
        }
        if (action === 'edit-project') {
            const projectId = target.dataset.projectId;
            const projectItem = document.getElementById(`project-item-${projectId}`);
            const nameSpan = projectItem.querySelector('[data-role="project-name"]');
            const actionsDiv = projectItem.querySelector('[data-role="project-actions"]');
            const currentName = nameSpan.textContent;

            nameSpan.innerHTML = `<input type="text" id="edit-project-name-${projectId}" class="input w-full" value="${currentName}">`;

            actionsDiv.innerHTML = `
                <button class="btn btn-success btn-sm" data-action="save-edit-project" data-project-id="${projectId}">Salvar</button>
                <button class="btn btn-secondary btn-sm" data-action="cancel-edit-project">Cancelar</button>
            `;
        }
        if (action === 'save-edit-project') {
            const projectId = target.dataset.projectId;
            const newName = document.getElementById(`edit-project-name-${projectId}`).value;
            if (newName) {
                await fetch(`/api/projects/${projectId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName }),
                });
                renderProjectsPage();
            }
        }
        if (action === 'cancel-edit-project') {
            renderProjectsPage();
        }
        if (action === 'manage-versions') {
            state.currentProject = { id: target.dataset.projectId, name: target.dataset.projectName };
            navigate('manage_versions');
        }
    }

    async function handleApiSpecsPageClick(target, action) {
        if (action === 'show-add-spec-form') {
            openSpecEditorModal();
        }
        if (action === 'edit-spec') {
            const specId = target.dataset.specId;
            const response = await fetch(`/api/specs/${specId}`);
            const spec = await response.json();
            openSpecEditorModal(spec);
        }
        if (action === 'delete-spec') {
             if (confirm('Tem a certeza que deseja apagar este ficheiro YAML?')) {
                await fetch(`/api/specs/${target.dataset.specId}`, { method: 'DELETE' });
                renderApiSpecsPage();
            }
        }
    }

    async function handleManageVersionsPageClick(target, action) {
        if (action === 'back-to-projects') {
            return navigate('projects');
        }
        if (action === 'show-add-version-form') {
            document.getElementById('add-version-form').classList.remove('hidden');
        }
         if (action === 'cancel-add-version') {
            document.getElementById('add-version-form').classList.add('hidden');
        }
        if (action === 'save-new-version') {
            const name = document.getElementById('new-version-name').value;
            if (name) {
                await fetch(`/api/projects/${state.currentProject.id}/versions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                renderManageVersionsPage();
            }
        }
        if (action === 'delete-version') {
             if (confirm('Tem a certeza que deseja apagar esta versão e todas as suas associações?')) {
                await fetch(`/api/versions/${target.dataset.versionId}`, { method: 'DELETE' });
                renderManageVersionsPage();
            }
        }
        if(action === 'manage-associations') {
            state.currentVersion = { id: target.dataset.versionId, name: target.dataset.versionName };
            navigate('manage_associations');
        }
    }

    async function handleManageAssociationsPageClick(target, action) {
        if (action === 'back-to-versions') {
            return navigate('manage_versions');
        }
        if(action === 'select-spec-for-assoc') {
            document.querySelectorAll('#assoc-specs-list > div.bg-indigo-100').forEach(el => el.classList.remove('bg-indigo-100', 'border-indigo-400'));
            target.classList.add('bg-indigo-100', 'border-indigo-400');
            
            const specId = target.dataset.specId;
            const endpointsListContainer = document.getElementById('assoc-endpoints-list');
            endpointsListContainer.innerHTML = 'A carregar...';
            try {
                const response = await fetch(`/api/specs/${specId}/endpoints`);
                const { endpoints } = await response.json();
                
                if(endpoints.length === 0){
                    endpointsListContainer.innerHTML = 'Nenhum endpoint encontrado neste ficheiro.';
                    return;
                }

                endpointsListContainer.innerHTML = endpoints.map(ep => {
                    const endpointId = `${specId}:${ep.path}:${ep.method}`;
                    // CORREÇÃO: Verifica no estado temporário se o endpoint está selecionado
                    const isChecked = state.pendingAssociations.has(endpointId);
                    return `
                        <div class="flex items-center p-1 hover:bg-gray-50 rounded">
                            <input type="checkbox" id="${endpointId}" data-action="toggle-endpoint-assoc" data-spec-id="${specId}" data-path="${ep.path}" data-method="${ep.method}" class="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" ${isChecked ? 'checked' : ''}>
                            <label for="${endpointId}" class="font-mono text-sm w-full cursor-pointer">
                                <span class="font-bold w-16 inline-block text-green-700">${ep.method.toUpperCase()}</span> 
                                <span>${ep.path}</span>
                            </label>
                        </div>
                    `;
                }).join('');

            } catch(error) {
                endpointsListContainer.innerHTML = `<div class="error-banner">${error.message}</div>`;
            }
        }
        if (action === 'toggle-endpoint-assoc') {
            const checkbox = target;
            const endpointId = checkbox.id;
            if (checkbox.checked) {
                state.pendingAssociations.add(endpointId);
            } else {
                state.pendingAssociations.delete(endpointId);
            }
        }
        if(action === 'save-associations') {
            // CORREÇÃO: Envia os dados do estado temporário, não do DOM
            const associations = Array.from(state.pendingAssociations).map(endpointId => {
                const [apiSpecId, endpointPath, endpointMethod] = endpointId.split(/(?<!^):/); // Split no primeiro ":"
                return { apiSpecId, endpointPath, endpointMethod };
            });

            await fetch(`/api/versions/${state.currentVersion.id}/associations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ associations })
            });
            alert('Associações salvas com sucesso!');
            navigate('manage_versions');
        }
    }

    // Início da aplicação
    navigate('projects');
});

