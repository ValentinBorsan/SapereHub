const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamificationController');
const requireAuth = require('../middleware/authMiddleware');

// GET /api/gamification/stats
router.get('/stats', requireAuth, gamificationController.getUserStats);

module.exports = router;