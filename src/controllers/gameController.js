const { gameCache, genreCache } = require('../config/cache');
const igdbApi = require('../services/igdbApi');
const { 
  fetchWithFallback,
  processGames,
  processGenreBatch,
  enrichGameDetails,
  EnrichmentLevel
} = require('../utils/helpers');

module.exports = {
    getPopularGames: async (req, res) => {
        try {
          // Extract pagination parameters from request
          const page = parseInt(req.query.page) || 1;
          const pageSize = parseInt(req.query.pageSize) || 200;
          const offset = (page - 1) * pageSize;
          
          // Generate a unique cache key that includes pagination info
          const cacheKey = `popular_games_${pageSize}_${page}`;
          
          // Check if we have this page cached
          if (gameCache.get(cacheKey)) {
            return res.status(200).json({
              games: gameCache.get(cacheKey),
              pagination: {
                currentPage: page,
                pageSize: pageSize,
                hasMore: true // We'll always assume there might be more unless we hit an empty result
              }
            });
          }
    
          // Fetch game IDs with pagination
          const orderedIds = await fetchWithFallback(
            async () => {
              const popular_games = await igdbApi.getPopularityPrimitives(
                `fields game_id; 
                 limit ${pageSize}; 
                 offset ${offset};
                 where popularity_type = 3; 
                 sort value desc;`
              );
              return popular_games.data.map(g => g.game_id);
            },
            async () => {
              const games = await igdbApi.getGames(
                `fields id; 
                 sort total_rating desc; 
                 limit ${pageSize}; 
                 offset ${offset};`
              );
              return games.data.map(g => g.id);
            }
          );
    
          // If no games found for this page, return appropriate response
          if (!orderedIds.length) {
            return res.status(200).json({
              games: [],
              pagination: {
                currentPage: page,
                pageSize: pageSize,
                hasMore: false
              }
            });
          }
    
          // Fetch game details in batches
          const BATCH_SIZE = 200;
          const batches = [];
          for (let i = 0; i < orderedIds.length; i += BATCH_SIZE) {
            const batchIds = orderedIds.slice(i, i + BATCH_SIZE);
            const games = await igdbApi.getGames(
              `fields name, genres, total_rating, cover, url; 
               where id = (${batchIds.join(',')}); 
               limit ${BATCH_SIZE};`
            );
            batches.push(...games.data);
          }
    
          // Maintain original order
          const idIndexMap = new Map();
          orderedIds.forEach((id, index) => idIndexMap.set(id, index));
    
          const orderedGames = batches
            .filter(game => idIndexMap.has(game.id))
            .sort((a, b) => idIndexMap.get(a.id) - idIndexMap.get(b.id));
    
          // Process and cache the results
          const processedGames = await processGames(orderedGames);
          gameCache.set(cacheKey, processedGames);
    
          // Return paginated response
          res.status(200).json({
            games: processedGames,
            pagination: {
              currentPage: page,
              pageSize: pageSize,
              hasMore: processedGames.length === pageSize // If we got a full page, there might be more
            }
          });
    
        } catch (error) {
          console.error('Error fetching data: ', error.message);
          
          if (error.response) {
            res.status(error.response.status).json({ 
              error: 'Error fetching IGDB data',
              details: error.response.data 
            });
          } else {
            res.status(500).json({ error: 'Connection error' });
          }
        }
      },

  getGamesByGenre: async (req, res) => {
    try {
            const cachedGamesByGenre = genreCache.get('genres_games');
            if (cachedGamesByGenre) {
                return res.status(200).json(cachedGamesByGenre);
            }
    
            const genresQuery = 'fields id, name; limit 25;';
            const genresResponse = await igdbApi.getGenres(genresQuery);
    
            if (!genresResponse.data?.length) {
                return res.status(404).json({ error: 'Nenhum gênero encontrado' });
            }
    
            const gamesByGenre = await processGenreBatch(genresResponse.data);
            const filteredGames = gamesByGenre.filter(item => item.status === 'fulfilled');
    
            genreCache.set('genres_games', filteredGames);
    
            res.status(200).json(filteredGames);
        } catch (error) {
            console.error('Erro ao buscar gêneros:', error);
            res.status(500).json({ error: 'Erro ao buscar dados IGDB' });
        }
  },

  searchGames: async (req, res) => {
    try {
      const gameName = req.params.name;
      const gameQuery = `
        fields name, genres, cover, total_rating;
        sort total_rating desc;
        where (name ~ "${gameName}"*)|(name ~ *"${gameName}")|(name ~ *"${gameName}"*);
        limit 32;
      `;

      const games = await igdbApi.getGames(gameQuery);

      if (!games.data?.length) {
        return res.status(404).json({ error: 'Nenhum jogo encontrado' });
      }

      const enrichedGames = await Promise.all(
        games.data.map(game => enrichGameDetails(game, EnrichmentLevel.BASIC))
      );

      res.status(200).json(enrichedGames);
    } catch (error) {
      console.error('Erro na busca de jogos:', error);
      res.status(500).json({ error: 'Erro ao buscar jogos' });
    }
  },

  getGameDetails: async (req, res) => {
    try {
            const gameId = req.params.id;
            
            if (isNaN(Number(gameId))) {
                return res.status(400).json({ error: 'ID do jogo inválido' });
            }

            const gameQuery = `
                fields name, genres, cover, storyline, summary, url, total_rating, platforms, videos, themes; 
                where id = ${gameId};
            `;

            const gameResponse = await igdbApi.getGames(gameQuery);

            if (!gameResponse.data?.length) {
                return res.status(404).json({ error: 'Jogo não encontrado' });
            }

            // Enriquecer com dados detalhados
            const gameDetails = await enrichGameDetails(gameResponse.data[0], EnrichmentLevel.DETAILED);
            res.status(200).json(gameDetails);
        } catch (error) {
            console.error('Erro ao buscar detalhes do jogo:', error);
            res.status(500).json({ error: 'Erro ao buscar detalhes do jogo' });
        }
    }
};