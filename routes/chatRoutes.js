const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const requireAuth = require('../middleware/authMiddleware');



// POST /api/chat/send -> Trimite mesaj
router.post('/send',requireAuth, chatController.sendMessage);

// GET /api/chat/:lessonId -> Ia mesajele anterioare
router.get('/:lessonId', chatController.getMessages);

module.exports = router;