const { authenticateSocketToken } = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const mediasoupSocketHandler = require('../mediasoup/socketHandler');

// Socket.IO event handlers with Mediasoup SFU integration
module.exports = (io, redisLocationService) => {
  // Authentication middleware
  io.use(authenticateSocketToken);

  io.on('connection', async (socket) => {
    console.log(`✅ Kullanıcı bağlandı: ${socket.user.username} (${socket.id})`);

    // Initialize Mediasoup SFU handlers for this socket
    mediasoupSocketHandler(io, socket);

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
          return socket.emit('error', { message: 'Room ID gerekli' });
        }

        // Zaten aynı odadaysak işlem yapma (duplicate event guard)
        if (socket.user.currentRoom && socket.user.currentRoom.toString() === roomId.toString()) {
          console.log(`⚠️ ${socket.user.username} zaten odada: ${roomId}`);
          return;
        }

        console.log(`📍 ${socket.user.username} odaya katılıyor: ${roomId}`);

        // Eski odadan ayrıl
        if (socket.user.currentRoom) {
          socket.leave(socket.user.currentRoom.toString());
          socket.to(socket.user.currentRoom.toString()).emit('user_left', {
            user: {
              _id: socket.user._id,
              username: socket.user.username
            }
          });
        }

        // Yeni odaya katıl
        socket.join(roomId.toString());
        socket.user.currentRoom = roomId;
        await socket.user.save();

        // Oda bilgilerini al
        const room = await Room.findById(roomId).populate('users.user', 'username avatar isOnline');

        if (!room) {
          return socket.emit('error', { message: 'Oda bulunamadı' });
        }

        // Odadaki kullanıcıları al
        const roomUsers = await User.find({ currentRoom: roomId });

        socket.emit('room_joined', {
          room: {
            _id: room._id,
            name: room.name,
            type: room.type,
            location: room.location
          },
          users: roomUsers.map(u => ({
            _id: u._id,
            username: u.username,
            avatar: u.avatar,
            isOnline: u.isOnline,
            currentRoom: u.currentRoom
          }))
        });

        // Diğer kullanıcılara bildir
        socket.to(roomId.toString()).emit('user_joined', {
          user: {
            _id: socket.user._id,
            username: socket.user.username,
            avatar: socket.user.avatar,
            isOnline: true
          }
        });

        console.log(`✅ ${socket.user.username} odaya katıldı: ${room.name}`);

      } catch (error) {
        console.error('❌ Join room hatası:', error);
        socket.emit('error', { message: 'Odaya katılma hatası' });
      }
    });

    // Odadan ayrılma
    socket.on('leave_room', async (data) => {
      try {
        const { roomId } = data;

        if (!roomId) {
          return socket.emit('error', { message: 'Room ID gerekli' });
        }

        console.log(`🚪 ${socket.user.username} odadan ayrılıyor: ${roomId}`);

        socket.leave(roomId.toString());

        // Kullanıcıyı odadan çıkar
        socket.user.currentRoom = null;
        await socket.user.save();

        // Diğer kullanıcılara bildir
        socket.to(roomId.toString()).emit('user_left', {
          user: {
            _id: socket.user._id,
            username: socket.user.username
          }
        });

        socket.emit('room_left', { roomId });
        console.log(`✅ ${socket.user.username} odadan ayrıldı: ${roomId}`);

      } catch (error) {
        console.error('❌ Leave room hatası:', error);
        socket.emit('error', { message: 'Odadan ayrılma hatası' });
      }
    });

    // Mesaj gönderme
    socket.on('send_message', async (data) => {
      try {
        const { roomId, content } = data;

        if (!roomId || !content) {
          return socket.emit('error', { message: 'Room ID ve mesaj içeriği gerekli' });
        }

        const message = new Message({
          room: roomId,
          sender: socket.user._id,
          content,
          type: 'text'
        });

        await message.save();
        await message.populate('sender', 'username avatar');

        io.to(roomId.toString()).emit('new_message', {
          message: {
            _id: message._id,
            content: message.content,
            sender: {
              _id: message.sender._id,
              username: message.sender.username,
              avatar: message.sender.avatar
            },
            createdAt: message.createdAt
          }
        });

      } catch (error) {
        console.error('❌ Send message hatası:', error);
        socket.emit('error', { message: 'Mesaj gönderme hatası' });
      }
    });

    // Konum güncelleme (Redis ile)
    socket.on('update_location', async (data) => {
      try {
        const { latitude, longitude, roomId } = data;

        if (!latitude || !longitude) {
          return socket.emit('error', { message: 'Konum bilgisi gerekli' });
        }

        // Redis'e kaydet
        if (redisLocationService && redisLocationService.isConnected) {
          await redisLocationService.updateUserLocation(
            socket.userId.toString(),
            latitude,
            longitude,
            {
              username: socket.user.username,
              avatar: socket.user.avatar
            }
          );

          // Yakındaki kullanıcıları bul
          const nearbyUsers = await redisLocationService.findNearbyUsers(
            latitude,
            longitude,
            10 // 10km radius
          );

          socket.emit('nearby_users', { users: nearbyUsers });
        }

        // Odadaki diğer kullanıcılara bildir
        if (roomId) {
          socket.to(roomId.toString()).emit('user_location_updated', {
            userId: socket.user._id,
            username: socket.user.username,
            location: { latitude, longitude }
          });
        }

      } catch (error) {
        console.error('❌ Update location hatası:', error);
        socket.emit('error', { message: 'Konum güncelleme hatası' });
      }
    });

    // Konuşma başladı
    socket.on('start_talking', async (data) => {
      try {
        const { roomId } = data;

        if (!roomId) {
          return socket.emit('error', { message: 'Room ID gerekli' });
        }

        console.log(`🎤 ${socket.user.username} konuşmaya başladı`);

        // Odadaki diğer kullanıcılara bildir (userId formatında)
        socket.to(roomId.toString()).emit('user_started_talking', {
          userId: socket.user._id.toString(), // userId olarak gönder
          username: socket.user.username,
          avatar: socket.user.avatar
        });

      } catch (error) {
        console.error('❌ Start talking hatası:', error);
        socket.emit('error', { message: 'Konuşma başlatma hatası' });
      }
    });

    // Konuşma bitti
    socket.on('stop_talking', async (data) => {
      try {
        const { roomId } = data;

        if (!roomId) {
          return socket.emit('error', { message: 'Room ID gerekli' });
        }

        console.log(`🔇 ${socket.user.username} konuşmayı bitirdi`);

        // Odadaki diğer kullanıcılara bildir (userId formatında)
        socket.to(roomId.toString()).emit('user_stopped_talking', {
          userId: socket.user._id.toString(), // userId olarak gönder
          username: socket.user.username
        });

      } catch (error) {
        console.error('❌ Stop talking hatası:', error);
        socket.emit('error', { message: 'Konuşma durdurma hatası' });
      }
    });

    // Bağlantı koptuğunda
    socket.on('disconnect', async () => {
      try {
        console.log(`❌ Kullanıcı bağlantısı kesildi: ${socket.user.username}`);

        // Kullanıcıyı offline yap
        await socket.user.setOffline();

        // Odadan ayrıl
        if (socket.user.currentRoom) {
          socket.to(socket.user.currentRoom.toString()).emit('user_left', {
            user: {
              _id: socket.user._id,
              username: socket.user.username
            }
          });
        }

        // Redis'ten konum bilgisini sil
        if (redisLocationService && redisLocationService.isConnected && typeof redisLocationService.removeUserLocation === 'function') {
          await redisLocationService.removeUserLocation(socket.user._id.toString());
        }

      } catch (error) {
        console.error('❌ Disconnect hatası:', error);
      }
    });

    // Ping/Pong for latency check
    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback();
      }
    });

    // Hata yakalama
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.user.username}:`, error);
      socket.emit('error', { message: 'Bağlantı hatası oluştu' });
    });
  });

  // Mediasoup SFU - Event listeners handled in mediasoup/socketHandler.js
  console.log('✅ Socket.IO handlers initialized with Mediasoup SFU');
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
