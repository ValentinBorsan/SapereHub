const supabase = require('../config/supabase');

exports.getHomePage = async (req, res) => {
    try {
        // 1. Preluăm cel mai recent anunț activ
        const { data: noticeData, error } = await supabase
            .from('notices')
            .select('content, updated_at')
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        // Mesaj fallback dacă nu există nimic în DB sau apare o eroare
        const noticeContent = noticeData ? noticeData.content : "Bine ați venit! Nu există anunțuri noi.";
        const noticeTime = noticeData ? new Date(noticeData.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "";

        // 2. Randăm pagina home cu datele
        res.render('pages/home', {
            title: 'Acasă | SaperePlus',
            user: req.user || null,
            notice: {
                content: noticeContent,
                time: noticeTime
            }
        });

    } catch (err) {
        console.error("Home Controller Error:", err);
        // Fallback în caz de eroare critică
        res.render('pages/home', {
            title: 'Acasă',
            user: req.user || null,
            notice: { content: "Bine ați venit!", time: "" }
        });
    }
};