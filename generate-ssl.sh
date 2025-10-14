#!/bin/bash

# SSL sertifikaları için dizin oluştur
mkdir -p ssl

# Self-signed sertifika oluştur
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=TR/ST=Istanbul/L=Istanbul/O=CarVoice/CN=*.local"

echo "✅ SSL sertifikaları oluşturuldu!"
echo "cert.pem ve key.pem dosyaları ssl/ klasöründe"

# Frontend için HTTPS server konfigürasyonu
cat > ssl/https-server.js << 'EOF'
const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

// Build edilen React uygulamasını serve et
app.use(express.static(path.join(__dirname, '../build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

const options = {
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

https.createServer(options, app).listen(3443, () => {
  console.log('🔒 HTTPS Server running on port 3443');
  console.log('📱 Mobil cihazlar için: https://[IP]:3443');
});
EOF

echo "🔒 HTTPS server scripti oluşturuldu: ssl/https-server.js"
echo "📱 Mobil cihazlardan erişim için bu scripti kullanabilirsiniz"
