const supabase = require("../config/supabase");

// IMPORTĂM TRADUCERILE
const ro = require("../locales/ro.json");
const en = require("../locales/en.json");
const it = require("../locales/it.json");

// HELPER: User Stats
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
        full_name: profile.full_name || reqUser.email.split("@")[0],
      };
    }
  } catch (e) {
    console.error("Profile fetch error:", e);
  }
  return reqUser;
}

// ============================================================
// GET: Pagina Grupului (MAIN)
// ============================================================
exports.getGroupPage = async (req, res) => {
  const { id } = req.params;
  const currentLang = req.cookies.sapere_lang || "ro";

  try {
    const userDisplay = await getUserWithStats(req.user);
    if (!userDisplay) return res.redirect("/auth");

    // 1. Verificăm existența grupului
    const { data: group } = await supabase
      .from("study_groups")
      .select("*")
      .eq("id", id)
      .single();
    if (!group) return res.redirect("/dashboard");

    // 2. LOGICA GRUP PRIVAT (Acces Restrictionat)
    if (group.is_private) {
      const now = new Date();
      const expires = new Date(group.private_expires_at);

      if (now < expires) {
        const { data: existingMember } = await supabase
          .from("group_members")
          .select("role")
          .eq("group_id", id)
          .eq("user_id", req.user.id)
          .single();

        if (!existingMember && req.user.role !== "admin") {
          return res.redirect("/dashboard?error=private_group_locked");
        }
      }
    }

    // 3. Preluăm membrii
    const { data: members, error: memErr } = await supabase
      .from("group_members")
      .select("user_id, role, profiles(full_name)")
      .eq("group_id", id);
    if (memErr) console.error("Err members:", memErr);
    let safeMembers = members || [];

    // 4. AUTO-JOIN
    const isMember = safeMembers.find((m) => m.user_id === req.user.id);
    if (!isMember) {
      const { error: joinError } = await supabase
        .from("group_members")
        .insert([{ group_id: id, user_id: req.user.id, role: "member" }]);
      if (!joinError) {
        safeMembers.push({
          user_id: req.user.id,
          role: "member",
          profiles: { full_name: userDisplay.full_name },
        });
      }
    }

    // 5. Determinăm Rolul Meu
    const myRecord = safeMembers.find((m) => m.user_id === req.user.id);
    let myGroupRole = "member";
    if (group.created_by === req.user.id) myGroupRole = "owner";
    else if (myRecord) myGroupRole = myRecord.role || "member";
    if (req.user.role === "admin") myGroupRole = "admin";

    // 6. Fetch Conținut
    const { data: lessons } = await supabase
      .from("group_lessons")
      .select("lesson_id, lessons(title, category, id)")
      .eq("group_id", id);
    const { data: exercises } = await supabase
      .from("group_exercises")
      .select("exercise_id, exercises(title, category, difficulty, id)")
      .eq("group_id", id);

    // 7. Statistici
    const { data: stats } = await supabase
      .from("group_exercise_results")
      .select(`score, created_at, profiles (full_name), exercises (title)`)
      .eq("group_id", id)
      .order("created_at", { ascending: false });

    const lbMap = {};
    if (stats)
      stats.forEach((s) => {
        const n = s.profiles?.full_name || "Anonim";
        if (!lbMap[n]) lbMap[n] = { name: n, score: 0, tests: 0 };
        lbMap[n].score += s.score;
        lbMap[n].tests++;
      });
    const leaderboard = Object.values(lbMap).sort((a, b) => b.score - a.score);

    // 8. Resurse Globale
    const { data: allL } = await supabase.from("lessons").select("id, title");
    const { data: allE } = await supabase.from("exercises").select("id, title");
    const { data: myF } = await supabase
      .from("flashcards")
      .select("*")
      .eq("user_id", userDisplay.id);

    const translations = { ro, en, it };

    res.render("pages/study-group", {
      user: userDisplay,
      group,
      members: safeMembers,
      myGroupRole,
      groupLessons: lessons || [],
      groupExercises: exercises || [],
      leaderboard,
      recentActivity: stats || [],
      myFlashcards: myF || [],
      allLessons: allL || [],
      allExercises: allE || [],
      currentLang,
      translations,
    });
  } catch (err) {
    console.error("Critical Error:", err);
    res.redirect("/dashboard");
  }
};

// API: Promovare Membru (Acum suportă toggle Member <-> Moderator)
exports.promoteMember = async (req, res) => {
  const { groupId, targetUserId, newRole } = req.body;
  try {
    const { data: group } = await supabase
      .from("study_groups")
      .select("created_by")
      .eq("id", groupId)
      .single();

    // Verificăm permisiunile: Doar Ownerul sau un Admin Global poate promova
    if (group.created_by !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Fără permisiuni." });

    // Actualizăm rolul
    const { error } = await supabase
      .from("group_members")
      .update({ role: newRole })
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);

    if (error) throw error;

    res.json({ success: true, newRole });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// API: Salvare Rezultat
exports.submitExerciseResult = async (req, res) => {
  const { groupId, exerciseId, score, total } = req.body;
  try {
    await supabase.from("group_exercise_results").insert([
      {
        group_id: groupId,
        exercise_id: exerciseId,
        user_id: req.user.id,
        score,
        total_questions: total,
      },
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Eroare salvare." });
  }
};

// API: Șterge Grup
exports.deleteGroup = async (req, res) => {
  const { groupId } = req.body;
  try {
    const { data: group } = await supabase
      .from("study_groups")
      .select("created_by")
      .eq("id", groupId)
      .single();
    if (!group) return res.status(404).json({ error: "Grup inexistent" });
    if (group.created_by !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Interzis" });

    await supabase.from("study_groups").delete().eq("id", groupId);
    res.json({ success: true, redirectUrl: "/groups" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// API: Add Content
exports.addLessonToGroup = async (req, res) => {
  try {
    await supabase.from("group_lessons").insert([
      {
        group_id: req.body.groupId,
        lesson_id: req.body.lessonId,
        added_by: req.user.id,
      },
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
exports.addExerciseToGroup = async (req, res) => {
  try {
    await supabase.from("group_exercises").insert([
      {
        group_id: req.body.groupId,
        exercise_id: req.body.exerciseId,
        added_by: req.user.id,
      },
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET: Lista de Grupuri (Pagina Publică)
exports.getGroupsList = async (req, res) => {
  const currentLang = req.cookies.sapere_lang || "ro";

  try {
    const { data: groups, error } = await supabase
      .from("study_groups")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const translations = { ro, en, it };

    res.render("pages/groups-list", {
      title: "Grupuri de Studiu",
      user: req.user,
      groups: groups || [],
      currentLang: currentLang,
      translations: translations,
    });
  } catch (err) {
    console.error(err);
    res.redirect("/dashboard");
  }
};

// 5. Creare Grup Nou
exports.createGroup = async (req, res) => {
  const { name, subject } = req.body;
  try {
    // 1. Creăm Grupul
    const { data, error } = await supabase
      .from("study_groups")
      .insert([{ name, subject, created_by: req.user.id }])
      .select()
      .single();

    if (error) throw error;

    // 2. CRITIC: Adăugăm creatorul ca membru 'owner' imediat
    const { error: memberError } = await supabase.from("group_members").insert([
      {
        group_id: data.id,
        user_id: req.user.id,
        role: "owner",
      },
    ]);

    if (memberError) console.error("Eroare adăugare owner:", memberError);

    res.redirect(`/groups/${data.id}`);
  } catch (err) {
    console.error("Eroare creare grup:", err);
    res.redirect("/dashboard?error=create_failed");
  }
};
