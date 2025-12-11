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
    // Render environment variables kontrol edilmeli
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- AKILLI MODEL SİSTEMİ (GÜNCELLENDİ) ---
// Model isimleri en güncel API standartlarına göre düzenlendi.
const MODELS_TO_TRY = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

async function generateWithFallback(prompt, imagePart = null) {
    let lastError = null;

    for (const modelName of MODELS_TO_TRY) {
        try {
            console.log(`🔄 Denenen Model: ${modelName}...`);
            
            // Yeni kütüphanede model alma yöntemi
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
            return text; 

        } catch (error) {
            console.warn(`⚠️ ${modelName} başarısız oldu. Hata:`, error.message);
            lastError = error;
            // Bir sonraki modele geç
        }
    }

    throw lastError;
}

// --- ROTA 1: GENEL SOHBET ---
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt eksik.' });

    const text = await generateWithFallback(prompt);
    res.json({ reply: text });

  } catch (error) {
    console.error("❌ TÜM MODELLER BAŞARISIZ:", error.message);
    
    if (error.message?.includes('429') || error.message?.includes('Quota')) {
        return res.json({ reply: "🌌 Evrensel hatlar şu an aşırı yoğun. (Limit Aşıldı)" });
    }
    res.status(500).json({ error: 'Sunucu hatası', details: error.message });
  }
});

// --- ROTA 2: GÖRSEL ANALİZ ---
app.post('/api/analyze-image', async (req, res) => {
  try {
    const { prompt, imageBase64 } = req.body;
    if (!prompt || !imageBase64) return res.status(400).json({ error: 'Veri eksik.' });

    // Temizlik
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
    
    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: "image/jpeg",
      },
    };

    const text = await generateWithFallback(prompt, imagePart);
    res.json({ reply: text });

  } catch (error) {
    console.error("❌ VISION HATASI:", error.message);
    res.status(500).json({ error: 'Görüntü analiz edilemedi.', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Kozmik Sunucu ${port} portunda çalışıyor!`);
});