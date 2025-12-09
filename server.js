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
const MODELS_TO_TRY = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];

app.post('/api/fal-bak', async (req, res) => {
    try {
        console.log("📥 Fal isteği alındı.");
        const { image, selectedCards, falTuru, intention, spreadId } = req.body;
        const finalImage = image || req.body.base64Image;

        // --- TAROT MODU MU? ---
        if (falTuru === 'tarot') {
            console.log(`🔮 Tarot Modu: ${spreadId || 'Standart'}`);
            const cards = JSON.parse(selectedCards); // [{name: "Kupa Ası", isReversed: true}, ...]

            // Kartları Metne Dökme
            const cardDescriptions = cards.map((c, i) => 
                `${i + 1}. Kart: ${c.name} ${c.isReversed ? '(TERS - Reversed Anlamını Yorumla)' : '(DÜZ)'}`
            ).join('\n');

            let prompt = "";

            // --- 1. İLİŞKİ AÇILIMI PROMPTU ---
            if (spreadId === 'iliski') {
                prompt = `
                GÖREV: Profesyonel bir Tarot yorumcusu olarak "İlişki Açılımı" yap.
                NİYET: "${intention}"
                
                KARTLAR VE POZİSYONLARI (Lütfen bu sıraya göre yorumla):
                ${cardDescriptions}

                AÇILIM KURALLARI:
                - Kart 1 (Merkez): İlişkinin şu anki durumu, hakim olan enerji ve ana sorun/pozitif durum.
                - Kart 2 (Sağ Taraf - Kadın/Partner 2): Kişinin ilişkiye dair DÜŞÜNCELERİ, beklentileri (Duygu yoktur, rasyoneldir).
                - Kart 3 (Sağ Taraf - Kadın/Partner 2): Kişinin DUYGULARI, bağlılığı ve hisleri.
                - Kart 4 (Sağ Taraf - Kadın/Partner 2): İlişkinin ÇEVREYE verdiği enerji ve dışarıdan nasıl göründüğü.
                - Kart 5 (Sol Taraf - Erkek/Partner 1): Sol tarafın ÇEVREYE verdiği enerji.
                - Kart 6 (Sol Taraf - Erkek/Partner 1): Sol tarafın DUYGULARI ve hisleri.
                - Kart 7 (Sol Taraf - Erkek/Partner 1): Sol tarafın DÜŞÜNCELERİ ve rasyonel beklentileri.

                YORUM YAPARKEN:
                - Sol tarafı (5,6,7) Partner 1 (Genelde Erkek), Sağ tarafı (2,3,4) Partner 2 (Genelde Kadın) olarak ele al.
                - Kartlar arasındaki zıtlıkları veya uyumu (Örn: Düşünceler ve Duygular çatışıyor mu?) analiz et.
                - Sonuç olarak ilişkinin potansiyelini özetle.
                - Mistik, derin ve empatik bir dil kullan.
                `;
            } 
            // --- 2. KELT HAÇI PROMPTU ---
            else if (spreadId === 'kelt') {
                prompt = `
                GÖREV: Profesyonel bir Tarot yorumcusu olarak "Kelt Haçı Açılımı" yap.
                NİYET: "${intention}"

                KARTLAR VE POZİSYONLARI:
                ${cardDescriptions}

                AÇILIM KURALLARI:
                1. Merkez: Şu an yaşanan durum ve ana konu.
                2. Engel/Destek: Kişinin üzerindeki ağırlık veya onu engelleyen/destekleyen faktör.
                3. Geçmiş (Kökler): Bugüne sebep olan geçmiş olaylar (Değiştirilemez, yüzleşilmeli).
                4. Gelecek (Olasılıklar): Bu yolda gidilirse muhtemel sonuç (Kesin değildir, değişebilir).
                5. Bilinçüstü (Yukarıdakiler): Ruhsal durum, maneviyat, içsel güç.
                6. Bilinçaltı (Aşağıdakiler): Gizli korkular, hayaller, farkında olunmayan etkiler.
                7. Tavsiye: Kişinin ne yapması veya yapmaması gerektiği.
                8. Dış Etkenler: Çevre, sosyal hayat ve başkalarının etkisi.
                9. Umutlar ve Korkular: İçsel beklentiler ve endişeler.
                10. Sonuç: Tüm kartların toplamı ve nihai öngörü.

                YORUM: Her kartı pozisyonuna göre derinlemesine analiz et ve bütünsel bir hikaye oluştur.
                `;
            }
            // --- 3. STANDART ÜÇLÜ AÇILIM ---
            else {
                prompt = `
                GÖREV: Tarot yorumcusu olarak 3 Kart açılımı yap.
                NİYET: "${intention}"
                KARTLAR: ${cardDescriptions}
                
                KURALLAR:
                - 1. Kart: Geçmiş (Kökler)
                - 2. Kart: Şimdi (Mevcut Durum)
                - 3. Kart: Gelecek (Olası Sonuç)
                
                Kartların ters veya düz oluşunu dikkate alarak mistik bir yorum yap.
                `;
            }

            // --- MODELİ ÇALIŞTIR ---
            let finalResponse = null;
            for (const modelName of MODELS_TO_TRY) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent([prompt]);
                    const response = await result.response;
                    finalResponse = response.text();
                    break; 
                } catch (e) {
                    console.log(`Model hatası (${modelName}):`, e.message);
                }
            }

            if (!finalResponse) throw new Error("Yapay zeka yanıt veremedi.");
            
            // JSON Formatında değilse düz metin olarak gönder
            // (Frontend'de fal-result.tsx zaten düz metni de kabul ediyor)
            return res.json({ success: true, response: finalResponse });

        } // --- TAROT MODU SONU ---


        // --- BURASI ESKİ KAHVE FALI KODU (AYNEN KALIYOR) ---
        // (Buraya dokunmana gerek yok, mevcut kahve kodu çalışmaya devam etsin)
        // ...
        
        // Kahve Falı için eski kodun devamı...
        if (!finalImage) return res.status(400).json({ success: false, error: "Resim yok." });
        // ... (Mevcut kahve kodun) ...
        // Sadece Tarot bloğunu en başa ekledik.

    } catch (error) {
        console.error("💥 SUNUCU HATASI:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda.`);
});