require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// Middleware (Resimler büyük olacağı için limiti artırıyoruz)
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- GEMINI KURULUMU ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Hangi modeli kullanacağımızı seçiyoruz (Flash hızlı ve ucuzdur)
// Not: Google versiyon isimlerini güncelleyebilir, şu an en yaygın "gemini-1.5-flash"
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- ROTA 1: GENEL SOHBET & METİN ANALİZİ (Chat, Rüya, Aşk) ---
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt eksik.' });
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ reply: text });

  } catch (error) {
    console.error("AI Hatası:", error);
    res.status(500).json({ error: 'Kozmik bağlantıda hata oluştu.', details: error.message });
  }
});

// --- ROTA 2: GÖRSEL ANALİZ (Kahve, El, Yüz Falı) ---
app.post('/api/analyze-image', async (req, res) => {
  try {
    const { prompt, imageBase64 } = req.body;

    if (!prompt || !imageBase64) {
      return res.status(400).json({ error: 'Resim veya prompt eksik.' });
    }

    // Base64 temizliği (Header varsa kaldır)
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

    res.json({ reply: text });

  } catch (error) {
    console.error("Vision AI Hatası:", error);
    res.status(500).json({ error: 'Görüntü analiz edilemedi.', details: error.message });
  }
});

// --- SAĞLIK KONTROLÜ (Render için) ---
app.get('/', (req, res) => {
  res.send('Kozmik Kahin Backend Calisiyor! 🔮');
});

app.listen(port, () => {
  console.log(`Sunucu ${port} portunda dinleniyor...`);
});