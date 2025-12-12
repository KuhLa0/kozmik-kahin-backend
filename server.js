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

// --- MODEL AYARLARI ---
const TEXT_MODELS_TO_TRY = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]; 
const VISION_MODELS_TO_TRY = ["gemini-2.5-flash-tts", "gemini-2.5-flash-lite"];
const FALLBACK_MESSAGE = "🌌 Kozmik hatlar aşırı yoğun. Lütfen 5 dakika sonra tekrar dene.";

// --- GENERATE CONTENT FONKSİYONU ---
async function generateContent(prompt, isVision = false, imagePart = null) {
    let lastError = null;
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
            if (error.message?.includes('429') || error.message?.includes('Quota')) {
                throw new Error(FALLBACK_MESSAGE);
            }
        }
    }
    throw lastError || new Error("Sunucu, Google API ile iletişim kuramadı.");
}

// --- ROUTE: GENEL SOHBET ---
app.post('/api/chat', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt eksik.' });

        const text = await generateContent(prompt, false);
        res.json({ success: true, response: text });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Sunucu hatası' });
    }
});

// --- ROUTE: GÖRSEL ANALİZ ---
app.post('/api/analyze-image', async (req, res) => {
    try {
        const { prompt, imageBase64 } = req.body;
        if (!prompt || !imageBase64) return res.status(400).json({ success:false, error: 'Veri eksik.' });

        const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
        const imagePart = { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } };

        const text = await generateContent(prompt, true, imagePart);
        res.json({ success:true, response: text });
    } catch (error) {
        res.status(500).json({ success:false, error: error.message || 'Sunucu hatası' });
    }
});

// --- ROUTE: FAL BAK / ASTRO TAKVİM ---
app.post('/api/fal-bak', async (req, res) => {
    try {
        const { falTuru, astroType, astroData, intention } = req.body;

        if (!falTuru || !astroType || !astroData) {
            return res.status(400).json({ success:false, error: 'Gerekli parametreler eksik: astroData veya falTuru veya astroType' });
        }

        let promptText = "";

        if (falTuru === 'astroloji' && astroType === 'calendar') {
            promptText = `Takvim verisi üret. Kullanıcı isteği: ${intention || 'Genel Astro Takvim'}.\nVeri: ${astroData}`;
        } else {
            promptText = `Fal türü: ${falTuru}, astroType: ${astroType}, veri: ${astroData}, intention: ${intention || ''}`;
        }

        const text = await generateContent(promptText, false);
        res.json({ success:true, response: text });

    } catch (error) {
        console.error("Fal Hatası:", error);
        res.status(500).json({ success:false, error: error.message || FALLBACK_MESSAGE });
    }
});

// --- SERVER BAŞLAT ---
app.listen(port, () => {
    console.log(`🚀 Kozmik Sunucu ${port} portunda çalışıyor!`);
});
