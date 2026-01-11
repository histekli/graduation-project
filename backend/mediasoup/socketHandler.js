/**
 * Mediasoup SFU Socket Events
 * Frontend ile Mediasoup arasındaki iletişim
 */

const mediasoupManager = require('./manager');

console.log('🔍 Mediasoup Handler Loaded. Manager status:', !!mediasoupManager);

module.exports = (io, socket) => {
  if (!mediasoupManager) {
    console.error('❌ Kritik Hata: Mediasoup Manager yüklenemedi!');
    return;
  }
  const peerId = socket.user._id.toString();

  /**
   * Get Router RTP Capabilities
   */
  socket.on('getRouterRtpCapabilities', async ({ roomId }, callback) => {
    try {
      const router = await mediasoupManager.createRouter(roomId);
      callback({ rtpCapabilities: router.rtpCapabilities });
      console.log(`📡 RTP capabilities gönderildi: ${peerId} (${roomId})`);
    } catch (error) {
      console.error('❌ getRouterRtpCapabilities hatası:', error);
      callback({ error: error.message });
    }
  });

  /**
   * Create WebRTC Transport (Send or Recv)
   */
  /**
   * Create WebRTC Transport (Send or Recv)
   */
  socket.on('createWebRtcTransport', async ({ roomId, direction }, callback) => {
    try {
      // Fail-safe: Ensure socket is in the room
      if (roomId && !socket.rooms.has(roomId.toString())) {
        console.log(`⚠️ Socket ${socket.id} not in room ${roomId}, force joining (in transport create)...`);
        socket.join(roomId.toString());
      }

      const transport = await mediasoupManager.createWebRtcTransport(
        roomId,
        peerId,
        direction,
        socket.id // Pass socket.id for resource tracking
      );

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });

      console.log(`🚚 Transport oluşturuldu: ${direction} - ${peerId}`);
    } catch (error) {
      console.error('❌ createWebRtcTransport hatası:', error);
      callback({ error: error.message });
    }
  });

  /**
   * Connect Transport
   */
  socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
    try {
      await mediasoupManager.connectTransport(transportId, dtlsParameters);
      callback({ success: true });
      console.log(`✅ Transport bağlandı: ${transportId}`);
    } catch (error) {
      console.error('❌ connectTransport hatası:', error);
      callback({ error: error.message });
    }
  });

  /**
   * Produce (User sends audio to server)
   */
  socket.on('produce', async ({ transportId, kind, rtpParameters, roomId }, callback) => {
    try {
      // Fail-safe: Ensure socket is in the room to receive broadcasts
      if (roomId && !socket.rooms.has(roomId.toString())) {
        console.log(`⚠️ Socket ${socket.id} not in room ${roomId}, force joining (in produce)...`);
        socket.join(roomId.toString());
      }

      const producer = await mediasoupManager.createProducer(
        transportId,
        rtpParameters,
        kind
      );

      callback({ producerId: producer.id });
      console.log(`🎤 Producer oluşturuldu: ${peerId} - ${kind}`);

      // Notify other users in room about new producer
      socket.to(roomId.toString()).emit('newProducer', {
        producerId: producer.id,
        peerId,
        kind,
      });
      console.log(`📢 newProducer broadcast edildi: ${producer.id} → room ${roomId}`);
    } catch (error) {
      console.error('❌ produce hatası:', error);
      callback({ error: error.message });
    }
  });

  /**
   * Consume (User receives audio from another user)
   */
  socket.on('consume', async ({ transportId, producerId, rtpCapabilities, roomId }, callback) => {
    try {
      const { consumer, producerPeerId } = await mediasoupManager.createConsumer(
        transportId,
        producerId,
        rtpCapabilities
      );

      callback({
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        producerUserId: producerPeerId // Producer'ın sahibinin ID'si
      });

      console.log(`🔊 Consumer oluşturuldu: ${peerId} <- ${producerId}`);
    } catch (error) {
      console.error('❌ consume hatası:', error);
      callback({ error: error.message });
    }
  });

  /**
   * Get Existing Producers in Room
   */
  socket.on('getProducers', async ({ roomId }, callback) => {
    try {
      const fullProducers = mediasoupManager.getProducersInRoom(roomId, peerId);

      // Frontend expects:
      // 1. producerIds (legacy array of strings)
      // 2. producers (array of objects { producerId, peerId, kind })

      const producerIds = fullProducers.map(p => p.producerId);

      // Return both formats for compatibility
      callback({
        producerIds,
        producers: fullProducers
      });

      console.log(`📋 Producers listesi: ${peerId} - ${producerIds.length} producer:`, producerIds);
    } catch (error) {
      console.error('❌ getProducers hatası:', error);
      callback({ error: error.message });
    }
  });

  /**
   * Resume Consumer
   */
  socket.on('resumeConsumer', async ({ consumerId }, callback) => {
    try {
      const { consumer } = mediasoupManager.consumers.get(consumerId) || {};
      if (consumer) {
        await consumer.resume();
        callback({ success: true });
        console.log(`▶️ Consumer resumed: ${consumerId}`);
      }
    } catch (error) {
      console.error('❌ resumeConsumer hatası:', error);
      callback({ error: error.message });
    }
  });

  /**
   * Cleanup on Disconnect
   */
  socket.on('disconnect', async () => {
    console.log(`🔌 Kullanıcı bağlantısı koptu: ${peerId} (Socket: ${socket.id})`);

    // Cleanup mediasoup resources associated with THIS socket
    await mediasoupManager.cleanupSocket(socket.id);

    // If user was in a room, check if room needs cleanup
    if (socket.user.currentRoom) {
      const roomId = socket.user.currentRoom.toString();
      await mediasoupManager.cleanupRoom(roomId);
    }
  });
};
