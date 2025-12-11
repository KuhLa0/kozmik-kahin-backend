require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

if (!process.env.GEMINI_API_KEY) {
    console.error("❌ HATA: GEMINI_API_KEY yok.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- AKILLI MODEL SİSTEMİ: YENİ İSİMLERE GÖRE AYARLANDI ---
// Resimli analiz yapacağımız için "flash-tts" veya "flash-lite" en iyi seçenek.
// En stabil olanı en üstte deneyeceğiz.
const TEXT_MODELS_TO_TRY = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]; 
const VISION_MODELS_TO_TRY = ["gemini-2.5-flash-tts", "gemini-2.5-flash-lite"];

const FALLBACK_MESSAGE = "🌌 Kozmik hatlar aşırı yoğun. Lütfen 5 dakika sonra tekrar dene.";

// --- GENEL FİZİK FONKSİYONU ---
async function generateContent(prompt, isVision = false, imagePart = null) {
    let lastError = null;
    
    // Hangi listeyi deneyeceğimizi belirle
    const modelList = isVision ? VISION_MODELS_TO_TRY : TEXT_MODELS_TO_TRY;

    for (const modelName of modelList) {
        try {
            console.log(`🔄 Denenen Model (${isVision ? 'Vision' : 'Text'}): ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            let result;
            if (isVision) {
                 result = await model.generateContent([prompt, imagePart]);
            } else {
                 result = await model.generateContent(prompt);
            }

            const text = result.response.text();
            console.log(`✅ BAŞARILI! Cevap veren model: ${modelName}`);
            return text; 

        } catch (error) {
            console.warn(`⚠️ ${modelName} başarısız oldu. Hata:`, error.message);
            lastError = error;
            // Limit dolduysa, son mesajı ayarla
            if (error.message?.includes('429') || error.message?.includes('Quota')) {
                throw new Error(FALLBACK_MESSAGE);
            }
        }
    }

    // Hiçbiri çalışmazsa en son hatayı fırlat
    throw lastError || new Error("Sunucu, Google API ile iletişim kuramadı.");
}

// --- ROTA 1: GENEL SOHBET (TEXT) ---
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt eksik.' });
    
    const text = await generateContent(prompt, false); // isVision: false
    res.json({ reply: text });

  } catch (error) {
    res.status(500).json({ error: error.message || 'Sunucu hatası' });
  }
});

// --- ROTA 2: GÖRSEL ANALİZ (VISION) ---
app.post('/api/analyze-image', async (req, res) => {
  try {
    const { prompt, imageBase64 } = req.body;
    if (!prompt || !imageBase64) return res.status(400).json({ error: 'Veri eksik.' });

    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: "image/jpeg",
      },
    };

    const text = await generateContent(prompt, true, imagePart); // isVision: true
    res.json({ reply: text });

  } catch (error) {
    res.status(500).json({ error: error.message || 'Sunucu hatası' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Kozmik Sunucu ${port} portunda çalışıyor!`);
});