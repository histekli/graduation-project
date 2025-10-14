const express = require('express');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Kullanıcı profilini getir
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('currentRoom', 'name description');
    
    if (!user) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı'
      });
    }
    
    res.json({ user });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Profil yüklenirken hata oluştu'
    });
  }
});

// Kullanıcı konumunu güncelle
router.post('/location', authenticateToken, async (req, res) => {
  try {
    const { longitude, latitude, address = '' } = req.body;
    
    if (!longitude || !latitude) {
      return res.status(400).json({
        error: 'Enlem ve boylam gerekli'
      });
    }
    
    // Validate coordinates
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        error: 'Geçersiz koordinatlar'
      });
    }
    
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı'
      });
    }
    
    await user.updateLocation(longitude, latitude, address);
    
    res.json({
      message: 'Konum güncellendi',
      location: user.location
    });
    
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      error: 'Konum güncellenirken hata oluştu'
    });
  }
});

// Yakındaki kullanıcıları bul
router.get('/nearby', authenticateToken, async (req, res) => {
  try {
    const { radius = 1000 } = req.query; // meters
    
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser || !currentUser.location.coordinates[0]) {
      return res.status(400).json({
        error: 'Önce konumunuzu paylaşmanız gerekli'
      });
    }
    
    const [longitude, latitude] = currentUser.location.coordinates;
    
    const nearbyUsers = await User.find({
      _id: { $ne: req.userId },
      isOnline: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: parseInt(radius)
        }
      }
    }).select('username avatar location isOnline lastSeen');
    
    res.json({ users: nearbyUsers });
    
  } catch (error) {
    console.error('Get nearby users error:', error);
    res.status(500).json({
      error: 'Yakındaki kullanıcılar yüklenirken hata oluştu'
    });
  }
});

// Profil güncelle
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { username, avatar } = req.body;
    
    const updateData = {};
    
    if (username) {
      // Check if username is taken by another user
      const existingUser = await User.findOne({
        username,
        _id: { $ne: req.userId }
      });
      
      if (existingUser) {
        return res.status(409).json({
          error: 'Bu kullanıcı adı zaten alınmış'
        });
      }
      
      updateData.username = username;
    }
    
    if (avatar !== undefined) {
      updateData.avatar = avatar;
    }
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    ).populate('currentRoom', 'name description');
    
    res.json({
      message: 'Profil güncellendi',
      user
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: Object.values(error.errors).map(e => e.message).join(', ')
      });
    }
    
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Bu kullanıcı adı zaten alınmış'
      });
    }
    
    res.status(500).json({
      error: 'Profil güncellenirken hata oluştu'
    });
  }
});

// Çevrimiçi kullanıcıları listele
router.get('/online', async (req, res) => {
  try {
    const onlineUsers = await User.find({
      isOnline: true
    }).select('username avatar location lastSeen currentRoom')
      .populate('currentRoom', 'name');
    
    res.json({ users: onlineUsers });
    
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({
      error: 'Çevrimiçi kullanıcılar yüklenirken hata oluştu'
    });
  }
});

module.exports = router;
