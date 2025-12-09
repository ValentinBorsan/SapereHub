const supabase = require('../config/supabase');

exports.createFlashcard = async (req, res) => {
    try {
        const { front, back } = req.body;
        
        // Verificăm dacă userul e logat (req.user vine din middleware)
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Trebuie să fii autentificat.' });
        }

        if (!front) {
            return res.status(400).json({ error: 'Câmpul "Față" este obligatoriu.' });
        }

        const { data, error } = await supabase
            .from('flashcards')
            .insert([
                { 
                    user_id: req.user.id,
                    front: front,
                    back: back
                }
            ]);

        if (error) throw error;

        res.json({ success: true, message: 'Flashcard salvat!' });

    } catch (err) {
        console.error("Flashcard Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 1. GET: Pagina de Exersare
exports.getPracticeMode = async (req, res) => {
    try {
        // Luăm toate cardurile utilizatorului
        const { data: flashcards, error } = await supabase
            .from('flashcards')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false }); // Sau random() dacă vrei

        if (error) throw error;

        // Dacă nu are carduri, îl trimitem înapoi la profil sau afișăm mesaj
        if (!flashcards || flashcards.length === 0) {
            return res.render('pages/flashcards-practice', {
                title: 'Exersare',
                user: req.user,
                flashcards: [] 
            });
        }

        res.render('pages/flashcards-practice', {
            title: 'Exersare Flashcards',
            user: req.user,
            flashcards: flashcards
        });

    } catch (err) {
        console.error("Practice Error:", err);
        res.redirect('/profile');
    }
};

// 2. DELETE: Șterge un card
exports.deleteFlashcard = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('flashcards')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id); // Securitate: șterge doar dacă e al lui

        if (error) throw error;

        res.json({ success: true });

    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ error: "Nu s-a putut șterge cardul." });
    }
};