// public/js/modal-controller.js

// === 1. CONTROL MODALE (Deschidere/Închidere) ===
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        // Animație simplă
        const content = modal.querySelector('div');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Închide modalul dacă dai click pe fundalul negru
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
    }
});

// === 2. LOGICĂ CALCULATOR ===
let calcDisplay = document.getElementById('calc-display');

function calcAppend(val) {
    const display = document.getElementById('calc-display');
    if (display.value === '0' && val !== '.') {
        display.value = val;
    } else {
        display.value += val;
    }
}

function calcClear() {
    document.getElementById('calc-display').value = '0';
}

function calcEqual() {
    const display = document.getElementById('calc-display');
    try {
        // Folosim Function in loc de eval pentru un pic mai multă siguranță
        display.value = new Function('return ' + display.value)();
    } catch (e) {
        display.value = 'Eroare';
    }
}

// === 3. LOGICĂ NOTIȚE (Local Storage) ===
document.addEventListener('DOMContentLoaded', () => {
    const savedNote = localStorage.getItem('sapere_quick_note');
    if (savedNote) {
        document.getElementById('quick-note').value = savedNote;
    }
});

function saveNote() {
    const text = document.getElementById('quick-note').value;
    localStorage.setItem('sapere_quick_note', text);
    alert('Notiță salvată local!');
}