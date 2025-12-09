const supabase = require("../config/supabase");

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Luăm datele PROFILULUI (XP, Level) direct din DB
    // Asta garantează că afișăm datele actualizate, nu cele vechi din cookie
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (profileError) {
        console.error("Eroare la preluarea profilului în dashboard:", profileError);
    }

    // 2. Luăm Lecțiile
    const { data: lessons } = await supabase
      .from("lessons")
      .select("*")
      .order("created_at", { ascending: false });

    // 3. Luăm Exercițiile
    const { data: exercises } = await supabase
      .from("exercises")
      .select("*")
      .order("created_at", { ascending: false });

    // 4. Pregătim obiectul user cu datele proaspete
    const userDisplay = {
        ...req.user, // Păstrăm id, email etc.
        xp: profile?.xp || 0,       // Suprascriem cu valoarea din DB
        level: profile?.level || 1, // Suprascriem cu valoarea din DB
        streak: profile?.streak || 0
    };

    // 5. Randăm pagina
    res.render("pages/dashboard", {
      user: userDisplay, // Trimitem userul actualizat
      lessons: lessons || [],
      exercises: exercises || [],
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.redirect("/");
  }
};