require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- API KEY KONTROL ---
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ HATA: GEMINI_API_KEY tanımlı değil.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- MODELLER ---
const TEXT_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
const VISION_MODELS = ["gemini-2.5-flash-tts", "gemini-2.5-flash-lite"];
const FALLBACK_MESSAGE = "🌌 Kozmik hatlar yoğun. Lütfen 5 dakika sonra tekrar dene.";

// --- GENEL İÇERİK ÜRETME FONKSİYONU ---
async function generateContent(prompt, isVision = false, imagePart = null) {
    let lastError = null;
    const models = isVision ? VISION_MODELS : TEXT_MODELS;

    for (const modelName of models) {
        try {
            console.log(`🔄 Model deneme (${isVision ? "Vision" : "Text"}): ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });

            let result;
            if (isVision) {
                result = await model.generateContent([prompt, imagePart]);
            } else {
                result = await model.generateContent(prompt);
            }

            const text = result.response.text();
            console.log(`✅ Model başarılı: ${modelName}`);
            return text;

        } catch (error) {
            console.warn(`⚠️ ${modelName} başarısız:`, error.message);
            lastError = error;
            if (error.message?.includes('429') || error.message?.includes('Quota')) {
                throw new Error(FALLBACK_MESSAGE);
            }
        }
    }

    throw lastError || new Error("Sunucu Google API ile iletişim kuramadı.");
}

// --- ASTROLOJİ / AŞK UYUMU ---
app.post('/api/fal-bak', async (req, res) => {
    try {
        const { falTuru, astroType, astroData } = req.body;

        if (!falTuru) return res.status(400).json({ error: "Gerekli parametreler eksik: falTuru" });

        let prompt;
        switch (falTuru) {
            case "astroloji":
                if (!astroData) return res.status(400).json({ error: "Gerekli parametreler eksik: astroData" });
                prompt = `Astroloji uyumu hesapla: ${astroData}`;
                break;
            case "kahve":
                prompt = `Kahve falı yorumla: ${req.body.kahveData || "veri yok"}`;
                break;
            case "tarot":
                prompt = `Tarot falı yorumla: ${req.body.tarotData || "veri yok"}`;
                break;
            default:
                return res.status(400).json({ error: "Geçersiz falTuru" });
        }

        const text = await generateContent(prompt, false);
        res.json({ success: true, response: text });

    } catch (error) {
        console.error("❌ Hata:", error);
        res.status(500).json({ success: false, error: error.message || "Sunucu hatası" });
    }
});

// --- GÖRSEL ANALİZ (ÖRNEĞİN KAHVE RESMİ) ---
app.post('/api/analyze-image', async (req, res) => {
    try {
        const { prompt, imageBase64 } = req.body;
        if (!prompt || !imageBase64) return res.status(400).json({ error: "Gerekli parametreler eksik." });

        const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
        const imagePart = { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } };

        const text = await generateContent(prompt, true, imagePart);
        res.json({ success: true, response: text });

    } catch (error) {
        console.error("❌ Hata:", error);
        res.status(500).json({ success: false, error: error.message || "Sunucu hatası" });
    }
});

// --- GENEL CHAT ---
app.post('/api/chat', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "Prompt eksik." });

        const text = await generateContent(prompt, false);
        res.json({ success: true, reply: text });

    } catch (error) {
        console.error("❌ Hata:", error);
        res.status(500).json({ success: false, error: error.message || "Sunucu hatası" });
    }
});

app.listen(port, () => {
    console.log(`🚀 Kozmik Sunucu ${port} portunda çalışıyor!`);
});
