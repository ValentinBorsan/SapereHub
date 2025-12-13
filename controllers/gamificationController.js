const supabase = require('../config/supabase');

// Configurare Punctaje
const POINTS = {
    LESSON_COMPLETE: 100,
    EXERCISE_COMPLETE: 50,
    FLASHCARD_CREATE: 10,
    LOGIN_DAILY: 20
};

exports.addXP = async (req, res) => {
    try {
        const { action } = req.body;
        const userId = req.user.id;
        
        const xpAmount = POINTS[action] || 10; // Default 10

        // 1. Luăm datele curente
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('xp, level')
            .eq('id', userId)
            .single();

        if (fetchError) throw fetchError;

        // 2. Calculăm noile valori
        const newXP = (profile.xp || 0) + xpAmount;
        const newLevel = 1 + Math.floor(newXP / 1000); // ATENȚIE: Sincronizat cu logica din lessonController (1000xp per nivel)
        const leveledUp = newLevel > profile.level;

        // 3. Salvăm în DB
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
                xp: newXP, 
                level: newLevel,
                last_active_at: new Date()
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        res.json({ 
            success: true, 
            xpAdded: xpAmount, 
            totalXP: newXP, 
            currentLevel: newLevel,
            leveledUp: leveledUp
        });

    } catch (err) {
        console.error("Gamification Error:", err);
        res.status(500).json({ error: "Eroare la actualizarea XP" });
    }
};




exports.getUserStats = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Neautorizat" });
        }

        // Luăm datele proaspete din DB
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('xp, level')
            .eq('id', req.user.id)
            .single();

        if (error || !profile) {
            return res.status(404).json({ error: "Profil inexistent" });
        }

        res.json({
            success: true,
            xp: profile.xp,
            level: profile.level
        });

    } catch (err) {
        console.error("Eroare Gamification Stats:", err);
        res.status(500).json({ error: "Eroare server" });
    }
};