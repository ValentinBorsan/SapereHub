const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inițializare Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

exports.translateContent = async (req, res) => {
  try {
    const { sourceLang, targetLang, content } = req.body;

    if (!content || !sourceLang || !targetLang) {
      return res.status(400).json({ error: "Lipsesc datele necesare (content, sourceLang, targetLang)." });
    }

    // Prompt optimizat pentru păstrarea structurii JSON
    const prompt = `
      Ești un traducător profesionist de conținut educațional. 
      Sarcina ta este să traduci valorile unui obiect JSON din limba "${sourceLang}" în limba "${targetLang}".

      REGULI STRICTE:
      1. Păstrează structura JSON EXACT așa cum este. Nu adăuga și nu șterge chei.
      2. Tradu DOAR valorile care reprezintă text vizibil pentru utilizator (ex: "title", "subtitle", "content", "term", "description", "items", "explanation").
      3. NU traduce valorile tehnice precum "type" (ex: "paragraph", "table", "geometry"), "fileType" sau URL-uri.
      4. Pentru conținutul HTML (din "paragraph"), tradu textul dar păstrează tag-urile HTML intacte.
      5. Returnează DOAR obiectul JSON valid, fără markdown (fără \`\`\`json).

      Obiectul de tradus:
      ${JSON.stringify(content)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Curățare markdown dacă AI-ul îl adaugă accidental
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const translatedJson = JSON.parse(text);

    res.json(translatedJson);

  } catch (error) {
    console.error("Eroare Traducere AI:", error);
    res.status(500).json({ error: "Eroare la procesarea traducerii." });
  }
};

// Funcții existente (Generare) - Le păstrăm pentru consistență
exports.generateLesson = async (req, res) => {
    try {
        const { topic, tone, sectionsCount } = req.body;
        const prompt = `
            Creează o structură de lecție educațională despre "${topic}".
            Ton: ${tone}. Număr secțiuni: ${sectionsCount}.
            Format JSON strict:
            {
                "title": "Titlu Lecție",
                "subtitle": "Scurtă descriere",
                "sections": [
                    {
                        "title": "Titlu Secțiune",
                        "blocks": [
                            { "type": "paragraph", "content": "<p>Conținut HTML...</p>" },
                            { "type": "definition", "term": "Termen", "description": "Explicație" }
                        ]
                    }
                ]
            }
            Returnează doar JSON.
        `;
        
        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        res.json(JSON.parse(text));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.generateBlock = async (req, res) => {
    try {
        const { prompt: userPrompt, context } = req.body;
        const finalPrompt = `
            Generează un bloc de conținut pentru o lecție despre "${context}".
            Cerință utilizator: "${userPrompt}".
            Returnează un singur obiect JSON valid pentru un bloc (ex: type: 'paragraph', 'table', 'list', etc.) compatibil cu editorul.
            Fără markdown.
        `;
        const result = await model.generateContent(finalPrompt);
        let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        res.json(JSON.parse(text));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};