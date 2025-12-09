const supabase = require("../config/supabase");

exports.getContent = async (req, res) => {
    const { type, id } = req.params;
    const lang = req.query.lang || 'ro'; // Limba cerută

    try {
        let table = type === 'lesson' ? 'lessons' : 'exercises';
        
        const { data, error } = await supabase
            .from(table)
            .select('content, title')
            .eq('id', id)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Not found' });

        // Extragem conținutul specific limbii
        let specificContent = data.content[lang];

        // Fallback dacă nu există limba cerută
        if (!specificContent) {
            if (data.content.ro) specificContent = data.content.ro;
            else if (data.content.en) specificContent = data.content.en;
            else if (data.content.it) specificContent = data.content.it;
        }

        res.json({ 
            success: true, 
            title: data.title, 
            data: specificContent 
        });

    } catch (err) {
        console.error("API Content Error:", err);
        res.status(500).json({ error: 'Server error' });
    }
};