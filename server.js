const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

if (!process.env.GEMINI_API_KEY) {
    console.error("❌ HATA: GEMINI_API_KEY bulunamadı!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Modelleri sırayla deneyeceğiz
const MODELS_TO_TRY = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];

app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 Fal isteği alındı.");
        const { image, selectedCards, falTuru, intention, spreadId } = req.body;
        const finalImage = image || req.body.base64Image;

        // --- TAROT MODU ---
        if (falTuru === 'tarot') {
            console.log(`🔮 Tarot Modu Başlatıldı: ${spreadId}`);
            
            // Kart verisini kontrol et
            if (!selectedCards) {
                throw new Error("Kart verisi (selectedCards) sunucuya ulaşmadı!");
            }

            const cards = JSON.parse(selectedCards);
            
            // Kartları okunabilir metne çevir
            const cardDescriptions = cards.map((c, i) => 
                `${i + 1}. Kart: ${c.name} ${c.isReversed ? '(TERS - Reversed)' : '(DÜZ)'}`
            ).join('\n');

            let prompt = "";
            
            // Prompt'u hazırla
            if (spreadId === 'iliski') {
                prompt = `
                GÖREV: Profesyonel Tarot yorumcusu (İlişki Uzmanı).
                NİYET: "${intention}"
                KARTLAR:
                ${cardDescriptions}
                KURALLAR:
                1. Merkez Kart: İlişkinin kalbi.
                2. Sağ Taraf (Kart 2,3,4): Partnerin düşünceleri ve hisleri.
                3. Sol Taraf (Kart 5,6,7): Senin düşüncelerin ve hislerin.
                YORUM: Kartların ters/düz oluşunu dikkate alarak derin, mistik bir yorum yap.
                `;
            } else if (spreadId === 'kelt') {
                prompt = `
                GÖREV: Profesyonel Tarot yorumcusu (Kelt Haçı).
                NİYET: "${intention}"
                KARTLAR:
                ${cardDescriptions}
                YORUM: 10 kartlık Kelt Haçı pozisyonlarına göre (Merkez, Engel, Geçmiş, Gelecek, Bilinçaltı, Sonuç vb.) detaylı yorumla.
                `;
            } else {
                prompt = `
                GÖREV: Tarot yorumcusu (3 Kart).
                NİYET: "${intention}"
                KARTLAR:
                ${cardDescriptions}
                YORUM: Geçmiş, Şimdi ve Gelecek olarak yorumla.
                `;
            }

            let finalResponse = null;
            let lastError = ""; // Son hatayı burada saklayacağız

            // Modelleri sırayla dene
            for (const modelName of MODELS_TO_TRY) {
                try {
                    console.log(`🔄 Deneniyor: ${modelName}`);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    finalResponse = response.text();
                    
                    console.log(`✅ BAŞARILI: ${modelName}`);
                    break; // Başarılıysa döngüden çık
                } catch (e) {
                    console.error(`❌ ${modelName} Hatası:`, e.message);
                    lastError = e.message; // Hatayı kaydet
                }
            }

            if (!finalResponse) {
                // Hatanın sebebini kullanıcıya gönderiyoruz
                throw new Error(`Google Reddetme Sebebi: ${lastError}`);
            }
            
            return res.json({ success: true, response: finalResponse });
        } 
        // --- TAROT BİTİŞ ---

        // --- KAHVE FALI MODU (Eski Kod) ---
        if (!finalImage) return res.status(400).json({ success: false, error: "Resim yok." });
        
        // ... (Kahve falı kodlarının kalanı buraya gelecek, eski çalışan halini koru) ...
        // Kahve falı için model çağırma kısmı burada olmalı.
        // Eğer kahve kodunu sildiysen, basitçe şunu ekle:
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");
        const result = await model.generateContent([
            "Bu kahve falını yorumla.", 
            { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } }
        ]);
        const response = await result.response;
        res.json({ success: true, response: response.text() });

    } catch (error) {
        console.error("💥 SUNUCU HATASI:", error);
        // Hatanın tüm detayını gönderiyoruz
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: error.stack 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda.`);
});