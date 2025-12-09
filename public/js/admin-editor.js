// public/js/admin-editor.js

let editorLang = typeof currentLang !== "undefined" ? currentLang : "ro";
let activeSection = null;
let autosaveTimeout;
let draggedItem = null;

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

document.addEventListener("DOMContentLoaded", () => {
  const savedDraft = localStorage.getItem("lesson_draft");
  const payloadElement = document.getElementById("lesson-data-payload");

  let lessonData = null;

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

// --- AI GENERATION LOGIC ---

function openAiModal() {
    const modal = document.getElementById('modal-ai-generator');
    const titleInput = document.getElementById(`title-${editorLang}`);
    if(titleInput && titleInput.value) {
        document.getElementById('ai-topic').value = titleInput.value;
    }
    modal.classList.remove('hidden');
}

function closeAiModal() {
    document.getElementById('modal-ai-generator').classList.add('hidden');
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
        populateEditorFromAI(lessonData);
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

function populateEditorFromAI(data) {
    const titleInput = document.getElementById(`title-${editorLang}`);
    const subInput = document.getElementById(`subtitle-${editorLang}`);
    
    if(titleInput) titleInput.value = data.title || "";
    if(subInput) subInput.value = data.subtitle || "";

    const container = document.getElementById(`sections-${editorLang}`);
    container.innerHTML = "";

    if (data.sections && Array.isArray(data.sections)) {
        data.sections.forEach(sec => {
            const tplSec = document.getElementById("tpl-section");
            const cloneSec = tplSec.content.cloneNode(true);
            const sectionCard = cloneSec.querySelector(".section-card");
            
            sectionCard.querySelector(".section-title-input").value = sec.title || "Secțiune Nouă";
            initDropZone(sectionCard.querySelector(".blocks-container"));
            
            sectionCard.addEventListener("click", function(e) {
                 if (!['BUTTON', 'I', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                    setActiveSection(this);
                }
            });

            container.appendChild(cloneSec);
            setActiveSection(sectionCard); // Auto-select last added

            if(sec.blocks && Array.isArray(sec.blocks)) {
                sec.blocks.forEach(blk => {
                    if (blk.type === 'text') blk.type = 'paragraph';
                    reconstructBlock(sectionCard, blk);
                });
            }
        });
    }
    triggerAutosave();
}

function openAiBlockModal() {
    // Dacă nu avem secțiune activă, încercăm să găsim una
    if (!activeSection) {
        const container = document.getElementById(`sections-${editorLang}`);
        const sections = container.querySelectorAll('.section-card');
        if (sections.length > 0) {
            setActiveSection(sections[sections.length - 1]);
        } else {
            alert(`Creează întâi o secțiune.`);
            return;
        }
    }
    document.getElementById('modal-ai-block').classList.remove('hidden');
    document.getElementById('ai-block-prompt').focus();
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
        
        // Scroll pe mobil
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

// --- CORE EDITOR FUNCTIONS ---

function loadLessonData(data) {
  if (document.getElementById("meta-category")) document.getElementById("meta-category").value = data.category || "Matematică";
  if (document.getElementById("meta-level")) document.getElementById("meta-level").value = data.level || "Începător";
  if (document.getElementById("meta-time")) document.getElementById("meta-time").value = data.read_time || 10;

  if (data.id) {
    const saveBtn = document.getElementById("btn-save");
    if(saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Actualizează';
        saveBtn.dataset.id = data.id;
    }
  }

  ["ro", "en", "it"].forEach((lang) => {
    if (!data.content || !data.content[lang]) return;
    const langData = data.content[lang];

    const titleInput = document.getElementById(`title-${lang}`);
    const subInput = document.getElementById(`subtitle-${lang}`);
    if (titleInput) titleInput.value = langData.title || "";
    if (subInput) subInput.value = langData.subtitle || "";

    if (langData.sections && langData.sections.length > 0) {
      const savedLang = editorLang;
      editorLang = lang; // Temporar switch context pentru a popula corect
      const container = document.getElementById(`sections-${lang}`);
      container.innerHTML = "";

      langData.sections.forEach((section) => {
        const tplSec = document.getElementById("tpl-section");
        const cloneSec = tplSec.content.cloneNode(true);
        const sectionCard = cloneSec.querySelector(".section-card");

        sectionCard.querySelector(".section-title-input").value = section.title;
        
        sectionCard.addEventListener("click", function (e) {
          if (!['BUTTON', 'I', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
            setActiveSection(this);
          }
        });

        initDropZone(sectionCard.querySelector(".blocks-container"));
        container.appendChild(cloneSec);
        setActiveSection(sectionCard);

        if (section.blocks) {
          section.blocks.forEach((block) => reconstructBlock(sectionCard, block));
        }
      });
      editorLang = savedLang; // Restore context
    }
  });
  
  // Reset active selection
  activeSection = null;
  document.querySelectorAll(".section-card").forEach((el) => el.classList.remove("ring-2", "ring-sapereOrange"));
}

function reconstructBlock(sectionCard, block) {
  const tplBlock = document.getElementById(`tpl-block-${block.type}`);
  if (!tplBlock) return;

  const cloneBlock = tplBlock.content.cloneNode(true);
  const blockItem = cloneBlock.querySelector(".block-item");
  const blocksContainer = sectionCard.querySelector(".blocks-container");

  blocksContainer.appendChild(blockItem);
  setupBlock(blockItem);

  // Populare date
  if (block.type === "paragraph") {
    const editorDiv = blockItem.querySelector(".quill-editor-container");
    const quill = new Quill(editorDiv, { theme: "snow", modules: { toolbar: quillToolbarOptions } });
    quill.clipboard.dangerouslyPasteHTML(block.content);
    quill.on("text-change", () => triggerAutosave());
  } else if (block.type === "title") {
    blockItem.querySelector(".block-title-input").value = block.content;
  } else if (block.type === "formula") {
    blockItem.querySelector(".formula-content").value = block.content;
    blockItem.querySelector(".formula-explanation").value = block.explanation || "";
  } else if (block.type === "definition") {
    blockItem.querySelector(".def-term").value = block.term;
    blockItem.querySelector(".def-desc").value = block.description;
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
    blockItem.querySelector(".res-title").value = block.title;
    blockItem.querySelector(".res-url").value = block.url;
    blockItem.querySelector(".res-type").value = block.fileType;
  } else if (block.type === "table") {
    // Reconstrucție tabel
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
  }
}

function switchLang(lang) {
  editorLang = lang;
  document.querySelectorAll(".lang-container").forEach((el) => el.classList.add("hidden"));
  document.getElementById(`container-${lang}`).classList.remove("hidden");

  document.querySelectorAll(".lang-tab").forEach((btn) => {
    btn.classList.remove("bg-sapereOrange", "text-white", "shadow");
    btn.classList.add("text-gray-400");
  });

  const activeTab = document.getElementById(`tab-${lang}`);
  activeTab.classList.add("bg-sapereOrange", "text-white", "shadow");
  activeTab.classList.remove("text-gray-400");

  activeSection = null;
  document.querySelectorAll(".section-card").forEach((el) => el.classList.remove("ring-2", "ring-sapereOrange"));
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
  
  // Timeout pentru mobile scroll fix
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

// --- FIX MOBIL: AUTO-SELECT SECTION ---
function addBlock(type) {
  // 1. Dacă nu avem secțiune activă, încercăm să selectăm ultima disponibilă
  if (!activeSection) {
      const container = document.getElementById(`sections-${editorLang}`);
      const sections = container.querySelectorAll('.section-card');
      
      if (sections.length > 0) {
          // Selectăm automat ultima secțiune
          setActiveSection(sections[sections.length - 1]);
      } else {
          // Dacă nu există nicio secțiune, întrebăm userul
          if(confirm("Nu există nicio secțiune creată. Vrei să adaugi una acum?")) {
              addSection();
              // Așteptăm puțin să se creeze secțiunea, apoi adăugăm blocul
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

  // Scroll smooth pe mobil
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

function copyStructureToOtherLangs() {
  if (!confirm("ATENȚIE: Această acțiune va clona INTEGRAL structura și conținutul în celelalte limbi. Continui?")) return;

  const currentData = extractLangData(editorLang);
  const targetLangs = ["ro", "en", "it"].filter((l) => l !== editorLang);

  targetLangs.forEach((targetLang) => {
    const container = document.getElementById(`sections-${targetLang}`);
    container.innerHTML = "";

    const titleInput = document.getElementById(`title-${targetLang}`);
    const subInput = document.getElementById(`subtitle-${targetLang}`);
    if(titleInput) titleInput.value = currentData.title || "";
    if(subInput) subInput.value = currentData.subtitle || "";

    currentData.sections.forEach((section) => {
      const tplSec = document.getElementById("tpl-section");
      const cloneSec = tplSec.content.cloneNode(true);
      const sectionCard = cloneSec.querySelector(".section-card");

      sectionCard.querySelector(".section-title-input").value = section.title;
      initDropZone(sectionCard.querySelector(".blocks-container"));
      
      sectionCard.addEventListener("click", function (e) {
        if (!['BUTTON', 'I', 'INPUT'].includes(e.target.tagName)) setActiveSection(this);
      });

      container.appendChild(cloneSec);

      section.blocks.forEach((block) => reconstructBlock(sectionCard, block));
    });
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
  const title = titleInput ? titleInput.value : "";
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
      }
      blocks.push(blockData);
    });
    sections.push({ title: secTitle, blocks });
  });
  return { title, subtitle: subtitleInput.value, sections };
}

function buildPayload() {
  return {
    category: document.getElementById("meta-category").value || "Matematică",
    level: document.getElementById("meta-level").value || "Începător",
    read_time: parseInt(document.getElementById("meta-time").value) || 10,
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

  btn.innerText = "Se procesează...";
  btn.disabled = true;
  btn.classList.add("opacity-75", "cursor-not-allowed");

  try {
    const payload = buildPayload();
    if (!payload.content.ro.title) throw new Error("Titlul în Română este obligatoriu!");

    const finalBody = {
      title: payload.content.ro.title,
      subtitle: payload.content.ro.subtitle,
      category: payload.category,
      level: payload.level,
      read_time: payload.read_time,
      content: payload.content,
    };

    if (lessonId) finalBody.id = lessonId;

    const response = await fetch("/admin/create-lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalBody),
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const result = await response.json();
      if (response.ok) {
        localStorage.removeItem("lesson_draft");
        window.location.href = result.redirectUrl;
      } else {
        throw new Error(result.error || "Eroare la salvare.");
      }
    } else {
        const text = await response.text();
        console.error("Server Error HTML:", text);
        throw new Error("Eroare server. Verifica consola.");
    }
  } catch (e) {
    alert("EROARE: " + e.message);
    btn.innerHTML = originalText;
    btn.disabled = false;
    btn.classList.remove("opacity-75", "cursor-not-allowed");
  }
}