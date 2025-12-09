require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Base64 resimler büyük olduğu için limit yüksek olmalı
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

let ACTIVE_MODEL = null;
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    console.error("❌ HATA: API Key yok!");
    process.exit(1);
}

// Modeli Bulma Fonksiyonu (Aynı kalıyor)
async function findActiveModel() {
    console.log("🔍 Model aranıyor...");
    try {
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const response = await axios.get(listUrl);
        const validModels = response.data.models.filter(m => 
            m.supportedGenerationMethods?.includes("generateContent")
        );
        
        const imageModel = validModels.find(m => m.name.includes('flash'));
        ACTIVE_MODEL = imageModel ? imageModel.name : "models/gemini-pro"; 
        console.log(`✅ Model Seçildi: ${ACTIVE_MODEL}`);
    } catch (error) {
        console.log("⚠️ Varsayılan model: gemini-1.5-flash");
        ACTIVE_MODEL = "models/gemini-1.5-flash";
    }
}
findActiveModel();

// --- API ENDPOINT ---
app.post('/api/fal-bak', async (req, res) => {
    if (!ACTIVE_MODEL) return res.status(503).json({ error: "Sunucu hazırlanıyor..." });

    try {
        const { message, type, image } = req.body;
        console.log(`📥 İstek: ${type} falı.`);

        // --- 🧠 ZEKİ PROMPT MÜHENDİSLİĞİ ---
        // Burası işin sırrı. AI'ya önce kontrol etmesini söylüyoruz.
        let promptText = "";

        if (type === "kahve" && image) {
            promptText = `
                GÖREV: Bir Görüntü Doğrulama ve Fal Uzmanısın.
                
                ADIM 1: Önce bu görüntüyü analiz et.
                Bu görüntüde aşağıdakilerden biri VAR MI?
                - Bir kahve fincanı (içi veya dışı)
                - Kahve telvesi şekilleri
                - Kahve tabağı
                
                EĞER YOKSA (Örn: İnsan yüzü, manzara, kedi, bilgisayar, siyah ekran vb. ise):
                Sadece tek bir kelime ile cevap ver: GECERSIZ_GORUNTU
                
                EĞER VARSA (Geçerli bir kahve falı fotoğrafıysa):
                Sen mistik bir falcısın. Gördüğün sembolleri yorumla.
                Kullanıcı Niyeti: "${message || 'Genel'}"
                Yorumun mistik, akıcı ve 3 paragraf olsun.
            `;
        } else {
            // Kahve değilse normal fal (Tarot/Astroloji vb.)
            promptText = `Sen bir falcısın. Soru: "${message}". Tür: ${type}. Mistik ve kısa cevap ver.`;
        }

        const contents = [];
        if (image) {
            contents.push({
                inlineData: { data: image, mimeType: "image/jpeg" }
            });
        }
        contents.push(promptText);

        const url = `https://generativelanguage.googleapis.com/v1beta/${ACTIVE_MODEL}:generateContent?key=${API_KEY}`;
        const response = await axios.post(url, { contents: [{ parts: contents }] });

        const botReply = response.data.candidates[0].content.parts[0].text.trim(); // Boşlukları temizle
        console.log("✅ AI Cevabı:", botReply.substring(0, 50) + "...");
        
        res.json({ success: true, reply: botReply });

    } catch (error) {
        console.error("Hata:", error.message);
        res.status(500).json({ success: false, error: "Sunucu hatası." });
    }
});

app.listen(port, () => {
    console.log(`✨ Sunucu ${port} portunda!`);
});