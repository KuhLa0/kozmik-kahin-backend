require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// Büyük resimler için limit artırımı
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. API Key Kontrolü
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ HATA: .env dosyasında GEMINI_API_KEY bulunamadı!");
    process.exit(1); // Key yoksa sunucuyu durdur
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 2. MODEL SEÇİMİ: SENİN LİMİTLERİNE UYGUN MODEL
// 'gemini-1.5-flash' hem hızlıdır hem de senin paylaştığın tabloya aittir.
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- YEDEK CEVAP FONKSİYONU ---
// Eğer günlük limitin (20 istek) dolarsa bu mesaj dönecek.
const getFallbackMessage = () => {
    const messages = [
        "🌌 Evrensel enerji şu an çok yoğun (Günlük limit aşıldı). Lütfen enerjini topla ve yarın tekrar dene.",
        "✨ Yıldızlar şu an dinleniyor. Kozmik Kahin yarına kadar mola verdi.",
        "🔮 Bugün çok fazla geleceğe baktık. Gizem perdesi yarına kadar kapandı."
    ];
    return messages[Math.floor(Math.random() * messages.length)];
};

// --- ROTA 1: GENEL SOHBET & METİN ANALİZİ ---
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log("📝 Metin İsteği Geldi...");

    if (!prompt) return res.status(400).json({ error: 'Prompt eksik.' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("✅ Cevap Başarılı.");
    res.json({ reply: text });

  } catch (error) {
    console.error("⚠️ AI Hatası:", error.message);

    // LİMİT AŞIMI KONTROLÜ (429 Hatası)
    if (error.message.includes('429') || error.message.includes('Quota') || error.status === 429) {
        console.log("⛔ Günlük Limit Aşıldı! Yedek mesaj gönderiliyor.");
        return res.json({ reply: getFallbackMessage() }); 
        // Hata kodu (500) göndermiyoruz, yedek mesajı "başarılı" gibi gönderiyoruz ki app çökmesin.
    }

    res.status(500).json({ error: 'Kozmik bağlantıda hata oluştu.', details: error.message });
  }
});

// --- ROTA 2: GÖRSEL ANALİZ (KAHVE, EL, YÜZ) ---
app.post('/api/analyze-image', async (req, res) => {
  try {
    const { prompt, imageBase64 } = req.body;
    console.log("📷 Görsel Analiz İsteği Geldi...");

    if (!prompt || !imageBase64) return res.status(400).json({ error: 'Veri eksik.' });

    // Base64 temizliği
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");

    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: "image/jpeg",
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log("✅ Görsel Yorumlandı.");
    res.json({ reply: text });

  } catch (error) {
    console.error("⚠️ Vision AI Hatası:", error.message);

    // LİMİT AŞIMI KONTROLÜ
    if (error.message.includes('429') || error.message.includes('Quota') || error.status === 429) {
        console.log("⛔ Günlük Limit Aşıldı! Yedek fal gönderiliyor.");
        return res.json({ reply: "☕ Fincanında çok yoğun enerjiler var... Bugünlük bu kadar, enerjini yarına sakla. (Günlük Limit Doldu)" });
    }

    res.status(500).json({ error: 'Görüntü analiz edilemedi.', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Kozmik Sunucu ${port} portunda!`);
  console.log(`✨ Model: gemini-1.5-flash (Ücretsiz Plan Ayarlı)`);
});