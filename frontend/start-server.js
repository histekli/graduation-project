const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

// SSL sertifikalarını kontrol et
const sslPath = path.join(__dirname, 'ssl');
const certPath = path.join(sslPath, 'cert.pem');
const keyPath = path.join(sslPath, 'key.pem');

console.log('🚀 Server başlatılıyor...');
console.log('📁 SSL Path:', sslPath);
console.log('🔐 Cert exists:', fs.existsSync(certPath));
console.log('🔑 Key exists:', fs.existsSync(keyPath));

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  console.log('🔒 SSL sertifikaları bulundu, React Development Server HTTPS ile başlatılıyor...');
  
  // React Development Server'ı HTTPS ile başlat
  console.log('⚡ HTTPS React Development Server başlatılıyor...');
  const devProcess = spawn('npm', ['run', 'start-dev'], { 
    stdio: 'inherit',
    env: {
      ...process.env,
      HTTPS: 'true',
      SSL_CRT_FILE: certPath,
      SSL_KEY_FILE: keyPath,
      PORT: '3443',
      BROWSER: 'none',
      REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL || 'http://backend:5000',
      REACT_APP_SOCKET_URL: process.env.REACT_APP_SOCKET_URL || 'ws://backend:5000'
    }
  });
  
  devProcess.on('error', (error) => {
    console.error('❌ Dev server başlatılamadı:', error.message);
  });
  
  devProcess.on('exit', (code) => {
    console.log(`🔴 Dev server çıktı (kod: ${code})`);
    process.exit(code);
  });
  
  // HTTP'den HTTPS'e yönlendirme server'ı
  const express = require('express');
  const redirectApp = express();
  
  redirectApp.use('*', (req, res) => {
    const httpsUrl = `https://${req.get('host').replace(':3000', ':3443')}${req.originalUrl}`;
    console.log('🔄 HTTP -> HTTPS redirect:', req.originalUrl, '->', httpsUrl);
    res.redirect(301, httpsUrl);
  });
  
  redirectApp.listen(3000, '0.0.0.0', () => {
    console.log('🔄 HTTP Redirect Server running on port 3000 -> HTTPS 3443');
  });
  
} else {
  console.error('❌ SSL sertifikaları bulunamadı!');
  console.log('🔧 SSL sertifikaları oluşturuluyor...');
  
  // SSL sertifikalarını oluştur
  const { execSync } = require('child_process');
  
  try {
    execSync('mkdir -p ssl', { stdio: 'inherit' });
    execSync(`openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=TR/ST=Istanbul/L=Istanbul/O=CarVoice/CN=*.local"`, { stdio: 'inherit' });
    console.log('✅ SSL sertifikaları oluşturuldu, server yeniden başlatılıyor...');
    process.exit(0);
  } catch (error) {
    console.error('❌ SSL sertifikası oluşturulamadı:', error);
    process.exit(1);
  }
}
