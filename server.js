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
    console.error("❌ HATA: GEMINI_API_KEY bulunamadı!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- GENİŞLETİLMİŞ MODEL LİSTESİ ---
// Sunucu sırayla bunları deneyecek.
const MODELS_TO_TRY = [
    "gemini-1.5-flash",          // En güncel ve hızlı
    "gemini-1.5-flash-latest",   // Alternatif isim
    "gemini-2.5-flash",          // Senin isteğin (Varsa dener)
    "gemini-1.5-pro",            // Pro sürüm
    "gemini-1.5-pro-latest",
    "gemini-pro",                // Eski kararlı sürüm
    "gemini-pro-vision"          // Eski görsel model
];

// --- MODEL AYARLARI ---
const GENERATION_CONFIG = {
    maxOutputTokens: 4000, 
    temperature: 0.7,      
};

// --- MODEL ÇALIŞTIRMA FONKSİYONU ---
async function generateWithFallback(prompt, imagePart = null) {
    let lastError = null;
    
    for (const modelName of MODELS_TO_TRY) {
        try {
            console.log(`🔄 Deneniyor: ${modelName}...`);
            
            // Model oluşturma
            const model = genAI.getGenerativeModel({ 
                model: modelName,
                generationConfig: GENERATION_CONFIG
            });
            
            let result;
            if (imagePart) {
                // Görsel varsa
                result = await model.generateContent([prompt, imagePart]);
            } else {
                // Sadece metin ise
                result = await model.generateContent(prompt);
            }
            
            const response = await result.response;
            const text = response.text();
            
            if (!text) throw new Error("Boş cevap döndü.");

            console.log(`✅ BAŞARILI! Çalışan Model: ${modelName}`);
            return text;

        } catch (error) {
            console.warn(`❌ ${modelName} başarısız: ${error.message.split('[')[0]}`);
            lastError = error;
            // Döngü kırılmaz, bir sonraki modele geçer...
        }
    }
    
    // Hepsi başarısız olursa
    throw new Error(`Sunucu Hatası: Hiçbir model yanıt vermedi. Son hata: ${lastError?.message}`);
}


// --- API ROTASI ---
app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 İstek alındı.");
        
        const { 
            image, selectedCards, falTuru, intention, spreadName, spreadStructure,
            astroData, astroType, userSign, userRising,
            dreamText, dreamEmotion, dreamVariant 
        } = req.body;
        
        const finalImage = image || req.body.base64Image;
        let aiResponse = "";

        // ==========================================
        // ✋ SENARYO 1: EL FALI
        // ==========================================
        if (falTuru === 'el-fali') {
            console.log("✋ Mod: EL FALI");
            if (!finalImage) return res.status(400).json({ error: "Resim yok." });
            
            const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");
            const imagePart = { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } };

            const astroContext = userSign 
                ? `KULLANICI: ${userSign} burcu. El çizgilerini yorumlarken bu burcun özelliklerini dikkate al.` 
                : "";

            const palmPrompt = `
            GÖREV: Profesyonel El Falı Uzmanı (Chiromancy).
            GÖRÜNTÜ: Kullanıcının avuç içi fotoğrafı.
            TALİMATLAR: Hayat, Akıl, Kalp ve Kader çizgilerini yorumla.
            ${astroContext}
            ÇIKTI FORMATI: Markdown kullan, mistik bir dil kullan.
            `;

            aiResponse = await generateWithFallback(palmPrompt, imagePart);
        }

        // ==========================================
        // 🌙 SENARYO 2: RÜYA TABİRİ
        // ==========================================
        else if (falTuru === 'ruya') {
            console.log(`🌙 Rüya Tabiri: ${dreamVariant}`);
            const astroContext = userSign ? `KULLANICI: ${userSign} burcu.` : "";
            
            const dreamPrompt = `
            GÖREV: Rüya Tabiri Uzmanı. Varyant: ${dreamVariant}.
            RÜYA: "${dreamText}" - HİS: "${dreamEmotion}".
            ${astroContext}
            ÇIKTI: BÖLÜM 1: JSON { "title": "Başlık", "visual_keyword": "ingilizce_kelime", "lucky_numbers": "1,2,3" } ---AYIRAC--- BÖLÜM 2: Detaylı Yorum.
            `;

            aiResponse = await generateWithFallback(dreamPrompt, null);
        }

        // ==========================================
        // 🪐 SENARYO 3: ASTROLOJİ
        // ==========================================
        else if (falTuru === 'astroloji') {
            const data = JSON.parse(astroData || '{}');
            console.log(`🪐 Astroloji: ${astroType}`);
            let astroPrompt = "";

            if (astroType === 'natal') {
                astroPrompt = `GÖREV: Astrolog. BİLGİ: ${data.name}, ${data.birthDate}, ${data.birthPlace}. ÇIKTI: BÖLÜM 1: JSON { "sun": "Burç", "ascendant": "Burç", ... } ---AYIRAC--- BÖLÜM 2: Yorum.`;
            } else if (astroType === 'horoscope') {
                astroPrompt = `GÖREV: ${data.sign} burcu yorumu. ÇIKTI: BÖLÜM 1: JSON { "motto": "..." } ---AYIRAC--- BÖLÜM 2: Yorum.`;
            } else if (astroType === 'compatibility') {
                astroPrompt = `Aşk Uyumu: ${data.name1} ve ${data.name2}. Detaylı analiz.`;
            } else if (astroType === 'calendar') {
                 astroPrompt = `GÖREV: Astroloji Takvimi. ÇIKTI: BÖLÜM 1: JSON { "events": [...] } ---AYIRAC--- BÖLÜM 2: Yorum.`;
            }
            aiResponse = await generateWithFallback(astroPrompt, null);
        }

        // ==========================================
        // 🔮 SENARYO 4: TAROT
        // ==========================================
        else if (falTuru === 'tarot') {
            const context = userSign ? `KULLANICI: ${userSign} burcu.` : "";
            const cards = JSON.parse(selectedCards);
            const cardDesc = cards.map((c, i) => `${i+1}. ${c.name} ${c.isReversed?'(TERS)':''}`).join('\n');
            const prompt = `GÖREV: Tarot. AÇILIM: ${spreadName}. NİYET: "${intention}". KARTLAR: ${cardDesc}. KURALLAR: ${spreadStructure}. ${context} Detaylı yorum.`;
            aiResponse = await generateWithFallback(prompt, null);
        } 

        // ==========================================
        // ☕ SENARYO 5: KAHVE FALI
        // ==========================================
        else {
            if (!finalImage) return res.status(400).json({ error: "Resim yok." });
            const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");
            const context = userSign ? `KULLANICI: ${userSign} burcu.` : "";
            const prompt = `GÖREV: Kahve Falı. NİYET: "${intention || 'Genel'}". ${context} Şekilleri yorumla.`;
            aiResponse = await generateWithFallback(prompt, { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } });
        }

        res.json({ success: true, response: aiResponse });

    } catch (error) {
        console.error("💥 KRİTİK HATA:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => { console.log(`🚀 Sunucu ${PORT} portunda hazır.`); });
server.setTimeout(300000);