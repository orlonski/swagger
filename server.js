const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir a pasta 'public' como estática
app.use(express.static(path.join(__dirname, 'public')));

// Rotas
const apiRoutes = require('./routes/api');
const docsRoutes = require('./routes/docs');
app.use('/api', apiRoutes);
app.use('/docs', docsRoutes);

// Rota principal que serve a interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Sincronizar a base de dados e iniciar o servidor
sequelize.sync().then(() => {
    app.listen(PORT, () => {
        console.log(`--- SUCESSO ---`);
        console.log(`Servidor a funcionar na porta ${PORT}`);
        console.log(`Aceda à aplicação em http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('--- ERRO FATAL ---');
    console.error('Não foi possível ligar ou sincronizar a base de dados:', err);
});

