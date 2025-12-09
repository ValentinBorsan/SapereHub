const supabase = require('../config/supabase');

// Mapare Slug URL -> Nume Categorie DB
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

// 2. POST (API): Marchează lecția ca terminată
exports.markLessonComplete = async (req, res) => {
    const { lessonId } = req.body;
    
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Trebuie să fii autentificat.' });
        }

        const { error } = await supabase
            .from('lesson_progress')
            .upsert({ 
                user_id: req.user.id, 
                lesson_id: lessonId, 
                is_completed: true,
                completed_at: new Date()
            }, { onConflict: 'user_id, lesson_id' });

        if (error) throw error;
        
        res.json({ success: true });

    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 3. POST (API): Resetează progresul lecției (NOU)
exports.resetLessonProgress = async (req, res) => {
    const { lessonId } = req.body;

    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Trebuie să fii autentificat.' });
        }

        // Ștergem înregistrarea din lesson_progress
        const { error } = await supabase
            .from('lesson_progress')
            .delete()
            .eq('user_id', req.user.id)
            .eq('lesson_id', lessonId);

        if (error) throw error;

        res.json({ success: true, message: 'Progres resetat.' });

    } catch (err) {
        console.error("Reset Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 4. GET: Listează Lecții după Categorie
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
            .select('id, title, subtitle, level, read_time, created_at')
            .eq('category', dbCategory)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.render('pages/category', {
            title: `Lecții de ${dbCategory}`,
            categoryName: dbCategory,
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

// DELETE: Șterge o lecție (Doar Admin)
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