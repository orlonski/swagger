require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const CustomStrategy = require('passport-custom').Strategy;
const PgStore = require('connect-pg-simple')(session);
const fetch = require('node-fetch');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares Essenciais ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Configuração da Sessão ---
app.use(session({
  store: new PgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
  }),
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
      return done(null, false, { message: 'Utilizador e password são obrigatórios.' });
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

// --- Definição das Rotas ---
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const docsRoutes = require('./routes/docs');

// Rotas Públicas (disponíveis antes do login)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);
app.use('/docs', docsRoutes);

// Rotas Protegidas (disponíveis apenas após o login)
app.get('/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use('/api', isAuthenticated, apiRoutes);

// --- Arranque do Servidor ---
sequelize.sync().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor a funcionar na porta ${PORT}`);
    });
}).catch(err => {
    console.error('Não foi possível ligar à base de dados:', err);
});

