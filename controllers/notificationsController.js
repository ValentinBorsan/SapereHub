const supabase = require('../config/supabase');

// 1. GET: Pagina dedicată cu toate notificările
exports.getNotificationsPage = async (req, res) => {
    try {
        if (!req.user) return res.redirect('/auth');

        const { data: notifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.render('pages/notifications', {
            title: 'Notificările Mele',
            notifications: notifications || [],
            user: req.user
        });
    } catch (err) {
        console.error("Eroare pagina notificări:", err);
        res.redirect('/dashboard');
    }
};

// 2. API: Obține notificările recente (pentru Navbar)
exports.getRecentNotifications = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Neautorizat" });

        // Luăm ultimele 5 notificări
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        // Numărăm notificările necitite
        const { count, error: countError } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', req.user.id)
            .eq('read', false);

        if (countError) throw countError;

        res.json({ 
            success: true, 
            notifications: data, 
            unreadCount: count 
        });

    } catch (err) {
        console.error("API Notificări Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 3. API: Marchează ca citit
exports.markAsRead = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Neautorizat" });

        const { id } = req.body;
        let query = supabase.from('notifications').update({ read: true }).eq('user_id', req.user.id);
        
        // Dacă id nu e 'all', marcăm doar una specifică
        if (id !== 'all') {
            query = query.eq('id', id);
        }

        const { error } = await query;
        if (error) throw error;

        res.json({ success: true });
    } catch (err) {
        console.error("Mark Read Error:", err);
        res.status(500).json({ error: err.message });
    }
};