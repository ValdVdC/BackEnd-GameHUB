const { getTaxonomyCache } = require('../services/taxonomy');

module.exports = {
  getGenres: (req, res) => {
    try {
      const taxonomyCache = getTaxonomyCache();
      res.json(taxonomyCache.genres);
    } catch (error) {
      console.error('Erro ao buscar gêneros:', error);
      res.status(500).json({ error: 'Erro interno ao buscar gêneros' });
    }
  },

  getGameTypes: (req, res) => {
    try {
      const taxonomyCache = getTaxonomyCache();
      res.json(taxonomyCache.gameTypes);
    } catch (error) {
      console.error('Erro ao buscar tipos de jogos:', error);
      res.status(500).json({ error: 'Erro interno ao buscar tipos de jogos' });
    }
  },

  getPlatforms: (req, res) => {
    try {
      const taxonomyCache = getTaxonomyCache();
      res.json(taxonomyCache.platforms);
    } catch (error) {
      console.error('Erro ao buscar plataformas:', error);
      res.status(500).json({ error: 'Erro interno ao buscar plataformas' });
    }
  },

  getThemes: (req, res) => {
    try {
      const taxonomyCache = getTaxonomyCache();
      res.json(taxonomyCache.themes);
    } catch (error) {
      console.error('Erro ao buscar temas:', error);
      res.status(500).json({ error: 'Erro interno ao buscar temas' });
    }
  },

  getGameModes: (req, res) => {
    try {
      const taxonomyCache = getTaxonomyCache();
      res.json(taxonomyCache.gameModes);
    } catch (error) {
      console.error('Erro ao buscar modos de jogo:', error);
      res.status(500).json({ error: 'Erro interno ao buscar modos de jogo' });
    }
  }
};