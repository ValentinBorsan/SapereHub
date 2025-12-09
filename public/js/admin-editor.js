// public/js/admin-editor.js

let editorLang = typeof currentLang !== "undefined" ? currentLang : "ro";
let activeSection = null;
let autosaveTimeout;
let draggedItem = null;

// Configurare Toolbar Quill (Editor Text)
const quillToolbarOptions = [
  ["bold", "italic", "underline", "strike"],
  ["blockquote", "code-block"],
  [{ header: [2, 3, false] }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ script: "sub" }, { script: "super" }],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  ["clean"],
];

// --- 1. EXPUNERE GLOBALĂ PENTRU HTML ONCLICK HANDLERS ---
// Aceasta rezolvă eroarea "ReferenceError"
window.switchLang = switchLang;
window.addSection = addSection;
window.addBlock = addBlock;
window.removeElement = removeElement;
window.moveBlockUp = moveBlockUp;
window.moveBlockDown = moveBlockDown;
window.moveSectionUp = moveSectionUp;
window.moveSectionDown = moveSectionDown;
window.addListItem = addListItem;
window.tableAddRow = tableAddRow;
window.tableAddCol = tableAddCol;
window.saveLesson = saveLesson;
window.triggerAutosave = triggerAutosave;

// Funcții AI
window.openAiModal = openAiModal;
window.closeAiModal = closeAiModal;
window.generateLessonAI = generateLessonAI;
window.openAiBlockModal = openAiBlockModal;
window.generateBlockAI = generateBlockAI;
window.translateLessonContent = translateLessonContent;

// Funcții Geometrie
window.insertGeoSnippet = insertGeoSnippet;
window.updateGeometry = updateGeometry;
window.initGeometryBoard = initGeometryBoard;

// Funcții Utilitare
window.copyStructureToOtherLangs = copyStructureToOtherLangs;
window.setActiveSection = setActiveSection;
window.populateEditorForLang = populateEditorForLang; // <--- FIX: Exportăm funcția

document.addEventListener("DOMContentLoaded", () => {
  const savedDraft = localStorage.getItem("lesson_draft");
  const payloadElement = document.getElementById("lesson-data-payload");

  let lessonData = null;

  // Încercăm să încărcăm datele de la server (mod editare)
  if (payloadElement) {
    try {
      const rawData = payloadElement.getAttribute("data-lesson");
      if (rawData && rawData !== "null") {
        lessonData = JSON.parse(rawData);
      }
    } catch (e) {
      console.error("Eroare la parsarea datelor server:", e);
    }
  }

  // Dacă nu avem date de la server, verificăm draft-ul local
  if (!lessonData && savedDraft) {
    if (
      confirm("Am găsit o versiune nesalvată a lecției. Vrei să o restaurezi?")
    ) {
      lessonData = JSON.parse(savedDraft);
      console.log("Restaurare din draft local:", lessonData);
    }
  }

  if (lessonData) {
    loadLessonData(lessonData);
  }
});

// ==========================================
// 2. HELPER FUNCTIONS (Popularea Editorului)
// ==========================================

// Aceasta este funcția lipsă care cauza eroarea. Ea populează editorul pentru o anumită limbă.
function populateEditorForLang(data, lang) {
    const container = document.getElementById(`sections-${lang}`);
    if (!container) return; // Siguranță
    
    container.innerHTML = ""; // Curăță conținutul vechi

    const titleInput = document.getElementById(`title-${lang}`);
    const subInput = document.getElementById(`subtitle-${lang}`);
    
    if(titleInput) titleInput.value = data.title || "";
    if(subInput) subInput.value = data.subtitle || "";

    if (data.sections && Array.isArray(data.sections)) {
        data.sections.forEach(sec => {
            const tplSec = document.getElementById("tpl-section");
            const cloneSec = tplSec.content.cloneNode(true);
            const sectionCard = cloneSec.querySelector(".section-card");
            
            sectionCard.querySelector(".section-title-input").value = sec.title || "";
            
            // Setare click handler pentru activare secțiune
            sectionCard.addEventListener("click", function(e) {
                 if (!['BUTTON', 'I', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                    setActiveSection(this);
                }
            });

            // Inițializare Drag & Drop
            initDropZone(sectionCard.querySelector(".blocks-container"));
            
            container.appendChild(cloneSec);

            // Adăugare blocuri
            if(sec.blocks && Array.isArray(sec.blocks)) {
                sec.blocks.forEach(blk => {
                    // Normalizare tipuri (uneori AI returnează 'text' în loc de 'paragraph')
                    if (blk.type === 'text') blk.type = 'paragraph';
                    reconstructBlock(sectionCard, blk);
                });
            }
        });
    }
    triggerAutosave();
}

// ==========================================
// 3. AI GENERATION & TRANSLATION LOGIC
// ==========================================

function openAiModal() {
    const modal = document.getElementById('modal-ai-generator');
    const titleInput = document.getElementById(`title-${editorLang}`);
    if(titleInput && titleInput.value) {
        document.getElementById('ai-topic').value = titleInput.value;
    }
    if(modal) modal.classList.remove('hidden');
}

function closeAiModal() {
    const modal = document.getElementById('modal-ai-generator');
    if(modal) modal.classList.add('hidden');
}

async function generateLessonAI() {
    const topic = document.getElementById('ai-topic').value;
    const tone = document.getElementById('ai-tone').value;
    const sectionsCount = document.getElementById('ai-sections').value;
    const btn = document.getElementById('btn-generate-ai');
    
    if(!topic) { alert("Te rog introdu un subiect!"); return; }

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generare...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, tone, sectionsCount })
        });

        if (!response.ok) throw new Error("Eroare server AI");

        const lessonData = await response.json();
        // Folosim populateEditorForLang pentru limba curentă
        populateEditorForLang(lessonData, editorLang); 
        closeAiModal();
        alert("Lecție generată cu succes!");

    } catch (e) {
        console.error(e);
        alert("Eroare la generare: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --- AI BLOCK GENERATOR (Blocuri Individuale) ---
function openAiBlockModal() {
    if (!activeSection) {
        // Auto-select ultima secțiune sau cere creare
        const container = document.getElementById(`sections-${editorLang}`);
        const sections = container.querySelectorAll('.section-card');
        if (sections.length > 0) {
            setActiveSection(sections[sections.length - 1]);
        } else {
            alert(`Creează întâi o secțiune.`);
            return;
        }
    }
    const modal = document.getElementById('modal-ai-block');
    if(modal) {
        modal.classList.remove('hidden');
        setTimeout(() => document.getElementById('ai-block-prompt').focus(), 100);
    }
}

async function generateBlockAI() {
    const prompt = document.getElementById('ai-block-prompt').value;
    const btn = document.getElementById('btn-create-block-ai');
    const lessonTitle = document.getElementById(`title-${editorLang}`)?.value || "";

    if (!prompt.trim()) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const response = await fetch('/api/ai/generate-block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, context: lessonTitle })
        });

        if (!response.ok) throw new Error("Eroare server");
        
        const blockData = await response.json();
        reconstructBlock(activeSection, blockData);
        
        document.getElementById('modal-ai-block').classList.add('hidden');
        document.getElementById('ai-block-prompt').value = "";
        
        // Scroll la noul bloc
        setTimeout(() => {
            const blocksContainer = activeSection.querySelector(".blocks-container");
            const newBlock = blocksContainer.lastElementChild;
            if(newBlock) newBlock.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);

        triggerAutosave();

    } catch (e) {
        console.error(e);
        alert("Nu am putut genera blocul.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --- AI TRANSLATION ---
async function translateLessonContent(sourceLang, targetLang) {
    if (!confirm(`⚠️ Ești sigur că vrei să TRADUCI automat din ${sourceLang.toUpperCase()} în ${targetLang.toUpperCase()}? \n\nAceastă acțiune va suprascrie complet conținutul existent în ${targetLang.toUpperCase()}.`)) return;

    // 1. Extrage datele din limba sursă
    const sourceData = extractLangData(sourceLang);
    
    // Verificare sumară
    if (!sourceData.title && (!sourceData.sections || sourceData.sections.length === 0)) {
        alert("Nu există conținut suficient în limba sursă pentru a traduce.");
        return;
    }

    // 2. Afișează indicator de încărcare
    const originalCursor = document.body.style.cursor;
    document.body.style.cursor = "wait";
    
    // Toast temporar
    const toast = document.createElement("div");
    toast.className = "fixed top-5 right-5 bg-blue-600 text-white px-6 py-4 rounded-xl shadow-2xl z-[9999] flex items-center gap-3 animate-bounce";
    toast.innerHTML = `<i class="fas fa-spinner fa-spin text-xl"></i> <div><strong>Traducere în curs...</strong><br/><span class="text-xs opacity-75">${sourceLang.toUpperCase()} ➔ ${targetLang.toUpperCase()}</span></div>`;
    document.body.appendChild(toast);

    try {
        // 3. Apel API
        const response = await fetch('/api/ai/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sourceLang, 
                targetLang, 
                content: sourceData 
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Eroare la traducerea API.");
        }

        const translatedData = await response.json();

        // 4. Populează limba țintă
        // Comutăm temporar contextul pe limba țintă pentru a popula corect DOM-ul
        switchLang(targetLang);
        populateEditorForLang(translatedData, targetLang);

        toast.className = "fixed top-5 right-5 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl z-[9999] flex items-center gap-3";
        toast.innerHTML = `<i class="fas fa-check-circle text-xl"></i> <div><strong>Traducere Completă!</strong></div>`;
        setTimeout(() => toast.remove(), 3000);
        
        triggerAutosave();

    } catch (e) {
        console.error(e);
        toast.className = "fixed top-5 right-5 bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl z-[9999] flex items-center gap-3";
        toast.innerHTML = `<i class="fas fa-exclamation-triangle text-xl"></i> <div><strong>Eroare</strong><br/><span class="text-xs">${e.message}</span></div>`;
        setTimeout(() => toast.remove(), 5000);
    } finally {
        document.body.style.cursor = originalCursor;
    }
}

// ==========================================
// 4. CORE EDITOR FUNCTIONS (Încărcare, Salvare, Blocuri)
// ==========================================

function loadLessonData(data) {
  // Setare metadate
  if (document.getElementById("meta-category")) document.getElementById("meta-category").value = data.category || "Matematică";
  if (document.getElementById("meta-level")) document.getElementById("meta-level").value = data.level || "Începător";
  if (document.getElementById("meta-time")) document.getElementById("meta-time").value = data.read_time || 10;

  // Dacă e editare, schimbăm butonul
  if (data.id) {
    const saveBtn = document.getElementById("btn-save");
    if(saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Actualizează';
        saveBtn.dataset.id = data.id;
    }
  }

  // Iterăm prin limbi și populăm
  ["ro", "en", "it"].forEach((lang) => {
    if (!data.content || !data.content[lang]) return;
    // Folosim funcția de populare
    populateEditorForLang(data.content[lang], lang);
  });
  
  // Dacă suntem pe un tab gol, rămânem acolo, altfel switch la default
  if(document.getElementById(`container-${editorLang}`) && document.getElementById(`container-${editorLang}`).classList.contains('hidden')) {
      switchLang(editorLang);
  }
  
  // Asigurăm că geometria se randează corect după load
  setTimeout(() => {
       document.querySelectorAll('.jxgbox').forEach(box => {
           // Forțăm un resize event sau re-init dacă e gol
           if(box.innerHTML === "") {
               const block = box.closest('.block-item');
               const code = block.querySelector('.geo-code').value;
               initGeometryBoard(block, code);
           }
       });
  }, 500);
}

function reconstructBlock(sectionCard, block) {
  const tplBlock = document.getElementById(`tpl-block-${block.type}`);
  if (!tplBlock) return;

  const cloneBlock = tplBlock.content.cloneNode(true);
  const blockItem = cloneBlock.querySelector(".block-item");
  const blocksContainer = sectionCard.querySelector(".blocks-container");

  blocksContainer.appendChild(blockItem);
  setupBlock(blockItem);

  // Populare specifică pe tipuri
  if (block.type === "paragraph") {
    const editorDiv = blockItem.querySelector(".quill-editor-container");
    const quill = new Quill(editorDiv, { theme: "snow", modules: { toolbar: quillToolbarOptions } });
    // IMPORTANT: Verificăm dacă conținutul este HTML valid sau text simplu
    if(block.content) quill.clipboard.dangerouslyPasteHTML(block.content);
    quill.on("text-change", () => triggerAutosave());
  } else if (block.type === "title") {
    blockItem.querySelector(".block-title-input").value = block.content || "";
  } else if (block.type === "formula") {
    blockItem.querySelector(".formula-content").value = block.content || "";
    blockItem.querySelector(".formula-explanation").value = block.explanation || "";
  } else if (block.type === "definition") {
    blockItem.querySelector(".def-term").value = block.term || "";
    blockItem.querySelector(".def-desc").value = block.description || "";
  } else if (block.type === "list") {
    const listContainer = blockItem.querySelector(".list-items-container");
    listContainer.innerHTML = "";
    if(block.items) {
        block.items.forEach((itemText) => {
            const li = createListItem(itemText);
            listContainer.appendChild(li);
        });
    }
  } else if (block.type === "resource") {
    blockItem.querySelector(".res-title").value = block.title || "";
    blockItem.querySelector(".res-url").value = block.url || "";
    blockItem.querySelector(".res-type").value = block.fileType || "link";
  } else if (block.type === "table") {
    const thead = blockItem.querySelector("thead");
    const tbody = blockItem.querySelector("tbody");
    
    if (block.content && block.content.length > 0) {
      const headerRow = block.content[0];
      const trHead = document.createElement("tr");
      let headHtml = "";
      headerRow.forEach((cell) => {
        headHtml += `<th class="px-4 py-2 border border-gray-600"><input type="text" class="w-full bg-transparent border-none focus:ring-0 text-white font-bold uppercase text-center" value="${cell}" oninput="triggerAutosave()"></th>`;
      });
      trHead.innerHTML = headHtml;
      thead.appendChild(trHead);

      block.content.slice(1).forEach((rowData) => {
        const tr = document.createElement("tr");
        let bodyHtml = "";
        rowData.forEach((cell) => {
          bodyHtml += `<td class="px-4 py-2 border border-gray-700"><input type="text" class="w-full bg-transparent border-none focus:ring-0 text-white" value="${cell}" oninput="triggerAutosave()"></td>`;
        });
        tr.innerHTML = bodyHtml;
        tbody.appendChild(tr);
      });
    } else {
        initTableBlock(blockItem);
    }
  } else if (block.type === "geometry") {
      // Reconstrucție GEOMETRIE
      blockItem.querySelector(".geo-code").value = block.code || "";
      // Folosim setTimeout pentru a permite DOM-ul să se așeze
      setTimeout(() => initGeometryBoard(blockItem, block.code), 200);
  }
}

function switchLang(lang) {
  editorLang = lang;
  document.querySelectorAll(".lang-container").forEach((el) => el.classList.add("hidden"));
  
  const container = document.getElementById(`container-${lang}`);
  if(container) container.classList.remove("hidden");

  document.querySelectorAll(".lang-tab").forEach((btn) => {
    btn.classList.remove("bg-sapereOrange", "text-white", "shadow");
    btn.classList.add("text-gray-400");
  });

  const activeTab = document.getElementById(`tab-${lang}`);
  if(activeTab) {
      activeTab.classList.add("bg-sapereOrange", "text-white", "shadow");
      activeTab.classList.remove("text-gray-400");
  }

  activeSection = null;
  document.querySelectorAll(".section-card").forEach((el) => el.classList.remove("ring-2", "ring-sapereOrange"));
  
  // Re-initializare geometrie la schimbarea tab-ului (fix pentru dimensiune 0)
  if(container) {
      container.querySelectorAll('.block-item.geometry').forEach(block => {
          const code = block.querySelector('.geo-code').value;
          // Re-init doar dacă e necesar
          if(block.querySelector('.jxgbox').innerHTML === "") {
              setTimeout(() => initGeometryBoard(block, code), 50);
          }
      });
  }
}

function addSection() {
  const container = document.getElementById(`sections-${editorLang}`);
  const template = document.getElementById("tpl-section");
  const clone = template.content.cloneNode(true);
  const sectionDiv = clone.querySelector(".section-card");

  sectionDiv.addEventListener("click", function (e) {
    if (!['BUTTON', 'I', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
      setActiveSection(this);
    }
  });

  initDropZone(sectionDiv.querySelector(".blocks-container"));

  container.appendChild(clone);
  setActiveSection(sectionDiv);
  
  setTimeout(() => {
      sectionDiv.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
  
  triggerAutosave();
}

function setActiveSection(element) {
  document.querySelectorAll(".section-card").forEach((el) => el.classList.remove("ring-2", "ring-sapereOrange"));
  activeSection = element;
  if (activeSection) {
      activeSection.classList.add("ring-2", "ring-sapereOrange");
  }
}

function addBlock(type) {
  // 1. Auto-select section
  if (!activeSection) {
      const container = document.getElementById(`sections-${editorLang}`);
      const sections = container.querySelectorAll('.section-card');
      
      if (sections.length > 0) {
          setActiveSection(sections[sections.length - 1]);
      } else {
          if(confirm("Nu există nicio secțiune creată. Vrei să adaugi una acum?")) {
              addSection();
              setTimeout(() => addBlock(type), 200);
              return;
          } else {
              return;
          }
      }
  }

  const templateId = `tpl-block-${type}`;
  const template = document.getElementById(templateId);
  if (!template) return;

  const clone = template.content.cloneNode(true);
  const blockDiv = clone.querySelector(".block-item");
  const container = activeSection.querySelector(".blocks-container");
  container.appendChild(blockDiv);

  setupBlock(blockDiv);

  if (type === "paragraph") {
    const editorDiv = blockDiv.querySelector(".quill-editor-container");
    const quill = new Quill(editorDiv, {
      theme: "snow",
      modules: { toolbar: quillToolbarOptions },
      placeholder: "Scrie conținutul lecției aici...",
    });
    quill.on("text-change", () => triggerAutosave());
  }

  if (type === "table") {
    initTableBlock(blockDiv);
  }

  // Inițializare Geometrie
  if (type === "geometry") {
      const uniqueId = 'jxgbox-' + Math.random().toString(36).substr(2, 9);
      const box = blockDiv.querySelector(".jxgbox");
      box.id = uniqueId;
      
      const defaultCode = "// board.create('point', [1,1]);\nconst p1 = board.create('point', [-2, 2], {name:'A', size:4});\nconst p2 = board.create('point', [2, -2], {name:'B', size:4});\nconst li = board.create('line', [p1,p2], {strokeColor:'#00a025', strokeWidth:2});";
      blockDiv.querySelector(".geo-code").value = defaultCode;

      setTimeout(() => initGeometryBoard(blockDiv, defaultCode), 100);
  }

  setTimeout(() => {
      blockDiv.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
  
  triggerAutosave();
}

function setupBlock(block) {
  block.setAttribute("draggable", "true");
  block.classList.add("cursor-grab");

  block.addEventListener("dragstart", function (e) {
    draggedItem = this;
    this.classList.add("opacity-50", "bg-gray-700", "cursor-grabbing");
    this.classList.remove("cursor-grab");
    e.dataTransfer.effectAllowed = "move";
  });

  block.addEventListener("dragend", function (e) {
    this.classList.remove("opacity-50", "bg-gray-700", "cursor-grabbing");
    this.classList.add("cursor-grab");
    draggedItem = null;
    triggerAutosave();
  });
}

function initDropZone(container) {
  container.addEventListener("dragover", function (e) {
    e.preventDefault();
    const afterElement = getDragAfterElement(container, e.clientY);
    if (afterElement == null) {
      container.appendChild(draggedItem);
    } else {
      container.insertBefore(draggedItem, afterElement);
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".block-item:not(.opacity-50)")];

  return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function removeElement(btn, type) {
  if (!confirm("Sigur vrei să ștergi acest element?")) return;
  const target = type === "section" ? btn.closest(".section-card") : btn.closest(".block-item");
  if (target) {
    target.remove();
    if (type === "section" && target === activeSection) activeSection = null;
    triggerAutosave();
  }
}

function moveBlockUp(btn) {
  const block = btn.closest(".block-item");
  const prev = block.previousElementSibling;
  if (prev) {
    block.parentNode.insertBefore(block, prev);
    block.scrollIntoView({ behavior: "smooth", block: "center" });
    triggerAutosave();
  }
}

function moveBlockDown(btn) {
  const block = btn.closest(".block-item");
  const next = block.nextElementSibling;
  if (next) {
    block.parentNode.insertBefore(next, block);
    block.scrollIntoView({ behavior: "smooth", block: "center" });
    triggerAutosave();
  }
}

function moveSectionUp(btn) {
  const section = btn.closest(".section-card");
  const prev = section.previousElementSibling;
  if (prev) {
    section.parentNode.insertBefore(section, prev);
    section.scrollIntoView({ behavior: "smooth", block: "center" });
    triggerAutosave();
  }
}

function moveSectionDown(btn) {
  const section = btn.closest(".section-card");
  const next = section.nextElementSibling;
  if (next) {
    section.parentNode.insertBefore(next, section);
    section.scrollIntoView({ behavior: "smooth", block: "center" });
    triggerAutosave();
  }
}

function createListItem(text = "") {
    const li = document.createElement("li");
    li.className = "flex items-center gap-2";
    li.innerHTML = `
        <span class="text-purple-500">•</span>
        <input type="text" class="list-input w-full bg-[#0f172a] border border-purple-500/30 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none" value="${text}" placeholder="Element nou..." oninput="triggerAutosave()">
        <button onclick="this.parentElement.remove(); triggerAutosave()" class="text-gray-600 hover:text-red-400 px-2"><i class="fas fa-trash-alt"></i></button>
    `;
    return li;
}

function addListItem(btn) {
  const container = btn.previousElementSibling;
  container.appendChild(createListItem());
  triggerAutosave();
}

function createCellInput(isHeader = false) {
  return `<input type="text" oninput="triggerAutosave()" class="w-full bg-transparent border-none focus:ring-0 text-white ${isHeader ? "font-bold uppercase text-center placeholder-gray-400" : "placeholder-gray-600"}" placeholder="${isHeader ? "TITLU" : "..."}">`;
}

function initTableBlock(blockDiv) {
  const thead = blockDiv.querySelector("thead");
  const tbody = blockDiv.querySelector("tbody");

  if(thead.children.length === 0) {
      const trHead = document.createElement("tr");
      trHead.innerHTML = `<th class="px-4 py-2 border border-gray-600">${createCellInput(true)}</th><th class="px-4 py-2 border border-gray-600">${createCellInput(true)}</th>`;
      thead.appendChild(trHead);

      const trBody = document.createElement("tr");
      trBody.innerHTML = `<td class="px-4 py-2 border border-gray-700">${createCellInput()}</td><td class="px-4 py-2 border border-gray-700">${createCellInput()}</td>`;
      tbody.appendChild(trBody);
  }
}

function tableAddRow(btn) {
  const blockItem = btn.closest(".block-item");
  const table = blockItem.querySelector("table");
  let headRow = table.querySelector("thead tr");
  
  if (!headRow) { initTableBlock(blockItem); headRow = table.querySelector("thead tr"); }

  const tbody = table.querySelector("tbody");
  const colsCount = headRow.children.length;

  const tr = document.createElement("tr");
  let cells = "";
  for (let i = 0; i < colsCount; i++) cells += `<td class="px-4 py-2 border border-gray-700">${createCellInput()}</td>`;
  tr.innerHTML = cells;
  tbody.appendChild(tr);
  triggerAutosave();
}

function tableAddCol(btn) {
  const blockItem = btn.closest(".block-item");
  const table = blockItem.querySelector("table");
  let headRow = table.querySelector("thead tr");

  if (!headRow) { initTableBlock(blockItem); headRow = table.querySelector("thead tr"); }

  const th = document.createElement("th");
  th.className = "px-4 py-2 border border-gray-600";
  th.innerHTML = createCellInput(true);
  headRow.appendChild(th);

  const bodyRows = table.querySelectorAll("tbody tr");
  bodyRows.forEach((row) => {
    const td = document.createElement("td");
    td.className = "px-4 py-2 border border-gray-700";
    td.innerHTML = createCellInput();
    row.appendChild(td);
  });
  triggerAutosave();
}

// --- CLONARE STRUCTURĂ ---
function copyStructureToOtherLangs() {
  if (!confirm("⚠️ ATENȚIE: Clonezi tot conținutul curent în celelalte limbi? \nVa suprascrie orice există în tab-urile celelalte.")) return;

  const currentData = extractLangData(editorLang);
  const targetLangs = ["ro", "en", "it"].filter((l) => l !== editorLang);

  targetLangs.forEach((targetLang) => {
      // Folosim funcția de populare pentru a replica structura
      populateEditorForLang(currentData, targetLang);
  });

  alert("Clonare completă!");
  triggerAutosave();
}

function triggerAutosave() {
  clearTimeout(autosaveTimeout);
  autosaveTimeout = setTimeout(() => {
    const data = buildPayload();
    localStorage.setItem("lesson_draft", JSON.stringify(data));
    const status = document.getElementById("autosave-status");
    if (status) {
      status.style.opacity = "1";
      setTimeout(() => (status.style.opacity = "0"), 2000);
    }
  }, 2000);
}

function extractLangData(lang) {
  const titleInput = document.getElementById(`title-${lang}`);
  const subtitleInput = document.getElementById(`subtitle-${lang}`);
  
  // Dacă elementele nu există (ex: eroare de randare), returnăm obiect gol
  if (!titleInput) return { title: "", subtitle: "", sections: [] };

  const title = titleInput.value;
  const sections = [];

  const sectionCards = document.querySelectorAll(`#sections-${lang} .section-card`);

  sectionCards.forEach((card) => {
    const secTitle = card.querySelector(".section-title-input").value;
    const blocks = [];

    card.querySelectorAll(".block-item").forEach((block) => {
      let blockData = {};

      if (block.classList.contains("paragraph")) {
        const quillEditor = Quill.find(block.querySelector(".quill-editor-container"));
        blockData = { type: "paragraph", content: quillEditor.root.innerHTML };
      } else if (block.classList.contains("title-block")) {
        blockData = { type: "title", content: block.querySelector(".block-title-input").value };
      } else if (block.classList.contains("formula")) {
        blockData = { type: "formula", content: block.querySelector(".formula-content").value, explanation: block.querySelector(".formula-explanation").value };
      } else if (block.classList.contains("definition")) {
        blockData = { type: "definition", term: block.querySelector(".def-term").value, description: block.querySelector(".def-desc").value };
      } else if (block.classList.contains("list")) {
        const items = [];
        block.querySelectorAll(".list-input").forEach((inp) => { if (inp.value.trim()) items.push(inp.value.trim()); });
        blockData = { type: "list", items: items };
      } else if (block.classList.contains("table-block")) {
        const rows = [];
        const table = block.querySelector("table");
        const headerRow = [];
        table.querySelectorAll("thead th input").forEach((inp) => headerRow.push(inp.value));
        rows.push(headerRow);
        table.querySelectorAll("tbody tr").forEach((tr) => {
          const rowData = [];
          tr.querySelectorAll("td input").forEach((inp) => rowData.push(inp.value));
          rows.push(rowData);
        });
        blockData = { type: "table", content: rows };
      } else if (block.classList.contains("resource")) {
        blockData = { type: "resource", title: block.querySelector(".res-title").value, url: block.querySelector(".res-url").value, fileType: block.querySelector(".res-type").value };
      } else if (block.classList.contains("geometry")) {
        blockData = { type: "geometry", code: block.querySelector(".geo-code").value };
      }
      blocks.push(blockData);
    });
    sections.push({ title: secTitle, blocks });
  });
  return { title, subtitle: subtitleInput.value, sections };
}

function buildPayload() {
  return {
    // Categoria se salvează în formatul "cheie" din DB (ex: Matematică)
    category: document.getElementById("meta-category").value || "Matematică",
    level: document.getElementById("meta-level").value || "Începător",
    read_time: parseInt(document.getElementById("meta-time").value) || 10,
    
    // AICI SALVĂM TOATE CELE 3 LIMBI
    content: {
      ro: extractLangData("ro"),
      en: extractLangData("en"),
      it: extractLangData("it"),
    },
  };
}

async function saveLesson() {
  const btn = document.getElementById("btn-save");
  const originalText = btn.innerHTML;
  const lessonId = btn.dataset.id;

  btn.innerText = "Se salvează...";
  btn.disabled = true;

  try {
    const payload = buildPayload();
    
    // Validare: Măcar limba română să aibă titlu
    if (!payload.content.ro.title) throw new Error("Titlul în Română este obligatoriu!");

    // Construim corpul cererii pentru adminController
    const finalBody = {
      // Titlul și Subtitlul "principale" (fallback) vor fi cele în RO
      title: payload.content.ro.title,
      subtitle: payload.content.ro.subtitle,
      
      category: payload.category,
      level: payload.level,
      read_time: payload.read_time,
      
      // JSON-ul complet cu toate limbile
      content: payload.content,
    };

    if (lessonId) finalBody.id = lessonId;

    const response = await fetch("/admin/create-lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalBody),
    });

    const result = await response.json();
    
    if (response.ok) {
        localStorage.removeItem("lesson_draft");
        window.location.href = result.redirectUrl;
    } else {
        throw new Error(result.error || "Eroare la salvare.");
    }
  } catch (e) {
    alert("EROARE: " + e.message);
  } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
  }
}

// --- 5. GEOMETRY HELPER FUNCTIONS ---

function initGeometryBoard(blockItem, code) {
    const box = blockItem.querySelector(".jxgbox");
    // Asigură-te că are ID
    if (!box.id || box.id === "box-placeholder") {
        box.id = 'jxgbox-' + Math.random().toString(36).substr(2, 9);
    }

    // Curăță conținutul vechi (dacă există instanță JSXGraph, ideal ar fi JXG.JSXGraph.freeBoard, dar simplu golim div-ul)
    // IMPORTANT: Aici păstrăm stilurile CSS inline dacă există
    const oldWidth = box.style.width;
    const oldHeight = box.style.height;
    
    // Eliberăm resursele JXG dacă există
    if (window.JXG && JXG.boards && JXG.boards[box.id]) {
        JXG.JSXGraph.freeBoard(JXG.boards[box.id]);
    }
    
    box.innerHTML = "";
    // Re-aplicăm dimensiunile pentru siguranță
    box.style.width = oldWidth || "100%";
    box.style.height = oldHeight || "100%";

    try {
        if (typeof JXG !== 'undefined') {
            const board = JXG.JSXGraph.initBoard(box.id, {
                boundingbox: [-5, 5, 5, -5], 
                axis: true,
                showCopyright: false,
                pan: { enabled: true },
                zoom: { enabled: true }
            });
            
            // Stocăm referința la board pe elementul DOM pentru acces ulterior
            blockItem.jxgBoard = board;

            // Executăm codul
            evaluateGeometryCode(board, code);
        } else {
             console.warn("Libraria JSXGraph nu este incarcata.");
        }
    } catch (e) {
        console.error("Eroare init JSXGraph:", e);
    }
}

function updateGeometry(textarea) {
    const blockItem = textarea.closest(".block-item");
    const code = textarea.value;
    // const board = blockItem.jxgBoard; // Nu mai folosim board-ul vechi, re-initializam

    // Debounce
    clearTimeout(blockItem.geoTimeout);
    blockItem.geoTimeout = setTimeout(() => {
         initGeometryBoard(blockItem, code);
    }, 800);
}

function evaluateGeometryCode(board, code) {
    try {
        // Funcție sigură (pe cât posibil) pentru a executa codul în contextul board-ului
        // 'board' este disponibil în interiorul funcției
        const func = new Function('board', code);
        func(board);
    } catch (e) {
        // console.warn("Eroare sintaxă geometrie:", e);
    }
}

function insertGeoSnippet(btn, type) {
    const textarea = btn.closest(".space-y-2").querySelector("textarea");
    let snippet = "";
    
    if (type === 'point') snippet = "\nboard.create('point', [1,1], {name:'P', size:3});";
    if (type === 'line') snippet = "\nconst p1 = board.create('point', [-2,-2], {visible:false});\nconst p2 = board.create('point', [2,2], {visible:false});\nboard.create('line', [p1,p2], {strokeColor:'blue'});";
    if (type === 'circle') snippet = "\nboard.create('circle', [[0,0], 2], {strokeColor:'red'});";
    if (type === 'polygon') snippet = "\nconst A = board.create('point', [0,0]);\nconst B = board.create('point', [2,0]);\nconst C = board.create('point', [1,2]);\nboard.create('polygon', [A,B,C], {fillColor:'yellow'});";

    textarea.value += snippet;
    updateGeometry(textarea);
    triggerAutosave();
}