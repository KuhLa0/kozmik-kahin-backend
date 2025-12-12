require('dotenv').config();
const express = require('express');
const cors = require('cors');
// Güvenlik ayarları için gerekli kütüphaneler
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Hız Sınırı: 15 dakikada 500 istek (Rahatlattık)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api', limiter);

if (!process.env.GEMINI_API_KEY) console.error("❌ HATA: GEMINI_API_KEY eksik!");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// SENİN ÇALIŞAN MODELİN
const MODEL_NAME = "gemini-2.5-flash-lite";

// GÜVENLİK FİLTRELERİ: HEPSİ KAPALI (BLOCK_NONE)
// Bu sayede Chat veya Falda "boş cevap" dönme sorunu biter.
const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

async function generateContent(prompt, isVision = false, imagePart = null) {
    try {
        console.log(`🔄 İstek Geldi. Model: ${MODEL_NAME}`);
        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            safetySettings: SAFETY_SETTINGS 
        });
        
        let result;
        if (isVision && imagePart) {
            result = await model.generateContent([prompt, imagePart]);
        } else {
            result = await model.generateContent(prompt);
        }

        const response = await result.response;
        const text = response.text();
        
        if (!text) throw new Error("AI boş yanıt döndü.");

        console.log("✅ Yanıt Başarılı.");
        return text;

    } catch (error) {
        console.error("⚠️ AI Hatası:", error.message);
        throw new Error("Yapay zeka yanıt veremedi.");
    }
}

// 1. FAL & ASTROLOJİ ENDPOINT'İ
app.post('/api/fal-bak', async (req, res) => {
    try {
        const { prompt, falTuru, astroData } = req.body;
        
        // Hazır prompt varsa direkt kullan (En sağlıklısı)
        if (prompt) {
            const text = await generateContent(prompt, false);
            return res.json({ success: true, response: text });
        }
        
        // Eski yöntem veri geldiyse prompt oluştur
        const generatedPrompt = `Fal Türü: ${falTuru}. Veri: ${astroData}. Yorumla.`;
        const text = await generateContent(generatedPrompt, false);
        res.json({ success: true, response: text });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. CHAT ENDPOINT'İ (Sohbet için)
app.post('/api/chat', async (req, res) => {
    try {
        const { prompt } = req.body;
        // Chat için basit prompt gönderimi
        const text = await generateContent(prompt, false);
        res.json({ success: true, response: text });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. GÖRSEL ANALİZ
app.post('/api/analyze-image', async (req, res) => {
    try {
        const cleanBase64 = req.body.imageBase64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
        const imagePart = { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } };
        const text = await generateContent(req.body.prompt, true, imagePart);
        res.json({ success: true, response: text });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.listen(port, () => console.log(`🚀 Server Hazır! Port: ${port} | Model: ${MODEL_NAME}`));