const getTerms = (req, res) => {
    res.render('pages/legal/terms', {
        layouts: 'main',
        title: res.__('legal.terms.title') || 'Termeni și Condiții',
        user: req.user || null
    });
};

const getPrivacy = (req, res) => {
    res.render('pages/legal/privacy', {
        layouts: 'main',
        title: res.__('legal.privacy.title') || 'Politica de Confidențialitate',
        user: req.user || null
    });
};

const getCookies = (req, res) => {
    res.render('pages/legal/cookies', {
        layouts: 'main',
        title: res.__('legal.cookies.title') || 'Politica de Cookies',
        user: req.user || null
    });
};

const getDeleteAccount = (req, res) => {
    res.render('pages/legal/delete-account', {
        layouts: 'main',
        title: res.__('legal.delete.title') || 'Ștergere Cont',
        user: req.user || null
    });
};

module.exports = {
    getTerms,
    getPrivacy,
    getCookies,
    getDeleteAccount
};