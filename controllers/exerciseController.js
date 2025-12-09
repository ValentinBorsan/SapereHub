const supabase = require("../config/supabase");

// 1. IMPORTĂM TRADUCERILE
const ro = require("../locales/ro.json");
const en = require("../locales/en.json");
const it = require("../locales/it.json");

// Mapare Categorii
const categoryMap = {
  math: {
    name: "Matematică",
    icon: "bx-calculator",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/50",
  },
  science: {
    name: "Științe",
    icon: "bx-atom",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/50",
  },
  english: {
    name: "Engleză",
    icon: "bx-book",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/50",
  },
  italian: {
    name: "Italiană",
    icon: "bx-pizza",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/50",
  },
  history: {
    name: "Istorie",
    icon: "bx-time-five",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/50",
  },
  geography: {
    name: "Geografie",
    icon: "bx-world",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/50",
  },
};

// HELPER: Obține categoriile traduse dinamic
function getTranslatedCategories(lang) {
  const t = lang === "it" ? it : lang === "en" ? en : ro;
  const translatedMap = {};

  Object.keys(categoryMap).forEach((key) => {
    translatedMap[key] = {
      ...categoryMap[key],
      name:
        t.subjects && t.subjects[key] ? t.subjects[key] : categoryMap[key].name,
    };
  });

  return translatedMap;
}

// HELPER: Funcție pentru a lua userul cu XP actualizat
async function getUserWithStats(reqUser) {
  if (!reqUser) return null;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", reqUser.id)
      .single();

    if (profile) {
      return {
        ...reqUser,
        xp: profile.xp || 0,
        level: profile.level || 1,
        streak: profile.streak || 0,
      };
    }
  } catch (e) {
    console.error("Profile fetch error:", e);
  }
  return reqUser;
}

// ============================================================
// 1. GET: Hub Principal
// ============================================================
exports.getHub = async (req, res) => {
  const currentLang = req.cookies.sapere_lang || "ro";
  const userDisplay = await getUserWithStats(req.user);

  const translatedCats = getTranslatedCategories(currentLang);

  res.render("pages/exercises-hub", {
    title: "Centru de Testare",
    categories: translatedCats,
    user: userDisplay,
    currentLang: currentLang,
    layouts: "main",
  });
};

// ============================================================
// 2. GET: Listă Exerciții per Categorie (AICI E MODIFICAREA)
// ============================================================
exports.getByCategory = async (req, res) => {
  const slug = req.params.slug;
  const currentLang = req.cookies.sapere_lang || "ro";

  const translatedCats = getTranslatedCategories(currentLang);
  const categoryInfo = translatedCats[slug];

  const userDisplay = await getUserWithStats(req.user);

  if (!categoryInfo) return res.status(404).render("pages/404");

  try {
    const { data: exercises, error } = await supabase
      .from("exercises")
      .select("id, title, difficulty, created_at, content")
      .eq("category", slug)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Procesăm fiecare exercițiu pentru a extrage TITLUL TRADUS
    const exercisesProcessed = exercises.map((ex) => {
      // A. Numărăm întrebările
      let qCount = 0;
      if (ex.content.ro && ex.content.ro.groups) {
        ex.content.ro.groups.forEach(
          (g) => (qCount += g.questions ? g.questions.length : 0)
        );
      } else if (ex.content.questions) {
        qCount = ex.content.questions.length;
      } else if (Array.isArray(ex.content)) {
        qCount = ex.content.length;
      }

      // B. EXTRAGEM TITLUL CORECT (Locales Logic)
      let displayTitle = ex.title; // Default: ce e în coloana 'title' (DB)

      // Verificăm dacă avem traducere pentru limba curentă în JSON
      if (
        ex.content &&
        ex.content[currentLang] &&
        ex.content[currentLang].title
      ) {
        displayTitle = ex.content[currentLang].title;
      }
      // Fallback 1: Engleză
      else if (ex.content && ex.content.en && ex.content.en.title) {
        displayTitle = ex.content.en.title;
      }
      // Fallback 2: Italiană
      else if (ex.content && ex.content.it && ex.content.it.title) {
        displayTitle = ex.content.it.title;
      }

      // Returnăm obiectul cu titlul suprascris pentru afișare
      return {
        ...ex,
        qCount,
        title: displayTitle,
      };
    });

    res.render("pages/exercises-list", {
      title: `Exerciții ${categoryInfo.name}`,
      category: categoryInfo,
      exercises: exercisesProcessed, // Folosim lista procesată
      user: userDisplay,
      currentLang: currentLang,
      layouts: "main",
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("pages/404");
  }
};

// ============================================================
// 3. GET: Vizualizare Exercițiu
// ============================================================
exports.getExercise = async (req, res) => {
  try {
    const { id } = req.params;
    const currentLang = req.cookies.sapere_lang || "ro";
    const userDisplay = await getUserWithStats(req.user);

    const { data: exercise, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !exercise) return res.status(404).render("pages/404");

    let finalTitle = exercise.title;
    let finalGroups = [];

    // Logica pentru a alege titlul corect din JSON-ul exercițiului
    let targetContent = exercise.content[currentLang];

    if (!targetContent || !targetContent.title) {
      if (exercise.category === "italian" && exercise.content.it?.title)
        targetContent = exercise.content.it;
      else if (exercise.category === "english" && exercise.content.en?.title)
        targetContent = exercise.content.en;
      else {
        const availableLang = ["ro", "en", "it"].find(
          (l) => exercise.content[l]?.title
        );
        if (availableLang) targetContent = exercise.content[availableLang];
      }
    }

    if (targetContent) {
      finalTitle = targetContent.title;
      if (targetContent.groups && Array.isArray(targetContent.groups)) {
        finalGroups = targetContent.groups;
      } else {
        finalGroups = [
          {
            description: targetContent.description,
            questions: targetContent.questions || [],
          },
        ];
      }
    } else {
      if (Array.isArray(exercise.content)) {
        finalGroups = [{ description: null, questions: exercise.content }];
      }
    }

    const viewData = {
      ...exercise,
      title: finalTitle,
      groups: finalGroups,
    };

    res.render("pages/exercise-view", {
      title: viewData.title,
      exercise: viewData,
      user: userDisplay,
      currentLang: currentLang,
      layouts: "main",
    });
  } catch (err) {
    console.error("Eroare Get Exercise:", err);
    res.status(500).render("pages/404");
  }
};

// 4. ADMIN: Pagini de creare/editare
exports.getCreatePage = async (req, res) => {
  const userDisplay = await getUserWithStats(req.user);
  const currentLang = req.cookies.sapere_lang || "ro";
  const translations = { ro, en, it };

  res.render("pages/admin/create-exercise", {
    user: userDisplay,
    exercise: null,
    layouts: "main",
    translations: translations,
    currentLang: currentLang,
  });
};

exports.getEditPage = async (req, res) => {
  const userDisplay = await getUserWithStats(req.user);
  const { id } = req.params;
  const currentLang = req.cookies.sapere_lang || "ro";

  const { data: exercise } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", id)
    .single();

  const translations = { ro, en, it };

  res.render("pages/admin/create-exercise", {
    user: userDisplay,
    exercise: exercise,
    translations: translations,
    currentLang: currentLang,
    layouts: "main",
  });
};

exports.saveExercise = async (req, res) => {
  console.log("--- SAVE EXERCISE REQUEST RECEIVED ---");
  try {
    const { id, category, difficulty, content } = req.body;
    if (!content) return res.status(400).json({ error: "Payload invalid." });

    const validLangs = ["ro", "en", "it"].filter((lang) => {
      const langData = content[lang];
      return (
        langData &&
        langData.title &&
        (langData.groups?.length > 0 || langData.questions?.length > 0)
      );
    });

    if (validLangs.length === 0)
      return res.status(400).json({ error: "Completează conținutul." });

    const mainTitle =
      content.ro?.title ||
      content.en?.title ||
      content.it?.title ||
      content[validLangs[0]].title;
    const exerciseId = id && id.trim() !== "" ? id : null;
    let error;

    if (exerciseId) {
      const response = await supabase
        .from("exercises")
        .update({ title: mainTitle, category, difficulty, content })
        .eq("id", exerciseId);
      error = response.error;
    } else {
      const response = await supabase
        .from("exercises")
        .insert([{ title: mainTitle, category, difficulty, content }]);
      error = response.error;
    }

    if (error) throw error;
    res.json({ success: true, redirectUrl: "/exercitii" });
  } catch (err) {
    console.error("SERVER CRASH:", err);
    res.status(500).json({ error: err.message || "Eroare internă server." });
  }
};

// 3. GET: Lista Exerciții (Public)
exports.getList = async (req, res) => {
  const currentLang = req.cookies.sapere_lang || "ro";

  try {
    const { data: exercises, error } = await supabase
      .from("exercises")
      .select("id, title, category, difficulty, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // TODO: Adăugă aceeași logică de traducere a titlurilor și aici dacă e necesar

    res.render("pages/exercises-list", {
      title: "Exerciții și Teste",
      exercises: exercises || [],
      user: req.user || null,
      currentLang: currentLang,
      layouts: "main",
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("pages/404");
  }
};

exports.deleteExercise = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Fără permisiuni." });
    const { error } = await supabase.from("exercises").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true, message: "Șters cu succes." });
  } catch (err) {
    res.status(500).json({ error: "Eroare la ștergere." });
  }
};
