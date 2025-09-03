document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');
    const loginSpinner = document.getElementById('login-spinner');
    const loginText = document.getElementById('login-text');

    // Função para ativar o estado de "a carregar"
    const startLoading = () => {
        loginButton.disabled = true;
        loginSpinner.classList.remove('hidden');
        loginText.textContent = 'Aguarde...';
    };

    // Função para desativar o estado de "a carregar"
    const stopLoading = () => {
        loginButton.disabled = false;
        loginSpinner.classList.add('hidden');
        loginText.textContent = 'Entrar';
    };

    // Verificar se o utilizador já está logado
    fetch('/api/auth/status')
        .then(res => res.json())
        .then(data => {
            if (data.isAuthenticated) {
                window.location.href = '/';
            }
        });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessage.textContent = '';
        startLoading();

        const username = e.target.username.value;
        const password = e.target.password.value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                // Em caso de sucesso, o redirecionamento irá acontecer,
                // mas mudamos o texto para dar feedback final.
                loginText.textContent = 'Sucesso!';
                window.location.href = '/';
            } else {
                errorMessage.textContent = 'Username ou senha inválidos.';
                stopLoading(); // Para o loading em caso de falha
            }
        } catch (error) {
            errorMessage.textContent = 'Erro de rede. Tente novamente.';
            stopLoading(); // Para o loading em caso de erro
        }
    });
});

