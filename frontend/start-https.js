#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const PORT_HTTPS = 3443;
const PORT_HTTP = 3000;

// SSL sertifikalarını kontrol et
const certPath = path.join(__dirname, 'ssl', 'cert.pem');
const keyPath = path.join(__dirname, 'ssl', 'key.pem');

console.log('🚀 GeoTalk CarVoice - HTTPS Server Starting...\n');

// Sertifika kontrolü
if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('❌ SSL sertifikaları bulunamadı!');
  console.log('🔧 Lütfen önce sertifikaları oluşturun:');
  console.log('   ./generate-ssl.sh\n');
  process.exit(1);
}

console.log('✅ SSL sertifikaları bulundu');
console.log('📁 Cert:', certPath);
console.log('📁 Key:', keyPath);
console.log('');

// React Development Server'ı HTTPS ile başlat
const env = {
  ...process.env,
  HTTPS: 'true',
  SSL_CRT_FILE: certPath,
  SSL_KEY_FILE: keyPath,
  PORT: PORT_HTTPS.toString(),
  BROWSER: 'none',
  // Disable automatic browser opening
  BROWSER_ARGS: '--disable-features=Translate',
  // Backend URLs
  REACT_APP_API_URL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  REACT_APP_WS_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:5000',
  REACT_APP_JANUS_WS_URL: process.env.REACT_APP_JANUS_WS_URL || 'ws://localhost:8188',
  // Disable ESLint warnings in console
  ESLINT_NO_DEV_ERRORS: 'true',
  TSC_COMPILE_ON_ERROR: 'true',
  // Enable source maps
  GENERATE_SOURCEMAP: 'true'
};

console.log('⚡ React Development Server (HTTPS) başlatılıyor...\n');

const reactProcess = spawn('npm', ['start'], {
  stdio: 'inherit',
  env: env,
  shell: true
});

reactProcess.on('error', (error) => {
  console.error('❌ React server başlatılamadı:', error.message);
  process.exit(1);
});

reactProcess.on('exit', (code) => {
  if (code !== 0) {
    console.log(`\n❌ React server çıktı (kod: ${code})`);
  }
  process.exit(code || 0);
});

// HTTP'den HTTPS'e yönlendirme server'ı
const redirectApp = express();

redirectApp.use('*', (req, res) => {
  const host = req.get('host');
  const hostname = host ? host.split(':')[0] : 'localhost';
  const httpsUrl = `https://${hostname}:${PORT_HTTPS}${req.originalUrl}`;
  
  console.log(`🔄 HTTP -> HTTPS: ${req.originalUrl}`);
  res.redirect(301, httpsUrl);
});

const httpServer = redirectApp.listen(PORT_HTTP, '0.0.0.0', () => {
  const localIp = getLocalIp();
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 GeoTalk CarVoice - Servers Running!');
  console.log('='.repeat(60));
  console.log('');
  console.log('🔒 HTTPS Server (React):');
  console.log(`   • Local:    https://localhost:${PORT_HTTPS}`);
  console.log(`   • Network:  https://${localIp}:${PORT_HTTPS}`);
  console.log('');
  console.log('🔄 HTTP Redirect Server:');
  console.log(`   • Port ${PORT_HTTP} -> ${PORT_HTTPS} (HTTPS)`);
  console.log('');
  console.log('⚠️  TARAYICI GÜVENLİK UYARISI:');
  console.log('   Self-signed sertifika kullanılıyor.');
  console.log('   Tarayıcınızda "Gelişmiş" -> "Devam Et" seçeneğini kullanın.');
  console.log('');
  console.log('📱 MOBİL CIHAZLAR:');
  console.log(`   1. Tarayıcıdan https://${localIp}:${PORT_HTTPS} adresine gidin`);
  console.log('   2. Sertifika uyarısını kabul edin');
  console.log('   3. Mikrofon izni verin');
  console.log('');
  console.log('🔧 Backend servislerin çalıştığından emin olun:');
  console.log('   • Backend API: http://localhost:5000');
  console.log('   • Janus WebSocket: ws://localhost:8188');
  console.log('   • MongoDB: mongodb://localhost:27017');
  console.log('   • Redis: redis://localhost:6379');
  console.log('');
  console.log('⏹  Durdurmak için: Ctrl+C');
  console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');
  httpServer.close();
  reactProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Shutting down...');
  httpServer.close();
  reactProcess.kill('SIGTERM');
  process.exit(0);
});

// Helper: Get local IP
function getLocalIp() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // IPv4, not internal, not VM
      if (net.family === 'IPv4' && !net.internal && !name.includes('docker') && !name.includes('vboxnet')) {
        return net.address;
      }
    }
  }
  
  return 'localhost';
}
