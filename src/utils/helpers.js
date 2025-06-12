const igdbApi = require('../services/igdbApi');
const { getTaxonomyCache } = require('../services/taxonomy');

const EnrichmentLevel = {
  BASIC: 'basic',
  DETAILED: 'detailed'
};

async function fetchWithFallback(primaryFetch, fallbackFetch) {
  try {
    return await primaryFetch();
  } catch (error) {
    if (!error.response || error.response.status !== 429) {
      console.error('Erro na busca principal:', error);
      return await fallbackFetch();
    }
    throw error;
  }
}

async function processGames(games, includeCovers = true) {
    // Processamento de capas permanece o mesmo
    const coverIds = games
        .map(game => game.cover)
        .filter(cover => cover);

    const coversQuery = `fields image_id; where id = (${coverIds.join(',')}); limit ${coverIds.length};`;
    
    const covers = await igdbApi.getCovers(coversQuery);

    const coverMap = {};
    covers.data.forEach(cover => {
        coverMap[cover.id] = `https://images.igdb.com/igdb/image/upload/t_1080p/${cover.image_id}.jpg`;
    });

    // Obter cache de taxonomias
    const taxonomyCache = getTaxonomyCache();
    
    // Usar o cache de taxonomias para mapear os dados
    return games.map(game => ({
        ...game,
        platforms: game.platforms ? game.platforms.map(platformId => 
            taxonomyCache.platforms[platformId] || `Platform ${platformId}`
        ) : [],
        genres: game.genres ? game.genres.map(genreId => 
            taxonomyCache.genres[genreId] || `Genre ${genreId}`
        ) : [],
        themes: game.themes ? game.themes.map(themeId => 
            taxonomyCache.themes[themeId] || `Theme ${themeId}`
        ) : [],
        game_modes: game.game_modes ? game.game_modes.map(gameModeId => 
            taxonomyCache.gameModes[gameModeId] || `Game Mode ${gameModeId}`
        ) : [],
        game_type: taxonomyCache.gameTypes[game.game_type] || 
            (game.game_type !== undefined ? `Game Type ${game.game_type}` : null),
        cover_url: includeCovers && game.cover ? coverMap[game.cover] : null
    }));
}

async function processGenreBatch(genres, batchSize = 500) {
  return await Promise.allSettled(genres.map(async genre => {
          try {
              const gamesQuery = `
              fields name, genres, total_rating, cover.image_id; 
              where genres = (${genre.id}) & total_rating != null;
              sort total_rating desc;
              limit ${batchSize};
              `.trim();
  
              const response = await igdbApi.getGames(gamesQuery);
  
              const games = response.data.map(game => ({
                  ...game,
                  cover_url: game.cover 
                      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
                      : null
              }));
  
              return { status: 'fulfilled', genre: genre.name, games };
          } catch (error) {
              console.error(`Erro ao buscar jogos do gênero ${genre.name}:`, error.message);
              return { status: 'rejected', genre: genre.name, games: [] };
          }
      }));
}

async function enrichGameDetails(game, level = EnrichmentLevel.BASIC) {
    try {
        // Definir quais dados buscar baseado no nível
        const enrichments = [];

        // Dados básicos (sempre incluídos)
        if (game.cover) {
            enrichments.push(fetchCover(game.cover));
        }
        if (game.genres?.length) {
            enrichments.push(fetchGenres(game.genres));
        }

        // Dados detalhados (apenas para nível DETAILED)
        if (level === EnrichmentLevel.DETAILED) {
            if (game.videos?.length) {
                enrichments.push(fetchVideos(game.videos));
            }
            if (game.id) {
                enrichments.push(fetchReleaseDate(game.id));
            }
            if (game.platforms?.length) {
                enrichments.push(fetchPlatforms(game.platforms));
            }

            if (game.themes?.length) {
                enrichments.push(fetchThemes(game.themes));
            }
            if (game.game_modes?.length) {
                enrichments.push(fetchGameModes(game.game_modes));
            }
        }

        // Executar todas as buscas em paralelo
        const results = await Promise.allSettled(enrichments);

        // Construir objeto de retorno
        const enrichedGame = { ...game };

        // Processar resultados
        let currentIndex = 0;

        // Processar cover
        if (game.cover) {
            enrichedGame.cover_url = results[currentIndex].status === 'fulfilled' ? 
                results[currentIndex].value : null;
            currentIndex++;
        }

        // Processar gêneros
        if (game.genres?.length) {
            enrichedGame.genres = results[currentIndex].status === 'fulfilled' ? 
                results[currentIndex].value : [];
            currentIndex++;
        }

        // Processar dados detalhados
        if (level === EnrichmentLevel.DETAILED) {
            if (game.videos?.length) {
                enrichedGame.video_url = results[currentIndex].status === 'fulfilled' ? 
                    results[currentIndex].value : [];
                currentIndex++;
            }
            if (game.id) {
                enrichedGame.release_date = results[currentIndex].status === 'fulfilled' ? 
                    results[currentIndex].value : null;
                currentIndex++;
            }
            if (game.platforms?.length) {
                enrichedGame.platforms_info = results[currentIndex].status === 'fulfilled' ? 
                    results[currentIndex].value : [];
                currentIndex++;
            }
            if (game.themes?.length) {
                enrichedGame.themes = results[currentIndex].status === 'fulfilled' ? 
                    results[currentIndex].value : [];
                currentIndex++;
            }
            if (game.game_modes?.length) {
                enrichedGame.game_modes = results[currentIndex].status === 'fulfilled' ? 
                    results[currentIndex].value : [];
                currentIndex++;
            }
        }

        return enrichedGame;
    } catch (error) {
        console.error('Erro ao enriquecer detalhes do jogo:', error);
        return game; // Retorna dados básicos em caso de erro
    }
}

// Funções auxiliares de busca
async function fetchCover(coverId) {
  const coversQuery = `fields image_id; where id = ${coverId};`;
      const response = await igdbApi.getCovers(coversQuery);
      return response.data[0] ? 
          `https://images.igdb.com/igdb/image/upload/t_1080p/${response.data[0].image_id}.jpg` : 
          null;
}

async function fetchGenres(genreIds) {
    const genresQuery = `fields name; where id = (${genreIds.join(',')});`;
      const response = await igdbApi.getGenres(genresQuery);
      return response.data.map(genre => genre.name);
}

async function fetchVideos(videoIds) {
      const videosQuery = `fields video_id; where id = (${videoIds.join(',')});`;
      const response = await igdbApi.getGameVideos(videosQuery);
      return response.data.map(video => `https://youtube.com/embed/${video.video_id}`);
}

async function fetchReleaseDate(gameId) {
     const releaseDateQuery = `fields human; where game = ${gameId}; sort date asc; limit 1;`;
     const response = await igdbApi.getReleaseDates(releaseDateQuery);
     return response.data[0]?.human || null;
}

async function fetchPlatforms(platformIds) {
  //Busca do nome e id da logo das plataformas
      const platformsQuery = `fields name, platform_logo; where id = (${platformIds.join(',')});`;
      
      const platformsResponse = await igdbApi.getPlatforms(platformsQuery);
      
      // Extrai os Ids dados pelo campo platform_logo
      const logoIds = platformsResponse.data
          .filter(platform => platform.platform_logo)
          .map(platform => platform.platform_logo);
      
      // Busca da image_id usando o platform_logo como id
      let platformLogos = {};
      if (logoIds.length > 0) {
          const logoQuery = `fields image_id; where id = (${logoIds.join(',')});`;
          const logoResponse = await igdbApi.getPlatformLogos(logoQuery);
          
          //Agrupamento das informações das plataformas
          platformLogos = logoResponse.data.reduce((acc, logo) => {
              acc[logo.id] = `https://images.igdb.com/igdb/image/upload/t_cover_small/${logo.image_id}.png`;
              return acc;
          }, {});        
      }
  
      // Construção do objeto final combinando as informações
      return platformsResponse.data.map(platform => ({
          id: platform.id,
          name: platform.name,
          logo_url: platform.platform_logo ? platformLogos[platform.platform_logo] : null
      }));    
}
async function fetchThemes(themeIds) {
    const themesQuery = `fields name; where id = (${themeIds.join(',')});`;
    const response = await igdbApi.getThemes(themesQuery);
    return response.data.map(theme => theme.name);
}

async function fetchGameModes(gameModeIds) {
    const gameModesQuery = `fields name; where id = (${gameModeIds.join(',')});`;
    const response = await igdbApi.getGameModes(gameModesQuery);
    return response.data.map(gameMode => gameMode.name);
}
module.exports = {
  fetchWithFallback,
  processGames,
  processGenreBatch,
  enrichGameDetails,
  EnrichmentLevel
};