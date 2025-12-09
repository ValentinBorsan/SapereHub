// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// LOGIN
router.get('/', authController.getLoginPage); // Alias
router.get('/login', authController.getLoginPage);
router.post('/login', authController.login);

// REGISTER (NOU)
router.get('/register', authController.getRegisterPage);
router.post('/register', authController.register);

// GOOGLE (NOU)
router.get('/google', authController.loginGoogle); // Declanșează login
router.get('/callback', authController.authCallback); // Procesează răspunsul

// LOGOUT
router.get('/logout', authController.logout);

module.exports = router;