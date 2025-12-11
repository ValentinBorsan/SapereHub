const express = require('express');
const router = express.Router();
const presentationController = require('../controllers/presentationController');

// GET /fizica (Rădăcina acestui router, montat la /fizica) -> Hub
router.get('/', presentationController.getHub);

// GET /fizica/:slug -> Lecția specifică
router.get('/:slug', presentationController.getPresentation);

module.exports = router;