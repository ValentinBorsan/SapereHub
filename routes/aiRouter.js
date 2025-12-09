const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const requireAuth = require('../middleware/authMiddleware');

// Middleware de protecție (doar useri autentificați, ideal doar admini)
// Poți adăuga un middleware suplimentar pentru admin dacă e necesar
router.use(requireAuth);

// Ruta pentru traducere
router.post('/translate', aiController.translateContent);

// Rute pentru generare (existente)
router.post('/generate', aiController.generateLesson);
router.post('/generate-block', aiController.generateBlock);

module.exports = router;