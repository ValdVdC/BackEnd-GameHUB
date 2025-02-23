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
      const GAME_LIMIT = 500;
      const BATCH_SIZE = 200;
      const cacheKey = `popular_games_${GAME_LIMIT}`;
      
      if (gameCache.get(cacheKey)) return res.status(200).json(gameCache.get(cacheKey));

    //Buscar IDs por popularidade
        const orderedIds = await fetchWithFallback(
            async () => {
                const popular_games = await igdbApi.getPopularityPrimitives(
                    `fields game_id; limit ${GAME_LIMIT}; where popularity_type = 3; sort value desc;`
                );
                return popular_games.data.map(g => g.game_id);
            },
            async () => {
                const games = await igdbApi.getGames(
                    `fields id; sort total_rating desc; limit ${GAME_LIMIT};`,
                );
                return games.data.map(g => g.id);
            }
        );

        //Buscar detalhes EM BATCHES
        const batches = [];
        for (let i = 0; i < orderedIds.length; i += BATCH_SIZE) {
            const batchIds = orderedIds.slice(i, i + BATCH_SIZE);
            const games = await igdbApi.getGames(
                `fields name, genres, total_rating, cover, url; 
                where id = (${batchIds.join(',')}); 
                limit ${BATCH_SIZE};`,
            );
            batches.push(...games.data);
        }

        //Ordenação para manter a ordem original
        const idIndexMap = new Map();
        orderedIds.forEach((id, index) => idIndexMap.set(id, index));

        const orderedGames = batches
            .filter(game => idIndexMap.has(game.id)) // Remove jogos não encontrados
            .sort((a, b) => idIndexMap.get(a.id) - idIndexMap.get(b.id));

        //Processar e cachear
        const processedGames = await processGames(orderedGames);
        gameCache.set(cacheKey, processedGames);

        res.status(200).json(processedGames);

    } catch (error) {
        console.error('Erro ao buscar dados: ', error.message);
        
        // Tratamento de erro mais detalhado
        if (error.response) {
            // Erro com resposta do servidor
            res.status(error.response.status).json({ 
                error: 'Erro ao buscar dados IGDB',
                details: error.response.data 
            });
        } else {
            // Erro sem resposta (ex: erro de rede)
            res.status(500).json({ error: 'Erro de conexão' });
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