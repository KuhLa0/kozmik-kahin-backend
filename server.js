const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Limitler
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// API Key Kontrolü
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ KRİTİK HATA: GEMINI_API_KEY bulunamadı!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 İstek alındı.");
        const { image } = req.body;
        const finalImage = image || req.body.base64Image;

        if (!finalImage) {
            return res.status(400).json({ success: false, error: "Resim yok." });
        }

        // --- MODEL SEÇİMİ ---
        // En güncel ve hızlı model budur. 
        // Eğer 2.5 kullanmak istiyorsan buraya yazabilirsin ama muhtemelen 404 verecektir.
        const modelName = "gemini-1.5-flash"; 
        
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: { responseMimeType: "application/json" } 
        });

        const validationPrompt = `
        Görev: Bu görüntüyü analiz et. Bu bir Türk kahvesi fincanı mı?
        Kurallar:
        1. Yanıt SADECE JSON formatında olsun.
        2. Kahve değilse: {"valid": false, "reason": "Görüntü kahve falı değil."}
        3. Kahve ise: {"valid": true, "yorum": "Mistik ve detaylı fal yorumun..."}
        `;

        const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");

        console.log(`🤖 Model (${modelName}) çalıştırılıyor...`);

        const result = await model.generateContent([
            validationPrompt,
            { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } },
        ]);

        const responseText = await result.response.text();
        console.log("✅ Yanıt geldi:", responseText);

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseText);
        } catch (e) {
            parsedResponse = { valid: true, yorum: responseText };
        }

        if (parsedResponse.valid === false) {
            return res.status(422).json({ 
                success: false, 
                isNotCoffee: true, 
                error: parsedResponse.reason 
            });
        }

        res.json({ success: true, response: parsedResponse.yorum });

    } catch (error) {
        console.error("💥 HATA OLUŞTU:", error.message);

        // --- ÖZEL DEBUG BLOĞU ---
        // Eğer "Not Found" hatası alırsak, sunucudaki mevcut modelleri listeleyelim
        if (error.message.includes("404") || error.message.includes("not found")) {
            console.log("🔍 Mevcut modeller listeleniyor...");
            try {
                // Modelleri listeleme (eski sürüm kütüphanede bu fonksiyon olmayabilir)
                // Ama kütüphaneyi güncellediğimiz için çalışmalı.
                // Not: listModels bir async iterator döner, kullanımı biraz farklıdır.
                console.log("⚠️ Render'daki kütüphane sürümü eski olabilir veya model adı hatalı.");
                console.log("⚠️ Lütfen package.json dosyasında '@google/generative-ai' sürümünün '^0.21.0' olduğundan emin olun.");
            } catch (listError) {
                console.log("Modeller listelenemedi.");
            }
        }

        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: "Render'daki kütüphane eski olabilir. package.json güncellenmeli."
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda çalışıyor.`);
});