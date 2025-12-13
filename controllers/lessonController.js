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

// Configurare Recompense XP
const XP_REWARDS = {
    SUBMISSION: 20, // XP primit la trimiterea lecției
    APPROVAL: 80,   // XP primit când lecția este aprobată
    COMPLETION: 50  // XP primit la parcurgerea unei lecții
};

const XP_PER_LEVEL = 1000; // Constanta pentru calcul nivel

// Helper pentru calculul nivelului
const calculateLevel = (xp) => Math.floor(xp / XP_PER_LEVEL) + 1;

// --- HELPER ROBUST PENTRU UPDATE XP & NOTIFICĂRI LEVEL UP ---
async function processXPUpdate(userId, xpAmount) {
    try {
        // 1. Luăm profilul curent
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('xp, level')
            .eq('id', userId)
            .single();

        if (error || !profile) return { xpAdded: 0, newLevel: 1, leveledUp: false };

        // 2. Calcule sigure (Number)
        const currentXP = Number(profile.xp) || 0;
        const currentLevel = Number(profile.level) || 1;
        
        const newXP = currentXP + Number(xpAmount);
        const newLevel = calculateLevel(newXP);
        const leveledUp = newLevel > currentLevel;

        // 3. Update DB
        await supabase
            .from('profiles')
            .update({ xp: newXP, level: newLevel })
            .eq('id', userId);

        // 4. Notificare Specială de Level Up
        if (leveledUp) {
            await supabase.from('notifications').insert({
                user_id: userId,
                type: 'reward', // Tip special pentru UI (ex: auriu)
                message: `🎉 Felicitări! Ai avansat la Nivelul ${newLevel}!`,
                read: false,
                created_at: new Date()
            });
        }

        return { xpAdded: xpAmount, newXP, newLevel, leveledUp };

    } catch (e) {
        console.error("Eroare processXPUpdate:", e);
        return null;
    }
}

// 1. GET: Vizualizare Lecție Individuală
exports.getLesson = async (req, res) => {
    const lessonId = req.params.id;

    try {
        const { data: lesson, error } = await supabase
            .from('lessons')
            .select('*, profiles:author_id(full_name, role)') 
            .eq('id', lessonId)
            .single();

        if (error || !lesson) {
            console.error("Lecție negăsită:", error?.message);
            return res.status(404).render('pages/404', { 
                title: 'Lecție negăsită',
                user: req.user || null 
            });
        }

        // --- SECURITATE: Verificăm dacă lecția este publicată ---
        // Dacă NU este publicată, permitem accesul doar Autorului sau Adminului
        if (lesson.status !== 'published') {
            const isAuthorized = req.user && (req.user.role === 'admin' || req.user.id === lesson.author_id);
            
            if (!isAuthorized) {
                return res.status(404).render('pages/404', { 
                    title: 'Lecție indisponibilă',
                    user: req.user || null 
                });
            }
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

        // Verificăm dacă a fost deja completată
        const { data: existingEntry } = await supabase
            .from('lesson_progress')
            .select('id, is_completed')
            .eq('user_id', req.user.id)
            .eq('lesson_id', lessonId)
            .single();

        let resultXP = { xpAdded: 0, newLevel: req.user.level || 1, newXP: req.user.xp || 0, leveledUp: false };

        // Acordăm XP doar dacă NU a fost completată anterior
        if (!existingEntry || !existingEntry.is_completed) {
            const updateRes = await processXPUpdate(req.user.id, XP_REWARDS.COMPLETION);
            if (updateRes) resultXP = updateRes;
        }

        // Salvăm progresul
        const { error } = await supabase
            .from('lesson_progress')
            .upsert({ 
                user_id: req.user.id, 
                lesson_id: lessonId, 
                is_completed: true,
                completed_at: new Date()
            }, { onConflict: 'user_id, lesson_id' });

        if (error) throw error;
        
        res.json({ 
            success: true, 
            xpAwarded: resultXP.xpAdded,
            totalXP: resultXP.newXP,
            currentLevel: resultXP.newLevel,
            leveledUp: resultXP.leveledUp
        });

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
            .select('id, title, subtitle, level, read_time, created_at, content') 
            .eq('category', dbCategory)
            .eq('status', 'published') // CRITIC: Filtrăm doar lecțiile publicate
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

// DELETE: Șterge o lecție + NOTIFICARE CONTRIBUITOR
exports.deleteLesson = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Nu ai permisiuni de ștergere.' });
        }

        // 1. Luăm datele lecției ÎNAINTE de ștergere pentru a ști cui trimitem notificare
        const { data: lessonToDelete, error: fetchError } = await supabase
            .from('lessons')
            .select('title, author_id')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error("Lesson fetch error before delete:", fetchError);
            // Putem continua ștergerea chiar dacă nu găsim detaliile, dar e riscant
        }

        // 2. Ștergem lecția efectiv
        const { error } = await supabase
            .from('lessons')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // 3. Trimitem notificare autorului (dacă există și nu e adminul însuși)
        if (lessonToDelete && lessonToDelete.author_id && lessonToDelete.author_id !== req.user.id) {
            await supabase.from('notifications').insert({
                user_id: lessonToDelete.author_id,
                type: 'warning', // Roșu/Portocaliu în UI
                message: `Lecția ta "${lessonToDelete.title}" a fost ștearsă de un administrator.`,
                read: false,
                created_at: new Date()
            });
        }

        res.json({ success: true, message: 'Lecție ștearsă cu succes și autor notificat.' });

    } catch (err) {
        console.error("Delete Lesson Error:", err);
        res.status(500).json({ error: "Eroare la ștergerea lecției." });
    }
};

// --- CONTRIBUȚII & ADMIN ---

// POST: Upload Lecție (Contribuitor)
exports.uploadLessonContribBlocks = async (req, res) => {
    try {
        const { title, subtitle, category, level, content, read_time } = req.body;
        const userId = req.user.id; 

        if (!title || !content) {
            return res.status(400).json({ error: 'Titlul și conținutul sunt obligatorii.' });
        }

        const lessonData = {
            title: title,
            subtitle: subtitle || '',
            category: category || 'Altele',
            level: level || 'Începător',
            read_time: read_time || 10,
            content: content, 
            author_id: userId, 
            status: 'pending', 
            created_at: new Date(),
            updated_at: new Date()
        };

        const { data, error } = await supabase
            .from('lessons')
            .insert([lessonData])
            .select();

        if (error) throw error;

        // ACORDARE XP (CREARE) - Folosim helper-ul robust
        const xpRes = await processXPUpdate(userId, XP_REWARDS.SUBMISSION);

        res.status(201).json({
            success: true,
            message: `Lecția a fost trimisă! Ai primit ${xpRes ? xpRes.xpAdded : 0} XP pentru contribuție.`,
            lessonId: data[0].id,
            xpAdded: xpRes ? xpRes.xpAdded : 0,
            leveledUp: xpRes ? xpRes.leveledUp : false
        });

    } catch (err) {
        console.error("Upload Lesson Contrib Error:", err);
        res.status(500).json({ error: 'Eroare la salvarea lecției.' });
    }
};

exports.getPendingLessons = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).send('Acces neautorizat.');
        }

        const { data: lessons, error } = await supabase
            .from('lessons')
            .select('*, profiles:author_id(full_name, email)') 
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.render('pages/admin/pending-lessons', {
            title: 'Lecții în Așteptare',
            lessons: lessons || [],
            user: req.user
        });

    } catch (err) {
        console.error("Get Pending Lessons Error:", err);
        res.status(500).send('Eroare server.');
    }
};

// POST: Aprobă lecția + ACORDĂ BONUS XP + NOTIFICARE
exports.approveLesson = async (req, res) => {
    try {
        const { lessonId } = req.body;

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Acces neautorizat.' });
        }

        // 1. Luăm lecția ORIGINALĂ
        const { data: originalLesson, error: fetchError } = await supabase
            .from('lessons')
            .select('author_id, title, status')
            .eq('id', lessonId)
            .single();

        if (fetchError || !originalLesson) {
            return res.status(404).json({ error: "Lecția nu a fost găsită." });
        }

        // Prevent double approval XP
        if (originalLesson.status === 'published') {
            return res.status(400).json({ error: "Lecția este deja publicată." });
        }

        // 2. Aprobăm lecția
        const { error: updateError } = await supabase
            .from('lessons')
            .update({ status: 'published', updated_at: new Date() })
            .eq('id', lessonId);

        if (updateError) throw updateError;

        // 3. Acordăm XP Autorului și Trimitem NOTIFICARE
        let xpAwarded = 0;

        if (originalLesson.author_id) {
            // Folosim helper-ul robust pentru XP și Level Up
            const xpRes = await processXPUpdate(originalLesson.author_id, XP_REWARDS.APPROVAL);
            
            if (xpRes) xpAwarded = xpRes.xpAdded;

            // Notificare Aprobare
            const { error: notifError } = await supabase.from('notifications').insert({
                user_id: originalLesson.author_id,
                type: 'success', 
                message: `Lecția ta "${originalLesson.title}" a fost aprobată! Ai primit ${xpAwarded} XP.`,
                read: false,
                created_at: new Date()
            });

            if(notifError) console.error("Eroare creare notificare aprobare:", notifError);
        }

        res.json({ 
            success: true, 
            message: 'Lecția a fost aprobată, XP acordat și notificare trimisă.',
            xpAwarded: xpAwarded,
            authorId: originalLesson.author_id
        });

    } catch (err) {
        console.error("Approve Lesson Error:", err);
        res.status(500).json({ error: 'Eroare la aprobarea lecției.' });
    }
};

// POST: Respinge lecția + NOTIFICARE
exports.rejectLesson = async (req, res) => {
    try {
        const { lessonId, reason } = req.body; 

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Acces neautorizat.' });
        }

        // 1. Luăm datele lecției pentru notificare
        const { data: lesson, error: fetchError } = await supabase
            .from('lessons')
            .select('title, author_id')
            .eq('id', lessonId)
            .single();

        if(fetchError) console.error("Nu am găsit lecția pentru respingere:", fetchError);

        // 2. Respingem lecția
        const { error } = await supabase
            .from('lessons')
            .update({ status: 'rejected', updated_at: new Date() }) 
            .eq('id', lessonId);

        if (error) throw error;

        // 3. Trimitem notificare de respingere
        if(lesson && lesson.author_id) {
             const { error: notifError } = await supabase.from('notifications').insert({
                user_id: lesson.author_id,
                type: 'error', 
                message: `Lecția ta "${lesson.title}" a fost respinsă.${reason ? ' Motiv: ' + reason : ''}`,
                read: false,
                created_at: new Date()
            });
            if(notifError) console.error("Eroare creare notificare respingere:", notifError);
        }

        res.json({ success: true, message: 'Lecția a fost respinsă.' });

    } catch (err) {
        console.error("Reject Lesson Error:", err);
        res.status(500).json({ error: 'Eroare la respingerea lecției.' });
    }
};