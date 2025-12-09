// controllers/userController.js

const requestDeleteAccount = async (req, res) => {
    try {
        const userId = req.user.id; // Presupunem că ai middleware de auth care populează req.user

        // AICI implementezi logica ta de ștergere:
        // 1. Ștergi datele din baza de date
        // 2. Sau marchezi contul ca "deleted" (soft delete)
        // 3. Sau trimiți un email de confirmare
        
        console.log(`Solicitare ștergere cont pentru userul: ${userId}`);

        // Pentru moment, doar simulăm succesul și facem logout
        // Decomentează linia de mai jos dacă vrei să ștergi sesiunea imediat
        // req.logout((err) => { if (err) console.error(err) });

        // Redirecționăm către o pagină de confirmare sau homepage
        // Poți crea o pagină dedicată "goodbye.ejs"
        res.render('pages/home', {
            layouts: 'main', // Sau o pagină de confirmare
            title: 'Cont Șters',
            user: null,
            success: 'Cererea ta a fost înregistrată. Contul va fi șters în 30 de zile.'
        });

    } catch (error) {
        console.error('Eroare la ștergerea contului:', error);
        res.status(500).render('pages/legal/delete-account', {
            layouts: 'main',
            title: 'Ștergere Cont',
            user: req.user,
            error: 'A apărut o eroare. Te rugăm să încerci din nou.'
        });
    }
};

module.exports = {
    requestDeleteAccount
};