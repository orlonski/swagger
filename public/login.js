document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    // Verificar se o usuario já está logado
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

        const username = e.target.username.value;
        const password = e.target.password.value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                window.location.href = '/';
            } else {
                errorMessage.textContent = 'Usuario ou senha inválidos.';
            }
        } catch (error) {
            errorMessage.textContent = 'Erro de rede. Tente novamente.';
        }
    });
});

