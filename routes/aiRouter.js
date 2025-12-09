const express = require('express');
const router = express.Router();

router.post('/generate', async (req, res) => {
    try {
        const { topic, tone, sectionsCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!topic) return res.status(400).json({ error: "Subiectul este obligatoriu." });
        if (!apiKey) return res.status(500).json({ error: "Cheia API lipsește din .env" });

        // PASUL 1: Aflăm ce modele sunt disponibile pentru TINE
        // Facem un request pentru a lista modelele active pe contul tău
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listResponse = await fetch(listUrl);
        const listData = await listResponse.json();

        if (listData.error) {
            console.error("❌ EROARE LISTARE MODELE:", listData.error);
            return res.status(500).json({ error: "Nu am putut verifica lista de modele AI.", details: listData.error.message });
        }

        // Căutăm un model valid care suportă 'generateContent'
        // Prioritizăm modelele care conțin "flash" (rapide), apoi "pro", apoi orice altceva.
        const availableModels = listData.models || [];
        const selectedModel = availableModels.find(m => m.name.includes("flash") && m.supportedGenerationMethods.includes("generateContent")) 
                           || availableModels.find(m => m.name.includes("pro") && m.supportedGenerationMethods.includes("generateContent"))
                           || availableModels.find(m => m.supportedGenerationMethods.includes("generateContent"));

        if (!selectedModel) {
            console.error("❌ NICIUN MODEL DISPONIBIL. Lista primită:", JSON.stringify(availableModels));
            return res.status(500).json({ error: "Contul tău Google AI nu are acces la niciun model de generare text." });
        }

        console.log(`✅ Model detectat automat: ${selectedModel.name}`);

        // PASUL 2: Generăm conținutul folosind modelul găsit
        // selectedModel.name vine deja formatat ca "models/gemini-..."
        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${selectedModel.name}:generateContent?key=${apiKey}`;

        const promptText = `
            Ești un profesor expert. Generează o structură de lecție în format JSON.
            Subiect: "${topic}"
            Ton: ${tone}
            Număr Secțiuni: ${sectionsCount}

            Răspunde DOAR cu JSON-ul, respectând strict această schemă:
            {
                "title": "Titlu",
                "subtitle": "Subtitlu",
                "sections": [
                    {
                        "title": "Titlu Secțiune",
                        "blocks": [
                            { "type": "paragraph", "content": "<p>Conținut...</p>" },
                            { "type": "definition", "term": "Termen", "description": "Definiție" },
                            { "type": "list", "items": ["Item 1", "Item 2"] }
                        ]
                    }
                ]
            }
        `;

        const genResponse = await fetch(generateUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const genData = await genResponse.json();

        if (genData.error) {
            // Dacă dă eroare pe JSON mode, încercăm din nou fără (fallback pentru modele vechi)
            console.warn("⚠️ Eroare la generare cu JSON mode. Reîncercăm standard...", genData.error.message);
            const fallbackResponse = await fetch(generateUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
            });
            const fallbackData = await fallbackResponse.json();
            
            if (fallbackData.error) {
                throw new Error(fallbackData.error.message);
            }
            
            // Procesăm răspunsul de fallback (text simplu -> JSON)
            const rawText = fallbackData.candidates[0].content.parts[0].text;
            const cleaned = rawText.replace(/```json|```/g, "").trim();
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            res.json(JSON.parse(cleaned.substring(firstBrace, lastBrace + 1)));
            return;
        }

        // Procesăm răspunsul standard
        const rawText = genData.candidates[0].content.parts[0].text;
        res.json(JSON.parse(rawText));

    } catch (error) {
        console.error("❌ EROARE FINALĂ:", error);
        res.status(500).json({ 
            error: "Generarea a eșuat.",
            details: error.message 
        });
    }
});


router.post('/generate-block', async (req, res) => {
    try {
        const { prompt, context } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!prompt) return res.status(400).json({ error: "Instrucțiunea este obligatorie." });

        // 1. Auto-detecție model (folosim logica robustă existentă)
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listResponse = await fetch(listUrl);
        const listData = await listResponse.json();
        
        const availableModels = listData.models || [];
        const selectedModel = availableModels.find(m => m.name.includes("flash") && m.supportedGenerationMethods.includes("generateContent")) 
                           || availableModels.find(m => m.name.includes("pro") && m.supportedGenerationMethods.includes("generateContent"))
                           || availableModels.find(m => m.supportedGenerationMethods.includes("generateContent"));

        if (!selectedModel) return res.status(500).json({ error: "Niciun model AI disponibil." });

        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${selectedModel.name}:generateContent?key=${apiKey}`;

        // 2. Prompt specializat pentru blocuri
        const systemInstruction = `
            Ești un asistent editorial expert. Sarcina ta este să generezi UN SINGUR bloc de conținut pentru o lecție, în format JSON.
            Contextul lecției (opțional): "${context || 'General'}"
            Cererea utilizatorului: "${prompt}"

            Trebuie să decizi cel mai bun tip de bloc (paragraph, list, table, definition, formula) pentru această cerere.
            
            Răspunde DOAR cu JSON-ul blocului, respectând una din aceste structuri:

            Pentru TABEL:
            { "type": "table", "content": [ ["Cap1", "Cap2"], ["Rând1-Col1", "Rând1-Col2"] ] }

            Pentru LISTĂ:
            { "type": "list", "items": ["Item 1", "Item 2", "Item 3"] }

            Pentru PARAGRAF (folosește HTML tags <p>, <b>):
            { "type": "paragraph", "content": "<p>Textul explicativ...</p>" }

            Pentru DEFINIȚIE:
            { "type": "definition", "term": "Termenul", "description": "Explicația..." }

            NU adăuga markdown (\`\`\`json). Doar JSON-ul pur.
        `;

        const response = await fetch(generateUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemInstruction }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        
        // Extragere și curățare
        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error("AI-ul nu a returnat text.");

        rawText = rawText.replace(/```json|```/g, "").trim();
        const blockJson = JSON.parse(rawText);

        res.json(blockJson);

    } catch (error) {
        console.error("Eroare generare bloc:", error);
        res.status(500).json({ error: "Nu s-a putut genera blocul." });
    }
});

module.exports = router;