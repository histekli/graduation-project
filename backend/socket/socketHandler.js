const { authenticateSocketToken } = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');

// Socket.IO event handlers
module.exports = (io) => {
  // Authentication middleware
  io.use(authenticateSocketToken);
  
  io.on('connection', async (socket) => {
    console.log(`✅ Kullanıcı bağlandı: ${socket.user.username} (${socket.id})`);
    
    try {
      // Kullanıcıyı online yap ve socket ID'yi kaydet
      await socket.user.setOnline(socket.id);
      
      // Kullanıcının mevcut odasını kontrol et
      if (socket.user.currentRoom) {
        socket.join(socket.user.currentRoom.toString());
        
        // Odadaki diğer kullanıcılara bildir
        socket.to(socket.user.currentRoom.toString()).emit('user_joined', {
          user: {
            _id: socket.user._id,
            username: socket.user.username,
            avatar: socket.user.avatar,
            isOnline: true
          }
        });
      }
      
    } catch (error) {
      console.error('Connection setup error:', error);
    }
    
    // Odaya katılma
    socket.on('join_room', async (data) => {
      try {
        const { roomId } = data;
        
        if (!roomId) {
          return socket.emit('room_error', { message: 'Oda ID\'si gerekli' });
        }
        
        const room = await Room.findById(roomId)
          .populate('users.user', 'username avatar isOnline location');
        
        if (!room) {
          return socket.emit('room_error', { message: 'Oda bulunamadı' });
        }
        
        // Kullanıcı zaten aynı odada mı kontrol et
        if (socket.user.currentRoom && socket.user.currentRoom.toString() === roomId) {
          console.log(`👤 ${socket.user.username} zaten odada: ${roomId}`);
          
          // Sadece kullanıcı listesini güncelleyelim, gereksiz bildirimler göndermeyelim
          const roomUsers = await User.find({ currentRoom: roomId })
            .select('username avatar isOnline location lastSeen');
            
          // Sessiz bir şekilde odaya tekrar katıldı olarak işaretle
          socket.emit('room_joined', {
            room,
            users: roomUsers,
            message: 'Zaten bu odasınız',
            silent: true // Frontend'de kullanılabilecek bir işaret
          });
          
          return;
        }
        
        // Eski odadan çık
        socket.rooms.forEach(roomName => {
          if (roomName !== socket.id) {
            socket.leave(roomName);
            
            // Eski odadaki kullanıcılara bildir
            socket.to(roomName).emit('user_left', {
              userId: socket.userId,
              username: socket.user.username
            });
          }
        });
        
        // Yeni odaya katıl
        socket.join(roomId);
        
        // Kullanıcının mevcut odasını güncelle
        await User.findByIdAndUpdate(socket.userId, { currentRoom: roomId });
        
        // Oda kullanıcılarını getir
        const roomUsers = await User.find({ currentRoom: roomId })
          .select('username avatar isOnline location lastSeen');
        
        // Tam kullanıcı verisiyle kullanıcı bilgisi oluştur
        const currentUser = {
          _id: socket.userId,
          username: socket.user.username,
          avatar: socket.user.avatar,
          isOnline: true,
          location: socket.user.location
        };
        
        // Odadaki diğer kullanıcılara bildir - standart format
        socket.to(roomId).emit('user_joined', {
          user: currentUser
        });
        
        // Kullanıcıya oda bilgilerini gönder - room_created flag ekledik
        // Bu flag ile yeni oda oluşturulduğunda fazladan bildirimleri engelliyoruz
        socket.emit('room_joined', {
          room,
          users: roomUsers,
          message: 'Odaya başarıyla katıldınız',
          room_created: room.creator && room.creator.toString() === socket.userId.toString()
        });
        
        // Tüm odaya güncellenmiş kullanıcı listesi gönder
        io.to(roomId).emit('room_users_updated', roomUsers);
        
      } catch (error) {
        console.error('Join room error:', error);
        socket.emit('room_error', { message: 'Odaya katılırken hata oluştu' });
      }
    });
    
    // Odadan ayrılma
    socket.on('leave_room', async (data) => {
      try {
        const { roomId } = data;
        
        if (!roomId) {
          return socket.emit('room_error', { message: 'Oda ID\'si gerekli' });
        }
        
        console.log(`👋 ${socket.user.username} odadan ayrılıyor: ${roomId}`);
        
        // Socketi odadan çıkar
        socket.leave(roomId);
        
        // Kullanıcının mevcut odasını temizle - her durumda temizleyelim
        await User.findByIdAndUpdate(socket.userId, { currentRoom: null });
        
        // Kullanıcıyı MongoDB'deki room.users listesinden çıkar
        try {
          const room = await Room.findById(roomId);
          if (room) {
            // Kullanıcı odada mı kontrol et
            const userIndex = room.users.findIndex(u => 
              u.user.toString() === socket.userId.toString()
            );
            
            if (userIndex >= 0) {
              room.users.splice(userIndex, 1);
              await room.save();
              console.log(`✅ ${socket.user.username} oda listesinden çıkarıldı`);
            }
          }
        } catch (roomErr) {
          console.error('Oda güncelleme hatası:', roomErr);
          // Bu hatayı kullanıcıya bildirmiyoruz, işleme devam ediyoruz
        }
        
        // Odadaki diğer kullanıcılara bildir - standart format
        socket.to(roomId).emit('user_left', {
          userId: socket.userId,
          username: socket.user.username
        });
        
        // Güncellenmiş kullanıcı listesi
        const roomUsers = await User.find({ currentRoom: roomId })
          .select('username avatar isOnline location lastSeen');
        
        io.to(roomId).emit('room_users_updated', roomUsers);
        
        // Kullanıcıya bildirimi gönder
        socket.emit('room_left', { message: 'Odadan ayrıldınız' });
        
      } catch (error) {
        console.error('Leave room error:', error);
        socket.emit('room_error', { message: 'Odadan ayrılırken hata oluştu' });
        
        // Hata durumunda bile kullanıcının currentRoom'unu temizlemeye çalışalım
        try {
          await User.findByIdAndUpdate(socket.userId, { currentRoom: null });
        } catch (cleanupErr) {
          console.error('Final cleanup error:', cleanupErr);
        }
      }
    });
    
    // WebRTC Sinyalleşme - Offer
    socket.on('webrtc_offer', (data) => {
      const { targetUserId, offer, roomId } = data;
      
      // Hedef kullanıcının socket'ini bul
      const targetSocket = findSocketByUserId(io, targetUserId);
      
      if (targetSocket) {
        targetSocket.emit('webrtc_offer', {
          fromUserId: socket.userId,
          fromUsername: socket.user.username,
          offer,
          roomId
        });
        console.log(`📞 WebRTC offer: ${socket.user.username} -> ${targetUserId}`);
      } else {
        socket.emit('webrtc_error', { message: 'Hedef kullanıcı çevrimiçi değil' });
      }
    });
    
    // WebRTC Sinyalleşme - Answer
    socket.on('webrtc_answer', (data) => {
      const { targetUserId, answer, roomId } = data;
      
      const targetSocket = findSocketByUserId(io, targetUserId);
      
      if (targetSocket) {
        targetSocket.emit('webrtc_answer', {
          fromUserId: socket.userId,
          fromUsername: socket.user.username,
          answer,
          roomId
        });
        console.log(`📞 WebRTC answer: ${socket.user.username} -> ${targetUserId}`);
      }
    });
    
    // WebRTC Sinyalleşme - ICE Candidate
    socket.on('ice_candidate', (data) => {
      const { targetUserId, candidate, roomId } = data;
      
      const targetSocket = findSocketByUserId(io, targetUserId);
      
      if (targetSocket) {
        targetSocket.emit('ice_candidate', {
          fromUserId: socket.userId,
          candidate,
          roomId
        });
      }
    });
    
    // Mesaj gönderme
    socket.on('send_message', async (data) => {
      try {
        const { roomId, content, type = 'text', replyTo } = data;
        
        if (!roomId || !content?.trim()) {
          return socket.emit('error', { message: 'Oda ID\'si ve mesaj içeriği gerekli' });
        }
        
        const room = await Room.findById(roomId);
        
        if (!room || !room.hasUser(socket.userId)) {
          return socket.emit('error', { message: 'Bu odaya mesaj gönderme izniniz yok' });
        }
        
        if (!room.settings.allowChat) {
          return socket.emit('error', { message: 'Bu odada sohbet devre dışı' });
        }
        
        const message = new Message({
          sender: socket.userId,
          room: roomId,
          content: content.trim(),
          type,
          metadata: {
            replyTo: replyTo || null
          }
        });
        
        await message.save();
        await message.populate('sender', 'username avatar');
        
        // Odadaki tüm kullanıcılara mesajı gönder
        io.to(roomId).emit('new_message', { message });
        
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Mesaj gönderilirken hata oluştu' });
      }
    });
    
    // Oda kullanıcılarını getir - yeni eklendi
    socket.on('get_room_users', async (data) => {
      try {
        const { roomId } = data;
        
        if (!roomId) {
          return socket.emit('room_error', { message: 'Oda ID\'si gerekli' });
        }
        
        // Odadaki tüm kullanıcıları getir
        const roomUsers = await User.find({ currentRoom: roomId })
          .select('username avatar isOnline location lastSeen');
        
        // Sadece isteyen kullanıcıya gönder
        socket.emit('room_users_updated', roomUsers);
        
      } catch (error) {
        console.error('Get room users error:', error);
        socket.emit('room_error', { message: 'Kullanıcı listesi alınırken hata oluştu' });
      }
    });
    
    // Konum güncelleme
    socket.on('location_update', async (data) => {
      try {
        const { longitude, latitude, accuracy, timestamp } = data;
        
        if (!longitude || !latitude) {
          return socket.emit('location_error', { message: 'Enlem ve boylam gerekli' });
        }
        
        // Kullanıcı konumunu güncelle
        await User.findByIdAndUpdate(socket.userId, {
          location: {
            type: 'Point',
            coordinates: [longitude, latitude],
            accuracy,
            timestamp: timestamp || new Date()
          }
        });
        
        // Kullanıcının bulunduğu odaya konum güncellemesini gönder
        if (socket.user.currentRoom) {
          socket.to(socket.user.currentRoom.toString()).emit('user_location_update', {
            userId: socket.userId,
            username: socket.user.username,
            location: {
              latitude,
              longitude,
              accuracy,
              timestamp: timestamp || new Date()
            }
          });
        }
        
        console.log(`📍 Konum güncellendi: ${socket.user.username} - ${latitude}, ${longitude}`);
        
      } catch (error) {
        console.error('Update location error:', error);
        socket.emit('location_error', { message: 'Konum güncellenirken hata oluştu' });
      }
    });
    
    // Konuşma başlatma - standardı alt çizgi olarak belirledik
    socket.on('start_talking', handleStartTalking);
    
    // Konuşma başlatma işleyicisi
    async function handleStartTalking(data) {
      try {
        const { roomId } = data;
        
        if (!roomId) {
          return socket.emit('voice_error', { message: 'Oda ID\'si gerekli' });
        }
        
        // Odadaki diğer kullanıcılara bildir - tek bir kez gönder
        socket.to(roomId).emit('user_started_talking', {
          userId: socket.userId,
          username: socket.user.username
        });
        
        console.log(`🎤 Konuşma başlatıldı: ${socket.user.username}`);
        
      } catch (error) {
        console.error('Start talking error:', error);
        socket.emit('voice_error', { message: 'Konuşma başlatılırken hata oluştu' });
      }
    }
    
    // Konuşma bitirme - standardı alt çizgi olarak belirledik
    socket.on('stop_talking', handleStopTalking);
    
    // Konuşma bitirme işleyicisi
    async function handleStopTalking(data) {
      try {
        const { roomId } = data;
        
        if (!roomId) {
          return socket.emit('voice_error', { message: 'Oda ID\'si gerekli' });
        }
        
        // Odadaki diğer kullanıcılara bildir
        socket.to(roomId).emit('user_stopped_talking', {
          userId: socket.userId,
          username: socket.user.username
        });
        
        console.log(`🤫 Konuşma bitirildi: ${socket.user.username}`);
        
      } catch (error) {
        console.error('Stop talking error:', error);
        socket.emit('voice_error', { message: 'Konuşma bitirilirken hata oluştu' });
      }
    }
    
    // Kullanıcı durumu (mute/unmute)
    socket.on('toggle_mute', async (data) => {
      try {
        const { roomId, isMuted } = data;
        
        if (!roomId) {
          return socket.emit('error', { message: 'Oda ID\'si gerekli' });
        }
        
        const room = await Room.findById(roomId);
        
        if (!room || !room.hasUser(socket.userId)) {
          return socket.emit('error', { message: 'Bu odada değilsiniz' });
        }
        
        await room.toggleMute(socket.userId, isMuted);
        
        // Odadaki diğer kullanıcılara bildir
        socket.to(roomId).emit('user_mute_changed', {
          userId: socket.userId,
          username: socket.user.username,
          isMuted
        });
        
        socket.emit('mute_toggled', { isMuted });
        
      } catch (error) {
        console.error('Toggle mute error:', error);
        socket.emit('error', { message: 'Sessize alma durumu değiştirilirken hata oluştu' });
      }
    });
    
    // Bağlantı kesilme
    socket.on('disconnect', async (reason) => {
      console.log(`❌ Kullanıcı bağlantısı kesildi: ${socket.user.username} - Sebep: ${reason}`);
      
      try {
        // Kullanıcıyı offline yap
        await socket.user.setOffline();
        
        // Mevcut odaya bildir
        if (socket.user.currentRoom) {
          socket.to(socket.user.currentRoom.toString()).emit('user_left', {
            userId: socket.userId,
            username: socket.user.username,
            reason: 'disconnected'
          });
        }
        
      } catch (error) {
        console.error('Disconnect cleanup error:', error);
      }
    });
    
    // Hata yakalama
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.user.username}:`, error);
      socket.emit('error', { message: 'Bağlantı hatası oluştu' });
    });
  });
};

// Yardımcı fonksiyon: Kullanıcı ID'sine göre socket bul
function findSocketByUserId(io, userId) {
  for (let [socketId, socket] of io.sockets.sockets) {
    if (socket.userId === userId) {
      return socket;
    }
  }
  return null;
}
