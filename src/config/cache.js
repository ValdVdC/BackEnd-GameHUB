const NodeCache = require('node-cache');

const gameCache = new NodeCache({ 
  stdTTL: 3600,
  checkperiod: 600
});

const genreCache = new NodeCache({ 
  stdTTL: 3600,
  checkperiod: 600
});

module.exports = { gameCache, genreCache };