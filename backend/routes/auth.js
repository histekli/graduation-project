const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Kayıt ol
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, deviceInfo = 'web' } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Kullanıcı adı, e-posta ve şifre gerekli'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Kullanıcı adı veya e-posta zaten kullanımda'
      });
    }

    // Create user
    const user = new User({
      username,
      email,
      password,
      deviceInfo
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu',
      user: user.toJSON(),
      token
    });

  } catch (error) {
    console.error('Register error:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Kullanıcı adı veya e-posta zaten kullanımda'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: Object.values(error.errors).map(e => e.message).join(', ')
      });
    }

    res.status(500).json({
      error: 'Kayıt sırasında bir hata oluştu'
    });
  }
});

// Giriş yap
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'E-posta ve şifre gerekli'
      });
    }

    // Find user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        error: 'Geçersiz e-posta veya şifre'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Geçersiz e-posta veya şifre'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    res.json({
      message: 'Giriş başarılı',
      user: user.toJSON(),
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Giriş sırasında bir hata oluştu'
    });
  }
});

// Token doğrulama
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token gerekli'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'Geçersiz token'
      });
    }

    res.json({
      valid: true,
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      valid: false,
      error: 'Geçersiz token'
    });
  }
});

// Şifre değiştirme
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Mevcut şifre ve yeni şifre gerekli'
      });
    }

    // Middleware tarafından req.userId'den kullanıcıyı al
    const user = await User.findById(req.userId).select('+password');

    if (!user) {
      return res.status(401).json({
        error: 'Kullanıcı bulunamadı'
      });
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        error: 'Mevcut şifre yanlış'
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Şifre başarıyla değiştirildi'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Şifre değiştirme sırasında bir hata oluştu'
    });
  }
});

module.exports = router;
