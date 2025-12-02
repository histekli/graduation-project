/**
 * Mediasoup SFU Socket Events
 * Frontend ile Mediasoup arasındaki iletişim
 */

const mediasoupManager = require('../mediasoup/manager');

module.exports = (io, socket) => {
  const peerId = socket.userId.toString();

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
  socket.on('createWebRtcTransport', async ({ roomId, direction }, callback) => {
    try {
      const transport = await mediasoupManager.createWebRtcTransport(
        roomId,
        peerId,
        direction
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
      const producer = await mediasoupManager.createProducer(
        transportId,
        rtpParameters,
        kind
      );

      callback({ producerId: producer.id });
      console.log(`🎤 Producer oluşturuldu: ${peerId} - ${kind}`);

      // Notify other users in room about new producer
      socket.to(roomId).emit('newProducer', {
        producerId: producer.id,
        peerId,
        kind,
      });
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
      const consumer = await mediasoupManager.createConsumer(
        transportId,
        producerId,
        rtpCapabilities
      );

      callback({
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
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
      const producers = mediasoupManager.getProducersInRoom(roomId, peerId);
      callback({ producers });
      console.log(`📋 Producers listesi: ${peerId} - ${producers.length} producer`);
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
    console.log(`🔌 Kullanıcı bağlantısı koptu: ${peerId}`);
    
    // Cleanup all mediasoup resources for this peer
    if (socket.user.currentRoom) {
      const roomId = socket.user.currentRoom.toString();
      await mediasoupManager.cleanupPeer(roomId, peerId);
      await mediasoupManager.cleanupRoom(roomId);
    }
  });
};
