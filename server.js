require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

if (!process.env.GEMINI_API_KEY) console.error("❌ HATA: GEMINI_API_KEY yok.");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const TEXT_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
const VISION_MODELS = ["gemini-2.5-flash-tts", "gemini-2.5-flash-lite"];
const FALLBACK = "🌌 Kozmik hatlar aşırı yoğun. Lütfen 5 dakika sonra tekrar dene.";

async function generateContent(prompt, isVision = false, imagePart = null) {
  let lastError = null;
  const models = isVision ? VISION_MODELS : TEXT_MODELS;

  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const result = isVision ? await model.generateContent([prompt, imagePart]) : await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err;
      if (err.message?.includes('429') || err.message?.includes('Quota')) throw new Error(FALLBACK);
    }
  }
  throw lastError || new Error("Sunucu, Google API ile iletişim kuramadı.");
}

// --- Mevcut endpointler ---
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt eksik.' });
    const text = await generateContent(prompt, false);
    res.json({ reply: text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Sunucu hatası' });
  }
});

app.post('/api/analyze-image', async (req, res) => {
  try {
    const { prompt, imageBase64 } = req.body;
    if (!prompt || !imageBase64) return res.status(400).json({ error: 'Veri eksik.' });

    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
    const imagePart = { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } };
    const text = await generateContent(prompt, true, imagePart);
    res.json({ reply: text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Sunucu hatası' });
  }
});

// --- Yeni fal-bak endpoint ---
app.post('/api/fal-bak', async (req, res) => {
  try {
    const { falTuru, astroType, astroData, intention } = req.body;
    if (!falTuru) return res.status(400).json({ success: false, error: 'falTuru eksik.' });
    if (falTuru === 'astroloji' && (!astroData || astroData === "")) return res.status(400).json({ success: false, error: 'Gerekli parametreler eksik: astroData' });

    const prompt = falTuru === 'astroloji'
      ? `Astroloji Takvim İsteği: ${typeof astroData === 'string' ? astroData : JSON.stringify(astroData)}\nNiyet: ${intention || ''}`
      : `${falTuru} isteği: ${intention || ''}`;

    const text = await generateContent(prompt, false);
    res.json({ success: true, response: text });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Sunucu hatası' });
  }
});

app.listen(port, () => console.log(`🚀 Kozmik Sunucu ${port} portunda çalışıyor!`));
