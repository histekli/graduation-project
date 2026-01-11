const express = require('express');
const Room = require('../models/Room');
const User = require('../models/User');
const Message = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Tüm odaları listele (public)
router.get('/public', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;

    const query = {
      isPublic: true,
      isActive: true
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const rooms = await Room.find(query)
      .populate('creator', 'username avatar')
      .populate('users.user', 'username avatar isOnline')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Room.countDocuments(query);

    res.json({
      rooms,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalRooms: total
    });

  } catch (error) {
    console.error('Get public rooms error:', error);
    res.status(500).json({
      error: 'Odalar yüklenirken hata oluştu'
    });
  }
});

// Oda oluştur
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { name, description, isPublic = true, password, maxUsers = 10, settings = {} } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Oda adı gerekli'
      });
    }

    // Check if room name exists
    const existingRoom = await Room.findOne({ name, isActive: true });
    if (existingRoom) {
      return res.status(409).json({
        error: 'Bu isimde bir oda zaten mevcut'
      });
    }

    const room = new Room({
      name,
      description,
      isPublic,
      password: isPublic ? null : password,
      maxUsers,
      creator: req.userId,
      settings: {
        allowChat: true,
        allowLocationSharing: true,
        requireApproval: false,
        recordConversations: false,
        ...settings
      }
    });

    // Add creator as admin
    await room.addUser(req.userId, 'admin');

    await room.populate([
      { path: 'creator', select: 'username avatar' },
      { path: 'users.user', select: 'username avatar isOnline' }
    ]);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('room_created', room);
    }

    res.status(201).json({
      message: 'Oda başarıyla oluşturuldu',
      room
    });

  } catch (error) {
    console.error('Create room error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: Object.values(error.errors).map(e => e.message).join(', ')
      });
    }

    res.status(500).json({
      error: 'Oda oluşturulurken hata oluştu'
    });
  }
});

// Odaya katıl
router.post('/:roomId/join', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { password } = req.body;

    const room = await Room.findById(roomId);

    if (!room || !room.isActive) {
      return res.status(404).json({
        error: 'Oda bulunamadı'
      });
    }

    // Check password for private rooms
    if (!room.isPublic && room.password !== password) {
      return res.status(401).json({
        error: 'Yanlış şifre'
      });
    }

    // Check if already in room - if so, just update timestamp and return success (Idempotency)
    if (room.hasUser(req.userId)) {
      console.log(`ℹ️ User ${req.userId} already in room ${roomId}, updating session...`);

      // Update joinedAt timestamp
      const userIndex = room.users.findIndex(u => u.user.toString() === req.userId);
      if (userIndex !== -1) {
        room.users[userIndex].joinedAt = new Date();
        await room.save();
      }

      // Ensure user currentRoom is set correctly
      await User.findByIdAndUpdate(req.userId, { currentRoom: roomId });

      await room.populate([
        { path: 'creator', select: 'username avatar' },
        { path: 'users.user', select: 'username avatar isOnline' }
      ]);

      return res.json({
        message: 'Odaya tekrar katıldınız',
        room
      });
    }

    await room.addUser(req.userId);

    // Update user's current room
    await User.findByIdAndUpdate(req.userId, { currentRoom: roomId });

    await room.populate([
      { path: 'creator', select: 'username avatar' },
      { path: 'users.user', select: 'username avatar isOnline' }
    ]);

    res.json({
      message: 'Odaya başarıyla katıldınız',
      room
    });

  } catch (error) {
    console.error('Join room error:', error);

    if (error.message.includes('Oda dolu')) {
      return res.status(409).json({
        error: error.message
      });
    }

    res.status(500).json({
      error: 'Odaya katılırken hata oluştu'
    });
  }
});

// Odadan ayrıl
router.post('/:roomId/leave', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        error: 'Oda bulunamadı'
      });
    }

    if (!room.hasUser(req.userId)) {
      return res.status(409).json({
        error: 'Bu odada değilsiniz'
      });
    }

    await room.removeUser(req.userId);

    // Clear user's current room
    await User.findByIdAndUpdate(req.userId, { currentRoom: null });

    res.json({
      message: 'Odadan başarıyla ayrıldınız'
    });

  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({
      error: 'Odadan ayrılırken hata oluştu'
    });
  }
});

// Oda detaylarını getir
router.get('/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId)
      .populate('creator', 'username avatar')
      .populate('users.user', 'username avatar isOnline location');

    if (!room) {
      return res.status(404).json({
        error: 'Oda bulunamadı'
      });
    }

    // Check if user has access
    if (!room.isPublic && !room.hasUser(req.userId) && room.creator._id.toString() !== req.userId) {
      return res.status(403).json({
        error: 'Bu odaya erişim izniniz yok'
      });
    }

    res.json({ room });

  } catch (error) {
    console.error('Get room details error:', error);
    res.status(500).json({
      error: 'Oda detayları yüklenirken hata oluştu'
    });
  }
});

// Oda sil (sadece oda sahibi)
router.delete('/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        error: 'Oda bulunamadı'
      });
    }

    // Check if user is room creator
    if (room.creator.toString() !== req.userId) {
      return res.status(403).json({
        error: 'Sadece oda sahibi odayı silebilir'
      });
    }

    // Mark room as inactive instead of deleting
    room.isActive = false;
    await room.save();

    // Clear current room for all users in this room
    await User.updateMany(
      { currentRoom: roomId },
      { currentRoom: null }
    );

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('room_deleted', roomId);
    }

    res.json({
      message: 'Oda başarıyla silindi'
    });

  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({
      error: 'Oda silinirken hata oluştu'
    });
  }
});

// Oda mesajlarını getir
router.get('/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        error: 'Oda bulunamadı'
      });
    }

    // Sadece private odalarda user kontrolü yap
    if (!room.isPublic && !room.hasUser(req.userId) && room.creator.toString() !== req.userId) {
      return res.status(403).json({
        error: 'Bu odanın mesajlarını görme izniniz yok'
      });
    }

    const messages = await Message.find({
      room: roomId,
      isDeleted: false
    })
      .populate('sender', 'username avatar')
      .populate('metadata.replyTo', 'content sender')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      hasMore: messages.length === limit
    });

  } catch (error) {
    console.error('Get room messages error:', error);
    res.status(500).json({
      error: 'Mesajlar yüklenirken hata oluştu'
    });
  }
});

module.exports = router;
