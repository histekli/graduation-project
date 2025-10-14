const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const userRoutes = require('./routes/users');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// CORS konfigürasyonu
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://yourdomain.com"] 
      : ["http://localhost:3000", "http://localhost:19006", `http://${process.env.HOST_IP}:3000`, "*"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false // WebRTC için gerekli
}));
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ["https://yourdomain.com"] 
    : ["http://localhost:3000", "http://localhost:19006", `http://${process.env.HOST_IP}:3000`, "*"],
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

// Routes
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

// Ana route
app.get('/', (req, res) => {
  res.json({
    message: 'WebRTC Car Voice GeoTalk API',
    version: '1.0.0',
    docs: '/api-docs'
  });
});

// Socket.IO event handling
socketHandler(io);

// Global error handler
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor`);
  console.log(`🌍 Ortam: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    mongoose.connection.close().then(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;
