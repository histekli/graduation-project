const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

// React development server'ı require et
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
  console.log('🔒 SSL sertifikaları bulundu, HTTPS ve HTTP server başlatılıyor...');
  
  // Önce development server'ı HTTPS ile başlat
  console.log('� HTTPS Development server başlatılıyor...');
  
  // React uygulamasını HTTPS ile serve et
  const express = require('express');
  const app = express();
  
  // Static dosyalar için middleware - public klasörü
  app.use(express.static(path.join(__dirname, 'public')));
  
  // Build klasörü varsa onu da serve et
  if (fs.existsSync(path.join(__dirname, 'build'))) {
    console.log('📦 Build klasörü bulundu, build dosyalarını serve ediliyor');
    app.use(express.static(path.join(__dirname, 'build')));
  }
  
  // API proxy için backend'e yönlendirme
  app.use('/api', (req, res) => {
    const backendUrl = `http://backend:5000${req.path}`;
    console.log('🔄 API Proxy:', req.method, req.path, '->', backendUrl);
    
    const options = {
      hostname: 'backend',
      port: 5000,
      path: req.path + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''),
      method: req.method,
      headers: {
        ...req.headers,
        host: 'backend:5000'
      }
    };
    
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (error) => {
      console.error('❌ Proxy error:', error);
      res.status(500).send('Proxy Error');
    });
    
    if (req.method === 'POST' || req.method === 'PUT') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  });
  
  // Socket.IO proxy
  app.use('/socket.io', (req, res) => {
    console.log('🔌 Socket.IO Proxy:', req.path);
    res.status(404).send('Socket.IO through HTTPS not supported in this proxy');
  });
  
  // React uygulaması için fallback
  app.get('*', (req, res) => {
    // Önce build/index.html'i dene, yoksa public/index.html'i gönder
    const buildIndexPath = path.join(__dirname, 'build', 'index.html');
    const publicIndexPath = path.join(__dirname, 'public', 'index.html');
    
    if (fs.existsSync(buildIndexPath)) {
      console.log('📦 Build index.html gönderiliyor:', req.path);
      res.sendFile(buildIndexPath);
    } else if (fs.existsSync(publicIndexPath)) {
      console.log('🔧 Public index.html gönderiliyor:', req.path);
      res.sendFile(publicIndexPath);
    } else {
      console.error('❌ index.html bulunamadı');
      res.status(404).send('index.html not found');
    }
  });
  
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  
  // HTTPS server
  const httpsServer = https.createServer(options, app);
  httpsServer.listen(3443, '0.0.0.0', () => {
    console.log('🔒 HTTPS Server running on port 3443');
    console.log('📱 Mobil erişim: https://[IP]:3443');
  });
  
  // HTTP'den HTTPS'e yönlendirme server'ı
  const redirectApp = express();
  redirectApp.use('*', (req, res) => {
    const httpsUrl = `https://${req.get('host').replace(':3000', ':3443')}${req.originalUrl}`;
    console.log('🔄 HTTP -> HTTPS redirect:', req.originalUrl, '->', httpsUrl);
    res.redirect(301, httpsUrl);
  });
  
  redirectApp.listen(3000, '0.0.0.0', () => {
    console.log('🔄 HTTP Redirect Server running on port 3000 -> HTTPS 3443');
  });
  
  // React Development Server'ı da başlat (webpack-dev-server)
  console.log('⚡ React Development Server başlatılıyor...');
  const devProcess = spawn('npm', ['run', 'start-dev'], { 
    stdio: 'inherit',
    env: {
      ...process.env,
      HTTPS: 'true',
      SSL_CRT_FILE: certPath,
      SSL_KEY_FILE: keyPath,
      PORT: '3001',
      BROWSER: 'none'
    }
  });
  
  devProcess.on('error', (error) => {
    console.log('⚠️ Dev server could not start:', error.message);
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
