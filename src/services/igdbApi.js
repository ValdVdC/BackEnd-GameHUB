const axios = require('../config/axios');
const API_URL = 'https://api.igdb.com/v4/';

// Configuração básica para todas as requisições
const getHeaders = () => ({
  'Client-ID': process.env.CLIENT_ID,
  'Authorization': `Bearer ${process.env.AUTH_TOKEN}`,
  'Content-Type': 'text/plain'
});

// Função genérica para realizar chamadas à API
const apiRequest = async (endpoint, query) => {
  try {
    const response = await axios.post(
      `${API_URL}${endpoint}`, 
      query, 
      { headers: getHeaders() }
    );
    return response;
  } catch (error) {
    console.error(`Erro na chamada à API (${endpoint}):`, error.message);
    throw error;
  }
};

module.exports = {
  // Função genérica que pode ser usada para qualquer endpoint
  request: (endpoint, query) => apiRequest(endpoint, query),
  
  // Mantendo as funções específicas para compatibilidade com o código existente
  getPopularityPrimitives: (query) => apiRequest('popularity_primitives', query),
  getGames: (query) => apiRequest('games', query),
  getCovers: (query) => apiRequest('covers', query),
  getGenres: (query) => apiRequest('genres', query),
  getGameVideos: (query) => apiRequest('game_videos', query),
  getReleaseDates: (query) => apiRequest('release_dates', query),
  getPlatforms: (query) => apiRequest('platforms', query),
  getPlatformLogos: (query) => apiRequest('platform_logos', query),
  getThemes: (query) => apiRequest('themes', query),
  getGameModes: (query) => apiRequest('game_modes', query),
  getGameTypes: (query) => apiRequest('game_types', query)
};