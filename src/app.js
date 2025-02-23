const express = require('express');
const app = express();

// Configurações
require('./config/cache'); // Se for usar DB futuramente
const corsConfig = require('./config/cors');
const { keepAliveMiddleware, healthRouter } = require('./middleware/keepAlive');

// Middlewares
app.use(corsConfig);

app.use(express.json());

app.use(keepAliveMiddleware);

// Rotas
app.use('/health', healthRouter);
app.use('/api/games', require('./routes/games'));


module.exports = app;