const supabase = require('../config/supabase'); // Asigură-te că calea e corectă

exports.sendMessage = async (req, res) => {
    try {
        const { lessonId, content } = req.body;

        // 1. Validări
        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Mesajul este gol." });
        }
        
        // Verificăm auth (req.user trebuie să fie populat de middleware-ul tău de auth)
        if (!req.user) {
            return res.status(401).json({ error: "Nu ești autentificat." });
        }

        // 2. Pregătim datele
        const newMessage = {
            lesson_id: lessonId, // Acum va accepta UUID
            user_id: req.user.id,
            username: req.user.user_metadata?.full_name || req.user.email?.split('@')[0] || 'Utilizator',
            content: content.trim()
        };

        // 3. Inserare în Supabase
        const { data, error } = await supabase
            .from('lesson_messages')
            .insert([newMessage])
            .select()
            .single();

        if (error) {
            console.error('Supabase Error:', error);
            return res.status(500).json({ error: 'Eroare la salvarea mesajului.' });
        }

        return res.json({ success: true, message: data });

    } catch (err) {
        console.error('Server Error:', err);
        return res.status(500).json({ error: 'Eroare internă server.' });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { lessonId } = req.params;

        const { data, error } = await supabase
            .from('lesson_messages')
            .select('*')
            .eq('lesson_id', lessonId)
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) throw error;

        return res.json({ messages: data });
    } catch (err) {
        return res.status(500).json({ error: 'Nu am putut încărca mesajele.' });
    }
};