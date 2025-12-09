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
        // Formula de nivel: Level 1 (0-99), Level 2 (100-299), etc.
        // Formula simplificată: Level = 1 + floor(xp / 100)
        const newLevel = 1 + Math.floor(newXP / 100);
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