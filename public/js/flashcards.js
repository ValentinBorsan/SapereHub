console.log("✅ Scriptul flashcards.js a fost încărcat.");

// 1. Listener pentru selecția de text
document.addEventListener("mouseup", function (e) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (e.target.id === "add-flashcard-btn" || e.target.closest("#add-flashcard-btn")) return;

  const existingBtn = document.getElementById("add-flashcard-btn");
  if (existingBtn) existingBtn.remove();

  const lessonArticle = document.getElementById("lesson-article");
  if (!selectedText.length || !lessonArticle || !lessonArticle.contains(selection.anchorNode)) return;

  const btn = document.createElement("button");
  btn.id = "add-flashcard-btn";
  btn.innerHTML = "<i class='bx bx-layer-plus'></i> Salvează Card";
  btn.className = "fixed z-50 bg-sapereOrange text-white px-3 py-1 rounded-lg shadow-xl font-bold text-xs transform transition hover:scale-110 cursor-pointer flex items-center gap-1";
  btn.style.top = (e.clientY + 15) + "px";
  btn.style.left = (e.clientX + 10) + "px";

  btn.addEventListener("mousedown", function (event) {
      event.preventDefault();
      event.stopPropagation();
      openFlashcardModal(selectedText);
  });

  document.body.appendChild(btn);
});

// 2. Funcția de deschidere Modal
function openFlashcardModal(text) {
  const modal = document.getElementById("modal-flashcard");
  const inputFront = document.getElementById("flashcard-front");
  const inputBack = document.getElementById("flashcard-back");

  if (!modal || !inputFront) return;

  inputFront.value = text;
  if(inputBack) inputBack.value = ""; 

  modal.classList.remove("hidden");
  window.getSelection().removeAllRanges();
  
  const btn = document.getElementById("add-flashcard-btn");
  if(btn) btn.remove();
}

// 3. Funcția de Salvare (Globală pentru a fi văzută de onsubmit)
window.saveFlashcard = async function(event) {
    event.preventDefault();
    
    const frontVal = document.getElementById("flashcard-front").value;
    const backVal = document.getElementById("flashcard-back").value;
    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> ...";

    try {
        const response = await fetch('/api/flashcards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ front: frontVal, back: backVal })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById("modal-flashcard").classList.add("hidden");
            
            // GAMIFICATION: Acordăm XP
            if (typeof awardXP === 'function') {
                awardXP('FLASHCARD_CREATE', 'Flashcard salvat cu succes!');
            } else {
                alert("Card salvat!");
            }
        } else {
            alert("Eroare: " + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert("Eroare de conexiune.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};