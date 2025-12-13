const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const exerciseController = require('../controllers/exerciseController');
const lessonController = require('../controllers/lessonController')
const requireAuth = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/adminMiddleware');

// IMPORTANT: Rutele sunt deja prefixate cu '/admin' din server.js

// 1. LECȚII
// URL final: /admin/create-lesson
router.get('/create-lesson', requireAuth, requireAdmin, adminController.getCreatePage);
router.post('/create-lesson', requireAuth, requireAdmin, adminController.createLesson);

// Ștergere lecție
router.delete('/delete-lesson/:id', requireAuth, requireAdmin, lessonController.deleteLesson);

// 2. EXERCIȚII
// URL final: /admin/create-exercise
router.get('/create-exercise', requireAuth, requireAdmin, exerciseController.getCreatePage);

// URL final: /admin/edit-exercise/:id
router.get('/edit-exercise/:id', requireAuth, requireAdmin, exerciseController.getEditPage);

// URL final: /admin/save-exercise
router.post('/save-exercise', requireAuth, requireAdmin, exerciseController.saveExercise);
router.delete('/delete-exercise/:id', requireAuth, requireAdmin, exerciseController.deleteExercise);

// 3. AVIZIER (NOU)
// URL final: /admin/update-notice
router.post('/update-notice', requireAuth, requireAdmin, adminController.updateNotice);

module.exports = router;