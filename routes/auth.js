const express = require('express');
const passport = require('passport');
const router = express.Router();

// Rota de Login que usa a estratégia 'custom'
router.post('/login', passport.authenticate('custom'), (req, res) => {
    res.status(200).json({ success: true, message: 'Login bem-sucedido.' });
});

// Rota de Logout
router.post('/logout', (req, res, next) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        req.session.destroy(() => {
            res.status(200).json({ success: true, message: 'Logout bem-sucedido.' });
        });
    });
});

// Rota para verificar o estado da autenticação
router.get('/status', (req, res) => {
    if (req.isAuthenticated() && req.user) {
        res.json({ isAuthenticated: true, user: { username: req.user.username } });
    } else {
        res.json({ isAuthenticated: false });
    }
});

module.exports = router;

