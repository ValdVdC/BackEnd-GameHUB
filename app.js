const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');
require('dotenv').config();
const axiosRetry = require('axios-retry').default;

const app = express();

const allowedOrigins = ['http://localhost:4200', 'https://front-end-game-hub.vercel.app'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

const API_URL = 'https://api.igdb.com/v4/';

// USO DE DOTENV (.env)

const CLIENT_ID = process.env.CLIENT_ID;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

const headers = {
    'Client-ID': CLIENT_ID,
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'text/plain'
};

// Configuração de retry para axios
axiosRetry(axios, {
    retries: 5, 
    retryCondition: (error) => {
        // Verifica se é um erro 429 (Too Many Requests)
        return (
            error.response && error.response.status === 429 ||
            // Outros erros de rede ou idempotência
            axiosRetry.isNetworkOrIdempotentRequestError(error)
        );
    },
    retryDelay: (retryCount, error) => {
        // Se for 429, usa um backoff exponencial com um tempo adicional
        if (error.response && error.response.status === 429) {
            // Obtém o tempo de espera do header Retry-After, se existir
            const retryAfter = error.response.headers['retry-after'];
            if (retryAfter) {
                return parseInt(retryAfter, 10) * 1000;
            }
            // Backoff exponencial para 429
            return Math.pow(2, retryCount) * 1000;
        }
        // Backoff padrão para outros erros
        return axiosRetry.exponentialDelay(retryCount);
    },
    // Opcional: função para complementar dados em caso de falha parcial
    onRetry: (retryCount, error, requestConfig) => {
        console.warn(`Tentativa ${retryCount} de retry para ${requestConfig.url}`);
        
        // Log adicional para 429
        if (error.response && error.response.status === 429) {
            console.warn('Limite de taxa excedido. Aguardando antes de tentar novamente.');
        }
    }
});

// Função auxiliar para processar requisições com tratamento de falhas parciais
async function fetchWithFallback(primaryFetch, fallbackFetch) {
    try {
        return await primaryFetch();
    } catch (error) {
        // Se a busca principal falhar completamente
        if (!error.response || error.response.status !== 429) {
            console.error('Erro na busca principal:', error);
            return await fallbackFetch();
        }
        throw error;
    }
}


// Cache com tempo de expiração e período de verificação
const gameCache = new NodeCache({ 
    stdTTL: 3600,  // 1 hora de cache
    checkperiod: 600 // Verifica o cache a cada 10 minutos
});

const genreCache = new NodeCache({ 
    stdTTL: 3600,  
    checkperiod: 600 
});

// Função para processar jogos
async function processGames(games, includeCovers = true) {
    // Processamento de capas
    const coverIds = games
        .map(game => game.cover)
        .filter(cover => cover);

    const coversQuery = `fields image_id; where id = (${coverIds.join(',')}); limit ${coverIds.length};`;
    
    const covers = await axios.post(API_URL + 'covers', coversQuery, { headers });

    const coverMap = {};
    covers.data.forEach(cover => {
        coverMap[cover.id] = `https://images.igdb.com/igdb/image/upload/t_1080p/${cover.image_id}.jpg`;
    });

    // Processamento de gêneros
    const allGenreIds = games.flatMap(game => game.genres || []);
    const uniqueGenreIds = Array.from(new Set(allGenreIds));

    const genresQuery = `
    fields name; 
    where id = (${uniqueGenreIds.join(',')}); 
    limit ${uniqueGenreIds.length};
    `;

    const genres = await axios.post(API_URL + 'genres', genresQuery, { headers });

    const genreMap = {};
    genres.data.forEach(genre => {
        genreMap[genre.id] = genre.name;
    });

    // Monta os detalhes finais dos jogos
    return games.map(game => ({
        ...game,
        genres: game.genres ? game.genres.map(genreId => genreMap[genreId]) : [],
        cover_url: includeCovers && game.cover ? coverMap[game.cover] : null
    }));
}

app.get('/api/games', async (req, res) => {
    try {
        const GAME_LIMIT = 500;
        const BATCH_SIZE = 200;

        // Verifica cache
        const cacheKey = `popular_games_${GAME_LIMIT}`;
        const cachedGames = gameCache.get(cacheKey);
        if (cachedGames) return res.status(200).json(cachedGames);

        //Buscar IDs por popularidade
        const orderedIds = await fetchWithFallback(
            async () => {
                const popular_games = await axios.post(
                    API_URL + 'popularity_primitives',
                    `fields game_id; limit ${GAME_LIMIT}; where popularity_type = 3; sort value desc;`,
                    { headers }
                );
                return popular_games.data.map(g => g.game_id);
            },
            async () => {
                const games = await axios.post(
                    API_URL + 'games',
                    `fields id; sort total_rating desc; limit ${GAME_LIMIT};`,
                    { headers }
                );
                return games.data.map(g => g.id);
            }
        );

        //Buscar detalhes EM BATCHES
        const batches = [];
        for (let i = 0; i < orderedIds.length; i += BATCH_SIZE) {
            const batchIds = orderedIds.slice(i, i + BATCH_SIZE);
            const games = await axios.post(
                API_URL + 'games',
                `fields name, genres, total_rating, cover, url; 
                where id = (${batchIds.join(',')}); 
                limit ${BATCH_SIZE};`,
                { headers }
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
});

// Endpoint de jogos por gênero com processamento em lote
const processGenreBatch = async (genres, batchSize = 500) => {
    return await Promise.allSettled(genres.map(async genre => {
        try {
            const gamesQuery = `
            fields name, genres, total_rating, cover.image_id; 
            where genres = (${genre.id}) & total_rating != null;
            sort total_rating desc;
            limit ${batchSize};
            `.trim();

            const response = await axios.post(
                API_URL + 'games',
                gamesQuery,
                { headers }
            );

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

app.get('/api/games/genres', async (req, res) => {
    try {
        const cachedGamesByGenre = genreCache.get('genres_games');
        if (cachedGamesByGenre) {
            return res.status(200).json(cachedGamesByGenre);
        }

        const genresQuery = 'fields id, name; limit 25;';
        const genresResponse = await axios.post(
            API_URL + 'genres', 
            genresQuery, 
            { headers }
        );

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
});

// Define um enum para os níveis de detalhamento
const EnrichmentLevel = {
    BASIC: 'basic',      // Para resultados de busca (nome, capa, gêneros)
    DETAILED: 'detailed' // Para página de detalhes (inclui tudo)
};

// Endpoint para busca
app.get('/api/game/search/:name', async (req, res) => {
    try {
        const gameName = req.params.name;
        const gameQuery = `
            fields name, genres, cover, total_rating;
            sort total_rating desc;
            where (name ~ "${gameName}"*)|(name ~ *"${gameName}")|(name ~ *"${gameName}"*);
        `;

        const games = await axios.post(API_URL + 'games', gameQuery, { headers });

        if (!games.data?.length) {
            return res.status(404).json({ error: 'Nenhum jogo encontrado' });
        }

        // Enriquecer com dados básicos
        const enrichedGames = await Promise.all(
            games.data.map(game => enrichGameDetails(game, EnrichmentLevel.BASIC))
        );
        
        res.status(200).json(enrichedGames);
    } catch (error) {
        console.error('Erro na busca de jogos:', error);
        res.status(500).json({ error: 'Erro ao buscar jogos' });
    }
});

// Endpoint para detalhes
app.get('/api/game/:id', async (req, res) => {
    try {
        const gameId = req.params.id;
        
        if (isNaN(Number(gameId))) {
            return res.status(400).json({ error: 'ID do jogo inválido' });
        }

        const gameQuery = `
            fields name, genres, cover, storyline, summary, url, total_rating, platforms, videos, themes; 
            where id = ${gameId};
        `;

        const gameResponse = await axios.post(API_URL + 'games', gameQuery, { headers });

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
});

// Função principal de enriquecimento
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
    const response = await axios.post(API_URL + 'covers', coversQuery, { headers });
    return response.data[0] ? 
        `https://images.igdb.com/igdb/image/upload/t_1080p/${response.data[0].image_id}.jpg` : 
        null;
}

async function fetchGenres(genreIds) {
    const genresQuery = `fields name; where id = (${genreIds.join(',')});`;
    const response = await axios.post(API_URL + 'genres', genresQuery, { headers });
    return response.data.map(genre => genre.name);
}

async function fetchVideos(videoIds) {
    const videosQuery = `fields video_id; where id = (${videoIds.join(',')});`;
    const response = await axios.post(API_URL + 'game_videos', videosQuery, { headers });
    return response.data.map(video => `https://youtube.com/embed/${video.video_id}`);
}

async function fetchReleaseDate(gameId) {
    const query = `fields human; where game = ${gameId}; sort date asc; limit 1;`;
    const response = await axios.post(API_URL + 'release_dates', query, { headers });
    return response.data[0]?.human || null;
}

async function fetchPlatforms(platformIds) {
    //Busca do nome e id da logo das plataformas
    const platformsQuery = `fields name, platform_logo; where id = (${platformIds.join(',')});`;
    const platformsResponse = await axios.post(API_URL + 'platforms', platformsQuery, { headers });
    
    // Extrai os Ids dados pelo campo platform_logo
    const logoIds = platformsResponse.data
        .filter(platform => platform.platform_logo)
        .map(platform => platform.platform_logo);
    
    // Busca da image_id usando o platform_logo como id
    let platformLogos = {};
    if (logoIds.length > 0) {
        const logoQuery = `fields image_id; where id = (${logoIds.join(',')});`;
        const logoResponse = await axios.post(API_URL + 'platform_logos', logoQuery, { headers });
        
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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});