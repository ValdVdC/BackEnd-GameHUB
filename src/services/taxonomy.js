const igdbApi = require('../services/igdbApi');

let taxonomyCache = {
  gameTypes: {},
  genres: {},
  platforms: {},
  themes: {},
  gameModes: {}
};

async function initializeTaxonomies() {
  try {
    console.log('Inicializando taxonomias...');
    
    // Carregar todos os game_types - normalmente são poucos, então podemos pegar todos
    const gameTypesResponse = await igdbApi.getGameTypes('fields id, type; limit 500;');
    taxonomyCache.gameTypes = gameTypesResponse.data.reduce((acc, type) => {
      acc[type.id] = type.type;
      return acc;
    }, {});
    
    // Carregar todos os gêneros
    const genresResponse = await igdbApi.getGenres('fields id, name; limit 500;');
    taxonomyCache.genres = genresResponse.data.reduce((acc, genre) => {
      acc[genre.id] = genre.name;
      return acc;
    }, {});
    
    // Carregar temas
    const themesResponse = await igdbApi.getThemes('fields id, name; limit 500;');
    taxonomyCache.themes = themesResponse.data.reduce((acc, theme) => {
      acc[theme.id] = theme.name;
      return acc;
    }, {});
    
    // Carregar modos de jogo
    const gameModesResponse = await igdbApi.getGameModes('fields id, name; limit 500;');
    taxonomyCache.gameModes = gameModesResponse.data.reduce((acc, mode) => {
      acc[mode.id] = mode.name;
      return acc;
    }, {});
    
    // Carregar plataformas - pode haver muitas, mas ainda é uma taxonomia estável
    const platformsResponse = await igdbApi.getPlatforms('fields id, name; limit 500;');
    taxonomyCache.platforms = platformsResponse.data.reduce((acc, platform) => {
      acc[platform.id] = platform.name;
      return acc;
    }, {});
    
    console.log('Taxonomias inicializadas com sucesso!');
    console.log(`Game Types carregados: ${Object.keys(taxonomyCache.gameTypes).length}`);
    console.log(`Gêneros carregados: ${Object.keys(taxonomyCache.genres).length}`);
    // Imprimir estatísticas de outras taxonomias...
    
    return true;
  } catch (error) {
    console.error('Erro ao inicializar taxonomias:', error);
    return false;
  }
}

function getTaxonomyCache() {
  return taxonomyCache;
}

module.exports = {
  initializeTaxonomies,
  getTaxonomyCache
};