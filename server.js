const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");
require("dotenv").config();

const app = express();

// 1. ÖNEMLİ: Resim yüklediğin için limitleri artırmamız şart!
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// API Anahtarı Kontrolü
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ HATA: GEMINI_API_KEY .env dosyasında veya Render ayarlarında yok!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 İstek Render'a ulaştı!");

        // Frontend'den gelen verileri güvenli şekilde alalım
        const { prompt, image, userPrompt, falTuru } = req.body;
        
        // Hangi isimle gelirse gelsin prompt'u yakala
        const finalPrompt = prompt || userPrompt || falTuru || "Kahve falıma bak";
        
        // Resmi yakala
        const finalImage = image || req.body.base64Image;

        console.log(`📝 Prompt: ${finalPrompt}`);

        if (!finalImage) {
            console.error("❌ Resim verisi boş geldi.");
            return res.status(400).json({ success: false, error: "Resim verisi sunucuya ulaşmadı." });
        }

        // --- MODEL SEÇİMİ ---
        // NOT: Google'ın resmi modelleri 'gemini-1.5-flash' veya 'gemini-pro'dur.
        // Eğer '2.5' çalışmazsa hata mesajında göreceğiz.
        const modelName = "gemini-2.5-flash"; 
        
        console.log(`🤖 Model hazırlanıyor: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });

        // Base64 başlığını temizle (Varsa)
        const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");

        const result = await model.generateContent([
            finalPrompt,
            {
                inlineData: {
                    data: cleanBase64,
                    mimeType: "image/jpeg",
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();

        console.log("✅ Fal yorumu başarılı!");
        res.json({ success: true, response: text });

    } catch (error) {
        console.error("💥 SUNUCU HATASI:", error);
        
        // BURASI ÇOK ÖNEMLİ: Hatanın detayını Frontend'e gönderiyoruz
        // Böylece telefon ekranında hatanın ne olduğunu göreceksin.
        res.status(500).json({ 
            success: false, 
            error: error.message || "Bilinmeyen sunucu hatası",
            details: error.toString() 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda çalışıyor.`);
});