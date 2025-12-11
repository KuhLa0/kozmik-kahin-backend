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
    process.exit(1); // API key yoksa server başlamasın
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Modeller
const TEXT_MODELS_TO_TRY = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]; 
const VISION_MODELS_TO_TRY = ["gemini-2.5-flash-tts", "gemini-2.5-flash-lite"];

const FALLBACK_MESSAGE = "🌌 Kozmik hatlar aşırı yoğun. Lütfen 5 dakika sonra tekrar dene.";

// İçerik oluşturma fonksiyonu
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

// Genel API endpoint fonksiyonu: prompt'u alır, fal türüne göre özelleştirilebilir
async function handleFalRequest(req, res, falType) {
    try {
        const { prompt, imageBase64, name1, date1, name2, date2, focus } = req.body;

        if (!prompt && !name1) {
            return res.status(400).json({ error: 'Gerekli parametreler eksik.' });
        }

        let generatedText;

        if (imageBase64) {
            // Görsel destekli fal (ör: resim analizi)
            const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
            const imagePart = {
                inlineData: {
                    data: cleanBase64,
                    mimeType: "image/jpeg",
                },
            };
            generatedText = await generateContent(prompt, true, imagePart);
        } else if (falType === 'ask-uyumu') {
            // Aşk uyumu için özel JSON oluşturabiliriz
            const astroData = JSON.stringify({ name1, date1, name2, date2, focus });
            const fullPrompt = `${prompt}\n\n${astroData}`;
            generatedText = await generateContent(fullPrompt, false);
        } else {
            // Genel metin bazlı fal, astroloji vb.
            generatedText = await generateContent(prompt, false);
        }

        res.json({ success: true, response: generatedText });

    } catch (error) {
        console.error("API HATA:", error);
        res.status(500).json({ success: false, error: error.message || 'Sunucu hatası' });
    }
}

// --- API ENDPOINTLERİ ---

app.post('/api/fal-bak', (req, res) => handleFalRequest(req, res, 'fal-bak'));
app.post('/api/ask-uyumu', (req, res) => handleFalRequest(req, res, 'ask-uyumu'));
app.post('/api/astroloji', (req, res) => handleFalRequest(req, res, 'astroloji'));
app.post('/api/numeroloji', (req, res) => handleFalRequest(req, res, 'numeroloji'));
app.post('/api/ruya', (req, res) => handleFalRequest(req, res, 'ruya'));
app.post('/api/cin', (req, res) => handleFalRequest(req, res, 'cin'));
app.post('/api/tarot', (req, res) => handleFalRequest(req, res, 'tarot'));
app.post('/api/el-fali', (req, res) => handleFalRequest(req, res, 'el-fali'));
app.post('/api/yuz-fali', (req, res) => handleFalRequest(req, res, 'yuz-fali'));
app.post('/api/astro-calendar', (req, res) => handleFalRequest(req, res, 'astro-calendar'));

// İstersen yeni endpointleri buraya ekleyebilirsin

app.listen(port, () => {
    console.log(`🚀 Kozmik Sunucu ${port} portunda çalışıyor!`);
});
