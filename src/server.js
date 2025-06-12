// Adicione no TOPO do arquivo:
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Ajuste o caminho se necessário

const app = require('./app');
const { initializeTaxonomies } = require('./services/taxonomy');

async function startServer() {
  try {
    // Inicializar cache de taxonomias
    await initializeTaxonomies();
    
    // Iniciar o servidor
    const PORT = process.env.PORT;
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();