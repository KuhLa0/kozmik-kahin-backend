require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Key Kontrolü
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ HATA: .env dosyasında GEMINI_API_KEY bulunamadı!");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- AKILLI MODEL SİSTEMİ (FALLBACK LOGIC) ---
// Sırasıyla denenecek modeller listesi
const MODELS_TO_TRY = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

// Bu fonksiyon sırayla modelleri dener, hangisi çalışırsa cevabı getirir
async function generateWithFallback(prompt, imagePart = null) {
    let lastError = null;

    for (const modelName of MODELS_TO_TRY) {
        try {
            console.log(`🔄 Denenen Model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            let result;
            if (imagePart) {
                // Görsel Analiz
                result = await model.generateContent([prompt, imagePart]);
            } else {
                // Sadece Metin
                result = await model.generateContent(prompt);
            }

            const response = await result.response;
            const text = response.text();
            
            console.log(`✅ BAŞARILI! Cevap veren model: ${modelName}`);
            return text; // Başarılıysa döngüden çık ve cevabı döndür

        } catch (error) {
            console.warn(`⚠️ ${modelName} başarısız oldu. Hata:`, error.message);
            lastError = error;
            // Döngü devam eder, bir sonraki modele geçer
        }
    }

    // Hiçbiri çalışmazsa hatayı fırlat
    throw lastError;
}

// --- ROTA 1: GENEL SOHBET (TEXT) ---
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt eksik.' });

    // Akıllı fonksiyonu çağırıyoruz (Sadece text)
    const text = await generateWithFallback(prompt);
    
    res.json({ reply: text });

  } catch (error) {
    console.error("❌ TÜM MODELLER BAŞARISIZ:", error.message);
    
    // Limit hatası kontrolü
    if (error.message?.includes('429') || error.message?.includes('Quota')) {
        return res.json({ reply: "🌌 Evrensel hatlar şu an aşırı yoğun. Kozmik enerjini toplayıp yarın tekrar dener misin?" });
    }
    
    res.status(500).json({ error: 'Sunucu hatası', details: error.message });
  }
});

// --- ROTA 2: GÖRSEL ANALİZ (VISION) ---
app.post('/api/analyze-image', async (req, res) => {
  try {
    const { prompt, imageBase64 } = req.body;
    if (!prompt || !imageBase64) return res.status(400).json({ error: 'Veri eksik.' });

    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: "image/jpeg",
      },
    };

    // Akıllı fonksiyonu çağırıyoruz (Text + Resim)
    const text = await generateWithFallback(prompt, imagePart);

    res.json({ reply: text });

  } catch (error) {
    console.error("❌ VISION HATASI:", error.message);
    
    if (error.message?.includes('429') || error.message?.includes('Quota')) {
        return res.json({ reply: "☕ Fincanındaki şekiller çok gizemli ama enerjiler şu an çok yoğun. (Günlük Limit Doldu)" });
    }

    res.status(500).json({ error: 'Görüntü analiz edilemedi.', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Kozmik Sunucu ${port} portunda çalışıyor!`);
});