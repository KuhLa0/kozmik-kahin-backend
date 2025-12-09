const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Limitleri yüksek tutuyoruz (Resimler için)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// API Anahtarı Kontrolü
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ HATA: GEMINI_API_KEY bulunamadı! Render Environment ayarlarını kontrol et.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- AKILLI MODEL LİSTESİ ---
// Sunucu sırasıyla bunları deneyecek. Hangisi çalışırsa cevabı ondan alacak.
const MODELS_TO_TRY = [
    "gemini-2.5-flash",       // Senin istediğin (Varsa dener)
    "gemini-1.5-flash",       // En güncel hızlı model
    "gemini-1.5-flash-latest",// Alternatif isim
    "gemini-pro",             // En eski ve en garanti çalışan model (Fail-safe)
];

app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 Fal isteği alındı.");
        const { image } = req.body;
        const finalImage = image || req.body.base64Image;

        if (!finalImage) {
            return res.status(400).json({ success: false, error: "Resim yok." });
        }

        const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");
        
        // Bu promptu her model için kullanacağız
        const validationPrompt = `
        Görev: Bu fotoğrafı analiz et. Bu bir Türk kahvesi falı mı?
        Cevap Formatı (Sadece JSON):
        Eğer kahve değilse: {"valid": false, "reason": "Bu resim kahve falı değil."}
        Eğer kahveyse: {"valid": true, "yorum": "Buraya fal yorumunu mistik bir dille yaz."}
        Lütfen JSON dışında hiçbir şey yazma.
        `;

        let finalResponse = null;
        let usedModelName = "";

        // --- MODEL DENEME DÖNGÜSÜ ---
        for (const modelName of MODELS_TO_TRY) {
            try {
                console.log(`🔄 Deneniyor: ${modelName}...`);
                
                const model = genAI.getGenerativeModel({ model: modelName });
                
                const result = await model.generateContent([
                    validationPrompt,
                    { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } }
                ]);

                const text = await result.response.text();
                
                // Eğer buraya geldiysek model çalıştı demektir!
                console.log(`✅ BAŞARILI! Çalışan model: ${modelName}`);
                finalResponse = text;
                usedModelName = modelName;
                break; // Döngüden çık, cevabı bulduk

            } catch (err) {
                console.log(`❌ ${modelName} başarısız oldu. Sıradakine geçiliyor...`);
                // Hatayı loglayalım ama sunucuyu durdurmayalım
                // console.log("Sebep:", err.message);
            }
        }

        // --- SONUÇ KONTROLÜ ---
        if (!finalResponse) {
            throw new Error("Hiçbir model çalıştırılamadı. Kütüphane çok eski veya API Key yetkisiz.");
        }

        // JSON Parse İşlemi
        let parsedData;
        try {
            // Temizlik yapalım (Bazen Markdown ```json``` içinde gelir)
            const cleanJson = finalResponse.replace(/```json/g, "").replace(/```/g, "").trim();
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            console.log("JSON parse edilemedi, düz metin gönderiliyor.");
            parsedData = { valid: true, yorum: finalResponse };
        }

        // Kahve Kontrolü Sonucu
        if (parsedData.valid === false) {
            return res.status(422).json({ 
                success: false, 
                isNotCoffee: true, 
                error: parsedData.reason 
            });
        }

        res.json({ success: true, response: parsedData.yorum, debug_model: usedModelName });

    } catch (error) {
        console.error("💥 KESİN HATA:", error);
        res.status(500).json({ 
            success: false, 
            error: "Fal bakılamadı.", 
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda hazır.`);
});