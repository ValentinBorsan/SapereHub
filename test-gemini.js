require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    // Încearcă să listezi modelele disponibile pentru cheia ta
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Salut, ești acolo?");
    console.log("SUCCES! Răspuns:", result.response.text());
  } catch (error) {
    console.error("EROARE:", error.message);
    console.log("\n--- DEPANARE ---");
    console.log("1. Verifică dacă ai activat 'Generative Language API' în Google Cloud Console.");
    console.log("2. Verifică dacă cheia este corectă în .env.");
    console.log("3. Dacă ești în Europa, uneori conturile fără billing sunt limitate.");
  }
}

test();
