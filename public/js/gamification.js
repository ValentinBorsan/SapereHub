/**
 * Sistem Gamificare SapereHub
 * Gestionează XP, Niveluri și Notificări
 */

async function awardXP(actionType, customMessage = "") {
    try {
        const response = await fetch('/api/gamification/xp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: actionType })
        });

        const data = await response.json();

        if (data.success) {
            // 1. Arată Notificare (Toast)
            showToast(data.xpAdded, customMessage || getMessageForAction(actionType));
            
            // 2. Actualizează UI global (dacă avem elementele în navbar)
            updateNavbarStats(data.totalXP, data.currentLevel);

            // 3. Efect special la Level Up
            if (data.leveledUp) {
                showLevelUpModal(data.currentLevel);
            }
        }
    } catch (e) {
        console.error("Eroare Gamificare:", e);
    }
}

// Helper pentru mesaje
function getMessageForAction(action) {
    switch(action) {
        case 'LESSON_COMPLETE': return "Lecție finalizată!";
        case 'EXERCISE_COMPLETE': return "Exercițiu rezolvat!";
        case 'FLASHCARD_CREATE': return "Flashcard salvat!";
        default: return "Activitate înregistrată!";
    }
}

// UI: Toast Notification
function showToast(xp, message) {
    // Creăm elementul
    const toast = document.createElement('div');
    toast.className = "fixed bottom-6 left-6 bg-[#1e293b] border border-sapereOrange/50 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 z-[100] transform translate-y-20 opacity-0 transition-all duration-500";
    toast.innerHTML = `
        <div class="bg-sapereOrange/20 p-2 rounded-full text-sapereOrange">
            <i class='bx bxs-zap text-xl'></i>
        </div>
        <div>
            <h4 class="font-bold text-sapereOrange">+${xp} XP</h4>
            <p class="text-xs text-gray-300">${message}</p>
        </div>
    `;

    document.body.appendChild(toast);

    // Animație Intrare
    setTimeout(() => {
        toast.classList.remove('translate-y-20', 'opacity-0');
    }, 100);

    // Animație Ieșire
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// UI: Update Global Stats (Navbar, Drawer, Profile)
function updateNavbarStats(xp, level) {
    // 1. Navbar
    const xpNav = document.getElementById('user-xp-display');
    const lvlNav = document.getElementById('user-level-display');
    
    if(xpNav) xpNav.innerText = xp + " XP";
    if(lvlNav) lvlNav.innerText = "Lvl " + level;

    // 2. Profile Drawer (NOU)
    const drawerLvl = document.getElementById('drawer-level');
    const drawerXP = document.getElementById('drawer-xp-text');
    const drawerBar = document.getElementById('drawer-xp-bar');
    const drawerNext = document.getElementById('drawer-xp-next');

    if (drawerLvl && drawerXP && drawerBar && drawerNext) {
        const progressInLevel = xp % 100;
        const remaining = 100 - progressInLevel;
        
        drawerLvl.innerText = "Nivel " + level;
        drawerXP.innerText = xp + " XP";
        drawerNext.innerText = remaining + " XP";
        // Actualizăm bara (width)
        drawerBar.style.width = progressInLevel + "%";
    }

    // 3. Profile Page (NOU)
    const profileXP = document.getElementById('profile-xp-value');
    const profileLvl = document.getElementById('profile-level-value');

    if (profileXP) profileXP.innerText = xp;
    if (profileLvl) profileLvl.innerText = level;
}
// UI: Level Up Modal
function showLevelUpModal(level) {
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in";
    modal.innerHTML = `
        <div class="bg-[#1e293b] p-10 rounded-3xl border-2 border-sapereOrange text-center shadow-[0_0_50px_rgba(245,158,11,0.5)] transform scale-90 animate-bounce-in max-w-sm mx-4">
            <div class="text-6xl mb-4">🚀</div>
            <h2 class="text-3xl font-black text-white mb-2 uppercase italic">Level Up!</h2>
            <p class="text-gray-400 mb-6">Felicitări! Ai ajuns la nivelul <span class="text-sapereOrange font-bold text-xl">${level}</span>.</p>
            <button onclick="this.closest('.fixed').remove()" class="px-8 py-3 bg-sapereOrange hover:bg-orange-600 text-white font-bold rounded-xl transition shadow-lg">Continuă</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Confetti Effect (Simplu CSS sau JS ar fi ideal aici)
}

// Inject styles for animations
const style = document.createElement('style');
style.innerHTML = `
    @keyframes bounceIn { 0%{transform:scale(0.8);opacity:0;} 50%{transform:scale(1.05);} 100%{transform:scale(1);} }
    .animate-bounce-in { animation: bounceIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
`;
document.head.appendChild(style);