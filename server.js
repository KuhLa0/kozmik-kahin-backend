require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Global değişken: Çalışan modelin adını burada saklayacağız
let ACTIVE_MODEL = null;

// API Key Kontrolü
if (!process.env.API_KEY) {
    console.error("❌ HATA: API Key .env dosyasında bulunamadı!");
    process.exit(1);
}

// ---------------------------------------------------------
// 🛠️ MÜHENDİSLİK ÇÖZÜMÜ: OTOMATİK MODEL BULUCU
// ---------------------------------------------------------
async function findActiveModel() {
    console.log("🔍 Google Sunucularında senin için açık olan modeller aranıyor...");
    
    try {
        // Google'dan model listesini istiyoruz
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.API_KEY}`;
        const response = await axios.get(listUrl);
        
        const models = response.data.models;
        
        // "generateContent" yeteneği olan modelleri filtrele
        const validModels = models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));

        if (validModels.length > 0) {
            // İlk uygun modeli seç (Genelde gemini-pro veya gemini-1.5-flash olur)
            // Listenin başındaki en güncelidir.
            ACTIVE_MODEL = validModels[0].name; 
            console.log(`✅ BAŞARILDI! Bulunan ve Seçilen Model: [ ${ACTIVE_MODEL} ]`);
            console.log("🚀 Sunucu artık bu modeli kullanacak.");
        } else {
            console.error("❌ HATA: API Anahtarın geçerli ama hiçbir modele erişim izni yok.");
            console.error("Lütfen Google AI Studio'da faturalandırma veya proje ayarlarını kontrol et.");
        }

    } catch (error) {
        console.error("🚨 MODEL LİSTESİ ALINAMADI!");
        console.error("Hata Detayı:", error.response ? error.response.data : error.message);
        console.log("⚠️ Varsayılan olarak 'models/gemini-pro' denenecek...");
        ACTIVE_MODEL = "models/gemini-pro";
    }
}

// Sunucu başlarken modeli bul
findActiveModel();

// ---------------------------------------------------------
// API ENDPOINT
// ---------------------------------------------------------
app.post('/api/fal-bak', async (req, res) => {
    // Eğer model henüz bulunamadıysa uyarı ver
    if (!ACTIVE_MODEL) {
        return res.status(503).json({ success: false, error: "Sunucu hala uygun model arıyor, 5 saniye sonra tekrar dene." });
    }

    try {
        const { message, type } = req.body;
        console.log(`📥 İstek: "${message}" -> Kullanılan Model: ${ACTIVE_MODEL}`);

        const promptText = `
            Sen Kozmik Kahin'sin.
            Kullanıcı sorusu: "${message}" (Tür: ${type})
            Kısa, mistik ve eğlenceli cevap ver.
        `;

        // Dinamik olarak seçtiğimiz modele istek atıyoruz
        // URL yapısı: https://.../models/gemini-pro:generateContent
        const url = `https://generativelanguage.googleapis.com/v1beta/${ACTIVE_MODEL}:generateContent?key=${process.env.API_KEY}`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: promptText }] }]
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const botReply = response.data.candidates[0].content.parts[0].text;
        console.log("✅ Cevap gönderildi.");
        
        res.json({ success: true, reply: botReply });

    } catch (error) {
        console.error("🚨 FAL BAKARKEN HATA:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Kozmik bağlantı hatası." });
    }
});

app.listen(port, () => {
    console.log(`✨ Kozmik Kahin Sunucusu Başladı (${port})`);
});