const express = require("express");
const router = express.Router();
const multer = require("multer");

// Importăm Controllerele
const lessonController = require("../controllers/lessonController");
const profileController = require("../controllers/profileController");
const exerciseController = require("../controllers/exerciseController");
const dashboardController = require("../controllers/dashboardController");
const flashcardController = require("../controllers/flashcardsController");
const gamificationController = require("../controllers/gamificationController");
const uploadController = require("../controllers/uploadController");
const groupController = require("../controllers/groupController");
const apiController = require("../controllers/apiController");
const pageController = require('../controllers/aboutController');
const contactController = require('../controllers/contactController');
const legalController = require('../controllers/legalController');
const userController = require('../controllers/userController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const requireAuth = require("../middleware/authMiddleware");

// --- RUTE PUBLICE (Home) ---
router.get("/", (req, res) => {
  res.render("pages/home", { title: "Acasă - Platforma de Studiu" });
});

// --- RUTE PROTEJATE (Dashboard & Profil) ---
router.get("/dashboard", requireAuth, dashboardController.getDashboard);
router.get("/profile", requireAuth, profileController.getProfilePage);
router.post("/profile/update", requireAuth, profileController.updateProfile);

// --- RUTE LECȚII ---
router.get("/lectie/:id", lessonController.getLesson);
router.get("/materii/:category", lessonController.getLessonsByCategory);
router.post(
  "/api/lesson/complete",
  requireAuth,
  lessonController.markLessonComplete
);
// RUTA NOUĂ: Resetare Progres
router.post(
  "/api/lesson/reset",
  requireAuth,
  lessonController.resetLessonProgress
);

// --- RUTE EXERCIȚII (Hub & Public View) ---
router.get("/exercitii", exerciseController.getHub);
router.get("/exercitii/c/:slug", exerciseController.getByCategory);
router.get("/exercitii/:id", requireAuth, exerciseController.getExercise);

router.post(
  "/api/flashcards",
  requireAuth,
  flashcardController.createFlashcard
);
router.get(
  "/flashcards/practice",
  requireAuth,
  flashcardController.getPracticeMode
);
router.delete(
  "/api/flashcards/:id",
  requireAuth,
  flashcardController.deleteFlashcard
);
router.post("/api/gamification/xp", requireAuth, gamificationController.addXP);

// RUTA UPLOAD FIȘIERE
router.post(
  "/api/upload",
  requireAuth,
  upload.single("file"),
  uploadController.uploadFile
);

// Middleware de eroare pentru Multer (dacă fișierul e prea mare)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res
      .status(400)
      .json({ error: "Fișierul este prea mare! Limita este 10MB." });
  }
  next(err);
});

router.get("/groups", requireAuth, groupController.getGroupsList);

// 2. Pagina unui Grup Specific (Room)
router.get("/groups/:id", requireAuth, groupController.getGroupPage);

router.post(
  "/api/groups/add-lesson",
  requireAuth,
  groupController.addLessonToGroup
);
router.get("/groups/:id", requireAuth, groupController.getGroupPage);
router.post("/groups/create", requireAuth, groupController.createGroup);
router.get("/api/content/:type/:id", requireAuth, apiController.getContent);
router.post(
  "/api/groups/add-exercise",
  requireAuth,
  groupController.addExerciseToGroup
);
router.post(
  "/api/groups/submit-exercise",
  requireAuth,
  groupController.submitExerciseResult
);
router.post("/api/groups/promote", requireAuth, groupController.promoteMember);
router.post("/api/groups/delete", requireAuth, groupController.deleteGroup);


router.get('/about', pageController.getAbout);

router.get('/contact', contactController.getContactPage);
router.post('/contact', contactController.sendContactMessage);
router.get('/terms', legalController.getTerms);
router.get('/privacy', legalController.getPrivacy);
router.get('/cookies', legalController.getCookies);
router.get('/delete-account', legalController.getDeleteAccount);
router.post('/users/delete-request', userController.requestDeleteAccount);

module.exports = router;