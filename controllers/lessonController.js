const supabase = require('../config/supabase');

// Mapare pentru interogarea DB (Slug URL -> Valoare din coloana 'category')
const categoryMap = {
    'math': 'Matematică',
    'science': 'Științe',
    'history': 'Istorie',
    'geography': 'Geografie',
    'italian': 'Italiana',
    'english': 'English',
    'technology': 'Tehnologie',
    'it': 'IT',
    'languages': 'Limbi'
};

// 1. GET: Vizualizare Lecție Individuală
exports.getLesson = async (req, res) => {
    const lessonId = req.params.id;

    try {
        const { data: lesson, error } = await supabase
            .from('lessons')
            .select('*')
            .eq('id', lessonId)
            .single();

        if (error || !lesson) {
            console.error("Lecție negăsită:", error?.message);
            return res.status(404).render('pages/404', { 
                title: 'Lecție negăsită',
                user: req.user || null 
            });
        }

        let isCompleted = false;
        if (req.user) {
            const { data: progress } = await supabase
                .from('lesson_progress')
                .select('is_completed')
                .eq('user_id', req.user.id)
                .eq('lesson_id', lessonId)
                .single();
            
            if (progress) isCompleted = progress.is_completed;
        }

        res.render('pages/lesson', { 
            title: lesson.title,
            lesson: lesson,
            isCompleted: isCompleted,
            user: req.user || null
        });

    } catch (err) {
        console.error("Server Error (Get Lesson):", err);
        res.status(500).render('pages/404', { 
            title: 'Eroare Server', 
            user: req.user || null 
        });
    }
};

// 2. POST (API): Marchează lecția ca terminată + XP Logic
exports.markLessonComplete = async (req, res) => {
    const { lessonId } = req.body;
    const XP_REWARD = 50; // Cantitatea de XP pentru prima finalizare

    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Trebuie să fii autentificat.' });
        }

        // 1. Verificăm istoricul pentru a vedea dacă a mai interacționat cu lecția
        const { data: existingEntry } = await supabase
            .from('lesson_progress')
            .select('id, is_completed')
            .eq('user_id', req.user.id)
            .eq('lesson_id', lessonId)
            .single();

        let xpAwarded = 0;
        let leveledUp = false;
        let newLevel = req.user.level;
        let newXP = req.user.xp;

        // 2. Dacă NU există nicio intrare, este prima dată absolut -> Dăm XP
        if (!existingEntry) {
            xpAwarded = XP_REWARD;
            newXP = (req.user.xp || 0) + XP_REWARD;
            
            // Calculăm noul nivel (Exemplu: fiecare 1000 XP = 1 Nivel)
            // Poți ajusta formula în funcție de sistemul tău de gamification
            const calculatedLevel = Math.floor(newXP / 1000) + 1;
            
            if (calculatedLevel > req.user.level) {
                newLevel = calculatedLevel;
                leveledUp = true;
            }

            // Actualizăm profilul utilizatorului
            await supabase
                .from('profiles')
                .update({ xp: newXP, level: newLevel })
                .eq('id', req.user.id);
        }

        // 3. Salvăm progresul (Upsert)
        // Setăm is_completed = true. Dacă rândul exista (de la un reset anterior), doar îl actualizăm.
        const { error } = await supabase
            .from('lesson_progress')
            .upsert({ 
                user_id: req.user.id, 
                lesson_id: lessonId, 
                is_completed: true,
                completed_at: new Date()
            }, { onConflict: 'user_id, lesson_id' });

        if (error) throw error;
        
        // Returnăm datele pentru a actualiza UI-ul (Toast, Navbar)
        res.json({ 
            success: true, 
            xpAwarded: xpAwarded,
            totalXP: newXP,
            currentLevel: newLevel,
            leveledUp: leveledUp
        });

    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 3. POST (API): Resetează progresul lecției (Soft Reset)
exports.resetLessonProgress = async (req, res) => {
    const { lessonId } = req.body;

    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Trebuie să fii autentificat.' });
        }

        // SCHIMBARE MAJORĂ: Folosim UPDATE în loc de DELETE
        // Setăm is_completed pe false, dar păstrăm rândul în DB.
        // Astfel, markLessonComplete va ști că utilizatorul a mai fost aici și nu va mai da XP.
        const { error } = await supabase
            .from('lesson_progress')
            .update({ is_completed: false })
            .eq('user_id', req.user.id)
            .eq('lesson_id', lessonId);

        if (error) throw error;

        res.json({ success: true, message: 'Progres resetat.' });

    } catch (err) {
        console.error("Reset Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 4. GET: Listează Lecții după Categorie (Rămâne neschimbat)
exports.getLessonsByCategory = async (req, res) => {
    const slug = req.params.category ? req.params.category.toLowerCase() : ''; 
    const dbCategory = categoryMap[slug]; 

    if (!dbCategory) {
        return res.status(404).render('pages/404', { 
            title: 'Categorie Inexistentă',
            user: req.user || null
        });
    }

    try {
        const { data: lessons, error } = await supabase
            .from('lessons')
            .select('id, title, subtitle, level, read_time, created_at, content') 
            .eq('category', dbCategory)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const translatedCategoryName = req.__(`subjects.${slug}`) || dbCategory;

        res.render('pages/category', {
            title: `Lecții de ${translatedCategoryName}`,
            categoryName: translatedCategoryName,
            lessons: lessons || [],
            user: req.user || null
        });

    } catch (err) {
        console.error("Category Error:", err);
        res.status(500).render('pages/404', { 
            title: 'Eroare Server',
            user: req.user || null 
        });
    }
};

// DELETE: Șterge o lecție (Doar Admin) (Rămâne neschimbat)
exports.deleteLesson = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Nu ai permisiuni de ștergere.' });
        }

        const { error } = await supabase
            .from('lessons')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Lecție ștearsă cu succes.' });

    } catch (err) {
        console.error("Delete Lesson Error:", err);
        res.status(500).json({ error: "Eroare la ștergerea lecției." });
    }
};