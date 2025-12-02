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

        // Janus'a kullanıcı katılımını bildir
        if (janusService) {
          try {
            await janusService.joinRoom(
              socket.userId.toString(),
              parseInt(socket.user.currentRoom),
              socket.user.username
            );
          } catch (janusError) {
            console.error('❌ Janus room join hatası:', janusError);
          }
        }

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

        // Janus'a kullanıcı katılımını bildir
        if (janusService) {
          try {
            const janusResult = await janusService.joinRoom(
              socket.userId.toString(),
              parseInt(roomId),
              socket.user.username
            );
            console.log('✅ Janus room join başarılı:', janusResult);
          } catch (janusError) {
            console.error('❌ Janus room join hatası:', janusError);
            // Janus hatası olsa bile normal socket işlemine devam et
          }
        }

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

        // Janus'tan kullanıcıyı çıkar
        if (janusService) {
          try {
            const janusResult = await janusService.leaveRoom(
              socket.userId.toString(),
              parseInt(roomId)
            );
            console.log('✅ Janus room leave başarılı:', janusResult);
          } catch (janusError) {
            console.error('❌ Janus room leave hatası:', janusError);
            // Janus hatası olsa bile normal socket işlemine devam et
          }
        }

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

    // Janus WebRTC Sinyalleşme - Janus Gateway üzerinden
    socket.on('janus_message', async (data) => {
      try {
        if (!janusService) {
          return socket.emit('janus_error', { message: 'Janus servis kullanılamıyor' });
        }

        const { action, payload } = data;

        switch (action) {
          case 'create_session':
            const sessionId = await janusService.createSession();
            socket.emit('janus_response', {
              action: 'session_created',
              sessionId
            });
            break;

          case 'attach_plugin':
            const handleId = await janusService.attachVideoRoomPlugin(payload.sessionId);
            socket.emit('janus_response', {
              action: 'plugin_attached',
              handleId
            });
            break;

          case 'join_room':
            const roomResult = await janusService.joinRoom(
              socket.userId.toString(),
              payload.roomId,
              socket.user.username
            );
            socket.emit('janus_response', {
              action: 'room_joined',
              result: roomResult
            });
            break;

          default:
            socket.emit('janus_error', { message: 'Bilinmeyen Janus aksiyon' });
        }

      } catch (error) {
        console.error('❌ Janus message handling error:', error);
        socket.emit('janus_error', { message: error.message });
      }
    });

    // ICE Server bilgilerini isteme
    socket.on('get_ice_servers', () => {
      try {
        if (janusService) {
          const iceServers = janusService.getIceServers();
          socket.emit('ice_servers', iceServers);
        } else {
          // Fallback ICE servers
          socket.emit('ice_servers', {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          });
        }
      } catch (error) {
        console.error('❌ ICE servers error:', error);
        socket.emit('error', { message: 'ICE server bilgileri alınamadı' });
      }
    });

    // Legacy WebRTC Sinyalleşme (P2P) - Janus olmadığında fallback
    socket.on('webrtc_offer', (data) => {
      console.log('⚠️ Legacy P2P WebRTC kullanılıyor (Janus yerine)');

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

    // Legacy WebRTC Sinyalleşme - Answer
    socket.on('webrtc_answer', (data) => {
      console.log('⚠️ Legacy P2P WebRTC kullanılıyor (Janus yerine)');

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

    // Legacy WebRTC Sinyalleşme - ICE Candidate
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

        // Kullanıcı konumunu MongoDB'ye kaydet
        await User.findByIdAndUpdate(socket.userId, {
          location: {
            type: 'Point',
            coordinates: [longitude, latitude],
            accuracy,
            timestamp: timestamp || new Date()
          }
        });
        
        // Redis'e konum cache'le (hızlı erişim için)
        if (redisLocationService && redisLocationService.isConnected) {
          await redisLocationService.setUserLocation(socket.userId.toString(), {
            latitude,
            longitude,
            accuracy,
            username: socket.user.username,
            roomId: socket.user.currentRoom
          });
          console.log(`🔴 Redis'e konum cache'lendi: ${socket.user.username}`);
        }

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

        // Janus'a konuşma durumunu bildir
        if (janusService) {
          try {
            janusService.updateTalkingStatus(socket.userId.toString(), true);
          } catch (janusError) {
            console.error('❌ Janus talking status hatası:', janusError);
          }
        }

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

        // Janus'a konuşma durumunu bildir
        if (janusService) {
          try {
            janusService.updateTalkingStatus(socket.userId.toString(), false);
          } catch (janusError) {
            console.error('❌ Janus talking status hatası:', janusError);
          }
        }

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

        // Janus'tan kullanıcıyı çıkar
        if (janusService && socket.user.currentRoom) {
          try {
            await janusService.leaveRoom(
              socket.userId.toString(),
              parseInt(socket.user.currentRoom)
            );
          } catch (janusError) {
            console.error('❌ Janus disconnect cleanup hatası:', janusError);
          }
        }

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

  // Janus Service event'lerini Socket.IO ile entegre et
  if (janusService) {
    // Katılımcı odaya katıldı
    janusService.on('participant_joined', (data) => {
      const { roomId, userId } = data;
      io.to(roomId.toString()).emit('janus_participant_joined', {
        userId,
        roomId
      });
    });

    // Katılımcı odadan ayrıldı  
    janusService.on('participant_left', (data) => {
      const { roomId, userId } = data;
      io.to(roomId.toString()).emit('janus_participant_left', {
        userId,
        roomId
      });
    });

    // Konuşma başladı
    janusService.on('talking_started', (data) => {
      const { roomId, userId } = data;
      io.to(roomId.toString()).emit('janus_talking_started', {
        userId,
        roomId
      });
    });

    // Konuşma bitti
    janusService.on('talking_stopped', (data) => {
      const { roomId, userId } = data;
      io.to(roomId.toString()).emit('janus_talking_stopped', {
        userId,
        roomId
      });
    });

    // WebRTC bağlantısı kuruldu
    janusService.on('webrtc_up', (data) => {
      console.log('✅ Janus WebRTC bağlantısı kuruldu:', data.session_id);
      io.emit('janus_webrtc_up', { sessionId: data.session_id });
    });

    // WebRTC bağlantısı kesildi
    janusService.on('hangup', (data) => {
      console.log('📞 Janus WebRTC bağlantısı kesildi:', data.session_id);
      io.emit('janus_hangup', { sessionId: data.session_id });
    });

    // Publishers güncellendi
    janusService.on('publishers_updated', (data) => {
      const { publishers } = data;
      io.emit('janus_publishers_updated', { publishers });
    });
  }
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
