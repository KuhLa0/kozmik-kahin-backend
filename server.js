const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");
require("dotenv").config();

const app = express();

// 1. Veri Limiti Ayarları (Resimler için yüksek tutuyoruz)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// 2. API Anahtarı Kontrolü
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ HATA: GEMINI_API_KEY bulunamadı! Render ayarlarını kontrol et.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AKILLI MODEL LİSTESİ (Sırayla denenecekler)
// Sunucu sırayla bunları dener, çalışan ilk modelden cevabı alır.
const MODELS_TO_TRY = [
    "gemini-2.5-flash",       // Senin öncelikli isteğin
    "gemini-1.5-flash",       // En güncel stabil sürüm (Yedek 1)
    "gemini-1.5-flash-latest",// Alternatif isimlendirme (Yedek 2)
    "gemini-pro",             // Eski ama sağlam model (Son Çare)
];

// --- MODEL ÇALIŞTIRMA FONKSİYONU (Fallback Logic) ---
async function generateWithFallback(prompt, imagePart = null) {
    let lastError = null;

    for (const modelName of MODELS_TO_TRY) {
        try {
            console.log(`🔄 Deneniyor: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            let result;
            if (imagePart) {
                // Resimli İstek (Kahve)
                result = await model.generateContent([prompt, imagePart]);
            } else {
                // Sadece Metin İsteği (Tarot)
                result = await model.generateContent(prompt);
            }

            const response = await result.response;
            const text = response.text();
            
            console.log(`✅ BAŞARILI! Çalışan Model: ${modelName}`);
            return text; // Sonucu döndür ve döngüden çık

        } catch (error) {
            // Hata alırsak logluyoruz ama döngüyü kırmıyoruz, sıradakine geçiyoruz
            console.warn(`❌ ${modelName} başarısız oldu. Sebep: ${error.message.split('[')[0]}`);
            lastError = error;
        }
    }
    
    // Hepsi başarısız olursa buraya düşer
    throw new Error(`Tüm modeller denendi ancak başarısız oldu. Son hata: ${lastError ? lastError.message : 'Bilinmiyor'}`);
}


// --- API ROTASI ---
app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 Fal isteği sunucuya ulaştı.");
        
        // Frontend'den gelen tüm verileri alıyoruz
        const { image, selectedCards, falTuru, intention, spreadName, spreadStructure } = req.body;
        const finalImage = image || req.body.base64Image;

        let aiResponse = "";

        // ============================================================
        // 🔮 SENARYO 1: TAROT FALI
        // ============================================================
        if (falTuru === 'tarot') {
            console.log(`🔮 Mod: TAROT (${spreadName})`);
            
            if (!selectedCards) throw new Error("Kart verisi eksik.");
            
            let cards;
            try {
                cards = JSON.parse(selectedCards);
            } catch (e) {
                cards = selectedCards; // Zaten obje ise
            }
            
            // Kartları okunabilir metne çevir
            const cardDescriptions = cards.map((c, i) => 
                `${i + 1}. Kart: ${c.name} ${c.isReversed ? '(TERS - Anlamı değişir)' : '(DÜZ)'}`
            ).join('\n');

            // Tarot Prompt'u (Dinamik)
            const tarotPrompt = `
            GÖREV: Sen bilge, mistik ve derin sezgileri olan profesyonel bir Tarot yorumcususun.
            AÇILIM TÜRÜ: ${spreadName || 'Özel Açılım'}
            SORU / NİYET: "${intention}"

            ÇEKİLEN KARTLAR:
            ${cardDescriptions}

            BU AÇILIMIN POZİSYON KURALLARI (Buna sadık kal):
            ${spreadStructure || 'Kartları sırasıyla yorumla.'}

            YORUMLAMA REHBERİ:
            1. Her kartı bulunduğu pozisyonun anlamına göre yorumla.
            2. TERS (Reversed) kartların uyarıcı, geciktirici veya içsel yönlerini mutlaka belirt.
            3. Kartlar arasındaki ilişkiyi ve hikayeyi bir bütün olarak anlat.
            4. Cevabını Markdown formatında, başlıklar ve paragraflar kullanarak düzenle.
            5. Kullanıcıya empatik, yol gösterici ve mistik bir dille hitap et.
            `;

            // Akıllı fonksiyonu çağır (Resim yok)
            aiResponse = await generateWithFallback(tarotPrompt, null);
        } 

        // ============================================================
        // ☕ SENARYO 2: KAHVE FALI
        // ============================================================
        else {
            console.log("☕ Mod: KAHVE FALI");

            if (!finalImage) return res.status(400).json({ success: false, error: "Resim yok." });

            // Base64 temizliği
            const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");
            const imagePart = { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } };

            const coffeePrompt = `
            GÖREV: Bu Türk kahvesi fincanını detaylıca yorumla.
            NİYET: "${intention || 'Genel Bakış'}"
            
            TALİMATLAR:
            1. Fincandaki şekilleri benzetim yoluyla analiz et (Yol, hayvan, semboller vb.).
            2. Aşk, Kariyer, Maddiyat ve Sağlık başlıkları altında yorumla.
            3. Mistik, pozitif ve umut verici bir dil kullan.
            `;

            // Akıllı fonksiyonu çağır (Resim var)
            aiResponse = await generateWithFallback(coffeePrompt, imagePart);
        }

        // Sonucu gönder
        res.json({ success: true, response: aiResponse });

    } catch (error) {
        console.error("💥 KRİTİK HATA:", error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.toString() 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda hazır.`);
});