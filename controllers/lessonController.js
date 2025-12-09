const supabase = require('../config/supabase');

// Mapare pentru interogarea DB (Slug URL -> Valoare din coloana 'category')
// Acestea trebuie să rămână fixe pentru că așa sunt salvate în baza de date
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

        // Titlul paginii va fi suprascris în EJS în funcție de limbă, 
        // dar trimitem titlul default (RO) aici.
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

// 3. POST (API): Resetează progresul lecției
exports.resetLessonProgress = async (req, res) => {
    const { lessonId } = req.body;

    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Trebuie să fii autentificat.' });
        }

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
    const dbCategory = categoryMap[slug]; // Ex: 'Matematică'

    if (!dbCategory) {
        return res.status(404).render('pages/404', { 
            title: 'Categorie Inexistentă',
            user: req.user || null
        });
    }

    try {
        // [FIX CRITIC]: Adăugat 'content' la select. 
        // Fără 'content', frontend-ul nu are acces la traducerile din JSON (ro/en/it).
        const { data: lessons, error } = await supabase
            .from('lessons')
            .select('id, title, subtitle, level, read_time, created_at, content') 
            .eq('category', dbCategory)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // [FIX]: Traducem numele categoriei pentru afișare
        // Folosim slug-ul (ex: 'math') pentru a căuta cheia de traducere (ex: 'subjects.math')
        // Fallback la numele din DB dacă traducerea lipsește
        const translatedCategoryName = req.__(`subjects.${slug}`) || dbCategory;

        res.render('pages/category', {
            title: `Lecții de ${translatedCategoryName}`,
            categoryName: translatedCategoryName, // Trimitem numele tradus către EJS
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