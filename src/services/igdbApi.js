const axios = require('../config/axios');
const API_URL = 'https://api.igdb.com/v4/';

const getHeaders = () => ({
  'Client-ID': process.env.CLIENT_ID,
  'Authorization': `Bearer ${process.env.AUTH_TOKEN}`,
  'Content-Type': 'text/plain'
});

module.exports = {
  getPopularityPrimitives: (query) => 
    axios.post(`${API_URL}popularity_primitives`, query, { headers: getHeaders() }),
  
  getGames: (query) => 
    axios.post(`${API_URL}games`, query, { headers: getHeaders() }),
  
  getCovers: (query) => 
    axios.post(`${API_URL}covers`, query, { headers: getHeaders() }),
  
  getGenres: (query) => 
    axios.post(`${API_URL}genres`, query, { headers: getHeaders() }),
  
  getGameVideos: (query) => 
    axios.post(`${API_URL}game_videos`, query, { headers: getHeaders() }),
  
  getReleaseDates: (query) => 
    axios.post(`${API_URL}release_dates`, query, { headers: getHeaders() }),
  
  getPlatforms: (query) => 
    axios.post(`${API_URL}platforms`, query, { headers: getHeaders() }),
  
  getPlatformLogos: (query) => 
    axios.post(`${API_URL}platform_logos`, query, { headers: getHeaders() })
};