// const express = require('express');
// const axios = require('axios')
// const cors = require('cors')
// const NodeCache = require('node-cache');
// require('dotenv').config()
// const app = express();

// app.use(cors({
//     origin: 'http://localhost:4200'
// }))
// app.use(express.json());

// const API_URL = 'https://api.igdb.com/v4/'

// const CLIENT_ID = process.env.CLIENT_ID;
// const AUTH_TOKEN = process.env.AUTH_TOKEN;

// const headers = {
//     'Client-ID': CLIENT_ID,
//     'Authorization': `Bearer ${AUTH_TOKEN}`,
//     'Content-Type': 'text/plain'
// };

// app.get('/api/games', async (req,res)=>{
//     try {
//         const popularQuery = `
//         fields game_id,value,popularity_type; 
//         sort value desc; 
//         limit 9; 
//         where  popularity_type = 3;
//         `
//         const popularGames = await axios.post(
//             API_URL+'popularity_primitives',
//             popularQuery ,
//             { headers }
//         )

//         const gameIds = popularGames.data.map(game=>game.game_id)

//         const gamesQuery = `
//         fields name, genres, total_rating, cover, url; 
//         where id = (${gameIds.join(',')}); 
//         limit 9;
//         `;
        
//         const games = await axios.post(
//             API_URL+'games',
//             gamesQuery,
//             { headers }
//         );
//         const coverIds = games.data
//         .map(game => game.cover)
//         .filter(cover => cover); 

//         const coversQuery = `fields image_id; 
//         where id = (${coverIds.join(',')});`;

//         const covers = await axios.post(
//             API_URL+'covers',
//             coversQuery,
//             { headers }
//         );

//         const coverMap = {};
//         covers.data.forEach(cover => {
//             coverMap[cover.id] = `https://images.igdb.com/igdb/image/upload/t_1080p/${cover.image_id}.jpg`;
//         });

//         const allGenreIds = games.data
//             .flatMap(game => game.genres || []);

//         const uniqueGenreIds = Array.from(new Set(allGenreIds));

//         const genresQuery = `
//         fields name; 
//         where id = (${uniqueGenreIds.join(',')}); 
//         limit ${uniqueGenreIds.length};
//         `;

//         const genres = await axios.post(
//             API_URL+'genres',
//             genresQuery,
//             { headers }
//         );

//         const genreMap = {};
//         genres.data.forEach(genre => {
//             genreMap[genre.id] = genre.name;
//         });
//         const gamesDetails = games.data.map(game => ({
//             ...game,
//             genres: game.genres ? game.genres.map(genreId => genreMap[genreId]) : [],
//             cover_url: game.cover ? coverMap[game.cover] : null
//         }));

//         res.status(200).json(gamesDetails);

//     } catch (error) {
//         console.error('Erro ao buscar dados: ', error.messsage)
//         res.status(500).json({error:'Erro ao buscar dados IGDB'})
//     }
// })

// app.get('/api/game/:id',async(req,res)=>{
//     const game = req.params.id
//     let gameQuery;
//     let gameId;
//     //Detalhes dos jogos
//     if (!isNaN(Number(game))) {
//         gameQuery = `
//         fields name, genres, cover, storyline, summary, url, total_rating, platforms, videos, themes; 
//         where id = (${game}); 
//         `;
//     } 
//     //Buscador do header
//     else {
//         gameQuery = `
//         fields name, genres, cover, storyline, summary, url, total_rating, platforms, videos, themes;
//         sort total_rating desc;
//         where (name ~ "${game}"*)|(name ~ *"${game}")|(name ~ *"${game}"*);
//         `;
//     }
//     try {
//         // Consulta principal dos jogos
//         const games = await axios.post(
//             API_URL+'games',
//             gameQuery,
//             { headers }
//         )
//         gameId = games.data[0].id;
        
//         // Consulta dos covers
//         const coverIds = games.data
//         .map(game => game.cover)
//         .filter(cover => cover); 
//         const coversQuery = `
//         fields image_id; 
//         where id = (${coverIds.join(',')});
//         `;
        
//         const covers = await axios.post(
//             API_URL+'covers',
//             coversQuery,
//             { headers }
//         );

        
//         const coverMap = {};
        
//         covers.data.forEach(cover => {
//             coverMap[cover.id] = `https://images.igdb.com/igdb/image/upload/t_1080p/${cover.image_id}.jpg`;
//         });

//         // Consulta dos videos
//         const videoIds = games.data
//         .flatMap(game => game.videos || [])

//         const videosQuery = `
//         fields video_id;
//         where id = (${videoIds.join(',')});
//         `
//         const videos = await axios.post(
//             API_URL+'game_videos',
//             videosQuery,
//             { headers }
//         );

//         const videoMap = {}
//         videos.data.forEach(video => {
//             videoMap[video.id] = `http://youtube.com/embed/${video.video_id}`
//         })

//         // // Consulta dos temas
//         // const themeIds = games.data
//         // .flatMap(game => game.themes ||[])

//         // const themesQuery = `
//         // fields name, url;
//         // where id = (${themeIds.join(',')});
//         // `

//         // const themes = await axios.post(
//         //     API_URL+'themes',
//         //     themesQuery,
//         //     { headers }
//         // )

//         // const themeMap = {}
//         // themes.data.forEach(theme =>{
//         //     themeMap[theme.id] = theme.url
//         // })
//         // Consulta do lançamento
//         const releaseDateQuery = `
//         fields human, date; 
//         where game = ${gameId}; 
//         sort date asc; 
//         limit 1;    
//         `
//         const releaseDate = await axios.post(
//             API_URL+'release_dates',
//             releaseDateQuery, 
//             { headers }
//         )
//         //Consulta de plataformas
        
//         const allPlatformIds = games.data
//         .flatMap(game=>game.platforms||[])

//         const uniquePlatformIds = Array.from(new Set(allPlatformIds))

//         const platformsQuery = `
//         fields platform_logo;
//         where id = (${uniquePlatformIds.join(',')});
//         `
//         const platforms = await axios.post(
//             API_URL+'platforms',
//             platformsQuery,
//             { headers }
//         )
//         const platformMap = {}
//         platforms.data.forEach(platform => {
//             platformMap[platform.id] = platform.platform_logo;
//         });

//         const platformLogoIds = platforms.data
//             .map(platform=>platform.platform_logo)
//             .filter(id=>id)

//         const platformsLogoQuery = `
//         fields image_id,url;
//         where id = (${platformLogoIds.join(',')});
//         `

//         const platformsLogo = await axios.post(
//             API_URL+'platform_logos',
//             platformsLogoQuery,
//             { headers }
//         )

//         const platformLogoMap = {};

//         platformsLogo.data.forEach(platform =>{
//             platformLogoMap[platform.id] = `https://images.igdb.com/igdb/image/upload/t_thumb/${platform.image_id}.jpg`;
//         })

//         //Consulta dos gêneros
//         const allGenreIds = games.data
//             .flatMap(game => game.genres || []);

//         const uniqueGenreIds = Array.from(new Set(allGenreIds));

//         const genresQuery = `
//         fields name; 
//         where id = (${uniqueGenreIds.join(',')}); 
//         limit ${uniqueGenreIds.length};
//         `;

//         const genres = await axios.post(
//             API_URL+'genres',
//             genresQuery,
//             { headers }
//         );

//         const genreMap = {};
//         genres.data.forEach(genre => {
//             genreMap[genre.id] = genre.name;
//         });

//         // Juntar os detalhes dos jogos
//         const gameDetails = games.data.map(game => ({
//             ...game,
//             genres: game.genres ? game.genres.map(genreId => genreMap[genreId]) : [],

//             cover_url: game.cover ? coverMap[game.cover] : null,

//             video_url: game.videos ? game.videos.map(videoId => videoMap[videoId]): [],

//             // theme_url: game.themes ? game.themes.map(themeId => themeMap[themeId]):[],
            
//             release_date: releaseDate.data? releaseDate.data[0].human : null,

//             platforms_logo: game.platforms ? game.platforms.map(platformId => platformLogoMap[platformMap[platformId]]) : [],

//         }));

//         res.status(200).json(gameDetails)
//     } catch (error) {
//         console.error('Erro ao buscar dados: ', error.messsage)
//         res.status(500).json({error:'Erro ao buscar dados IGDB'})
//     }
// })

// //Jogos por categoria 

// const processGenreBatch = async (genres, batchSize = 3) => {
//         return await Promise.allSettled(genres.map(async genre => {
//             try {
//                 const gamesQuery = `
//                 fields name, genres, total_rating, cover.image_id; 
//                 where genres = (${genre.id}) & total_rating != null;
//                 sort total_rating desc;
//                 limit ${batchSize};
//                 `.trim();

//                 const response = await axios.post(
//                     API_URL + 'games',
//                     gamesQuery,
//                     { headers }
//                 );

//                 const games = response.data.map(game => ({
//                     ...game,
//                     cover_url: game.cover 
//                         ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
//                         : null
//                 }));

//                 return { status: 'fulfilled', genre: genre.name, games };
//             } catch (error) {
//                 console.error(`Erro ao buscar jogos do gênero ${genre.name}:`, error.message);
//                 return { status: 'rejected', genre: genre.name, games: [] };
//             }
//         }));
// }

// const genreCache = new NodeCache({stdTTL:3600})

// app.get('/api/games/genres', async (req, res) => {
//     try {
//         const cachedGamesByGenre = genreCache.get('genres_games');
//         if (cachedGamesByGenre) {
//             return res.status(200).json(cachedGamesByGenre);
//         }

//         const genresQuery = 'fields id, name; limit 25;';
//         const genresResponse = await axios.post(
//             API_URL + 'genres', 
//             genresQuery, 
//             { headers }
//         );

//         if (!genresResponse.data?.length) {
//             return res.status(404).json({ error: 'Nenhum gênero encontrado' });
//         }

//         const gamesByGenre = await processGenreBatch(genresResponse.data);
//         const filteredGames = gamesByGenre.filter(item => item.status === 'fulfilled');

//         genreCache.set('genres_games', filteredGames);

//         res.status(200).json(filteredGames);
//     } catch (error) {
//         console.error('Erro ao buscar gêneros:', error);
//         res.status(500).json({ error: 'Erro ao buscar dados IGDB' });
//     }
// });


// const PORT = 3000;
// app.listen(PORT, ()=>{console.log(`Servidor rodando na porta ${PORT}`)})
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');
require('dotenv').config();
const axiosRetry = require('axios-retry').default;

const app = express();

app.use(cors({
    origin: 'http://localhost:4200'
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
    retries: 3, 
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

    const coversQuery = `fields image_id; where id = (${coverIds.join(',')});`;
    
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

// Endpoint de jogos populares
app.get('/api/games', async (req, res) => {
    try {
        // Verifica cache primeiro
        const cachedGames = gameCache.get('popular_games');
        if (cachedGames) {
            return res.status(200).json(cachedGames);
        }

        // Busca jogos populares com fallback
        const popularGames = await fetchWithFallback(
            // Busca principal
            async () => {
                const response = await axios.post(
                    API_URL + 'popularity_primitives',
                    `
                    fields game_id,value,popularity_type; 
                    sort value desc; 
                    limit 9; 
                    where popularity_type = 3;
                    `,
                    { headers }
                );
                
                if (!response.data || response.data.length === 0) {
                    throw new Error('Nenhum jogo popular encontrado');
                }
                
                return response.data;
            },
            // Fallback
            async () => {
                const fallbackResponse = await axios.post(
                    API_URL + 'games',
                    `
                    fields name, genres, total_rating, cover, url; 
                    sort total_rating desc;
                    limit 9;
                    `,
                    { headers }
                );
                
                return fallbackResponse.data;
            }
        );

        // Processamento dos IDs dos jogos
        const gameIds = popularGames.map(game => 
            game.game_id || game.id
        );

        // Resto do processamento mantido igual
        const gamesQuery = `
        fields name, genres, total_rating, cover, url; 
        where id = (${gameIds.join(',')}); 
        limit 9;
        `;
        
        const games = await axios.post(
            API_URL + 'games',
            gamesQuery,
            { headers }
        );

        // Processamento dos jogos
        const gamesDetails = await processGames(games.data);

        // Salva no cache
        gameCache.set('popular_games', gamesDetails);

        res.status(200).json(gamesDetails);

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
const processGenreBatch = async (genres, batchSize = 9) => {
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

app.get('/api/game/:id',async(req,res)=>{
    const game = req.params.id
    let gameQuery;
    let gameId;
    //Detalhes dos jogos
    if (!isNaN(Number(game))) {
        gameQuery = `
        fields name, genres, cover, storyline, summary, url, total_rating, platforms, videos, themes; 
        where id = (${game}); 
        `;
    } 
    //Buscador do header
    else {
        gameQuery = `
        fields name, genres, cover, storyline, summary, url, total_rating, platforms, videos, themes;
        sort total_rating desc;
        where (name ~ "${game}"*)|(name ~ *"${game}")|(name ~ *"${game}"*);
        `;
    }
    try {
        // Consulta principal dos jogos
        const games = await axios.post(
            API_URL+'games',
            gameQuery,
            { headers }
        )
        gameId = games.data[0].id;
        
        // Consulta dos covers
        const coverIds = games.data
        .map(game => game.cover)
        .filter(cover => cover); 
        const coversQuery = `
        fields image_id; 
        where id = (${coverIds.join(',')});
        `;
        
        const covers = await axios.post(
            API_URL+'covers',
            coversQuery,
            { headers }
        );

        
        const coverMap = {};
        
        covers.data.forEach(cover => {
            coverMap[cover.id] = `https://images.igdb.com/igdb/image/upload/t_1080p/${cover.image_id}.jpg`;
        });

        // Consulta dos videos
        const videoIds = games.data
        .flatMap(game => game.videos || [])

        const videosQuery = `
        fields video_id;
        where id = (${videoIds.join(',')});
        `
        const videos = await axios.post(
            API_URL+'game_videos',
            videosQuery,
            { headers }
        );

        const videoMap = {}
        videos.data.forEach(video => {
            videoMap[video.id] = `http://youtube.com/embed/${video.video_id}`
        })

        // // Consulta dos temas
        // const themeIds = games.data
        // .flatMap(game => game.themes ||[])

        // const themesQuery = `
        // fields name, url;
        // where id = (${themeIds.join(',')});
        // `

        // const themes = await axios.post(
        //     API_URL+'themes',
        //     themesQuery,
        //     { headers }
        // )

        // const themeMap = {}
        // themes.data.forEach(theme =>{
        //     themeMap[theme.id] = theme.url
        // })
        // Consulta do lançamento
        const releaseDateQuery = `
        fields human, date; 
        where game = ${gameId}; 
        sort date asc; 
        limit 1;    
        `
        const releaseDate = await axios.post(
            API_URL+'release_dates',
            releaseDateQuery, 
            { headers }
        )
        //Consulta de plataformas
        
        const allPlatformIds = games.data
        .flatMap(game=>game.platforms||[])

        const uniquePlatformIds = Array.from(new Set(allPlatformIds))

        const platformsQuery = `
        fields platform_logo;
        where id = (${uniquePlatformIds.join(',')});
        `
        const platforms = await axios.post(
            API_URL+'platforms',
            platformsQuery,
            { headers }
        )
        const platformMap = {}
        platforms.data.forEach(platform => {
            platformMap[platform.id] = platform.platform_logo;
        });

        const platformLogoIds = platforms.data
            .map(platform=>platform.platform_logo)
            .filter(id=>id)

        const platformsLogoQuery = `
        fields image_id,url;
        where id = (${platformLogoIds.join(',')});
        `

        const platformsLogo = await axios.post(
            API_URL+'platform_logos',
            platformsLogoQuery,
            { headers }
        )

        const platformLogoMap = {};

        platformsLogo.data.forEach(platform =>{
            platformLogoMap[platform.id] = `https://images.igdb.com/igdb/image/upload/t_thumb/${platform.image_id}.jpg`;
        })

        //Consulta dos gêneros
        const allGenreIds = games.data
            .flatMap(game => game.genres || []);

        const uniqueGenreIds = Array.from(new Set(allGenreIds));

        const genresQuery = `
        fields name; 
        where id = (${uniqueGenreIds.join(',')}); 
        limit ${uniqueGenreIds.length};
        `;

        const genres = await axios.post(
            API_URL+'genres',
            genresQuery,
            { headers }
        );

        const genreMap = {};
        genres.data.forEach(genre => {
            genreMap[genre.id] = genre.name;
        });

        // Juntar os detalhes dos jogos
        const gameDetails = games.data.map(game => ({
            ...game,
            genres: game.genres ? game.genres.map(genreId => genreMap[genreId]) : [],

            cover_url: game.cover ? coverMap[game.cover] : null,

            video_url: game.videos ? game.videos.map(videoId => videoMap[videoId]): [],

            // theme_url: game.themes ? game.themes.map(themeId => themeMap[themeId]):[],
            
            release_date: releaseDate.data? releaseDate.data[0].human : null,

            // platforms_logo: game.platforms ? game.platforms.map(platformId => platformLogoMap[platformMap[platformId]]) : [],

        }));
        
        res.status(200).json(gameDetails)
    } catch (error) {
        console.error('Erro ao buscar dados: ', error.messsage)
        res.status(500).json({error:'Erro ao buscar dados IGDB'})
    }
})

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});