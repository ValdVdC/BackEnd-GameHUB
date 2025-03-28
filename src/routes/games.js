const router = require('express').Router();
const controller = require('../controllers/gameController');

router.get('/', controller.getPopularGames);
router.get('/genres', controller.getGamesByGenre);
router.get('/platforms', controller.getGamesByPlatform); 
router.get('/themes', controller.getGamesByTheme);
router.get('/game-modes', controller.getGamesByGameMode); 
router.get('/search/:name', controller.searchGames);
router.get('/:id', controller.getGameDetails);

module.exports = router;