const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Mesaj içeriği gerekli'],
    maxlength: [1000, 'Mesaj en fazla 1000 karakter olabilir']
  },
  type: {
    type: String,
    enum: ['text', 'location', 'system', 'file'],
    default: 'text'
  },
  location: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: [Number], // [longitude, latitude]
    address: String
  },
  metadata: {
    edited: {
      type: Boolean,
      default: false
    },
    editedAt: Date,
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    fileUrl: String,
    fileName: String,
    fileSize: Number
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries
messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

// Mark message as read by user
messageSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(r => r.user.toString() === userId.toString());
  
  if (!existingRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Edit message content
messageSchema.methods.editContent = function(newContent) {
  this.content = newContent;
  this.metadata.edited = true;
  this.metadata.editedAt = new Date();
  return this.save();
};

// Soft delete message
messageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.content = 'Bu mesaj silindi';
  return this.save();
};

module.exports = mongoose.model('Message', messageSchema);
