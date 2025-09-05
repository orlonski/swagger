document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos do DOM
    const pageContainer = document.getElementById('page-container');
    const userMenu = document.getElementById('user-menu');
    const specEditorModal = document.getElementById('spec-editor-modal');
    const toastContainer = document.getElementById('toast-container');
    const confirmModal = document.getElementById('confirm-modal');
    
    // Verificar se elementos existem
    if (!pageContainer) {
        console.error('Elemento page-container não encontrado');
        return;
    }

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

    // --- Função de Navegação (definida primeiro) ---
    function navigate(page, data = {}) {
        console.log('Navigate called with page:', page);
        state.currentPage = page;
        if (data.project) state.currentProject = data.project;
        if (data.version) state.currentVersion = data.version;
        
        if (page === 'projects') {
            console.log('Calling renderProjectsPage');
            renderProjectsPage();
        } else if (page === 'api_specs') {
            console.log('Calling renderApiSpecsPage');
            renderApiSpecsPage();
        } else if (page === 'dashboard') {
            console.log('Calling renderDashboardPage');
            renderDashboardPage();
        } else if (page === 'manage_versions') {
            console.log('Calling renderManageVersionsPage');
            renderManageVersionsPage();
        } else if (page === 'manage_associations') {
            console.log('Calling renderManageAssociationsPage');
            renderManageAssociationsPage();
        }
    }

    // --- Função para atualizar navegação ativa ---
    function updateActiveNavigation(page) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        if (page === 'projects') document.getElementById('nav-projects').classList.add('active');
        if (page === 'api_specs') document.getElementById('nav-api-specs').classList.add('active');
        if (page === 'dashboard') document.getElementById('nav-dashboard').classList.add('active');
    }

    // --- Verificação de Autenticação e Ponto de Entrada ---
    async function checkAuthAndInitialize() {
        // Esconder header durante verificação
        const header = document.querySelector('header');
        header.style.display = 'none';
        
        // Tela de loading completa
        document.body.innerHTML = `
            <div class="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center">
                <div class="text-center">
                    <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-6"></div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-2">Hub de Documentação</h2>
                    <p class="text-gray-600 font-medium">Verificando autenticação...</p>
                </div>
            </div>
        `;
        
        try {
            const response = await fetch('/api/auth/status');
            if (!response.ok) throw new Error('Falha na verificação de estado.');
            
            const data = await response.json();
            if (!data.isAuthenticated) {
                // Transição suave para login
                document.body.innerHTML = `
                    <div class="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
                        <div class="text-center">
                            <div class="animate-pulse">
                                <div class="h-16 w-16 bg-indigo-300 rounded-full mx-auto mb-6"></div>
                            </div>
                            <h2 class="text-2xl font-bold text-gray-800 mb-2">Redirecionando...</h2>
                            <p class="text-gray-600 font-medium">Acesso não autorizado</p>
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    window.location.href = '/login';
                }, 800);
            } else {
                // Restaurar página original e inicializar
                location.reload(); // Recarrega para restaurar HTML original
            }
        } catch (error) {
            console.error("Erro de autenticação, a redirecionar para o login:", error);
            // Transição suave mesmo em caso de erro
            document.body.innerHTML = `
                <div class="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center">
                    <div class="text-center">
                        <div class="animate-pulse">
                            <div class="h-16 w-16 bg-red-300 rounded-full mx-auto mb-6"></div>
                        </div>
                        <h2 class="text-2xl font-bold text-gray-800 mb-2">Erro de Conexão</h2>
                        <p class="text-gray-600 font-medium">Redirecionando para login...</p>
                    </div>
                </div>
            `;
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
        }
    }

    // --- Sistema de Notificações ---
    function showToast(message, type = 'success', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function showConfirm(title, message, onConfirm, onCancel = null) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        
        const confirmOk = document.getElementById('confirm-ok');
        const confirmCancel = document.getElementById('confirm-cancel');
        
        // Remove existing listeners
        const newConfirmOk = confirmOk.cloneNode(true);
        const newConfirmCancel = confirmCancel.cloneNode(true);
        confirmOk.parentNode.replaceChild(newConfirmOk, confirmOk);
        confirmCancel.parentNode.replaceChild(newConfirmCancel, confirmCancel);
        
        // Add new listeners
        newConfirmOk.addEventListener('click', () => {
            confirmModal.classList.remove('show');
            if (onConfirm) onConfirm();
        });
        
        newConfirmCancel.addEventListener('click', () => {
            confirmModal.classList.remove('show');
            if (onCancel) onCancel();
        });
        
        // Show modal
        confirmModal.classList.add('show');
        
        // Close on backdrop click
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.classList.remove('show');
                if (onCancel) onCancel();
            }
        });
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
            const [specsRes, assocRes] = await Promise.all([ 
                fetch('/api/specs'), 
                fetch(`/api/versions/${state.currentVersion.id}/associations?projectId=${state.currentProject.id}`) 
            ]);
            const specs = await specsRes.json();
            const associations = await assocRes.json();
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
                window.location.href = '/login';
                return;
            }
             if (action === 'navigate-projects') { navigate('projects'); return; }
            if (action === 'navigate-api-specs') { navigate('api_specs'); return; }
            if (action === 'navigate-dashboard') { 
                console.log('Dashboard clicked - calling renderDashboardPage directly');
                renderDashboardPage();
                return; 
            }

            if (action === 'close-spec-modal') { closeSpecEditorModal(); return; }
            if (action === 'save-spec') {
                disableButton('Salvando...');
                const name = document.getElementById('modal-spec-name').value;
                const yaml = state.swaggerEditor.specSelectors.specStr();
                if (name && yaml) {
                    const url = state.editingSpecId ? `/api/specs/${state.editingSpecId}` : '/api/specs';
                    const method = state.editingSpecId ? 'PUT' : 'POST';
                    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, yaml }) });
                    const successMessage = state.editingSpecId ? 'Ficheiro YAML atualizado com sucesso!' : 'Ficheiro YAML criado com sucesso!';
                    showToast(successMessage, 'success');
                    enableButton();
                    closeSpecEditorModal();
                    if (state.currentPage === 'api_specs') renderApiSpecsPage();
                } else {
                    showToast('Nome e conteúdo YAML são obrigatórios.', 'error');
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
                showConfirm('Confirmar exclusão', 'Tem a certeza que deseja apagar este projeto?', () => {
                    target.closest('.project-item').style.opacity = '0.5';
                    fetch(`/api/projects/${target.dataset.projectId}`, { method: 'DELETE' }).then(() => renderProjectsPage());
                });
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
                showConfirm('Confirmar exclusão', 'Tem a certeza que deseja apagar este ficheiro YAML?', () => {
                    target.closest('.spec-item').style.opacity = '0.5';
                    fetch(`/api/specs/${target.dataset.specId}`, { method: 'DELETE' }).then(() => renderApiSpecsPage());
                });
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
                showConfirm('Confirmar exclusão', 'Tem a certeza que deseja apagar esta versão?', () => {
                    target.closest('.version-item').style.opacity = '0.5';
                    fetch(`/api/versions/${target.dataset.versionId}`, { method: 'DELETE' }).then(() => renderManageVersionsPage());
                });
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
                await fetch(`/api/versions/${state.currentVersion.id}/associations`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ 
                        associations,
                        projectId: state.currentProject.id 
                    }) 
                });
                showToast('Associações salvas com sucesso!', 'success');
                navigate('manage_versions', { project: state.currentProject });
            }
        });
        
        navigate('projects');
    }

    // --- Dashboard Cliente-Módulo Versões ---
    async function renderDashboardPage() {
        console.log('renderDashboardPage called');
        updateActiveNavigation('dashboard');
        
        const loadingSpinner = `
            <div class="flex justify-center items-center p-8">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        `;
        
        pageContainer.innerHTML = `
            <div class="space-y-6">
                <div class="page-header">
                    <h2 class="text-2xl font-bold text-gray-800">Dashboard de Versões Cliente-Módulo</h2>
                    <div class="flex space-x-6">
                        <div class="relative">
                            <button id="client-filter-btn" class="flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]">
                                <span id="client-filter-text">Selecionar Clientes</span>
                                <svg class="w-5 h-5 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                            <div id="client-filter-dropdown" class="hidden absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                                <div class="p-3 border-b border-gray-200">
                                    <input type="text" id="client-search-input" placeholder="Buscar clientes..." class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                </div>
                                <div id="client-options" class="p-2">
                                    <!-- Options will be populated here -->
                                </div>
                            </div>
                        </div>
                        
                        <div class="relative">
                            <button id="module-filter-btn" class="flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]">
                                <span id="module-filter-text">Selecionar Módulos</span>
                                <svg class="w-5 h-5 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                            <div id="module-filter-dropdown" class="hidden absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                                <div class="p-3 border-b border-gray-200">
                                    <input type="text" id="module-search-input" placeholder="Buscar módulos..." class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                </div>
                                <div id="module-options" class="p-2">
                                    <!-- Options will be populated here -->
                                </div>
                            </div>
                        </div>
                        
                        <button id="clear-filters-btn" class="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500">
                            Limpar Filtros
                        </button>
                    </div>
                </div>
                
                <div id="dashboard-stats" class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    ${loadingSpinner}
                </div>
                
                <div class="bg-white rounded-xl shadow-md overflow-hidden">
                    <div class="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                        <h3 class="text-lg font-semibold">Matriz de Versões</h3>
                        <p class="text-indigo-100">Visualização interativa das versões por cliente e módulo</p>
                    </div>
                    <div id="version-matrix" class="p-4">
                        ${loadingSpinner}
                    </div>
                </div>
            </div>
        `;
        
        await loadDashboardData();
    }
    
    async function loadDashboardData() {
        try {
            const response = await fetch('/api/client-module-dashboard');
            const data = await response.json();
            
            renderDashboardStats(data.stats);
            renderVersionMatrix(data.clients, data.modules, data.versions);
            setupDashboardFilters(data.clients, data.modules, data.versions);
            
        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            showToast('Erro ao carregar dashboard', 'error');
        }
    }
    
    function renderDashboardStats(stats) {
        document.getElementById('dashboard-stats').innerHTML = `
            <div class="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg cursor-help relative group">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-blue-100 text-sm">Total Clientes</p>
                        <p class="text-2xl font-bold">${stats.TOTAL_CLIENTES || 0}</p>
                    </div>
                    <div class="text-blue-200">
                        <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                </div>
                <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    Quantidade de clientes ativos no sistema
                    <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
            </div>
            
            <div class="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg cursor-help relative group">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-green-100 text-sm">Total Módulos</p>
                        <p class="text-2xl font-bold">${stats.TOTAL_MODULOS || 0}</p>
                    </div>
                    <div class="text-green-200">
                        <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                        </svg>
                    </div>
                </div>
                <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    Quantidade total de módulos disponíveis
                    <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
            </div>
            
            <div class="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg cursor-help relative group">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-purple-100 text-sm">Combinações Cliente-Módulo</p>
                        <p class="text-2xl font-bold">${stats.TOTAL_INSTALACOES || 0}</p>
                        <p class="text-purple-200 text-xs mt-1">Total de módulos instalados em clientes</p>
                    </div>
                    <div class="text-purple-200">
                        <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                        </svg>
                    </div>
                </div>
                <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-64 text-center z-50">
                    Cada célula preenchida na matriz representa uma combinação cliente-módulo. Indica quantos módulos estão efetivamente instalados nos clientes.
                    <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
            </div>
            
            <div class="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg cursor-help relative group">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-orange-100 text-sm">Versões Diferentes</p>
                        <p class="text-2xl font-bold">${stats.TOTAL_VERSOES || 0}</p>
                        <p class="text-orange-200 text-xs mt-1">Quantidade de versões distintas em uso</p>
                    </div>
                    <div class="text-orange-200">
                        <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                </div>
                <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-64 text-center z-50">
                    Quantas versões distintas existem em todo o sistema. Muitas versões = maior complexidade de suporte.
                    <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
            </div>
        `;
    }
    
    function renderVersionMatrix(clients, modules, versions) {
        // Limitar dados para melhor performance
        const maxClients = 50;
        const maxModules = 20;
        
        const limitedClients = clients.slice(0, maxClients);
        const limitedModules = modules.slice(0, maxModules);
        
        // Criar mapa de versões para acesso rápido
        const versionMap = new Map();
        versions.forEach(v => {
            const key = `${v.CLIENTE_ID}-${v.COD_MODULO}`;
            versionMap.set(key, v.VERSAO);
        });
        
        // Gerar cores para versões (cache)
        const allVersions = [...new Set(versions.map(v => v.VERSAO))];
        const versionColors = new Map();
        allVersions.forEach((version, index) => {
            const hue = (index * 137.5) % 360;
            versionColors.set(version, `hsl(${hue}, 70%, 85%)`);
        });
        
        // Usar DocumentFragment para melhor performance
        const container = document.getElementById('version-matrix');
        
        // Mostrar aviso se dados foram limitados
        let warningHTML = '';
        if (clients.length > maxClients || modules.length > maxModules) {
            warningHTML = `
                <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div class="flex items-center">
                        <svg class="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                        <span class="text-sm text-yellow-800">
                            <strong>Performance:</strong> Mostrando apenas ${limitedClients.length} de ${clients.length} clientes e ${limitedModules.length} de ${modules.length} módulos. Use os filtros para refinar a visualização.
                        </span>
                    </div>
                </div>
            `;
        }
        
        // Construir HTML de forma mais eficiente
        const headerCells = limitedModules.map(module => 
            `<th class="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase min-w-[120px] bg-gray-100 border-r border-gray-200" title="${module.DESCRICAO}">
                <div class="whitespace-nowrap">
                    <div>${module.NOME}</div>
                    ${module.VERSAO ? `<div class="text-xs text-gray-500 font-normal normal-case mt-1">v${module.VERSAO}</div>` : ''}
                </div>
            </th>`
        ).join('');
        
        const bodyRows = limitedClients.map((client, clientIndex) => {
            const rowClass = clientIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50';
            const cells = limitedModules.map(module => {
                const key = `${client.CLIENTE_ID}-${module.COD_MODULO}`;
                const version = versionMap.get(key);
                
                if (version) {
                    const bgColor = versionColors.get(version);
                    return `<td class="px-2 py-2 text-center text-sm border-r border-gray-100" style="background-color: ${bgColor}"><span class="inline-block px-2 py-1 rounded text-xs font-medium bg-white bg-opacity-80 text-gray-800">${version}</span></td>`;
                } else {
                    return `<td class="px-2 py-2 text-center text-sm bg-gray-50 border-r border-gray-100"><span class="text-gray-400 text-xs">—</span></td>`;
                }
            }).join('');
            
            return `<tr class="${rowClass} hover:bg-blue-50 border-b border-gray-100"><td class="px-4 py-2 text-sm font-medium text-gray-900 sticky left-0 ${rowClass} z-20 border-r-2 border-gray-300 shadow-sm"><div class="whitespace-nowrap font-semibold">${client.NOME}</div></td>${cells}</tr>`;
        }).join('');
        
        container.innerHTML = `
            ${warningHTML}
            <div class="overflow-auto max-h-[500px] border border-gray-200 rounded-lg">
                <table class="min-w-full relative">
                    <thead class="sticky top-0 z-20">
                        <tr class="bg-gray-100 border-b-2 border-gray-300">
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase sticky left-0 bg-gray-100 z-30 border-r-2 border-gray-300 shadow-md">Cliente</th>
                            ${headerCells}
                        </tr>
                    </thead>
                    <tbody class="bg-white">
                        ${bodyRows}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    function setupDashboardFilters(clients, modules, versions) {
        let selectedClients = new Set(clients.map(c => c.CLIENTE_ID));
        let selectedModules = new Set(modules.map(m => m.COD_MODULO));
        
        // Populate client options
        function populateClientOptions(searchTerm = '') {
            const filteredClients = clients.filter(c => 
                c.NOME.toLowerCase().includes(searchTerm.toLowerCase())
            );
            
            const clientOptions = document.getElementById('client-options');
            clientOptions.innerHTML = `
                <div class="mb-2">
                    <label class="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" id="select-all-clients" class="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                        <span class="font-medium text-sm text-gray-700">Selecionar Todos</span>
                    </label>
                </div>
                <div class="border-t border-gray-200 pt-2">
                    ${filteredClients.map(client => `
                        <label class="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input type="checkbox" value="${client.CLIENTE_ID}" class="client-checkbox mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" ${selectedClients.has(client.CLIENTE_ID) ? 'checked' : ''}>
                            <span class="text-sm text-gray-700">${client.NOME}</span>
                        </label>
                    `).join('')}
                </div>
            `;
            
            // Update select all checkbox
            const selectAllClients = document.getElementById('select-all-clients');
            const clientCheckboxes = document.querySelectorAll('.client-checkbox');
            selectAllClients.checked = clientCheckboxes.length > 0 && Array.from(clientCheckboxes).every(cb => cb.checked);
            selectAllClients.indeterminate = Array.from(clientCheckboxes).some(cb => cb.checked) && !selectAllClients.checked;
        }
        
        // Populate module options
        function populateModuleOptions(searchTerm = '') {
            const filteredModules = modules.filter(m => 
                m.NOME.toLowerCase().includes(searchTerm.toLowerCase())
            );
            
            const moduleOptions = document.getElementById('module-options');
            moduleOptions.innerHTML = `
                <div class="mb-2">
                    <label class="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" id="select-all-modules" class="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                        <span class="font-medium text-sm text-gray-700">Selecionar Todos</span>
                    </label>
                </div>
                <div class="border-t border-gray-200 pt-2">
                    ${filteredModules.map(module => `
                        <label class="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input type="checkbox" value="${module.COD_MODULO}" class="module-checkbox mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" ${selectedModules.has(module.COD_MODULO) ? 'checked' : ''}>
                            <span class="text-sm text-gray-700">${module.NOME}</span>
                        </label>
                    `).join('')}
                </div>
            `;
            
            // Update select all checkbox
            const selectAllModules = document.getElementById('select-all-modules');
            const moduleCheckboxes = document.querySelectorAll('.module-checkbox');
            selectAllModules.checked = moduleCheckboxes.length > 0 && Array.from(moduleCheckboxes).every(cb => cb.checked);
            selectAllModules.indeterminate = Array.from(moduleCheckboxes).some(cb => cb.checked) && !selectAllModules.checked;
        }
        
        // Update filter text
        function updateFilterText() {
            const clientText = document.getElementById('client-filter-text');
            const moduleText = document.getElementById('module-filter-text');
            
            if (selectedClients.size === clients.length) {
                clientText.textContent = 'Todos os Clientes';
            } else if (selectedClients.size === 0) {
                clientText.textContent = 'Nenhum Cliente';
            } else {
                clientText.textContent = `${selectedClients.size} Cliente(s)`;
            }
            
            if (selectedModules.size === modules.length) {
                moduleText.textContent = 'Todos os Módulos';
            } else if (selectedModules.size === 0) {
                moduleText.textContent = 'Nenhum Módulo';
            } else {
                moduleText.textContent = `${selectedModules.size} Módulo(s)`;
            }
        }
        
        // Apply filters
        function applyFilters() {
            const filteredClients = clients.filter(c => selectedClients.has(c.CLIENTE_ID));
            const filteredModules = modules.filter(m => selectedModules.has(m.COD_MODULO));
            renderVersionMatrix(filteredClients, filteredModules, versions);
        }
        
        // Initialize
        populateClientOptions();
        populateModuleOptions();
        updateFilterText();
        
        // Event listeners
        document.getElementById('client-filter-btn').addEventListener('click', () => {
            const dropdown = document.getElementById('client-filter-dropdown');
            dropdown.classList.toggle('hidden');
            document.getElementById('module-filter-dropdown').classList.add('hidden');
        });
        
        document.getElementById('module-filter-btn').addEventListener('click', () => {
            const dropdown = document.getElementById('module-filter-dropdown');
            dropdown.classList.toggle('hidden');
            document.getElementById('client-filter-dropdown').classList.add('hidden');
        });
        
        document.getElementById('client-search-input').addEventListener('input', (e) => {
            populateClientOptions(e.target.value);
        });
        
        document.getElementById('module-search-input').addEventListener('input', (e) => {
            populateModuleOptions(e.target.value);
        });
        
        document.getElementById('clear-filters-btn').addEventListener('click', () => {
            selectedClients = new Set(clients.map(c => c.CLIENTE_ID));
            selectedModules = new Set(modules.map(m => m.COD_MODULO));
            populateClientOptions();
            populateModuleOptions();
            updateFilterText();
            applyFilters();
        });
        
        // Debounce function for performance
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        const debouncedApplyFilters = debounce(() => {
            updateFilterText();
            applyFilters();
        }, 150);
        
        // Handle checkbox changes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('client-checkbox')) {
                const clientId = parseInt(e.target.value);
                if (e.target.checked) {
                    selectedClients.add(clientId);
                } else {
                    selectedClients.delete(clientId);
                }
                debouncedApplyFilters();
                populateClientOptions(document.getElementById('client-search-input').value);
            }
            
            if (e.target.classList.contains('module-checkbox')) {
                const moduleCode = e.target.value;
                if (e.target.checked) {
                    selectedModules.add(moduleCode);
                } else {
                    selectedModules.delete(moduleCode);
                }
                debouncedApplyFilters();
                populateModuleOptions(document.getElementById('module-search-input').value);
            }
            
            if (e.target.id === 'select-all-clients') {
                const clientCheckboxes = document.querySelectorAll('.client-checkbox');
                clientCheckboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    const clientId = parseInt(cb.value);
                    if (e.target.checked) {
                        selectedClients.add(clientId);
                    } else {
                        selectedClients.delete(clientId);
                    }
                });
                updateFilterText();
                applyFilters();
            }
            
            if (e.target.id === 'select-all-modules') {
                const moduleCheckboxes = document.querySelectorAll('.module-checkbox');
                moduleCheckboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    const moduleCode = cb.value;
                    if (e.target.checked) {
                        selectedModules.add(moduleCode);
                    } else {
                        selectedModules.delete(moduleCode);
                    }
                });
                updateFilterText();
                applyFilters();
            }
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#client-filter-btn') && !e.target.closest('#client-filter-dropdown')) {
                document.getElementById('client-filter-dropdown').classList.add('hidden');
            }
            if (!e.target.closest('#module-filter-btn') && !e.target.closest('#module-filter-dropdown')) {
                document.getElementById('module-filter-dropdown').classList.add('hidden');
            }
        });
    }
    

    // Interceptar respostas 401 globalmente
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args)
            .then(response => {
                if (response.status === 401) {
                    // Sessão expirada, redirecionar para login
                    showToast('Sessão expirada. Redirecionando...', 'warning');
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 1500);
                    throw new Error('Session expired');
                }
                return response;
            });
    };

    // Verificar se já está autenticado primeiro
    fetch('/api/auth/status')
        .then(response => {
            if (response.status === 401) {
                checkAuthAndInitialize();
                return;
            }
            return response.json();
        })
        .then(data => {
            if (data && data.isAuthenticated) {
                // Usuário já autenticado, inicializar app normalmente
                state.user = data.user;
                userMenu.textContent = `Olá, ${state.user.username}`;
                initializeMainApp();
            } else {
                // Não autenticado, mostrar loading e redirecionar
                checkAuthAndInitialize();
            }
        })
        .catch((error) => {
            if (error.message !== 'Session expired') {
                // Erro na verificação, mostrar loading e redirecionar
                checkAuthAndInitialize();
            }
        });
});

