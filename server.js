// ----- SERVER.JS / INDEX.JS GÜNCEL HALİ -----

const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Resim limiti
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

if (!process.env.GEMINI_API_KEY) {
    console.error("❌ HATA: GEMINI_API_KEY eksik!");
}

// JSON yanıtları garantilemek için model ayarı
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// 'response_mime_type': 'application/json' özelliği genelde pro modellerde daha iyi çalışır
// ama 1.5-flash veya 2.5-flash ile de deneyebiliriz.
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", // Veya senin çalıştığını teyit ettiğin "gemini-2.5-flash"
    generationConfig: { responseMimeType: "application/json" } 
});


app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 İstek alındı, işleniyor...");
        const { image } = req.body;
        const finalImage = image || req.body.base64Image;

        if (!finalImage) {
            return res.status(400).json({ success: false, error: "Resim verisi yok." });
        }

        // --- ÖZEL PROMPT (KAHVE KONTROLÜ İÇİN) ---
        // Gemini'yi bir dedektif gibi kullanıyoruz.
        const validationPrompt = `
        Görev: Bu görüntüyü analiz et. Bu bir Türk kahvesi fincanı ve fal bakmak için uygun telve içeriyor mu?
        
        Kurallar:
        1. Yanıtın SADECE geçerli bir JSON formatında olmalı.
        2. Eğer görüntü bir kahve falı fincanı DEĞİLSE (örneğin kedi, manzara, boş bardak ise), şu JSON'u döndür: {"valid": false, "reason": "Bu bir kahve falı görüntüsüne benzemiyor."}
        3. Eğer görüntü geçerli bir kahve falı İSE, mistik ve detaylı bir yorum yap ve şu JSON'u döndür: {"valid": true, "yorum": "Senin mistik fal yorumun buraya..."}
        `;

        const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");

        console.log("🤖 Gemini kahve kontrolü yapıyor...");
        const result = await model.generateContent([
            validationPrompt,
            {
                inlineData: {
                    data: cleanBase64,
                    mimeType: "image/jpeg",
                },
            },
        ]);

        const responseText = await result.response.text();
        console.log("🤖 Gemini Yanıtı (Ham):", responseText);

        // Gelen metni JSON objesine çeviriyoruz
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseText);
        } catch (e) {
             // Bazen Gemini tam JSON döndürmezse hata verir, bunu yakalayalım.
             console.error("JSON Parse Hatası:", e);
             throw new Error("Yapay zeka yanıtı okunamadı.");
        }


        // KONTROL ANI: Kahve mi değil mi?
        if (parsedResponse.valid === false) {
            console.log("⛔ Resim reddedildi: Kahve değil.");
            // Frontend'e özel bir hata kodu (422 Unprocessable Entity) gönderiyoruz
            return res.status(422).json({ 
                success: false, 
                isNotCoffee: true, // Frontend bunu kontrol edecek
                error: parsedResponse.reason || "Bu görüntü kahve falına benzemiyor." 
            });
        }

        console.log("✅ Resim onaylandı, fal yorumu gönderiliyor.");
        // Başarılı yorumu gönder
        res.json({ success: true, response: parsedResponse.yorum });

    } catch (error) {
        console.error("💥 SUNUCU HATASI:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message || "Sunucu hatası",
            details: error.toString() 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda.`);
});