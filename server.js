import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 3000;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const CLAUDE_MODEL = "claude-sonnet-5";

// ---- Vérification de santé (utile pour Render/Railway) ----
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "sputnik-server" });
});

// ---- Fonction commune : appelle Claude (texte ou code) ----
async function askClaude({ systemPrompt, history, message }) {
  if (!ANTHROPIC_KEY) {
    throw new Error("ANTHROPIC_API_KEY manquante dans le fichier .env");
  }

  const messages = [
    ...(history || []).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erreur API Anthropic (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

// ---- Onglet TEXTE ----
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: "Champ 'message' requis" });

    const reply = await askClaude({
      systemPrompt: "Tu es SPUTNIK, un assistant IA clair, direct et utile. Réponds en français sauf si on te parle dans une autre langue.",
      history,
      message,
    });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Onglet CODE ----
app.post("/api/code", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: "Champ 'message' requis" });

    const reply = await askClaude({
      systemPrompt: "Tu es SPUTNIK Code. Tu écris du code propre et fonctionnel, avec de brèves explications. Privilégie des exemples complets et exécutables.",
      history,
      message,
    });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Onglet IMAGE (via OpenAI Images) ----
app.post("/api/image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Champ 'prompt' requis" });
    if (!OPENAI_KEY) {
      return res.status(400).json({
        error: "OPENAI_API_KEY manquante. Ajoute une clé OpenAI dans le fichier .env pour activer la génération d'images.",
      });
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erreur API OpenAI (${response.status}): ${errText}`);
    }

    const data = await response.json();
    res.json({ image_base64: data.data[0].b64_json });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Onglet VOIX : pas besoin de serveur ----
// La transcription voix -> texte et la synthèse texte -> voix peuvent se faire
// gratuitement, directement dans le navigateur, avec la Web Speech API.
// Une fois le texte transcrit côté app, il suffit de l'envoyer à /api/chat.

app.listen(PORT, () => {
  console.log(`Serveur SPUTNIK lancé sur le port ${PORT}`);
});
