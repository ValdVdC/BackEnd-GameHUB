const express = require('express');

const keepAliveMiddleware = (req, res, next) => {
    // Reset do timer de inatividade a cada requisição
    if (global.inactivityTimeout) {
        clearTimeout(global.inactivityTimeout);
    }
    
    // Define novo timer
    global.inactivityTimeout = setTimeout(() => {
        console.log('Servidor mantendo-se ativo...');
        // Faz uma requisição para si mesmo para manter ativo
        fetch(process.env.SELF_URL || `http://localhost:${process.env.PORT || 3000}/health`)
            .catch(err => console.error('Erro no keep-alive:', err));
    }, 840000); // 14 minutos

    next();
};

// Rota de health check
const healthRouter = express.Router();
healthRouter.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = { keepAliveMiddleware, healthRouter };