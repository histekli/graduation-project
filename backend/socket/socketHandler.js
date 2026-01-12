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

    console.log(`🔍 [DEBUG] Socket handlers initialized for ${socket.user.username}, Redis available: ${!!redisLocationService}`);

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

        // Zaten aynı odadaysak bile socket'i odaya dahil et (Reconnect senaryosu)
        // if (socket.user.currentRoom && socket.user.currentRoom.toString() === roomId.toString()) {
        //   console.log(`ℹ️ ${socket.user.username} zaten odada, socket odası güncelleniyor: ${roomId}`);
        // }

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
        await User.findByIdAndUpdate(socket.user._id, { currentRoom: roomId });
        socket.user.currentRoom = roomId; // Update local socket user object for immediate use

        // Oda bilgilerini al
        const room = await Room.findById(roomId).populate('users.user', 'username avatar isOnline');

        if (!room) {
          return socket.emit('error', { message: 'Oda bulunamadı' });
        }

        // Odadaki kullanıcıları al
        const roomUsers = await User.find({ currentRoom: roomId });
        console.log(`👥 [DEBUG] Odadaki Kullanıcılar (${room.name}):`, roomUsers.map(u => `${u.username} (${u._id})`));

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

        // Send existing producers to the newly joined user
        // This ensures they receive all current producers immediately without race conditions
        const mediasoupManager = require('../mediasoup/manager');
        const existingProducers = mediasoupManager.getProducersInRoom(roomId, socket.user._id.toString());

        if (existingProducers.length > 0) {
          console.log(`📡 Sending ${existingProducers.length} existing producers to ${socket.user.username}`);

          // Emit newProducer event for each existing producer to this socket only
          for (const producer of existingProducers) {
            socket.emit('newProducer', {
              producerId: producer.producerId,
              peerId: producer.peerId,
              kind: producer.kind
            });
            console.log(`  📤 Sent existing producer ${producer.producerId} from peer ${producer.peerId}`);
          }
        }

        // Send existing user locations to the newly joined user
        if (redisLocationService && redisLocationService.isConnected) {
          const userIds = roomUsers.map(u => u._id.toString());
          const locations = await redisLocationService.getRoomUserLocations(roomId, userIds);

          if (locations.length > 0) {
            // Send all existing locations at once
            socket.emit('room_locations_initial', { locations });
            console.log(`📍 ${locations.length} konum bilgisi gönderildi: ${socket.user.username}`);
          }

          // Also broadcast THIS user's location to others in the room (if they have one)
          const myLocation = await redisLocationService.getUserLocation(socket.user._id.toString());
          if (myLocation) {
            socket.to(roomId.toString()).emit('user_location_update', {
              userId: socket.user._id.toString(),
              username: socket.user.username,
              location: {
                latitude: myLocation.latitude,
                longitude: myLocation.longitude,
                timestamp: myLocation.timestamp || Date.now()
              }
            });
            console.log(`📡 Yeni katılan kullanıcının konumu broadcast edildi: ${socket.user.username} → room ${roomId}`);
          }
        }

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
        await User.findByIdAndUpdate(socket.user._id, { currentRoom: null });
        socket.user.currentRoom = null;

        // Diğer kullanıcılara bildir
        socket.to(roomId.toString()).emit('user_left', {
          user: {
            _id: socket.user._id,
            username: socket.user.username
          }
        });

        socket.emit('room_left', { roomId });
        console.log(`✅ ${socket.user.username} odadan ayrıldı: ${roomId}`);

        const remainingUsers = await User.find({ currentRoom: roomId });
        console.log(`👥 [DEBUG] Odada Kalanlar:`, remainingUsers.map(u => `${u.username} (${u._id})`));

        // Mediasoup Cleanup - Kullanıcı odadan manuel çıkarsa kaynaklarını temizle (Zombie Producer Önleme)
        const mediasoupManager = require('../mediasoup/manager');
        await mediasoupManager.cleanupSocket(socket.id);

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

    // Konum güncelleme (Frontend'den 'location_update' geliyor)
    console.log(`📍 [INIT] Location update handler kaydediliyor for ${socket.user.username}`);
    socket.on('location_update', async (data) => {
      console.log('🔔 [DEBUG] Location update event alındı:', {
        user: socket.user?.username,
        data,
        hasRedis: !!redisLocationService,
        redisConnected: redisLocationService?.isConnected,
        currentRoom: socket.user?.currentRoom
      });

      try {
        const { latitude, longitude } = data;
        const roomId = socket.user.currentRoom;

        if (!latitude || !longitude) {
          console.warn('⚠️ Eksik konum bilgisi:', data);
          return;
        }

        // Redis'e kaydet (GEO ile)
        if (redisLocationService && redisLocationService.isConnected) {
          await redisLocationService.setUserLocation(socket.user._id.toString(), {
            latitude,
            longitude,
            username: socket.user.username,
            avatar: socket.user.avatar,
            roomId: roomId ? roomId.toString() : null
          });

          console.log(`📍 ${socket.user.username} konumu güncellendi: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } else {
          console.warn('⚠️ Redis bağlı değil, konum kaydedilemedi');
        }

        // Odadaki diğer kullanıcılara bildir (sadece aynı odadaysa)
        if (roomId) {
          const locationUpdate = {
            userId: socket.user._id.toString(),
            username: socket.user.username,
            location: {
              latitude,
              longitude,
              timestamp: Date.now()
            }
          };

          // Debug: Odadaki socket'leri göster
          const roomSockets = await io.in(roomId.toString()).fetchSockets();
          console.log(`🔍 [DEBUG] Room ${roomId} has ${roomSockets.length} sockets:`, roomSockets.map(s => s.user?.username || 'unknown'));

          socket.to(roomId.toString()).emit('user_location_update', locationUpdate);
          console.log(`📡 Konum broadcast edildi: ${socket.user.username} → room ${roomId} (${roomSockets.length - 1} alıcı)`);
        } else {
          console.warn('⚠️ Kullanıcı odada değil, broadcast yapılmadı');
        }

      } catch (error) {
        console.error('❌ Location update hatası:', error);
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
