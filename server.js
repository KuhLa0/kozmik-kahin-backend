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
    console.error("❌ HATA: GEMINI_API_KEY bulunamadı!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- MODEL LİSTESİ (SADECE STABİL VE YÜKSEK KOTALI OLANLAR) ---
// Deneysel modelleri kaldırdık, 429 hatasını önlemek için en güvenliler kaldı.
const MODELS_TO_TRY = [
    "gemini-1.5-flash",  // En hızlı ve yüksek kotalı
    "gemini-1.5-pro"     // Daha zeki yedek
];

// --- MODEL AYARLARI ---
const GENERATION_CONFIG = {
    maxOutputTokens: 4000, // Detaylı analizler için uzunluk limiti
    temperature: 0.7,      // Yaratıcılık dengesi
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
                ? `KULLANICI: ${userSign} burcu. El çizgilerini yorumlarken bu burcun karakteristik özelliklerini (Örn: Toprak grubuysa pratik eller) dikkate al.` 
                : "";

            const palmPrompt = `
            GÖREV: Profesyonel El Falı Uzmanı (Chiromancy).
            GÖRÜNTÜ: Kullanıcının avuç içi fotoğrafı.
            
            TALİMATLAR:
            Fotoğraftaki ana hatları tespit et ve detaylıca yorumla:
            1. **Hayat Çizgisi:** Canlılık, sağlık ve yaşam enerjisi.
            2. **Akıl Çizgisi:** Zeka, düşünce yapısı ve mantık.
            3. **Kalp Çizgisi:** Duygular, aşk hayatı ve ilişkiler.
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
              "visual_keyword": "Rüyayı anlatan TEK İNGİLİZCE kelime veya kısa öbek (Örn: 'stormy ocean', 'flying bird'). Sadece görsel odaklı olsun.",
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
                astroPrompt = `
                GÖREV: Uzman Astrolog. Doğum haritası analizi.
                BİLGİ: ${data.name}, ${data.birthDate}, ${data.birthPlace}.
                ÖNEMLİ: Yükselen burcu saate göre hesapla.
                
                ÇIKTI: 
                BÖLÜM 1: JSON (Sadece veri, Türkçe burç isimleri)
                { "Sun": "Burç", "Moon": "Burç", "Ascendant": "Burç", "Mercury": "Burç", "Venus": "Burç", "Mars": "Burç", "Jupiter": "Burç", "Saturn": "Burç" }
                ---AYIRAC---
                BÖLÜM 2: Markdown Yorum (Güneş, Yükselen, Ay, Element Dengesi, Aşk, Kariyer, Gelecek).
                `;
            }
            else if (astroType === 'horoscope') {
                const periodText = data.period === 'weekly' ? 'Bu Hafta' : data.period === 'monthly' ? 'Bu Ay' : 'Bugün';
                astroPrompt = `
                GÖREV: ${data.sign} burcu için ${periodText} Astrolojik Yorumu.
                TARİH: Bugün.
                ÇIKTI: 
                BÖLÜM 1: JSON { "motto": "Kısa motivasyon cümlesi" }
                ---AYIRAC---
                BÖLÜM 2: Markdown Yorum (Gökyüzü Gündemi, Aşk, Kariyer, Sağlık).
                `;
            }
            else if (astroType === 'compatibility') {
                astroPrompt = `
                GÖREV: Aşk Uyumu (Sinastri). Kişi 1: ${data.name1} (${data.sign1}), Kişi 2: ${data.name2} (${data.sign2}).
                ANALİZ: Element uyumu, Ruhsal bağ, Çekim gücü, Zorluklar, Sonuç.
                `;
            }
            else if (astroType === 'calendar') {
                 astroPrompt = `
                 GÖREV: Astroloji Takvimi. Önümüzdeki 30 günün Ay Fazları ve Retroları.
                 ÇIKTI: 
                 BÖLÜM 1: JSON { "events": [{ "date": "DD.MM", "title": "Olay", "type": "retro" }] } 
                 ---AYIRAC--- 
                 BÖLÜM 2: Genel Yorum.
                 `;
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
            
            const prompt = `
            GÖREV: Tarot Yorumcusu. AÇILIM: ${spreadName}. NİYET: "${intention}".
            KARTLAR: ${cardDesc}.
            KURALLAR: ${spreadStructure}.
            ${context}
            YORUM: Mistik, derin, detaylı ve astrolojik referanslı bir yorum yap. Markdown kullan.
            `;
            aiResponse = await generateWithFallback(prompt, null);
        } 

        // ==========================================
        // ☕ SENARYO 5: KAHVE FALI
        // ==========================================
        else {
            if (!finalImage) return res.status(400).json({ error: "Resim yok." });
            const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");
            
            const context = userSign ? `KULLANICI: ${userSign} burcu. Falın sonuna burçla ilgili bir doğrulama cümlesi ekle.` : "";
            
            const prompt = `
            GÖREV: Kahve Falı. NİYET: "${intention || 'Genel'}".
            ${context}
            TALİMAT: Şekilleri yorumla, mistik konuş. Aşk, Kariyer, Sağlık olarak ayır.
            `;
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