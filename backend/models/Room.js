const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Oda adı gerekli'],
    trim: true,
    maxlength: [50, 'Oda adı en fazla 50 karakter olabilir']
  },
  description: {
    type: String,
    maxlength: [200, 'Açıklama en fazla 200 karakter olabilir']
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  password: {
    type: String,
    default: null // Eğer özel oda ise şifre gerekli
  },
  maxUsers: {
    type: Number,
    default: 10,
    min: [2, 'En az 2 kullanıcı olmalı'],
    max: [50, 'En fazla 50 kullanıcı olabilir']
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  users: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['admin', 'moderator', 'user'],
      default: 'user'
    },
    isMuted: {
      type: Boolean,
      default: false
    },
    isListenOnly: {
      type: Boolean,
      default: false
    }
  }],
  settings: {
    allowChat: {
      type: Boolean,
      default: true
    },
    allowLocationSharing: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    recordConversations: {
      type: Boolean,
      default: false
    }
  },
  region: {
    type: {
      type: String,
      enum: ['Point', 'Polygon'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude] for Point
      default: [0, 0]
    },
    radius: {
      type: Number,
      default: 1000 // meters
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Geolocation index
roomSchema.index({ region: '2dsphere' });

// User count virtual
roomSchema.virtual('userCount').get(function() {
  return this.users.length;
});

// Add user to room
roomSchema.methods.addUser = function(userId, role = 'user') {
  const existingUser = this.users.find(u => u.user.toString() === userId.toString());
  
  if (existingUser) {
    throw new Error('Kullanıcı zaten odada');
  }
  
  if (this.users.length >= this.maxUsers) {
    throw new Error('Oda dolu');
  }
  
  this.users.push({
    user: userId,
    role,
    joinedAt: new Date()
  });
  
  return this.save();
};

// Remove user from room
roomSchema.methods.removeUser = function(userId) {
  this.users = this.users.filter(u => u.user.toString() !== userId.toString());
  return this.save();
};

// Get user role in room
roomSchema.methods.getUserRole = function(userId) {
  const user = this.users.find(u => u.user.toString() === userId.toString());
  return user ? user.role : null;
};

// Check if user is in room
roomSchema.methods.hasUser = function(userId) {
  return this.users.some(u => u.user.toString() === userId.toString());
};

// Mute/unmute user
roomSchema.methods.toggleMute = function(userId, isMuted) {
  const user = this.users.find(u => u.user.toString() === userId.toString());
  if (user) {
    user.isMuted = isMuted;
    return this.save();
  }
  throw new Error('Kullanıcı odada bulunamadı');
};

// Set listen only mode
roomSchema.methods.setListenOnly = function(userId, isListenOnly) {
  const user = this.users.find(u => u.user.toString() === userId.toString());
  if (user) {
    user.isListenOnly = isListenOnly;
    return this.save();
  }
  throw new Error('Kullanıcı odada bulunamadı');
};

module.exports = mongoose.model('Room', roomSchema);
