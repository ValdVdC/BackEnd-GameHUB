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
          // Verificar o cache primeiro
          const cachedGamesByGenre = genreCache.get('genres_games');
          if (cachedGamesByGenre) {
            return res.status(200).json(cachedGamesByGenre);
          }
      
          // Obter gêneros
          const genresQuery = 'fields id, name; limit 25;';
          const genresResponse = await igdbApi.getGenres(genresQuery);
      
          if (!genresResponse.data?.length) {
            return res.status(404).json({ error: 'Nenhum gênero encontrado' });
          }
      
          // Buscar jogos populares primeiro
          const POPULAR_GAMES_LIMIT = 500; // Aumentar limite para ter mais opções de filtro
          
          // Criar um mapa para armazenar os valores de popularidade
          const popularityMap = new Map();
          
          // Buscar lista de jogos populares com seus valores de popularidade
          const popularGamesData = await fetchWithFallback(
            async () => {
              const popular_games = await igdbApi.getPopularityPrimitives(
                `fields game_id, value; 
                 limit ${POPULAR_GAMES_LIMIT}; 
                 where popularity_type = 3; 
                 sort value desc;`
              );
              // Armazenar os valores de popularidade no mapa
              popular_games.data.forEach(item => {
                popularityMap.set(item.game_id, item.value);
              });
              return popular_games.data.map(g => g.game_id);
            },
            async () => {
              const games = await igdbApi.getGames(
                `fields id, total_rating; 
                 sort total_rating desc; 
                 limit ${POPULAR_GAMES_LIMIT};`
              );
              // Se usarmos o fallback, usamos o total_rating como substituto para o valor de popularidade
              games.data.forEach(item => {
                popularityMap.set(item.id, item.total_rating || 0);
              });
              return games.data.map(g => g.id);
            }
          );
      
          // Extrair apenas os IDs para uso posterior
          const popularGamesIds = popularityMap.size > 0 ? 
            Array.from(popularityMap.keys()) : 
            [];
      
          // Se não encontrou jogos populares, usar abordagem antiga
          if (!popularGamesIds.length) {
            const gamesByGenre = await processGenreBatch(genresResponse.data);
            const filteredGames = gamesByGenre.filter(item => item.status === 'fulfilled');
            genreCache.set('genres_games', filteredGames);
            return res.status(200).json(filteredGames);
          }
      
          // Buscar detalhes dos jogos populares em batches
          const BATCH_SIZE = 200;
          const popularGamesBatches = [];
          
          for (let i = 0; i < popularGamesIds.length; i += BATCH_SIZE) {
            const batchIds = popularGamesIds.slice(i, i + BATCH_SIZE);
            const gamesDetails = await igdbApi.getGames(
              `fields name, genres.name, total_rating, cover.url, id, url; 
               where id = (${batchIds.join(',')}); 
               limit ${BATCH_SIZE};`
            );
            popularGamesBatches.push(...gamesDetails.data);
          }
      
          // Processar detalhes para facilitar a filtragem
          const processedGames = popularGamesBatches.map(game => {
            return {
              id: game.id,
              name: game.name,
              genres: game.genres ? game.genres.map(g => g.name) : [],
              cover_url: game.cover ? game.cover.url.replace('t_thumb', 't_cover_big') : null,
              total_rating: game.total_rating || 0,
              // Incluir o valor de popularidade no objeto do jogo
              popularity_value: popularityMap.get(game.id) || 0
            };
          });
      
          // Criar um mapa de gêneros para jogos populares
          const genreMap = {};
          genresResponse.data.forEach(genre => {
            genreMap[genre.name] = [];
          });
      
          // Filtrar jogos por gênero
          processedGames.forEach(game => {
            game.genres.forEach(genreName => {
              if (genreMap[genreName]) {  // Removida a verificação de comprimento
                // Verificar apenas se o jogo já existe neste gênero (evitar duplicatas)
                if (!genreMap[genreName].some(existingGame => existingGame.id === game.id)) {
                  genreMap[genreName].push(game);
                }
              }
            });
          });
      
          // Converter o mapa em array de resultados
          const result = Object.entries(genreMap).map(([genreName, games]) => {
            const genre = genresResponse.data.find(g => g.name === genreName);
            
            // Ordenar jogos por valor de popularidade dentro de cada gênero
            const sortedGames = games.sort((a, b) => b.popularity_value - a.popularity_value);
            
            return {
              id: genre ? genre.id : null,
              value: {
                genre: genreName,
                games: sortedGames
              },
              status: 'fulfilled'
            };
          });
      
          // Filtrar para garantir que apenas categorias com jogos sejam retornadas
          const filteredResult = result.filter(item => item.value.games.length > 0);
      
          // Armazenar em cache
          genreCache.set('genres_games', filteredResult);
      
          // Retornar resultado
          res.status(200).json(filteredResult);
        } catch (error) {
          console.error('Erro ao buscar gêneros:', error);
          res.status(500).json({ error: 'Erro ao buscar dados IGDB' });
        }
      },

      searchGames: async (req, res) => {
        try {
          const gameName = req.params.name;
          const page = parseInt(req.query.page) || 1;
          const pageSize = parseInt(req.query.pageSize) || 500;
          const offset = (page - 1) * pageSize;
          
          // Gerar chave de cache para esta busca específica
          const cacheKey = `search_${gameName}_${pageSize}_${page}`;
          
          // Verificar cache primeiro
          if (gameCache.get(cacheKey)) {
            return res.status(200).json({
              games: gameCache.get(cacheKey),
              pagination: {
                currentPage: page,
                pageSize: pageSize,
                hasMore: true // Assumimos que pode haver mais resultados
              }
            });
          }
      
          // Buscar IDs dos jogos que correspondem à pesquisa
          const searchQuery = `
            fields id;
            sort total_rating desc;
            where (name ~ "${gameName}"*)|(name ~ *"${gameName}")|(name ~ *"${gameName}"*);
            limit ${pageSize};
            offset ${offset};
          `;
      
          const searchResults = await igdbApi.getGames(searchQuery);
          
          if (!searchResults.data?.length) {
            return res.status(200).json({
              games: [],
              pagination: {
                currentPage: page,
                pageSize: pageSize,
                hasMore: false
              }
            });
          }
          
          // Extrair IDs dos jogos encontrados
          const gameIds = searchResults.data.map(game => game.id);
          
          // Buscar valores de popularidade para os jogos encontrados
          const popularityMap = new Map();
          
          try {
            const popularityQuery = `
              fields game_id, value;
              where game_id = (${gameIds.join(',')}) & popularity_type = 3;
              limit ${gameIds.length};
            `;
            
            const popularityResult = await igdbApi.getPopularityPrimitives(popularityQuery);
            
            // Mapear valores de popularidade por ID do jogo
            popularityResult.data.forEach(item => {
              popularityMap.set(item.game_id, item.value);
            });
          } catch (error) {
            console.warn('Erro ao buscar popularity_primitives:', error.message);
            // Continuar mesmo sem os dados de popularidade
          }
          
          // Buscar detalhes completos dos jogos em batches
          const BATCH_SIZE = 200;
          const gameDetailsBatches = [];
          
          for (let i = 0; i < gameIds.length; i += BATCH_SIZE) {
            const batchIds = gameIds.slice(i, i + BATCH_SIZE);
            
            const detailsQuery = 
            `fields name, genres.name, total_rating, cover.url, id, url;
            where id = (${batchIds.join(',')});
            limit ${BATCH_SIZE};
            `;
            
            const gamesDetails = await igdbApi.getGames(detailsQuery);
            gameDetailsBatches.push(...gamesDetails.data);
          }
          
          // Processar e enriquecer os detalhes dos jogos

          const processedGames = gameDetailsBatches.map(game => {
            return {
              id: game.id,
              name: game.name,
              genres: game.genres ? game.genres.map(g => g.name) : [],
              cover_url: game.cover ? game.cover.url.replace('t_thumb', 't_cover_big') : null,
              total_rating: game.total_rating || 0,
              // Incluir o valor de popularidade no objeto do jogo
              popularity_value: popularityMap.get(game.id) || 0
            };
          });

          // Manter a ordem original dos resultados da busca
          const orderedResults = [];
          gameIds.forEach(id => {
            const game = processedGames.find(g => g.id === id);
            if (game) orderedResults.push(game);
          });
          
          // Cachear os resultados
          gameCache.set(cacheKey, orderedResults);
          
          // Retornar resultados paginados
          res.status(200).json({
            games: orderedResults,
            pagination: {
              currentPage: page,
              pageSize: pageSize,
              hasMore: orderedResults.length === pageSize // Se temos uma página completa, pode haver mais
            }
          });
          
        } catch (error) {
          console.error('Erro na busca de jogos:', error);
          
          if (error.response) {
            res.status(error.response.status).json({ 
              error: 'Erro ao buscar dados IGDB',
              details: error.response.data 
            });
          } else {
            res.status(500).json({ error: 'Erro de conexão' });
          }
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