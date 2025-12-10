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

// Hız ve Kalite Dengesi
const GENERATION_CONFIG = {
    maxOutputTokens: 3000, 
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
            console.warn(`❌ ${modelName} başarısız oldu: ${error.message.split('[')[0]}`);
            lastError = error;
        }
    }
    throw new Error(`Tüm modeller başarısız. Son hata: ${lastError?.message}`);
}

app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 İstek alındı.");
        const { image, selectedCards, falTuru, intention, spreadName, spreadStructure, astroData, astroType, userSign, userRising } = req.body;
        const finalImage = image || req.body.base64Image;
        let aiResponse = "";

        // ==========================================
        // 🪐 SENARYO 1: ASTROLOJİ MODÜLÜ
        // ==========================================
        if (falTuru === 'astroloji') {
            const data = JSON.parse(astroData || '{}');
            console.log(`🪐 Astroloji: ${astroType}`);
            let astroPrompt = "";

            // 1. DOĞUM HARİTASI (Görsel İçin Optimize Edildi)
            if (astroType === 'natal') {
                astroPrompt = `
                GÖREV: Uzman Astrolog. Doğum haritası analizi.
                BİLGİ: ${data.name}, ${data.birthDate}, ${data.birthPlace}.
                
                ÖNEMLİ: Yükselen burcu doğum saatine göre hassas hesapla.

                ÇIKTI FORMATI:
                BÖLÜM 1: JSON (Gezegenlerin Hangi Burçta Olduğu)
                Lütfen burç isimlerini Türkçe olarak (Koç, Boğa, İkizler, Yengeç, Aslan, Başak, Terazi, Akrep, Yay, Oğlak, Kova, Balık) yaz.
                { 
                  "Sun": "Burç Adı", 
                  "Moon": "Burç Adı", 
                  "Ascendant": "Burç Adı", 
                  "Mercury": "Burç Adı", 
                  "Venus": "Burç Adı", 
                  "Mars": "Burç Adı", 
                  "Jupiter": "Burç Adı",
                  "Saturn": "Burç Adı",
                  "Uranus": "Burç Adı",
                  "Neptune": "Burç Adı",
                  "Pluto": "Burç Adı"
                }
                ---AYIRAC---
                BÖLÜM 2: DETAYLI YORUM (Markdown)
                1. **Güneş (Öz):** Karakterin.
                2. **Yükselen (Maske):** Dış dünya.
                3. **Ay (Duygu):** İç dünya.
                4. **Aşk & Tutku:** Venüs ve Mars.
                5. **Karmik Yol:** Satürn ve Jüpiter.
                6. **Gelecek:** 1 Aylık öngörü.
                `;
            }
            // 2. GÜNLÜK YORUM (Bildirim İçin Motto Eklendi)
            else if (astroType === 'horoscope') {
                const periodText = data.period === 'weekly' ? 'Bu Hafta' : 'Bugün';
                astroPrompt = `
                GÖREV: ${data.sign} burcu için ${periodText} Astrolojik Yorumu.
                TARİH: Bugün.
                
                ÇIKTI FORMATI:
                BÖLÜM 1: JSON (Bildirim İçin)
                { "motto": "Bugün için kısa, vurucu, 10 kelimelik bir motivasyon cümlesi." }
                ---AYIRAC---
                BÖLÜM 2: DETAYLI YORUM (Markdown)
                1. **Gökyüzü Gündemi:** Ay fazı ve Retroların etkisi.
                2. **Aşk & İlişkiler:** Detaylı analiz.
                3. **Kariyer & Para:** Fırsatlar.
                4. **Şanslı Sayı & Renk.**
                `;
            }
            // 3. TAKVİM (Format Hatasını Önlemek İçin Sıkılaştırıldı)
            else if (astroType === 'calendar') {
                 astroPrompt = `
                 GÖREV: Önümüzdeki 30 günün Astroloji Takvimini çıkar.
                 
                 ÇIKTI FORMATI (SADECE BU JSON FORMATINA UY):
                 BÖLÜM 1: JSON
                 {
                   "events": [
                     { "date": "DD.MM", "title": "Olay Başlığı (Örn: Merkür Retrosu Başlıyor)", "type": "retro" },
                     { "date": "DD.MM", "title": "Olay Başlığı (Örn: Boğa Burcunda Yeni Ay)", "type": "moon" },
                     { "date": "DD.MM", "title": "Olay Başlığı (Örn: Venüs Terazi'ye Geçiyor)", "type": "planet" }
                   ]
                 }
                 ---AYIRAC---
                 BÖLÜM 2: GENEL ATMOSFER (Markdown)
                 Bu ayın genel enerjisini anlatan mistik bir yazı.
                 `;
            }
            // 4. UYUM (Aynı)
            else if (astroType === 'compatibility') {
                astroPrompt = `Aşk Uyumu Analizi: ${data.name1} (${data.sign1}) ve ${data.name2} (${data.sign2}). Element, nitelik ve gezegen uyumunu analiz et. Uzun vadeli puan ver.`;
            }

            aiResponse = await generateWithFallback(astroPrompt, null);
        }

        // ==========================================
        // 🔮 TAROT & ☕ KAHVE (Mevcut Entegrasyon)
        // ==========================================
        else if (falTuru === 'tarot') {
            const context = userSign ? `KULLANICI: ${userSign} burcu. Kartları bu burcun özellikleriyle ve bugünkü gökyüzü enerjisiyle harmanla.` : "";
            const cards = JSON.parse(selectedCards);
            const cardDesc = cards.map((c, i) => `${i+1}. ${c.name} ${c.isReversed?'(TERS)':''}`).join('\n');
            const prompt = `TAROT YORUMU. AÇILIM: ${spreadName}. NİYET: "${intention}". KARTLAR: ${cardDesc}. KURALLAR: ${spreadStructure}. ${context} Detaylı ve mistik yorumla.`;
            aiResponse = await generateWithFallback(prompt, null);
        } 
        else {
            if (!finalImage) return res.status(400).json({ error: "Resim yok." });
            const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");
            const context = userSign ? `KULLANICI: ${userSign} burcu. Fincandaki sembolleri kullanıcının burcunun element özellikleriyle ilişkilendir.` : "";
            const prompt = `KAHVE FALI. NİYET: "${intention}". ${context} Şekilleri yorumla, mistik konuş.`;
            aiResponse = await generateWithFallback(prompt, { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } });
        }

        res.json({ success: true, response: aiResponse });

    } catch (error) {
        console.error("💥 HATA:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`🚀 Sunucu ${PORT} portunda.`); });