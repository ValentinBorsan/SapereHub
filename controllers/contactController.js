const emailService = require('../services/emailService');

// GET: Afișează pagina
const getContactPage = (req, res) => {
    res.render('pages/contact', {
        layouts:'main',
        title: res.__('nav.contact') || 'Contact',
        user: req.user || null
    });
};

// POST: Procesează formularul
const sendContactMessage = async (req, res) => {
    const { firstName, lastName, email, message } = req.body;

    // Validare simplă
    if (!firstName || !email || !message) {
        return res.render('pages/contact', {
            layouts: 'main',
            title: res.__('nav.contact'),
            user: req.user || null,
            error: res.__('contact.error.missing_fields') || 'Toate câmpurile sunt obligatorii.'
        });
    }

    // Trimite email
    const result = await emailService.sendContactEmail({ firstName, lastName, email, message });

    if (result.success) {
        return res.render('pages/contact', {
            layouts: 'main',
            title: res.__('nav.contact'),
            user: req.user || null,
            success: res.__('contact.success.sent') || 'Mesajul a fost trimis cu succes!'
        });
    } else {
        return res.render('pages/contact', {
            layouts: 'main',
            title: res.__('nav.contact'),
            user: req.user || null,
            error: res.__('contact.error.send_failed') || 'Eroare la trimitere. Încearcă din nou.'
        });
    }
};

module.exports = {
    getContactPage,
    sendContactMessage
};