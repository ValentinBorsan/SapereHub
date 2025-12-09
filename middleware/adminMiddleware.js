const requireAdmin = (req, res, next) => {
    // Presupunem că requireAuth a rulat deja și avem req.user
    if (req.user && req.user.role === 'admin') {
        return next(); // Ești admin, treci mai departe
    }

    // Nu ești admin? Redirect la dashboard-ul normal sau home
    console.warn(`[Security] Acces interzis la Admin pentru: ${req.user.email}`);
    res.redirect('/dashboard'); 
};

module.exports = requireAdmin;