const supabase = require('../config/supabase');
const fs = require('fs');

exports.uploadFile = async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Niciun fișier selectat.' });

        // Nume unic: timestamp + nume_original
        const fileName = `${Date.now()}_${file.originalname}`;

        // Upload în Supabase Storage
        const { data, error } = await supabase.storage
            .from('group-files')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype
            });

        if (error) throw error;

        // Obținem URL-ul public
        const { data: publicData } = supabase.storage
            .from('group-files')
            .getPublicUrl(fileName);

        res.json({ 
            success: true, 
            fileUrl: publicData.publicUrl, 
            fileName: file.originalname,
            fileType: file.mimetype
        });

    } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).json({ error: 'Eroare la încărcare.' });
    }
};