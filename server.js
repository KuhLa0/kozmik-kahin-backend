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

// --- DÜZELTME: SADECE KESİN ÇALIŞAN KARARLI MODELLER ---
// '-latest' eklerini kaldırdık, çünkü API bazen bunları bulamıyor.
const MODELS_TO_TRY = [
    "gemini-1.5-flash",  // En hızlı ve güvenilir
    "gemini-1.5-pro",    // Daha zeki (Yedek)
    "gemini-2.0-flash-exp" // Google'ın yeni deneysel modeli (Varsa çalışır)
];

// --- MODEL AYARLARI ---
const GENERATION_CONFIG = {
    maxOutputTokens: 3000, 
    temperature: 0.7,      
};

// --- MODEL ÇALIŞTIRMA FONKSİYONU ---
async function generateWithFallback(prompt, imagePart = null) {
    let lastError = null;
    
    for (const modelName of MODELS_TO_TRY) {
        try {
            console.log(`🔄 Deneniyor: ${modelName}...`);
            
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
            // Hatayı temizleyip logluyoruz
            const msg = error.message ? error.message.split('[')[0] : "Bilinmiyor";
            console.warn(`❌ ${modelName} başarısız: ${msg}`);
            lastError = error;
            // Döngü kırılmaz, bir sonraki modele geçer...
        }
    }
    
    // Hepsi başarısız olursa
    throw new Error(`Sunucu Hatası: Hiçbir model yanıt vermedi. (Son hata: ${lastError?.message})`);
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
                ? `KULLANICI: ${userSign} burcu. El çizgilerini yorumlarken bu burcun karakteristik özelliklerini dikkate al.` 
                : "";

            const palmPrompt = `
            GÖREV: Profesyonel El Falı Uzmanı (Chiromancy).
            GÖRÜNTÜ: Kullanıcının avuç içi fotoğrafı.
            
            TALİMATLAR:
            Fotoğraftaki ana hatları tespit et ve yorumla:
            1. **Hayat Çizgisi:** Canlılık, sağlık.
            2. **Akıl Çizgisi:** Zeka, düşünce yapısı.
            3. **Kalp Çizgisi:** Duygular ve aşk hayatı.
            4. **Kader Çizgisi:** Kariyer ve yaşam yolu (Görünüyorsa).
            
            ${astroContext}
            
            ÇIKTI FORMATI (Markdown):
            - Başlıklar ve maddeler kullan.
            - Mistik ve etkileyici bir dil kullan.
            `;

            aiResponse = await generateWithFallback(palmPrompt, imagePart);
        }

        // ==========================================
        // 🌙 SENARYO 2: RÜYA TABİRİ
        // ==========================================
        else if (falTuru === 'ruya') {
            console.log(`🌙 Rüya Tabiri: ${dreamVariant}`);

            const astroContext = userSign 
                ? `KULLANICI BİLGİSİ: Bu kişi ${userSign} burcudur. Rüyadaki sembolleri bu burcun bilinçaltı özellikleriyle ilişkilendir.` 
                : "";

            let roleDescription = "Sen kadim kaynaklara hakim, mistik bir rüya yorumcususun.";
            if (dreamVariant === 'psychological') roleDescription = "Sen Carl Jung ekolünü takip eden uzman bir psikanalistsin.";
            else if (dreamVariant === 'spiritual') roleDescription = "Sen modern bir spiritüel rehbersin.";

            const dreamPrompt = `
            GÖREV: ${roleDescription}
            RÜYA METNİ: "${dreamText}"
            HİSSİYAT: "${dreamEmotion}"
            ${astroContext}

            ÇIKTI FORMATI (Buna Kesinlikle Uy):
            BÖLÜM 1: JSON
            {
              "title": "Rüyaya Kısa Mistik Başlık",
              "visual_keyword": "Rüyayı anlatan TEK İNGİLİZCE kelime (Örn: 'stormy ocean').",
              "lucky_numbers": "3, 7, 21"
            }
            ---AYIRAC---
            BÖLÜM 2: DETAYLI YORUM (Markdown)
            1. **Ana Mesaj:** Özet.
            2. **Sembol Analizi:** Detaylar.
            3. **${dreamVariant === 'psychological' ? 'Psikolojik' : 'Mistik'} Derinlik.**
            4. **Tavsiye.**
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
                astroPrompt = `GÖREV: Uzman Astrolog. Doğum haritası analizi. BİLGİ: ${data.name}, ${data.birthDate}, ${data.birthPlace}. ÇIKTI: BÖLÜM 1: JSON { "sun": "Burç", "moon": "Burç", "ascendant": "Burç", "mercury": "Burç", "venus": "Burç", "mars": "Burç", "jupiter": "Burç", "saturn": "Burç" } ---AYIRAC--- BÖLÜM 2: Markdown Yorum.`;
            }
            else if (astroType === 'horoscope') {
                astroPrompt = `GÖREV: ${data.sign} burcu için ${data.period} yorumu. ÇIKTI: BÖLÜM 1: JSON { "motto": "..." } ---AYIRAC--- BÖLÜM 2: Markdown Yorum.`;
            }
            else if (astroType === 'compatibility') {
                astroPrompt = `Aşk Uyumu: ${data.name1} (${data.sign1}) ve ${data.name2} (${data.sign2}). Element ve nitelik uyumu.`;
            }
            else if (astroType === 'calendar') {
                 astroPrompt = `GÖREV: Astroloji Takvimi. ÇIKTI: BÖLÜM 1: JSON { "events": [...] } ---AYIRAC--- BÖLÜM 2: Yorum.`;
            }
            aiResponse = await generateWithFallback(astroPrompt, null);
        }

        // ==========================================
        // 🔮 SENARYO 4: TAROT
        // ==========================================
        else if (falTuru === 'tarot') {
            const context = userSign ? `KULLANICI: ${userSign} burcu. Kartları bu burcun özellikleriyle harmanla.` : "";
            const cards = JSON.parse(selectedCards);
            const cardDesc = cards.map((c, i) => `${i+1}. ${c.name} ${c.isReversed?'(TERS)':''}`).join('\n');
            const prompt = `GÖREV: Tarot Yorumcusu. AÇILIM: ${spreadName}. NİYET: "${intention}". KARTLAR: ${cardDesc}. KURALLAR: ${spreadStructure}. ${context} Detaylı yorumla.`;
            aiResponse = await generateWithFallback(prompt, null);
        } 

        // ==========================================
        // ☕ SENARYO 5: KAHVE FALI
        // ==========================================
        else {
            if (!finalImage) return res.status(400).json({ error: "Resim yok." });
            const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");
            const context = userSign ? `KULLANICI: ${userSign} burcu. Falın sonunda burçla ilgili doğrulama yap.` : "";
            const prompt = `GÖREV: Kahve Falı. NİYET: "${intention || 'Genel'}". ${context} Şekilleri yorumla, mistik konuş.`;
            aiResponse = await generateWithFallback(prompt, { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } });
        }

        res.json({ success: true, response: aiResponse });

    } catch (error) {
        console.error("💥 KRİTİK HATA:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
// Sunucu zaman aşımı süresi (5 dakika)
const server = app.listen(PORT, () => { console.log(`🚀 Sunucu ${PORT} portunda hazır.`); });
server.setTimeout(300000);