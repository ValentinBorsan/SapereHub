const supabase = require('../config/supabase');

// 1. Pagina HUB (Lista de lecții de fizică)
exports.getHub = async (req, res) => {
    try {
        const { data: lessons, error } = await supabase
            .from('presentations')
            .select('title, description, slug, category, cover_image')
            .eq('category', 'Fizică')
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.render('pages/physics_hub', {
            title: 'Hub Fizică - SaperePlus',
            lessons: lessons || []
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Eroare la încărcarea hub-ului.');
    }
};

// 2. Pagina PREZENTARE (Lecția individuală)
exports.getPresentation = async (req, res) => {
    try {
        const { slug } = req.params;

        const { data: lesson, error } = await supabase
            .from('presentations')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error || !lesson) {
            return res.status(404).render('pages/404', { title: 'Lecția nu există' });
        }

        // Randăm pagina generică de prezentare, pasând datele din DB
        res.render('pages/presentation', {
            layout: 'layouts/presentation', // Folosim layout-ul creat anterior
            title: lesson.title,
            lesson: lesson,
            slides: lesson.content // JSON-ul cu slide-uri
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Eroare server.');
    }
};