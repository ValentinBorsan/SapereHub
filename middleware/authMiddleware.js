const supabase = require('../config/supabase');

const requireAuth = async (req, res, next) => {
    const token = req.cookies.sb_token;

    if (!token) {
        return res.redirect('/auth/login');
    }

    // 1. Verificăm userul Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        res.clearCookie('sb_token');
        return res.redirect('/auth/login');
    }

    // 2. Luăm rolul ȘI NUMELE din tabelul 'profiles'
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name') 
        .eq('id', user.id)
        .single();

    // Atașăm datele la obiectul user
    user.role = profile ? profile.role : 'student';
    user.full_name = profile ? (profile.full_name || user.email.split('@')[0]) : 'Student';

    req.user = user;
    res.locals.user = user;
    
    next();

};

module.exports = requireAuth;