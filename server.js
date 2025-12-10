const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");
require("dotenv").config();

const app = express();

// 1. Veri Limiti Ayarları (Resimler ve uzun metinler için yüksek tutuyoruz)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// 2. API Anahtarı Kontrolü
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ HATA: GEMINI_API_KEY bulunamadı!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Kullanılacak Modeller (Öncelik sırasına göre)
const MODELS_TO_TRY = ["gemini-1.5-flash", "gemini-2.5-flash", "gemini-pro"];

// --- MODEL AYARLARI (KALİTE VE UZUNLUK İÇİN) ---
const GENERATION_CONFIG = {
    maxOutputTokens: 4000, // Detaylı astroloji analizleri için limiti artırdık
    temperature: 0.7,      // Yaratıcı ama tutarlı
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
            if (imagePart) result = await model.generateContent([prompt, imagePart]);
            else result = await model.generateContent(prompt);
            
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.warn(`❌ ${modelName} başarısız oldu: ${error.message.split('[')[0]}`);
            lastError = error;
        }
    }
    throw new Error(`Tüm modeller başarısız. Son hata: ${lastError?.message}`);
}

// --- API ROTASI ---
app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 Fal isteği alındı.");
        
        const { 
            image, selectedCards, falTuru, intention, spreadName, spreadStructure,
            astroData, astroType, userSign, userRising 
        } = req.body;
        
        const finalImage = image || req.body.base64Image;
        let aiResponse = "";

        // ============================================================
        // 🪐 SENARYO 1: ASTROLOJİ MODÜLÜ (TAM KAPSAMLI)
        // ============================================================
        if (falTuru === 'astroloji') {
            const data = JSON.parse(astroData || '{}');
            console.log(`🪐 Astroloji Modu: ${astroType}`);

            let astroPrompt = "";

            // --- 1. DOĞUM HARİTASI (Natal Chart & Yükselen Hesaplama) ---
            if (astroType === 'natal') {
                astroPrompt = `
                GÖREV: Sen Dünya çapında ünlü, derinlemesine analiz yapan bir Astrologsun.
                BİLGİLER:
                - İsim: ${data.name}
                - Doğum Tarihi/Saati: ${data.birthDate} (Saati kullanarak Yükselen Burcu HESAPLA)
                - Doğum Yeri: ${data.birthPlace}

                İSTENEN ÇIKTI FORMATI (Buna sadık kal):
                
                BÖLÜM 1: GEZEGEN KONUMLARI (Sadece JSON)
                {
                  "sun": "Burç Adı",
                  "moon": "Burç Adı",
                  "ascendant": "Burç Adı (Yükselen)",
                  "mercury": "Burç Adı",
                  "venus": "Burç Adı",
                  "mars": "Burç Adı",
                  "jupiter": "Burç Adı",
                  "saturn": "Burç Adı"
                }
                
                ---AYIRAC---
                
                BÖLÜM 2: DETAYLI YORUM (Markdown)
                Kişiye özel, nokta atışı ve detaylı bir analiz yaz.
                
                1. **Güneş Burcun (Öz Kimliğin):** "Sen bir [Burç]sun..." diyerek başlama. Karakterinin derinliklerine in.
                2. **Yükselen Burcun (Dış Dünyaya Masken):** Hesapladığın yükselene göre, insanların seni nasıl gördüğünü ve hayat amacını anlat. Örn: "Güneşin [Burç] olsa da, Yükselen [Burç] seni dışarıya karşı daha..."
                3. **Ay Burcun (Bilinçaltın):** Duygusal ihtiyaçların ve annelik/ev algın.
                4. **Element ve Nitelik Dengesi:** Haritanda Ateş, Toprak, Hava, Su dengesi nasıl? Eksik element neye yol açıyor?
                5. **Kariyer ve Finans:** Merkür ve Satürn konumuna göre potansiyelin.
                6. **Aşk ve İlişkiler:** Venüs (Sevgi) ve Mars (Tutku) konumlarının analizi.
                7. **Karmik Dersler:** Satürn'ün bulunduğu konuma göre hayattaki sınavın.
                `;
            }
            
            // --- 2. GÜNLÜK/HAFTALIK/AYLIK YORUM (Transitler & Retrolar) ---
            else if (astroType === 'horoscope') {
                const periodText = data.period === 'weekly' ? 'Bu Haftalık' : data.period === 'monthly' ? 'Bu Aylık' : 'Bugünkü';
                astroPrompt = `
                GÖREV: ${data.sign} burcu için ${periodText} Profesyonel Astroloji Yorumu.
                TARİH: Bugünün tarihi itibariyle gökyüzü konumları.
                
                TALİMATLAR:
                1. Sadece "Bugün şanslısın" deme. **Merkür Retrosu, Ay Fazları (Yeniay/Dolunay), Güneş Tutulmaları veya önemli gezegen geçişlerini (Örn: Plüton Kova'da)** mutlaka yoruma dahil et.
                2. "Ay şu an [Burç] burcunda hareket ediyor, bu da sana..." şeklinde spesifik konuş.
                3. Yorumu şu başlıklara böl:
                   - **Genel Enerji:** Gökyüzünün sana mesajı.
                   - **Aşk & İlişkiler:** Venüs etkileri.
                   - **Kariyer & Para:** Merkür/Mars etkileri.
                   - **Dikkat Etmen Gerekenler:** Retrolar veya sert açılar.
                4. Şanslı Sayı ve Renk ver.
                `;
            }
            
            // --- 3. AŞK UYUMU (Sinastri & Kompozit Bakış Açısı) ---
            else if (astroType === 'compatibility') {
                astroPrompt = `
                GÖREV: İki kişi arasında detaylı Aşk Uyumu (Sinastri) Analizi.
                1. KİŞİ: ${data.name1} (${data.sign1})
                2. KİŞİ: ${data.name2} (${data.sign2})
                
                TALİMATLAR:
                Sadece Güneş burçlarına bakma. Element uyumlarına ve arketiplerine bak.
                
                ANALİZ:
                1. **Ruhsal Bağ:** Birbirinizi nasıl tamamlıyorsunuz?
                2. **Çekim Gücü:** Tutku yüksek mi? (Mars/Venüs enerjisi).
                3. **İletişim:** Merkür uyumu nasıl? (Sözlü çatışma riski var mı?).
                4. **Zorluklar:** İlişkiyi yıpratabilecek gölge yönleriniz.
                5. **Sonuç:** Uzun vadeli ilişki potansiyeli (% Puan ver).
                `;
            }
            
            // --- 4. ASTRO TAKVİM (Ay Fazları & Retrolar) ---
            else if (astroType === 'calendar') {
                 // Frontend'den gelen hazır prompt'u kullanıyoruz
                 astroPrompt = `
                 GÖREV: Astroloji Takvimi Hazırlayıcısı. Önümüzdeki 30 günün gökyüzü takvimini çıkar.
                 
                 İSTENEN VERİLER:
                 - Ay Fazları (Yeni Ay, İlk Dördün, Dolunay, Son Dördün) - Hangi burçta?
                 - Gezegen Retroları (Merkür, Venüs, Mars vb.) - Başlangıç/Bitiş tarihleri.
                 - Önemli Gezegen Burç Değişimleri (Ingress).
                 
                 ÇIKTI FORMATI:
                 BÖLÜM 1: JSON
                 { "events": [ { "date": "15 Aralık", "title": "İkizler Burcunda Dolunay", "icon": "moon-full" }, ... ] }
                 ---AYIRAC---
                 BÖLÜM 2: Bu ayın genel gökyüzü teması (Markdown).
                 `;
            }

            aiResponse = await generateWithFallback(astroPrompt, null);
        }

        // ============================================================
        // 🔮 SENARYO 2: TAROT FALI (ASTRO-ENTEGRASYONLU)
        // ============================================================
        else if (falTuru === 'tarot') {
            const cards = JSON.parse(selectedCards);
            const cardDesc = cards.map((c, i) => `${i+1}. Kart: ${c.name} ${c.isReversed?'(TERS)':''}`).join('\n');
            
            // --- ENTEGRASYON MANTIĞI ---
            // Eğer kullanıcı burcunu kaydettiyse, Tarot yorumuna bunu yediriyoruz.
            const astroContext = userSign 
                ? `
                ENTEGRASYON TALİMATI:
                Kullanıcı **${userSign}** burcudur${userRising ? ` ve Yükseleni **${userRising}**` : ''}.
                Lütfen kartları yorumlarken şu formatı kullan:
                1. Önce kartın klasik anlamını açıkla.
                2. Sonra, **"Bir ${userSign} olarak bu kart senin için..."** diyerek burç özellikleriyle bağlantı kur.
                3. Yorumun en sonuna, **o anki gökyüzü konumuyla (Örn: Dolunay, Retro) çekilen kart arasındaki ilişkiyi** anlatan özel bir paragraf ekle. Örn: "Tarotundaki Tılsım Kralı'nın maddi gücü, bugün Boğa burcundaki Jüpiter transitiyle birleşerek..."
                ` 
                : "";

            const prompt = `
            GÖREV: Profesyonel Tarot Yorumcusu.
            AÇILIM: ${spreadName}.
            NİYET: "${intention}".
            
            KARTLAR:
            ${cardDesc}
            
            KURALLAR: ${spreadStructure}
            
            ${astroContext}
            
            YORUM: Mistik, derin, zengin ve astrolojiyle harmanlanmış bir yorum yap.
            `;
            
            aiResponse = await generateWithFallback(prompt, null);
        } 

        // ============================================================
        // ☕ SENARYO 3: KAHVE FALI (ASTRO-DOĞRULAMALI)
        // ============================================================
        else {
            if (!finalImage) return res.status(400).json({ error: "Resim yok." });
            const cleanBase64 = finalImage.replace(/^data:image\/\w+;base64,/, "");
            const imagePart = { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } };

            // --- ENTEGRASYON MANTIĞI ---
            // Kahve yorumunun sonuna "Kozmik Doğrulama" ekliyoruz.
            const astroContext = userSign 
                ? `
                ENTEGRASYON TALİMATI:
                Fal sahibi **${userSign}** burcudur.
                Fincandaki sembolleri yorumladıktan sonra, en sona **"KOZMİK DOĞRULAMA"** adında bir başlık aç.
                Burada, fincanda çıkan ana temanın (Örn: Yol, Kuş, Kalp), kullanıcının burcundaki güncel gezegen hareketleriyle (Örn: Mars transiti, Venüs retrosu) nasıl örtüştüğünü veya uyarı verdiğini açıkla.
                Örn: "Fincandaki at sembolü hızlı bir haberi müjdelerken, Mars'ın burcunuzdaki konumu da bu haberin kariyerle ilgili olacağını doğruluyor."
                ` 
                : "";

            const prompt = `
            GÖREV: Kahve Falı Yorumu. NİYET: "${intention || 'Genel Bakış'}".
            
            TALİMATLAR:
            1. Fincandaki şekilleri benzetim yoluyla analiz et.
            2. Aşk, Kariyer, Maddiyat ve Sağlık başlıkları altında toparla.
            3. ${astroContext}
            4. Mistik ve umut verici bir dil kullan.
            `;
            
            aiResponse = await generateWithFallback(prompt, imagePart);
        }

        res.json({ success: true, response: aiResponse });

    } catch (error) {
        console.error("💥 KRİTİK HATA:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`🚀 Sunucu ${PORT} portunda hazır.`); });