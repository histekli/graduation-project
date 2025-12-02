const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT token doğrulama middleware'i
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        error: 'Erişim token\'ı gerekli'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    // Kullanıcının hala var olup olmadığını kontrol et
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        error: 'Geçersiz token - kullanıcı bulunamadı'
      });
    }
    
    req.userId = decoded.userId;
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Geçersiz token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token\'ın süresi dolmuş'
      });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Kimlik doğrulama hatası'
    });
  }
};

// Socket.IO için token doğrulama
const authenticateSocketToken = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    const isGuest = socket.handshake.auth.isGuest || false;
    const guestUsername = socket.handshake.auth.username;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    // Guest kullanıcı kontrolü
    if (token.startsWith('guest_token_')) {
      console.log('👤 Guest user connecting:', guestUsername);
      
      // Guest kullanıcı için sanal user objesi oluştur
      socket.userId = token; // Guest token'ı userId olarak kullan
      socket.user = {
        _id: token,
        username: guestUsername || 'Misafir',
        isGuest: true,
        isOnline: true,
        avatar: null,
        currentRoom: null,
        socketId: socket.id,
        // Guest için dummy metodlar
        setOnline: async (socketId) => {
          socket.user.socketId = socketId;
          socket.user.isOnline = true;
          return Promise.resolve();
        },
        setOffline: async () => {
          socket.user.isOnline = false;
          return Promise.resolve();
        },
        save: async () => Promise.resolve()
      };
      
      return next();
    }
    
    // Normal kullanıcı JWT doğrulaması
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    
    socket.userId = decoded.userId;
    socket.user = user;
    next();
    
  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};

// Admin kontrolü
const requireAdmin = (req, res, next) => {
  // Bu middleware sadece belirli admin route'ları için kullanılabilir
  // Şimdilik basit bir kontrol, daha sonra genişletilebilir
  if (req.user && req.user.username === 'admin') {
    next();
  } else {
    res.status(403).json({
      error: 'Bu işlem için admin yetkisi gerekli'
    });
  }
};

module.exports = {
  authenticateToken,
  authenticateSocketToken,
  requireAdmin
};
