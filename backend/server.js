const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const userRoutes = require('./routes/users');
const socketHandler = require('./socket/socketHandler');

// Redis Location Service
const RedisLocationService = require('./services/redisLocationService');

// Mediasoup Manager başlat
const mediasoupManager = require('./mediasoup/manager');

const app = express();

// HTTPS için SSL sertifikaları
let server;
const sslPath = path.join(__dirname, '../ssl');
const sslCertPath = path.join(sslPath, 'cert.pem');
const sslKeyPath = path.join(sslPath, 'key.pem');

if (fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath) && process.env.DISABLE_SSL !== 'true') {
  const httpsOptions = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath)
  };
  server = https.createServer(httpsOptions, app);
  console.log('🔒 HTTPS server oluşturuldu');
} else {
  server = http.createServer(app);
  console.log('⚠️  HTTP server oluşturuldu (SSL sertifikaları bulunamadı)');
}

// Redis Location Service başlat

let redisLocationService;
try {
  redisLocationService = new RedisLocationService();
  console.log('🔴 Redis Location Service başlatıldı');
} catch (error) {
  console.error('❌ Redis Location Service başlatma hatası:', error);
  // Redis olmadan devam et
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Geliştirme modunda Redis olmadan çalışıyor...');
  }
}

// CORS konfigürasyonu
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ["https://yourdomain.com"]
      : [
        "http://localhost:3000",
        "http://localhost:19006",
        `http://${process.env.HOST_IP}:3000`,
        `https://${process.env.HOST_IP}:3443`,
        "https://localhost:3443",
        "*"
      ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowEIO3: true
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:", "https:", "http:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false // WebRTC için gerekli
}));
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ["https://yourdomain.com"]
    : [
      "http://localhost:3000",
      "http://localhost:19006",
      `http://${process.env.HOST_IP}:3000`,
      `https://${process.env.HOST_IP}:3443`,
      "https://localhost:3443",
      "*"
    ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB bağlantısı
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/carvoice';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('✅ MongoDB bağlantısı başarılı');
  })
  .catch((error) => {
    console.error('⚠️  MongoDB bağlantı hatası (geliştirme modunda devam ediliyor):', error.message);
    // Geliştirme modunda MongoDB olmadan devam et
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Geliştirme modunda MongoDB olmadan çalışıyor...');
    } else {
      process.exit(1);
    }
  });

// Routes - /api prefix ile
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Ana route - API info
app.get('/api', (req, res) => {
  res.json({
    message: 'WebRTC Car Voice GeoTalk API - Mediasoup SFU',
    version: '2.0.0',
    architecture: 'SFU (Selective Forwarding Unit)',
    mediaServer: 'Mediasoup v3',
    docs: '/api-docs'
  });
});

// Socket.IO event handling - Mediasoup SFU ve Redis Location Service ile
socketHandler(io, redisLocationService);

// Mediasoup SFU API endpoint'leri
app.get('/api/sfu/status', (req, res) => {
  try {
    res.json({
      status: 'active',
      architecture: 'SFU (Selective Forwarding Unit)',
      mediaServer: 'Mediasoup v3',
      workers: mediasoupManager.workers ? mediasoupManager.workers.length : 0,
      activeRooms: mediasoupManager.routers ? mediasoupManager.routers.size : 0,
      codec: 'Opus 48kHz Stereo',
      portRange: '40000-49999 (UDP)'
    });
  } catch (error) {
    console.error('❌ SFU status endpoint hatası:', error);
    res.status(500).json({ error: 'SFU durumu alınamadı' });
  }
});

// Redis Location API endpoint'leri
app.get('/locations/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude ve longitude gerekli' });
    }

    if (redisLocationService && redisLocationService.isConnected) {
      const nearbyUsers = await redisLocationService.findNearbyUsers(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(radius)
      );
      res.json({ users: nearbyUsers });
    } else {
      res.json({ users: [], message: 'Redis bağlı değil' });
    }
  } catch (error) {
    console.error('❌ Nearby locations endpoint hatası:', error);
    res.status(500).json({ error: 'Yakındaki kullanıcılar alınamadı' });
  }
});

app.get('/redis/stats', async (req, res) => {
  try {
    if (redisLocationService && redisLocationService.isConnected) {
      const stats = await redisLocationService.getStats();
      res.json({ stats, connected: true });
    } else {
      res.json({ connected: false, message: 'Redis bağlı değil' });
    }
  } catch (error) {
    console.error('❌ Redis stats endpoint hatası:', error);
    res.status(500).json({ error: 'Redis istatistikleri alınamadı' });
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message
  });
});

// Catch-all route - serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

const PORT = process.env.PORT || 3443;
const PROTOCOL = server instanceof https.Server ? 'https' : 'http';

// Initialize Mediasoup workers before starting server
(async () => {
  try {
    console.log('⚙️ Mediasoup workers başlatılıyor...');

    try {
      await mediasoupManager.init();
      console.log('✅ Mediasoup workers hazır');
    } catch (err) {
      console.error('❌ Mediasoup Init Error (Non-fatal, starting server anyway):', err);
    }

    server.listen(PORT, () => {
      console.log(`🚀 Sunucu ${PROTOCOL}://localhost:${PORT} adresinde çalışıyor`);
      console.log(`🌍 Ortam: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🎙️ SFU (Mediasoup): ${mediasoupManager.workers && mediasoupManager.workers.length > 0 ? 'Aktif' : 'Pasif (Hata)'}`);
      console.log(`🔒 Protokol: ${PROTOCOL.toUpperCase()}`);
    });

  } catch (error) {
    console.error('❌ Kritik Sunucu Hatası:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');

    // Redis Service'i kapat
    if (redisLocationService) {
      redisLocationService.close().catch(console.error);
    }

    // Mediasoup cleanup
    if (mediasoupManager && mediasoupManager.workers) {
      console.log('Mediasoup workers kapatılıyor...');
      mediasoupManager.workers.forEach(worker => worker.close());
    }

    mongoose.connection.close().then(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');

    // Redis Service'i kapat
    if (redisLocationService) {
      redisLocationService.close().catch(console.error);
    }

    // Mediasoup cleanup
    if (mediasoupManager && mediasoupManager.workers) {
      console.log('Mediasoup workers kapatılıyor...');
      mediasoupManager.workers.forEach(worker => worker.close());
    }

    mongoose.connection.close().then(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;
