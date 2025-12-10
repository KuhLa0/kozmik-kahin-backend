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
const MODELS_TO_TRY = ["gemini-1.5-flash", "gemini-2.5-flash", "gemini-pro"];

// --- MODEL AYARLARI (HIZ İÇİN) ---
// Astrolojik hesaplamalar uzun sürebileceği için hız ayarı ekledik.
const GENERATION_CONFIG = {
    maxOutputTokens: 2000, // Çıktı uzunluğunu yeterli ama sınırlı tutar
    temperature: 0.7,      // Tutarlı ve yaratıcı arasında denge
};


// --- MODEL ÇALIŞTIRMA FONKSİYONU (Fallback Logic) ---
async function generateWithFallback(prompt, imagePart = null) {
    let lastError = null;
    for (const modelName of MODELS_TO_TRY) {
        try {
            console.log(`🔄 Deneniyor: ${modelName}...`);
            
            // Hız ayarları (GENERATION_CONFIG) burada modele veriliyor!
            const model = genAI.getGenerativeModel({ 
                model: modelName,
                generationConfig: GENERATION_CONFIG
            });
            
            let result;
            if (imagePart) result = await model.generateContent([prompt, imagePart]);
            else result = await model.generateContent(prompt);
            
            const response = await result.response;
            return response.text();
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
            image, selectedCards, falTuru, intention, spreadName, spreadStructure,
            astroData, astroType, userSign, userRising 
        } = req.body;
        
        const finalImage = image || req.body.base64Image;
        let aiResponse = "";

        // ==========================================
        // 🪐 SENARYO 1: ASTROLOJİ MODÜLÜ (Gelişmiş)
        // ==========================================
        if (falTuru === 'astroloji') {
            const data = JSON.parse(astroData || '{}');
            console.log(`🪐 Astroloji: ${astroType}`);

            let astroPrompt = "";

            // 1. DOĞUM HARİTASI (Natal Chart)
            if (astroType === 'natal') {
                astroPrompt = `
                GÖREV: Uzman Astrolog. Doğum haritası analizi.
                BİLGİ: Kişi Adı: ${data.name}, Doğum Tarihi/Saati: ${data.birthDate}, Doğum Yeri: ${data.birthPlace}
                
                ÇIKTI FORMATI:
                BÖLÜM 1: JSON (Sadece gezegen konumları)
                { "sun": "Burç", "moon": "Burç", "ascendant": "Burç (Yükselen)", "mercury": "Burç", "venus": "Burç", "mars": "Burç", "jupiter": "Burç" }
                ---AYIRAC---
                BÖLÜM 2: DETAYLI YORUM (Markdown)
                1. **Güneş (Öz Kimlik):** Karakter ve Yaşam Amacı.
                2. **Yükselen (Maske):** Dış görünüş ve Yaşam Alanı. (Saati ve yeri dikkate alarak hesapla).
                3. **Ay (Duygular):** İç dünya ve duygusal tepkiler.
                4. **Aşk ve Kariyer:** Venüs ve Mars'ın etkileşimi.
                5. **Element Dengesi:** Haritadaki Ateş, Su, Hava, Toprak dağılımı.
                6. **Gelecek:** Önümüzdeki 1 ay için önemli transit etkileri.
                `;
            }
            // 2. GÜNLÜK/HAFTALIK/AYLIK BURÇ YORUMU (Horoscope)
            else if (astroType === 'horoscope') {
                const periodText = data.period === 'weekly' ? 'Bu Hafta' : data.period === 'monthly' ? 'Bu Ay' : 'Bugün';
                astroPrompt = `
                GÖREV: ${data.sign} burcu için ${periodText} Astrolojik Yorumu.
                
                DİKKAT EDİLMESİ GEREKENLER:
                1. Şu anki gökyüzü konumlarını (Ay fazı, Merkür Retrosu, Güneş tutulması, önemli açılar) mutlaka yoruma dahil et.
                2. Bu transitlerin ${data.sign} burcuna özel etkisini anlat.
                3. Aşk, Kariyer ve Sağlık başlıkları altında toparla.
                4. Şanslı gün/sayı ver.
                `;
            }
            // 3. AŞK UYUMU (Compatibility / Sinastri)
            else if (astroType === 'compatibility') {
                astroPrompt = `
                GÖREV: İki burç arasındaki Aşk Uyumu (Sinastri) Analizi.
                Kişi 1: ${data.name1} (${data.sign1})
                Kişi 2: ${data.name2} (${data.sign2})
                
                ANALİZ:
                1. Element ve Nitelik uyumu.
                2. İlişkinin dinamiği (Tutku, Huzur, Zorluk).
                3. Olası kriz noktaları ve nasıl aşılacağı.
                4. Uzun vadeli gelecek potansiyeli (% Puan ver).
                `;
            }
            // 4. ASTRO TAKVİM (Calendar)
            else if (astroType === 'calendar') {
                 // Frontend'den gelen hazır prompt'u kullanıyoruz (içinde JSON formatı var)
                 astroPrompt = `
                 GÖREV: Astroloji Takvimi Hazırlayıcısı. Önümüzdeki 4 hafta için en önemli Ay Fazlarını, Retroları ve Gezegen Geçişlerini listele.
                 
                 ÇIKTI FORMATI:
                 BÖLÜM 1: JSON (Örnekteki gibi event listesi)
                 ---AYIRAC---
                 BÖLÜM 2: Bu dönem için genel yorum (Markdown)
                 `;
            }

            aiResponse = await generateWithFallback(astroPrompt, null);
        }

        // ==========================================
        // 🔮 SENARYO 2: TAROT (Entegreli)
        // ==========================================
        else if (falTuru === 'tarot') {
            // Astro Entegrasyon Metni (userSign, userRising kullanılarak)
            const context = userSign ? `KULLANICI BİLGİSİ: Bu kişi ${userSign} burcudur${userRising ? ` ve Yükseleni ${userRising}` : ''}. Yorumda kartları bu burcun özellikleri, element dengesi ve bugünkü gökyüzü enerjisiyle bağdaştır.` : "";
            
            const cards = JSON.parse(selectedCards);
            const cardDesc = cards.map((c, i) => `${i+1}. ${c.name} ${c.isReversed?'(TERS)':''}`).join('\n');
            
            const prompt = `
            GÖREV: Profesyonel Tarot Yorumcusu. AÇILIM: ${spreadName}. NİYET: "${intention}".
            KARTLAR: ${cardDesc}. KURALLAR: ${spreadStructure}.
            ${context}
            YORUM: Mistik, astrolojik referanslı ve detaylı yorumla.
            `;
            aiResponse = await generateWithFallback(prompt, null);
        }

        // ==========================================
        // ☕ SENARYO 3: KAHVE (Entegreli)
        // ==========================================
        else {
            if (!finalImage) return res.status(400).json({ error: "Resim yok." });
            const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");
            
            // Astro Entegrasyon Metni (userSign kullanılarak)
            const context = userSign ? `KULLANICI: ${userSign} burcu. Fal yorumunun sonunda "Bu fal, ${userSign} burcundaki Mars transitiyle de uyumlu..." gibi bir doğrulama cümlesi ekleyerek yorumu pekiştir.` : "";
            
            const prompt = `
            GÖREV: Kahve Falı. NİYET: "${intention || 'Genel'}".
            ${context}
            TALİMAT: Şekilleri yorumla, mistik konuş.
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
app.listen(PORT, () => { console.log(`🚀 Sunucu ${PORT} portunda hazır.`); });