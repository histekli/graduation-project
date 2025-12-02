#!/bin/bash

echo "🔐 SSL Sertifikaları Oluşturuluyor..."

# SSL sertifikaları için dizin oluştur
mkdir -p ssl
mkdir -p frontend/ssl

# IP adresini al
HOST_IP=$(hostname -I | awk '{print $1}')
echo "📍 Yerel IP: $HOST_IP"

# OpenSSL config dosyası oluştur (SAN - Subject Alternative Name desteği ile)
cat > ssl/openssl.cnf << EOF
[req]
default_bits = 4096
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=TR
ST=Istanbul
L=Istanbul
O=GeoTalk CarVoice
CN=localhost

[v3_req]
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = critical, serverAuth
subjectAltName = @alt_names
basicConstraints = critical, CA:FALSE

[alt_names]
DNS.1 = localhost
DNS.2 = *.local
DNS.3 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
IP.3 = $HOST_IP
EOF

# Self-signed sertifika oluştur (SAN desteği ile)
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -days 365 \
  -config ssl/openssl.cnf \
  -extensions v3_req

# Frontend için kopyala
cp ssl/key.pem frontend/ssl/
cp ssl/cert.pem frontend/ssl/

echo ""
echo "✅ SSL sertifikaları oluşturuldu!"
echo "📁 Root SSL: ssl/cert.pem, ssl/key.pem"
echo "📁 Frontend SSL: frontend/ssl/cert.pem, frontend/ssl/key.pem"
echo ""
echo "🌐 Erişim URL'leri:"
echo "   • Localhost: https://localhost:3443"
echo "   • Local IP: https://$HOST_IP:3443"
echo ""
echo "⚠️  TARAYICI UYARILARI:"
echo "   Chrome: 'Gelişmiş' -> 'localhost bağlantısına devam et (güvenli değil)'"
echo "   Firefox: 'Gelişmiş' -> 'Riski Kabul Et ve Devam Et'"
echo "   Safari: 'Detayları Göster' -> 'Web sitesini ziyaret et'"
echo ""
echo "📱 MOBİL CİHAZLAR İÇİN:"
echo "   1. Tarayıcıdan https://$HOST_IP:3443 adresine gidin"
echo "   2. Sertifika uyarısını kabul edin (her tarayıcı için bir kez)"
echo "   3. Mikrofon iznini verin"
echo ""

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
