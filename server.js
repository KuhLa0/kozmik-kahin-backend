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
const MODELS_TO_TRY = ["gemini-1.5-flash", "gemini-2.5-flash", "gemini-pro"];

const GENERATION_CONFIG = {
    maxOutputTokens: 4000, 
    temperature: 0.7,      
};

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
            if (imagePart) result = await model.generateContent([prompt, imagePart]);
            else result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.warn(`❌ ${modelName} başarısız: ${error.message.split('[')[0]}`);
            lastError = error;
        }
    }
    throw new Error(`Tüm modeller başarısız. Son hata: ${lastError?.message}`);
}

app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 İstek alındı.");
        const { 
            image, selectedCards, falTuru, intention, spreadName, spreadStructure,
            astroData, astroType, userSign, userRising,
            dreamText, dreamEmotion, dreamVariant // Rüya parametreleri
        } = req.body;
        
        const finalImage = image || req.body.base64Image;
        let aiResponse = "";

        // ==========================================
        // 🌙 SENARYO 1: RÜYA TABİRİ (GÖRSEL DESTEKLİ)
        // ==========================================
        if (falTuru === 'ruya') {
            console.log(`🌙 Rüya Tabiri: ${dreamVariant}`);

            const astroContext = userSign 
                ? `KULLANICI BİLGİSİ: Bu kişi ${userSign} burcudur. Rüyadaki sembolleri bu burcun bilinçaltı özellikleriyle (Örn: Yengeç ise ev/aile, Akrep ise dönüşüm/kriz) ilişkilendirerek yorumla.` 
                : "";

            let roleDescription = "Sen kadim kaynaklara (İbn-i Sirin vb.) hakim, mistik bir rüya yorumcususun.";
            if (dreamVariant === 'psychological') roleDescription = "Sen Carl Jung ekolünü takip eden uzman bir psikanalistsin. Rüyayı bilinçaltı arketipleri üzerinden yorumla.";
            else if (dreamVariant === 'spiritual') roleDescription = "Sen modern bir spiritüel rehbersin. Rüyayı ruhsal gelişim ve enerji frekansı üzerinden yorumla.";

            const dreamPrompt = `
            GÖREV: ${roleDescription}
            RÜYA METNİ: "${dreamText}"
            HİSSİYAT: "${dreamEmotion}"
            ${astroContext}

            ÇIKTI FORMATI (Buna Kesinlikle Uy):
            
            BÖLÜM 1: JSON (Özet ve Görsel Bilgisi)
            {
              "title": "Rüyaya Kısa Mistik Bir Başlık",
              "visual_keyword": "Rüyanın atmosferini en iyi anlatan TEK BİR İNGİLİZCE kelime veya kısa öbek (Örn: 'stormy ocean', 'flying bird', 'ancient door'). Sadece görsel odaklı olsun.",
              "lucky_numbers": "3, 7, 21"
            }
            
            ---AYIRAC---
            
            BÖLÜM 2: DETAYLI YORUM (Markdown)
            1. **Ana Mesaj:** Rüyanın özü nedir?
            2. **Sembol Analizi:** Görülen kilit sembollerin anlamları.
            3. **${dreamVariant === 'psychological' ? 'Psikolojik' : 'Mistik'} Derinlik:** Seçilen bakış açısına göre detaylı analiz.
            4. **Tavsiye:** Bu rüya ışığında ne yapmalı?
            `;

            aiResponse = await generateWithFallback(dreamPrompt, null);
        }

        // ==========================================
        // 🪐 SENARYO 2: ASTROLOJİ MODÜLÜ
        // ==========================================
        else if (falTuru === 'astroloji') {
            const data = JSON.parse(astroData || '{}');
            console.log(`🪐 Astroloji: ${astroType}`);
            let astroPrompt = "";

            if (astroType === 'natal') {
                astroPrompt = `
                GÖREV: Uzman Astrolog. Doğum haritası analizi. BİLGİ: ${data.name}, ${data.birthDate}, ${data.birthPlace}.
                
                ÇIKTI FORMATI:
                BÖLÜM 1: JSON { "sun": "Burç", "moon": "Burç", "ascendant": "Burç", "mercury": "Burç", "venus": "Burç", "mars": "Burç", "jupiter": "Burç" }
                ---AYIRAC---
                BÖLÜM 2: Markdown Yorum (Güneş, Yükselen, Ay, Element Dengesi, Aşk, Kariyer, Gelecek).
                `;
            }
            else if (astroType === 'horoscope') {
                const periodText = data.period === 'weekly' ? 'Bu Hafta' : 'Bugün';
                astroPrompt = `
                GÖREV: ${data.sign} burcu için ${periodText} Astrolojik Yorumu.
                ÇIKTI FORMATI:
                BÖLÜM 1: JSON { "motto": "Günün kısa motivasyon cümlesi" }
                ---AYIRAC---
                BÖLÜM 2: Markdown Yorum (Gezegen transitleri, Aşk, Kariyer, Sağlık).
                `;
            }
            else if (astroType === 'compatibility') {
                astroPrompt = `Aşk Uyumu Analizi: ${data.name1} (${data.sign1}) ve ${data.name2} (${data.sign2}). Element, nitelik ve gezegen uyumunu analiz et.`;
            }
            else if (astroType === 'calendar') {
                 astroPrompt = `GÖREV: Astroloji Takvimi. Önümüzdeki 30 günün Ay Fazları ve Retroları.
                 ÇIKTI FORMATI: BÖLÜM 1: JSON { "events": [{ "date": "DD.MM", "title": "Olay", "type": "retro" }] } ---AYIRAC--- BÖLÜM 2: Genel Yorum.`;
            }
            aiResponse = await generateWithFallback(astroPrompt, null);
        }

        // ==========================================
        // 🔮 SENARYO 3: TAROT FALI
        // ==========================================
        else if (falTuru === 'tarot') {
            const context = userSign ? `KULLANICI: ${userSign} burcu. Kartları bu burcun özellikleriyle harmanla.` : "";
            const cards = JSON.parse(selectedCards);
            const cardDesc = cards.map((c, i) => `${i+1}. ${c.name} ${c.isReversed?'(TERS)':''}`).join('\n');
            
            const prompt = `GÖREV: Tarot Yorumcusu. AÇILIM: ${spreadName}. NİYET: "${intention}". KARTLAR: ${cardDesc}. KURALLAR: ${spreadStructure}. ${context} Detaylı yorumla.`;
            aiResponse = await generateWithFallback(prompt, null);
        } 

        // ==========================================
        // ☕ SENARYO 4: KAHVE FALI
        // ==========================================
        else {
            if (!finalImage) return res.status(400).json({ error: "Resim yok." });
            const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");
            const context = userSign ? `KULLANICI: ${userSign} burcu. Falın sonunda burçla ilgili bir doğrulama cümlesi ekle.` : "";
            
            const prompt = `GÖREV: Kahve Falı. NİYET: "${intention || 'Genel'}". ${context} Şekilleri yorumla, mistik konuş.`;
            aiResponse = await generateWithFallback(prompt, { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } });
        }

        res.json({ success: true, response: aiResponse });

    } catch (error) {
        console.error("💥 HATA:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`🚀 Sunucu ${PORT} portunda hazır.`); });