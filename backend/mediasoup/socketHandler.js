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

  // ... (intermediate code unchanged)

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
