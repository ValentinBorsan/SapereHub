const supabase = require("../config/supabase");

// 1. IMPORTĂM TRADUCERILE
const ro = require("../locales/ro.json");
const en = require("../locales/en.json");
const it = require("../locales/it.json");

// GET: Pagina de creare SAU editare LECȚIE
exports.getCreatePage = async (req, res) => {
  const editId = req.query.edit;
  let lessonData = null;

  // Citim limba curentă din cookie (sau default 'ro')
  const currentLang = req.cookies.sapere_lang || "ro";

  if (editId) {
    try {
      // Selectăm tot (*) inclusiv 'content' care are structura multilingvă
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", editId)
        .single();

      if (!error && data) {
        lessonData = data;
      } else {
        console.warn(
          `[Admin] Lecția ${editId} nu a fost găsită:`,
          error?.message
        );
      }
    } catch (err) {
      console.error("Eroare la încărcarea lecției pentru editare:", err);
    }
  }

  // 2. CONSTRUIM OBIECTUL TRANSLATIONS
  const translations = { ro, en, it };

  res.render("pages/admin/create-lesson", {
    title: lessonData ? "Editează Lecția" : "Creează Lecție Nouă",
    user: req.user,
    lesson: lessonData,
    translations: translations,
    currentLang: currentLang,
    layouts: "main",
  });
};

exports.createLesson = async (req, res) => {
  try {
    // req.body.content conține obiectul { ro: {...}, en: {...}, it: {...} }
    // trimis de admin-editor.js (funcția buildPayload)
    const { id, title, subtitle, category, level, read_time, content } = req.body;

    // Validare de bază
    if (!title || !content) {
      return res
        .status(400)
        .json({ error: "Titlul și conținutul sunt obligatorii." });
    }

    const payload = {
      title, // Titlul "principal" (fallback, de obicei RO)
      subtitle: subtitle || "",
      category: category || "General", // Valoarea din DB (ex: Matematică)
      level: level || "Începător",
      read_time: parseInt(read_time) || 10,
      content: content, // Aici se salvează tot JSON-ul multilingv
      updated_at: new Date(),
    };

    let data, error;

    // Scenariul 1: UPDATE (Dacă avem ID)
    if (id) {
      const result = await supabase
        .from("lessons")
        .update(payload)
        .eq("id", id)
        .select();

      data = result.data;
      error = result.error;
    }
    // Scenariul 2: INSERT (Lecție nouă)
    else {
      // Adăugăm autorul doar la creare
      payload.author = req.user
        ? req.user.email
          ? req.user.email.split("@")[0]
          : "Admin"
        : "Admin";

      const result = await supabase.from("lessons").insert([payload]).select();

      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Supabase Error:", error);
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      throw new Error(
        "Nu s-a putut salva lecția (baza de date nu a returnat date)."
      );
    }

    res.status(200).json({
      success: true,
      redirectUrl: `/lectie/${data[0].id}`,
      message: "Lecția a fost salvată cu succes!",
    });
  } catch (err) {
    console.error("Eroare salvare lecție (Controller):", err);
    res.status(500).json({ error: err.message || "Eroare internă server." });
  }
};