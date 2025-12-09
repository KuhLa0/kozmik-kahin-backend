const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");
require("dotenv").config();

const app = express();

// 1. Veri Limiti Ayarları
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// 2. API Anahtarı Kontrolü
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ HATA: GEMINI_API_KEY bulunamadı! Render ayarlarını kontrol et.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AKILLI MODEL LİSTESİ
const MODELS_TO_TRY = [
    "gemini-2.5-flash",       
    "gemini-1.5-flash",       
    "gemini-1.5-flash-latest",
    "gemini-pro",             
];

// --- MODEL ÇALIŞTIRMA FONKSİYONU ---
async function generateWithFallback(prompt, imagePart = null) {
    let lastError = null;

    for (const modelName of MODELS_TO_TRY) {
        try {
            console.log(`🔄 Deneniyor: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            let result;
            if (imagePart) {
                result = await model.generateContent([prompt, imagePart]);
            } else {
                result = await model.generateContent(prompt);
            }

            const response = await result.response;
            const text = response.text();
            
            console.log(`✅ BAŞARILI! Çalışan Model: ${modelName}`);
            return text;

        } catch (error) {
            console.warn(`❌ ${modelName} başarısız oldu. Sebep: ${error.message.split('[')[0]}`);
            lastError = error;
        }
    }
    throw new Error(`Tüm modeller başarısız. Son hata: ${lastError ? lastError.message : 'Bilinmiyor'}`);
}


// --- API ROTASI ---
app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 İstek alındı.");
        
        const { 
            image, selectedCards, falTuru, intention, spreadName, spreadStructure, // Tarot ve Kahve Parametreleri
            astroData // Astroloji Parametresi {name, birthDate, birthPlace}
        } = req.body;
        
        const finalImage = image || req.body.base64Image;
        let aiResponse = "";

        // ============================================================
        // 🪐 SENARYO 1: ASTROLOJİ (DOĞUM HARİTASI) - YENİ!
        // ============================================================
        if (falTuru === 'astroloji') {
            console.log(`🪐 Mod: ASTROLOJİ`);
            
            const { name, birthDate, birthPlace } = JSON.parse(astroData);

            const astroPrompt = `
            GÖREV: Sen uzman bir Astrologsun. Aşağıdaki doğum bilgilerine göre kişinin "Natal Haritasını" (Doğum Haritası) çıkar ve yorumla.

            KİŞİ BİLGİLERİ:
            - İsim: ${name}
            - Doğum Yeri: ${birthPlace}
            - Doğum Tarihi/Saati: ${birthDate}

            İSTENEN ÇIKTI FORMATI (Lütfen bu formata sadık kal):
            Cevabın iki bölümden oluşmalı ve aralarında "---AYIRAC---" kelimesi olmalı.

            BÖLÜM 1: GEZEGEN KONUMLARI (Sadece JSON Formatında)
            Lütfen şu JSON objesini doldur (Yorum katma, sadece veri):
            {
              "sun": "Burç Adı",
              "moon": "Burç Adı",
              "ascendant": "Burç Adı (Yükselen)",
              "mercury": "Burç Adı",
              "venus": "Burç Adı",
              "mars": "Burç Adı",
              "jupiter": "Burç Adı"
            }

            ---AYIRAC---

            BÖLÜM 2: DETAYLI YORUM (Markdown Formatında)
            Aşağıdaki başlıkları kullanarak derin, mistik ve nokta atışı bir analiz yap:
            1. **Güneş Burcun (Öz Kimliğin):** Kişinin temel karakteri ve yaşam amacı.
            2. **Yükselen Burcun (Masken):** Dış dünyada nasıl algılandığı ve ilk izlenimi.
            3. **Ay Burcun (Duyguların):** İç dünyası, duygusal ihtiyaçları ve bilinçaltı.
            4. **Aşk ve İlişkiler (Venüs & Mars):** Sevgi dili, çekim gücü ve ilişki potansiyeli.
            5. **Element Dengesi:** Haritasındaki ateş, toprak, hava, su dengesi.
            6. **Gelecek Öngörüsü:** Önümüzdeki 1 ay için kısa bir astrolojik öngörü.

            ÜSLUP: Samimi, güçlendirici ve mistik bir dil kullan.
            `;

            aiResponse = await generateWithFallback(astroPrompt, null);
        }

        // ============================================================
        // 🔮 SENARYO 2: TAROT FALI
        // ============================================================
        else if (falTuru === 'tarot') {
            console.log(`🔮 Mod: TAROT (${spreadName})`);
            
            if (!selectedCards) throw new Error("Kart verisi eksik.");
            let cards;
            try { cards = JSON.parse(selectedCards); } catch (e) { cards = selectedCards; }
            
            const cardDescriptions = cards.map((c, i) => 
                `${i + 1}. Kart: ${c.name} ${c.isReversed ? '(TERS - Anlamı değişir)' : '(DÜZ)'}`
            ).join('\n');

            const tarotPrompt = `
            GÖREV: Sen bilge, mistik ve derin sezgileri olan profesyonel bir Tarot yorumcususun.
            AÇILIM TÜRÜ: ${spreadName || 'Özel Açılım'}
            SORU / NİYET: "${intention}"

            ÇEKİLEN KARTLAR:
            ${cardDescriptions}

            BU AÇILIMIN POZİSYON KURALLARI:
            ${spreadStructure || 'Kartları sırasıyla yorumla.'}

            YORUMLAMA REHBERİ:
            1. Her kartı bulunduğu pozisyonun anlamına göre yorumla.
            2. TERS (Reversed) kartların uyarıcı, geciktirici veya içsel yönlerini mutlaka belirt.
            3. Kartlar arasındaki ilişkiyi ve hikayeyi bir bütün olarak anlat.
            4. Cevabını Markdown formatında düzenle.
            5. Kullanıcıya empatik ve yol gösterici ol.
            `;

            aiResponse = await generateWithFallback(tarotPrompt, null);
        } 

        // ============================================================
        // ☕ SENARYO 3: KAHVE FALI
        // ============================================================
        else {
            console.log("☕ Mod: KAHVE FALI");

            if (!finalImage) return res.status(400).json({ success: false, error: "Resim yok." });

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