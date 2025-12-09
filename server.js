const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Resim ve veri limiti (50mb)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// API Anahtarı Kontrolü
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ HATA: GEMINI_API_KEY bulunamadı! Render Environment ayarlarını kontrol et.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Kullanılacak Model (gemini-pro v1beta'da kalktığı için 1.5-flash kullanıyoruz)
const MODEL_NAME = "gemini-1.5-flash";

app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 Fal isteği alındı.");
        
        // Frontend'den gelen tüm verileri alıyoruz
        const { image, selectedCards, falTuru, intention, spreadName, spreadStructure } = req.body;
        const finalImage = image || req.body.base64Image;

        // ============================================================
        // 🔮 SENARYO 1: TAROT FALI
        // ============================================================
        if (falTuru === 'tarot') {
            console.log(`🔮 Tarot Modu Çalışıyor: ${spreadName}`);
            
            if (!selectedCards) {
                throw new Error("Kart verisi (selectedCards) sunucuya ulaşmadı!");
            }

            const cards = JSON.parse(selectedCards);
            
            // Kartları okunabilir metne çevir (İsim + Ters/Düz Durumu)
            const cardDescriptions = cards.map((c, i) => 
                `${i + 1}. Kart: ${c.name} ${c.isReversed ? '(TERS - Reversed)' : '(DÜZ)'}`
            ).join('\n');

            // --- AKILLI PROMPT (İSTEM) ---
            // Frontend'den gelen özel kuralları (spreadStructure) buraya gömüyoruz.
            const prompt = `
            GÖREV: Sen profesyonel, sezgileri kuvvetli ve mistik bir Tarot yorumcususun.
            
            AÇILIM TÜRÜ: ${spreadName || 'Özel Açılım'}
            KULLANICININ NİYETİ / SORUSU: "${intention}"

            ÇEKİLEN KARTLAR:
            ${cardDescriptions}

            BU AÇILIMIN KURALLARI VE POZİSYON ANLAMLARI:
            ${spreadStructure || 'Kartları sırasıyla yorumla.'}

            YORUMLAMA TALİMATLARI:
            1. Her kartı, yukarıda belirtilen pozisyon anlamına göre detaylıca analiz et.
            2. Eğer kart TERS (Reversed) ise, o kartın gölge yönlerini, içsel blokajlarını veya gecikmeleri vurgula.
            3. Kartlar arasındaki enerji akışını ve hikayeyi birleştir.
            4. Cevabın Markdown formatında, okunaklı ve mistik bir dille olsun. Başlıklar kullan.
            5. Sonuç olarak kullanıcıya net bir rehberlik ve tavsiye ver.
            `;

            console.log(`🤖 Model (${MODEL_NAME}) Tarot için çalıştırılıyor...`);

            const model = genAI.getGenerativeModel({ model: MODEL_NAME });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            console.log("✅ Tarot yorumu başarıyla oluşturuldu.");
            return res.json({ success: true, response: text });
        } 

        // ============================================================
        // ☕ SENARYO 2: KAHVE FALI (Resimli)
        // ============================================================
        else {
            console.log("☕ Kahve Falı Modu Çalışıyor...");

            if (!finalImage) {
                return res.status(400).json({ success: false, error: "Resim yüklenmedi." });
            }

            const model = genAI.getGenerativeModel({ model: MODEL_NAME });
            const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");

            // Kahve Promptu
            const coffeePrompt = `
            GÖREV: Bu Türk kahvesi fincanını yorumla.
            NİYET: "${intention || 'Genel Bakış'}"
            
            TALİMATLAR:
            1. Fincandaki şekilleri benzetim yoluyla analiz et (Kuş, yol, dağ, kalp vb.).
            2. Mistik, pozitif ve umut verici bir dil kullan.
            3. Aşk, Kariyer ve Sağlık başlıkları altında toparla.
            `;

            const result = await model.generateContent([
                coffeePrompt, 
                { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } }
            ]);
            
            const response = await result.response;
            const text = response.text();

            console.log("✅ Kahve yorumu başarıyla oluşturuldu.");
            return res.json({ success: true, response: text });
        }

    } catch (error) {
        console.error("💥 SUNUCU HATASI:", error);
        
        // Hatanın detayını Frontend'e gönder (Kullanıcı "Hata" diyip geçmesin, sebebini görsün)
        res.status(500).json({ 
            success: false, 
            error: error.message || "Bilinmeyen sunucu hatası.",
            details: error.toString() 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda hazır.`);
});