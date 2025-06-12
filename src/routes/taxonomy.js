const router = require('express').Router();
const controller = require('../controllers/taxonomyController');

router.get('/genres', controller.getGenres);
router.get('/game-types', controller.getGameTypes);
router.get('/themes', controller.getThemes);
router.get('/game-modes', controller.getGameModes);

module.exports = router;