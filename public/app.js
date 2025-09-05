document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos do DOM
    const pageContainer = document.getElementById('page-container');
    const userMenu = document.getElementById('user-menu');
    const specEditorModal = document.getElementById('spec-editor-modal');

    // Estado da aplicação
    let state = {
        currentPage: 'projects',
        currentProject: null,
        currentVersion: null,
        editingSpecId: null,
        swaggerEditor: null,
        user: null,
        pendingAssociations: new Set()
    };

    // --- Verificação de Autenticação e Ponto de Entrada ---
    async function checkAuthAndInitialize() {
        try {
            const response = await fetch('/api/auth/status');
            if (!response.ok) throw new Error('Falha na verificação de estado.');
            
            const data = await response.json();
            if (!data.isAuthenticated) {
                window.location.href = '/login.html';
            } else {
                state.user = data.user;
                userMenu.textContent = `Olá, ${state.user.username}`;
                initializeMainApp();
            }
        } catch (error) {
            console.error("Erro de autenticação, a redirecionar para o login:", error);
            window.location.href = '/login.html';
        }
    }
    
    // --- Função de Inicialização da Aplicação Principal ---
    function initializeMainApp() {
        const navProjects = document.getElementById('nav-projects');
        const navApiSpecs = document.getElementById('nav-api-specs');

        const navigate = (page, payload = {}) => {
            if (page === 'manage_versions' && payload.project) {
                state.currentProject = payload.project;
            }
            if (page === 'manage_associations' && payload.version) {
                state.currentVersion = payload.version;
            }
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
                case 'projects': renderProjectsPage(); break;
                case 'api_specs': renderApiSpecsPage(); break;
                case 'manage_versions': renderManageVersionsPage(); break;
                case 'manage_associations': renderManageAssociationsPage(); break;
            }
        };

        const renderProjectsPage = async () => {
            pageContainer.innerHTML = `
                <div class="page-header">
                    <h2 class="text-2xl font-bold">Projetos</h2>
                    <button data-action="show-add-project-form" class="btn btn-primary">Novo Projeto</button>
                </div>
                <div class="filter-section my-4 p-4 border rounded-md bg-gray-50">
                    <div class="flex flex-wrap gap-4 items-center">
                        <div class="flex-1 min-w-64">
                            <label for="project-search" class="block text-sm font-medium text-gray-700 mb-1">Buscar Projetos</label>
                            <input type="text" id="project-search" class="input" placeholder="Digite o nome do projeto ou código do módulo...">
                        </div>
                        <div class="flex gap-2 mt-6">
                            <button data-action="clear-filter" class="btn btn-secondary">Limpar</button>
                        </div>
                    </div>
                </div>
                <div id="add-project-form" class="hidden my-4 p-4 border rounded-md bg-white shadow-sm">
                    <h3 class="text-lg font-semibold mb-2">Criar Novo Projeto</h3>
                    <input type="text" id="new-project-name" class="input" placeholder="Nome do Projeto">
                    <div class="mt-2 space-x-2">
                        <button data-action="save-new-project" class="btn btn-success">Salvar</button>
                        <button data-action="cancel-add-project" class="btn btn-secondary">Cancelar</button>
                    </div>
                </div>
                <div id="projects-count" class="text-sm text-gray-600 mb-2"></div>
                <div id="projects-list" class="space-y-3 mt-6"></div>`;
            await loadProjects();
            setupProjectFilter();
        };

        const renderApiSpecsPage = async () => {
            pageContainer.innerHTML = `
                <div class="page-header">
                    <h2 class="text-2xl font-bold">Repositório de Ficheiros YAML</h2>
                    <button data-action="show-add-spec-form" class="btn btn-primary">Nova API</button>
                </div>
                <div class="filter-section my-4 p-4 border rounded-md bg-gray-50">
                    <div class="flex flex-wrap gap-4 items-center">
                        <div class="flex-1 min-w-64">
                            <label for="spec-search" class="block text-sm font-medium text-gray-700 mb-1">Buscar Ficheiros YAML</label>
                            <input type="text" id="spec-search" class="input" placeholder="Digite o nome do ficheiro YAML...">
                        </div>
                        <div class="flex gap-2 mt-6">
                            <button data-action="clear-spec-filter" class="btn btn-secondary">Limpar</button>
                        </div>
                    </div>
                </div>
                <div id="specs-count" class="text-sm text-gray-600 mb-2"></div>
                <div id="specs-list" class="space-y-3 mt-6"></div>`;
            await loadApiSpecs();
            setupSpecFilter();
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
                <div class="filter-section my-4 p-4 border rounded-md bg-gray-50">
                    <div class="flex flex-wrap gap-4 items-center">
                        <div class="flex-1 min-w-64">
                            <label for="version-search" class="block text-sm font-medium text-gray-700 mb-1">Buscar Versões</label>
                            <input type="text" id="version-search" class="input" placeholder="Digite o número da versão (ex: 1.0.1, 1.0.148)...">
                        </div>
                        <div class="flex gap-2 mt-6">
                            <button data-action="clear-version-filter" class="btn btn-secondary">Limpar</button>
                        </div>
                    </div>
                </div>
                 <div id="add-version-form" class="hidden my-4 p-4 border rounded-md bg-white shadow-sm">
                    <h3 class="text-lg font-semibold mb-2">Criar Nova Versão</h3>
                    <input type="text" id="new-version-name" class="input" placeholder="Nome da Versão (ex: 1.0.0)">
                    <div class="mt-2 space-x-2">
                        <button data-action="save-new-version" class="btn btn-success">Salvar</button>
                        <button data-action="cancel-add-version" class="btn btn-secondary">Cancelar</button>
                    </div>
                </div>
                <div id="versions-count" class="text-sm text-gray-600 mb-2"></div>
                <div id="versions-list" class="space-y-3 mt-6"></div>`;
            await loadVersionsForCurrentProject();
            setupVersionFilter();
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
                </div>`;
            await loadDataForAssociationPage();
        };

        const getLoadingIndicator = (text = '') => `
            <div class="flex justify-center items-center p-8">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                ${text ? `<span class="ml-4 text-gray-600">${text}</span>` : ''}
            </div>
        `;
        
        const getButtonLoadingIndicator = (text) => `<div class="flex items-center justify-center"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>${text}</span></div>`;

        let allProjects = []; // Store all projects for filtering
        
        async function loadProjects() {
            const projectsList = document.getElementById('projects-list');
            projectsList.innerHTML = getLoadingIndicator();
            try {
                const response = await fetch('/api/projects');
                if (!response.ok) throw new Error('Falha ao carregar projetos do servidor.');
                allProjects = await response.json();
                renderProjectsList(allProjects);
            } catch (error) { 
                projectsList.innerHTML = `<div class="error-banner">${error.message}</div>`; 
            }
        }
        
        function renderProjectsList(projects) {
            const projectsList = document.getElementById('projects-list');
            const projectsCount = document.getElementById('projects-count');
            
            if (projectsCount) {
                projectsCount.textContent = `Mostrando ${projects.length} de ${allProjects.length} projetos`;
            }
            
            if (projects.length === 0) {
                projectsList.innerHTML = `<div class="text-center text-gray-500 p-4">Nenhum projeto encontrado com os filtros aplicados.</div>`;
                return;
            }
            
            projectsList.innerHTML = projects.map(project => `
                <div class="project-item" id="project-item-${project.id}" data-project-name="${project.name.toLowerCase()}" data-project-code="${project.cod_modulo || ''}">
                    <div class="flex-grow">
                        <span class="font-bold text-lg" data-role="project-name">${project.name}</span>
                        <a href="/docs/${project.slug}" target="_blank" class="text-indigo-500 hover:underline ml-4 text-sm" data-role="project-slug">/docs/${project.slug}</a>
                        ${project.cod_modulo ? `<span class="text-sm text-gray-600 ml-4">Código: ${project.cod_modulo}</span>` : ''}
                    </div>
                    <div class="flex-shrink-0 space-x-2" data-role="project-actions">
                        <button class="btn btn-secondary btn-sm" data-action="manage-versions" data-project-id="${project.id}" data-project-name="${project.name}">Gerir Versões</button>
                    </div>
                </div>`).join('');
        }
        
        function setupProjectFilter() {
            const searchInput = document.getElementById('project-search');
            if (!searchInput) return;
            
            const filterProjects = () => {
                const searchTerm = searchInput.value.toLowerCase().trim();
                
                if (!searchTerm) {
                    renderProjectsList(allProjects);
                    return;
                }
                
                const filteredProjects = allProjects.filter(project => {
                    const matchesName = project.name.toLowerCase().includes(searchTerm);
                    const matchesCode = project.cod_modulo && project.cod_modulo.toLowerCase().includes(searchTerm);
                    return matchesName || matchesCode;
                });
                
                renderProjectsList(filteredProjects);
            };
            
            // Real-time search
            searchInput.addEventListener('input', filterProjects);
        }
        let allSpecs = []; // Store all specs for filtering
        
        async function loadApiSpecs() {
            const specsList = document.getElementById('specs-list');
            specsList.innerHTML = getLoadingIndicator();
            try {
                const response = await fetch('/api/specs');
                if (!response.ok) throw new Error('Falha ao carregar APIs do servidor.');
                allSpecs = await response.json();
                renderSpecsList(allSpecs);
            } catch (error) { 
                specsList.innerHTML = `<div class="error-banner">${error.message}</div>`; 
            }
        }
        
        function renderSpecsList(specs) {
            const specsList = document.getElementById('specs-list');
            const specsCount = document.getElementById('specs-count');
            
            if (specsCount) {
                specsCount.textContent = `Mostrando ${specs.length} de ${allSpecs.length} ficheiros YAML`;
            }
            
            if (specs.length === 0) {
                specsList.innerHTML = `<div class="text-center text-gray-500 p-4">Nenhum ficheiro YAML encontrado com os filtros aplicados.</div>`;
                return;
            }
            
            specsList.innerHTML = specs.map(spec => `
                <div class="spec-item" data-spec-name="${spec.name.toLowerCase()}">
                    <span class="font-bold text-lg">${spec.name}</span>
                    <div class="space-x-2">
                        <button class="btn btn-secondary btn-sm" data-action="edit-spec" data-spec-id="${spec.id}">Editar</button>
                        <button class="btn btn-danger btn-sm" data-action="delete-spec" data-spec-id="${spec.id}">Apagar</button>
                    </div>
                </div>`).join('');
        }
        
        function setupSpecFilter() {
            const searchInput = document.getElementById('spec-search');
            if (!searchInput) return;
            
            const filterSpecs = () => {
                const searchTerm = searchInput.value.toLowerCase().trim();
                
                if (!searchTerm) {
                    renderSpecsList(allSpecs);
                    return;
                }
                
                const filteredSpecs = allSpecs.filter(spec => {
                    return spec.name.toLowerCase().includes(searchTerm);
                });
                
                renderSpecsList(filteredSpecs);
            };
            
            // Real-time search
            searchInput.addEventListener('input', filterSpecs);
        }
        let allVersions = []; // Store all versions for filtering
        
        async function loadVersionsForCurrentProject() {
            const versionsList = document.getElementById('versions-list');
            versionsList.innerHTML = getLoadingIndicator();
            try {
                const response = await fetch(`/api/projects/${state.currentProject.id}/versions`);
                if (!response.ok) throw new Error('Falha ao carregar versões.');
                allVersions = await response.json();
                renderVersionsList(allVersions);
            } catch (error) { 
                versionsList.innerHTML = `<div class="error-banner">${error.message}</div>`; 
            }
        }
        
        function renderVersionsList(versions) {
            const versionsList = document.getElementById('versions-list');
            const versionsCount = document.getElementById('versions-count');
            
            if (versionsCount) {
                versionsCount.textContent = `Mostrando ${versions.length} de ${allVersions.length} versões`;
            }
            
            if (versions.length === 0) {
                versionsList.innerHTML = `<div class="text-center text-gray-500 p-4">Nenhuma versão encontrada com os filtros aplicados.</div>`;
                return;
            }
            
            versionsList.innerHTML = versions.map(v => {
                const count = parseInt(v.endpointCount, 10);
                const endpointText = count === 1 ? 'endpoint' : 'endpoints';
                return `
                <div class="version-item" data-version-name="${v.name.toLowerCase()}">
                    <div class="flex items-center">
                        <span class="font-bold text-lg">${v.name}</span>
                        <span class="ml-4 text-sm font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">${count} ${endpointText}</span>
                    </div>
                    <div class="space-x-2">
                        <button class="btn btn-secondary btn-sm" data-action="manage-associations" data-version-id="${v.id}" data-version-name="${v.name}">Gerir Endpoints</button>
                    </div>
                </div>`
            }).join('');
        }
        
        function setupVersionFilter() {
            const searchInput = document.getElementById('version-search');
            if (!searchInput) return;
            
            const filterVersions = () => {
                const searchTerm = searchInput.value.toLowerCase().trim();
                
                if (!searchTerm) {
                    renderVersionsList(allVersions);
                    return;
                }
                
                const filteredVersions = allVersions.filter(version => {
                    return version.name.toLowerCase().includes(searchTerm);
                });
                
                renderVersionsList(filteredVersions);
            };
            
            // Real-time search
            searchInput.addEventListener('input', filterVersions);
        }
        async function loadDataForAssociationPage() {
            const specsListContainer = document.getElementById('assoc-specs-list');
            specsListContainer.innerHTML = getLoadingIndicator();
            console.log('Carregando associações para:', {
                versionId: state.currentVersion.id,
                projectId: state.currentProject.id
            });
            const [specsRes, assocRes] = await Promise.all([ 
                fetch('/api/specs'), 
                fetch(`/api/versions/${state.currentVersion.id}/associations?projectId=${state.currentProject.id}`) 
            ]);
            const specs = await specsRes.json();
            const associations = await assocRes.json();
            console.log('Associações carregadas:', associations);
            state.pendingAssociations = new Set(associations.map(a => `${a.ApiSpecId}:${a.endpointPath}:${a.endpointMethod}`));
            
            if (specs.length === 0) {
                specsListContainer.innerHTML = `<div class="text-center text-gray-500 p-4">Nenhum ficheiro YAML no repositório.</div>`;
                return;
            }
            specsListContainer.innerHTML = specs.map(spec => `<div class="p-3 border rounded-lg cursor-pointer hover:bg-indigo-50 hover:border-indigo-300" data-action="select-spec-for-assoc" data-spec-id="${spec.id}">${spec.name}</div>`).join('');
        }

        async function openSpecEditorModal(spec = null) {
            const newApiTemplate = 'openapi: 3.0.0\ninfo:\n  title: Nova API\n  version: 1.0.0\npaths:\n';
            specEditorModal.classList.remove('hidden');
            if (!state.swaggerEditor) {
                state.swaggerEditor = SwaggerEditorBundle({ dom_id: '#swagger-editor-container', layout: 'EditorLayout' });
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
        function closeSpecEditorModal() { specEditorModal.classList.add('hidden'); }

        document.body.addEventListener('click', async (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            
            // Handle clear filter actions
            if (action === 'clear-filter') {
                const searchInput = document.getElementById('project-search');
                if (searchInput) {
                    searchInput.value = '';
                    renderProjectsList(allProjects);
                }
                return;
            }
            
            if (action === 'clear-version-filter') {
                const searchInput = document.getElementById('version-search');
                if (searchInput) {
                    searchInput.value = '';
                    renderVersionsList(allVersions);
                }
                return;
            }
            
            if (action === 'clear-spec-filter') {
                const searchInput = document.getElementById('spec-search');
                if (searchInput) {
                    searchInput.value = '';
                    renderSpecsList(allSpecs);
                }
                return;
            }

            const originalButtonText = target.innerHTML;
            const disableButton = (text) => { 
                target.disabled = true;
                target.innerHTML = getButtonLoadingIndicator(text);
            };
            const enableButton = () => {
                target.disabled = false;
                target.innerHTML = originalButtonText;
            };

            if (action === 'logout') {
                disableButton('A sair...');
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/login.html';
                return;
            }
             if (action === 'navigate-projects') { navigate('projects'); return; }
            if (action === 'navigate-api-specs') { navigate('api_specs'); return; }

            if (action === 'close-spec-modal') { closeSpecEditorModal(); return; }
            if (action === 'save-spec') {
                disableButton('Salvando...');
                const name = document.getElementById('modal-spec-name').value;
                const yaml = state.swaggerEditor.specSelectors.specStr();
                if (name && yaml) {
                    const url = state.editingSpecId ? `/api/specs/${state.editingSpecId}` : '/api/specs';
                    const method = state.editingSpecId ? 'PUT' : 'POST';
                    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, yaml }) });
                    closeSpecEditorModal();
                    if (state.currentPage === 'api_specs') renderApiSpecsPage();
                } else {
                    alert('Nome e conteúdo YAML são obrigatórios.');
                    enableButton();
                }
                return;
            }

            if (action === 'show-add-project-form') { document.getElementById('add-project-form').classList.remove('hidden'); }
            if (action === 'cancel-add-project') { document.getElementById('add-project-form').classList.add('hidden'); }
            if (action === 'save-new-project') {
                disableButton('Salvando...');
                const name = document.getElementById('new-project-name').value;
                if (name) { await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); renderProjectsPage(); }
                else { enableButton(); }
            }
            if (action === 'delete-project') {
                if (confirm('Tem a certeza?')) { target.closest('.project-item').style.opacity = '0.5'; await fetch(`/api/projects/${target.dataset.projectId}`, { method: 'DELETE' }); renderProjectsPage(); }
            }
            if (action === 'edit-project') {
                const projectId = target.dataset.projectId;
                const item = document.getElementById(`project-item-${projectId}`);
                const nameSpan = item.querySelector('[data-role="project-name"]');
                const actionsDiv = item.querySelector('[data-role="project-actions"]');
                nameSpan.innerHTML = `<input type="text" id="edit-project-name-${projectId}" class="input w-full" value="${nameSpan.textContent}">`;
                actionsDiv.innerHTML = `<button class="btn btn-success btn-sm" data-action="save-edit-project" data-project-id="${projectId}">Salvar</button> <button class="btn btn-secondary btn-sm" data-action="cancel-edit-project">Cancelar</button>`;
            }
            if (action === 'save-edit-project') {
                disableButton('Salvando...');
                const projectId = target.dataset.projectId;
                const newName = document.getElementById(`edit-project-name-${projectId}`).value;
                if (newName) { await fetch(`/api/projects/${projectId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) }); renderProjectsPage(); }
                else { enableButton(); }
            }
            if (action === 'cancel-edit-project') { renderProjectsPage(); }
            if (action === 'manage-versions') {
                navigate('manage_versions', { project: { id: target.dataset.projectId, name: target.dataset.projectName } });
            }
            if (action === 'show-add-spec-form') { openSpecEditorModal(); }
            if (action === 'edit-spec') {
                disableButton('Editando...');
                const spec = await (await fetch(`/api/specs/${target.dataset.specId}`)).json();
                enableButton();
                openSpecEditorModal(spec);
            }
            if (action === 'delete-spec') {
                if (confirm('Tem a certeza?')) { target.closest('.spec-item').style.opacity = '0.5'; await fetch(`/api/specs/${target.dataset.specId}`, { method: 'DELETE' }); renderApiSpecsPage(); }
            }
            if (action === 'back-to-projects') { navigate('projects'); }
            if (action === 'show-add-version-form') { document.getElementById('add-version-form').classList.remove('hidden'); }
            if (action === 'cancel-add-version') { document.getElementById('add-version-form').classList.add('hidden'); }
            if (action === 'save-new-version') {
                disableButton('Salvando...');
                const name = document.getElementById('new-version-name').value;
                if (name) { await fetch(`/api/projects/${state.currentProject.id}/versions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); renderManageVersionsPage(); }
                else { enableButton(); }
            }
            if (action === 'delete-version') {
                if (confirm('Tem a certeza?')) { target.closest('.version-item').style.opacity = '0.5'; await fetch(`/api/versions/${target.dataset.versionId}`, { method: 'DELETE' }); renderManageVersionsPage(); }
            }
            if (action === 'manage-associations') {
                navigate('manage_associations', { version: { id: target.dataset.versionId, name: target.dataset.versionName } });
            }
            if (action === 'back-to-versions') { navigate('manage_versions', { project: state.currentProject }); }
            if (action === 'select-spec-for-assoc') {
                document.querySelectorAll('#assoc-specs-list > div.bg-indigo-100').forEach(el => el.classList.remove('bg-indigo-100', 'border-indigo-400'));
                target.classList.add('bg-indigo-100', 'border-indigo-400');
                const specId = target.dataset.specId;
                const endpointsContainer = document.getElementById('assoc-endpoints-list');
                endpointsContainer.innerHTML = getLoadingIndicator();
                try {
                    const { endpoints } = await (await fetch(`/api/specs/${specId}/endpoints`)).json();
                    if (endpoints.length === 0) { endpointsContainer.innerHTML = 'Nenhum endpoint encontrado.'; return; }
                    endpointsContainer.innerHTML = endpoints.map(ep => {
                        const endpointId = `${specId}:${ep.path}:${ep.method}`;
                        const isChecked = state.pendingAssociations.has(endpointId);
                        return `<div class="flex items-center p-1 hover:bg-gray-50 rounded"><input type="checkbox" id="${endpointId}" data-action="toggle-endpoint-assoc" class="mr-3 h-4 w-4" ${isChecked ? 'checked' : ''}><label for="${endpointId}" class="font-mono text-sm w-full cursor-pointer"><span class="font-bold w-16 inline-block text-green-700">${ep.method.toUpperCase()}</span> <span>${ep.path}</span></label></div>`;
                    }).join('');
                } catch (error) { endpointsContainer.innerHTML = `<div class="error-banner">${error.message}</div>`; }
            }
            if (action === 'toggle-endpoint-assoc') {
                const checkbox = target;
                if (checkbox.checked) { state.pendingAssociations.add(checkbox.id); } 
                else { state.pendingAssociations.delete(checkbox.id); }
            }
            if (action === 'save-associations') {
                disableButton('Salvando...');
                const associations = Array.from(state.pendingAssociations).map(id => {
                    const [apiSpecId, endpointPath, endpointMethod] = id.split(':', 3);
                    return { apiSpecId, endpointPath, endpointMethod };
                });
                console.log('Frontend enviando:', {
                    versionId: state.currentVersion.id,
                    projectId: state.currentProject.id,
                    associations: associations
                });
                await fetch(`/api/versions/${state.currentVersion.id}/associations`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ 
                        associations,
                        projectId: state.currentProject.id 
                    }) 
                });
                alert('Associações salvas com sucesso!');
                navigate('manage_versions', { project: state.currentProject });
            }
        });
        
        navigate('projects');
    }

    checkAuthAndInitialize();
});

