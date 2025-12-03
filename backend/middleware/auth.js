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
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
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

module.exports = {
  authenticateToken,
  authenticateSocketToken
};
