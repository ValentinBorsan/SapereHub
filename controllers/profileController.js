const supabase = require('../config/supabase');

exports.getProfilePage = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Luăm datele PROFILULUI (XP, Level, Streak) direct din DB
        // Facem asta aici pentru a fi siguri că avem cele mai recente date, chiar dacă middleware-ul a rulat deja
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError) console.error("Eroare profil:", profileError);

        // 2. Luăm FLASHCARDURILE
        const { data: flashcards } = await supabase
            .from('flashcards')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        // 3. Luăm ISTORICUL LECȚIILOR (și le numărăm)
        const { data: progressData, error: progressError } = await supabase
            .from('lesson_progress')
            .select(`
                completed_at,
                lessons (id, title, category, level)
            `)
            .eq('user_id', userId)
            .eq('is_completed', true)
            .order('completed_at', { ascending: false });

        const completedLessons = progressData || [];
        
        // --- PREGĂTIM DATELE PENTRU VIEW ---
        // Folosim datele din 'profile' (DB), nu din 'req.user' (Sesiune) pentru acuratețe maximă
        const userDisplay = {
            ...req.user, // Date de bază (email, id)
            full_name: profile?.full_name || req.user.email.split('@')[0],
            role: profile?.role || 'student',
            xp: profile?.xp || 0,          // AICI E CHEIA: Citim XP din DB
            level: profile?.level || 1,    // AICI E CHEIA: Citim Level din DB
            streak: profile?.streak || 0
        };
        const { count } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', req.user.id)
        .eq('status', 'published');

    const isContributor = count > 0;


        res.render('pages/profile', { 
            title: 'Profilul Meu',
            user: userDisplay,       // Trimitem obiectul user actualizat
            flashcards: flashcards || [],
            completedLessons: completedLessons,
            stats: {
                count: completedLessons.length // Doar numărul lecțiilor e calculat
            },
            success: req.query.success,
            error: req.query.error,
            isContributor: isContributor
        });

    } catch (err) {
        console.error("Profile Controller Error:", err);
        res.redirect('/?error=server');
    }
};

// ... (funcția updateProfile rămâne la fel)
exports.updateProfile = async (req, res) => {
    // Codul existent...
    const { full_name } = req.body;
    try {
        await supabase.from('profiles').update({ full_name }).eq('id', req.user.id);
        res.redirect('/profile?success=updated');
    } catch (err) {
        res.redirect('/profile?error=failed');
    }
};