// Adicione no TOPO do arquivo:
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Ajuste o caminho se necessário

const app = require('./app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});