// controllers/authController.js
const supabase = require('../config/supabase');

// 1. LOGIN PAGE (GET)
exports.getLoginPage = (req, res) => {
    if (req.cookies.sb_token) return res.redirect('/dashboard');
    res.render('pages/login', { title: 'Autentificare', error: null, success: null,layout: 'layouts/auth' });
};

// 2. REGISTER PAGE (GET)
exports.getRegisterPage = (req, res) => {
    if (req.cookies.sb_token) return res.redirect('/dashboard');
    res.render('pages/register', { title: 'Înregistrare Cont', error: null,layout: 'layouts/auth'});
};

// 3. PROCESARE REGISTER (POST - Email/Password)
exports.register = async (req, res) => {
    const { name, email, password, confirm_password } = req.body;

    // Validări de bază
    if (!name || !email || !password) {
        return res.render('pages/register', { title: 'Înregistrare', error: 'Toate câmpurile sunt obligatorii.' });
    }
    if (password !== confirm_password) {
        return res.render('pages/register', { title: 'Înregistrare', error: 'Parolele nu coincid.' });
    }

    try {
        // Creăm userul în Supabase
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                // Salvăm numele în metadate (ca să nu facem tabel separat încă)
                data: { full_name: name } 
            }
        });

        if (error) throw error;

        // Succes! Trimitem la login cu mesaj
        // (Sau putem face auto-login, dar e mai sigur să ceară confirmare email dacă e activat)
        res.render('pages/login', { 
            title: 'Autentificare', 
            error: null,
            success: 'Cont creat cu succes! Te rugăm să te autentifici.' 
        });

    } catch (err) {
        console.error("Register Error:", err.message);
        return res.render('pages/register', { title: 'Înregistrare', error: err.message });
    }
};

// 4. PROCESARE LOGIN (POST - Email/Password)
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // ... restul codului (setare cookie) ...
        res.cookie('sb_token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3600000 * 24 * 7
        });

        return res.redirect('/#materii');

    } catch (err) {
        console.error("Login Error:", err.message); // Vedem eroarea în terminal
        
        return res.render('pages/login', { 
            title: 'Autentificare', 
            // MODIFICARE: Afișăm eroarea reală primită de la Supabase
            error: err.message, 
            success: null
        });
    }
};

// 5. GOOGLE AUTH (Start)
exports.loginGoogle = async (req, res) => {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // Aici îi spunem unde să se întoarcă DUPĂ ce trece prin serverele Supabase
                redirectTo: 'http://localhost:3000/auth/callback',
                
                // Forțăm ecranul de consent pentru a primi refresh token
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
                
                // Important: Vrem doar URL-ul, nu să facă redirect automat biblioteca
                skipBrowserRedirect: true 
            }
        });

        if (error) throw error;
        
        // Dacă totul e ok, primim un URL lung de la Supabase. Redirectăm userul acolo.
        if (data.url) {
            console.log("--> Redirecting to Google Auth URL:", data.url);
            res.redirect(data.url);
        } else {
            throw new Error("Nu s-a generat URL-ul de login.");
        }

    } catch (err) {
        console.error("Google Init Error:", err);
        res.redirect('/auth');
    }
};

// 6. AUTH CALLBACK (Finalizare)
exports.authCallback = async (req, res) => {
    const code = req.query.code; // Acum ar trebui să avem ?code=... datorită PKCE

    if (!code) {
        // Dacă ajungem aici și tot nu avem cod, logăm ce avem
        console.error("Callback Error: Query params received:", req.query);
        return res.redirect('/auth/login?error=NoCodeReceived');
    }

    try {
        // Schimbăm codul pe sesiune
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) throw error;

        console.log("✅ Sesiune creată pentru:", data.user.email);

        // Setăm cookie-ul
        res.cookie('sb_token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3600000 * 24 * 7
        });

        res.redirect('/#materii');

    } catch (err) {
        console.error("Exchange Error:", err);
        res.redirect(`/auth/login?error=${encodeURIComponent(err.message)}`);
    }
};

// 7. LOGOUT
exports.logout = async (req, res) => {
    res.clearCookie('sb_token');
    await supabase.auth.signOut();
    res.redirect('/');
};