require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const CustomStrategy = require('passport-custom').Strategy;
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares Essenciais ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Configuração da Sessão ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret_change_this_in_production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 dias
}));

// --- Configuração da Autenticação (Passport.js) ---
app.use(passport.initialize());
app.use(passport.session());

passport.use('custom', new CustomStrategy(
  async (req, done) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return done(null, false, { message: 'User e password são obrigatórios.' });
    }
    try {
      const externalApiUrl = 'https://portal.kmm.com.br/_remote/gateway.php';
      const body = { module: "LOGON", operation: "LOGON", parameters: { username, password, cod_gestao: 9 } };
      const response = await fetch(externalApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};
      if (!response.ok || data.success === false) {
        return done(null, false, { message: data.result?.message || 'Credenciais inválidas.' });
      }
      const result = data.result;
      if (result && result.token) {
        return done(null, { username: username, token: result.token });
      } else {
        return done(null, false, { message: 'Token não recebido do serviço de autenticação.' });
      }
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => { done(null, user); });
passport.deserializeUser((user, done) => { done(null, user); });

// --- Middleware de Proteção ---
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
        return res.status(401).json({ error: 'Não autorizado. Por favor, faça o login novamente.' });
    }
    res.redirect('/login.html');
}

// --- Rotas Básicas (sem Oracle) ---
app.use(express.static(path.join(__dirname, 'public')));

// Rota de teste
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Container funcionando sem Oracle'
    });
});

// Rota de login básica
app.post('/api/auth/login', passport.authenticate('custom'), (req, res) => {
    res.json({ success: true, user: req.user });
});

app.get('/api/auth/status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ isAuthenticated: true, user: req.user });
    } else {
        res.json({ isAuthenticated: false });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.logout(() => {
        res.json({ success: true });
    });
});

// Rotas temporárias sem Oracle
app.get('/api/projects', (req, res) => {
    res.json([
        { id: 1, name: 'Projeto Teste', slug: 'projeto-teste', cod_modulo: 'TEST001' }
    ]);
});

app.get('/api/specs', (req, res) => {
    res.json([
        { id: 1, name: 'API Teste', yaml: 'openapi: 3.0.0\ninfo:\n  title: Test API\n  version: 1.0.0\npaths:' }
    ]);
});

app.get('/docs/:slug?', (req, res) => {
    res.send(`
        <html>
            <head><title>Documentação</title></head>
            <body>
                <h1>Documentação - ${req.params.slug || 'Geral'}</h1>
                <p>Container funcionando! Oracle será configurado posteriormente.</p>
            </body>
        </html>
    `);
});

// --- Arranque do Servidor (sem Sequelize) ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 Docs: http://localhost:${PORT}/docs`);
    console.log(`🚀 Container iniciado com sucesso!`);
});
