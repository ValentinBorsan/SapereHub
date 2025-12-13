const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationsController'); // Ajustează calea dacă e nevoie
const requireAuth = require('../middleware/authMiddleware');


 router.get('/', requireAuth, notificationController.getNotificationsPage);

// API Routes (folosite de Navbar)
router.get('/api/recent', requireAuth, notificationController.getRecentNotifications);
router.post('/api/read', requireAuth, notificationController.markAsRead);

module.exports = router;