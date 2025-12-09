require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('❌ Lipsesc credențialele Supabase din .env');
}

// CONFIGURARE SPECIALĂ PENTRU SERVER (Node.js)
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        flowType: 'pkce',           // Forțăm schimbul de cod (Code Exchange)
        detectSessionInUrl: false,  // CRITIC: Oprește clientul să caute # în URL pe server
        autoRefreshToken: false,    // Gestionăm noi sesiunea prin cookie
        persistSession: false       // Nu vrem să salveze în fișiere locale
    }
});

console.log('✅ Supabase conectat (Server Mode - PKCE).');

module.exports = supabase;