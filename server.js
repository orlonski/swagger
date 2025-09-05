require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const CustomStrategy = require('passport-custom').Strategy;
const fetch = require('node-fetch');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares Essenciais ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Configuração da Sessão (sem PostgreSQL) ---
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

// --- Middleware de Proteção Robusto ---
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    
    // Para requisições AJAX/API
    if (req.xhr || req.headers['accept']?.includes('application/json') || req.path.startsWith('/api/')) {
        return res.status(401).json({ 
            error: 'Sessão expirada ou não autorizado', 
            code: 'UNAUTHORIZED',
            redirect: '/login'
        });
    }
    
    // Para requisições de página
    res.redirect('/login');
}

// Middleware para validar token se presente
function validateToken(req, res, next) {
    if (req.isAuthenticated() && req.user?.token) {
        // TODO: Implementar validação do token com API externa se necessário
        return next();
    }
    return isAuthenticated(req, res, next);
}

// Middleware para logging de acesso
function logAccess(req, res, next) {
    const timestamp = new Date().toISOString();
    const user = req.user?.username || 'anonymous';
    console.log(`[${timestamp}] ${req.method} ${req.path} - User: ${user}`);
    next();
}

// --- Definição das Rotas ---
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const docsRoutes = require('./routes/docs');

// Middleware global de logging
app.use(logAccess);

// Rotas Públicas (disponíveis antes do login)
app.use('/api/auth', authRoutes);
app.use('/docs', docsRoutes);

// Rotas de login com URL limpa
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/login.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.js'));
});

// Proteção da página principal
app.get('/', validateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Proteção de arquivos estáticos sensíveis
app.get('/app.js', validateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.js'));
});
app.get('/index.html', validateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Outros arquivos estáticos (CSS, imagens, etc.) - públicos
app.use(express.static(path.join(__dirname, 'public'), {
    index: false // Impede servir index.html automaticamente
}));

// Rotas de API protegidas
app.use('/api', validateToken, apiRoutes);

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
    console.error(err.stack);
    
    if (req.xhr || req.headers['accept']?.includes('application/json')) {
        res.status(500).json({ 
            error: 'Erro interno do servidor', 
            code: 'INTERNAL_ERROR'
        });
    } else {
        res.status(500).send('Erro interno do servidor');
    }
});

// Middleware para rotas não encontradas
app.use((req, res) => {
    if (req.xhr || req.headers['accept']?.includes('application/json')) {
        res.status(404).json({ 
            error: 'Rota não encontrada', 
            code: 'NOT_FOUND'
        });
    } else {
        // Redirecionar para login em caso de rota não encontrada
        res.redirect('/login');
    }
});

// --- Arranque do Servidor ---
sequelize.sync().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}).catch(err => {
    console.error('Não foi possível conectar à base de dados:', err);
});

