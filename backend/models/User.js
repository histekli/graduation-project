const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Kullanıcı adı gerekli'],
    unique: true,
    trim: true,
    minlength: [3, 'Kullanıcı adı en az 3 karakter olmalı'],
    maxlength: [20, 'Kullanıcı adı en fazla 20 karakter olabilir']
  },
  email: {
    type: String,
    required: [true, 'E-posta adresi gerekli'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Geçerli bir e-posta adresi girin']
  },
  password: {
    type: String,
    required: [true, 'Şifre gerekli'],
    minlength: [6, 'Şifre en az 6 karakter olmalı']
  },
  avatar: {
    type: String,
    default: null
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  currentRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    },
    address: {
      type: String,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  socketId: {
    type: String,
    default: null
  },
  deviceInfo: {
    type: String,
    default: 'web'
  }
}, {
  timestamps: true
});

// Geolocation index
userSchema.index({ location: '2dsphere' });

// Password hash middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Update location method
userSchema.methods.updateLocation = function(longitude, latitude, address = '') {
  this.location = {
    type: 'Point',
    coordinates: [longitude, latitude],
    address,
    timestamp: new Date()
  };
  return this.save();
};

// Set online status
userSchema.methods.setOnline = function(socketId) {
  this.isOnline = true;
  this.socketId = socketId;
  this.lastSeen = new Date();
  return this.save();
};

// Set offline status
userSchema.methods.setOffline = function() {
  this.isOnline = false;
  this.socketId = null;
  this.lastSeen = new Date();
  return this.save();
};

// JSON transformation
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.socketId;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
