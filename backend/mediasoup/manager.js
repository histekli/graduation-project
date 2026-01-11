/**
 * Mediasoup Worker Manager
 * SFU Worker'ları ve Router'ları yönetir
 */

const mediasoup = require('mediasoup');
const config = require('./config');

class MediasoupManager {
  constructor() {
    this.workers = [];
    this.nextWorkerIdx = 0;
    this.routers = new Map(); // roomId -> router
    this.transports = new Map(); // transportId -> {transport, roomId, peerId}
    this.producers = new Map(); // producerId -> {producer, roomId, peerId}
    this.consumers = new Map(); // consumerId -> {consumer, roomId, peerId}
  }

  /**
   * Initialize Mediasoup Workers
   */
  async init() {
    const numWorkers = process.env.MEDIASOUP_WORKERS ? parseInt(process.env.MEDIASOUP_WORKERS) : 1; // Default to 1 for stability
    console.log(`🚀 Mediasoup başlatılıyor: ${numWorkers} worker...`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker(config.worker);

      worker.on('died', () => {
        console.error('❌ Mediasoup worker öldü! Exit:', worker.pid);
        // process.exit(1); // Do not crash the app, try to survive
      });

      this.workers.push(worker);
      console.log(`✅ Worker ${i + 1} oluşturuldu (PID: ${worker.pid})`);
    }

    console.log('✅ Mediasoup hazır!');
  }

  /**
   * Get next worker (Round-robin)
   */
  getNextWorker() {
    const worker = this.workers[this.nextWorkerIdx];
    this.nextWorkerIdx = (this.nextWorkerIdx + 1) % this.workers.length;
    return worker;
  }

  /**
   * Create Router for Room
   */
  async createRouter(roomId) {
    if (this.routers.has(roomId)) {
      return this.routers.get(roomId);
    }

    const worker = this.getNextWorker();
    const router = await worker.createRouter({
      mediaCodecs: config.router.mediaCodecs,
    });

    this.routers.set(roomId, router);
    console.log(`📡 Router oluşturuldu: ${roomId}`);
    return router;
  }

  /**
   * Get Router for Room
   */
  getRouter(roomId) {
    return this.routers.get(roomId);
  }

  /**
   * Create WebRTC Transport
   */
  async createWebRtcTransport(roomId, peerId, direction) {
    const router = await this.createRouter(roomId);

    const transport = await router.createWebRtcTransport(
      config.webRtcTransport
    );

    this.transports.set(transport.id, {
      transport,
      roomId,
      peerId,
      direction, // 'send' or 'recv'
    });

    console.log(`🚚 ${direction} transport oluşturuldu: ${peerId} (${roomId})`);
    console.log(`🔑 Transport ID: ${transport.id}`);
    return transport;
  }

  /**
   * Connect Transport
   */
  async connectTransport(transportId, dtlsParameters) {
    const { transport } = this.transports.get(transportId) || {};
    if (!transport) {
      throw new Error('Transport bulunamadı');
    }

    await transport.connect({ dtlsParameters });
    console.log(`✅ Transport bağlandı: ${transportId}`);
  }

  /**
   * Create Producer (User sends audio)
   */
  async createProducer(transportId, rtpParameters, kind) {
    const { transport, roomId, peerId } = this.transports.get(transportId) || {};
    if (!transport) {
      throw new Error('Transport bulunamadı');
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
    });

    this.producers.set(producer.id, {
      producer,
      roomId,
      peerId,
    });

    console.log(`🎤 Producer oluşturuldu: ${peerId} (${kind})`);
    return producer;
  }

  /**
   * Create Consumer (User receives audio from another user)
   */
  async createConsumer(transportId, producerId, rtpCapabilities) {
    console.log(`🔍 Consume isteği - transportId: ${transportId}`);
    console.log(`🔍 Mevcut transport IDs:`, Array.from(this.transports.keys()));

    const { transport, roomId, peerId } = this.transports.get(transportId) || {};
    if (!transport) {
      console.error(`❌ Transport bulunamadı! Aranan ID: ${transportId}`);
      throw new Error('Transport bulunamadı');
    }

    const { producer, peerId: producerPeerId } = this.producers.get(producerId) || {};
    if (!producer) {
      throw new Error('Producer bulunamadı');
    }

    const router = this.getRouter(roomId);
    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('RTP capabilities uyumsuz');
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false, // Start immediately
    });

    this.consumers.set(consumer.id, {
      consumer,
      roomId,
      peerId,
    });

    console.log(`🔊 Consumer oluşturuldu: ${peerId} <- Producer ${producerId}`);

    // Return consumer with producer's peerId
    return {
      consumer,
      producerPeerId // Producer'ın sahibi (kim konuşuyor)
    };
  }

  /**
   * Get all Producers in Room (except the requester)
   */
  getProducersInRoom(roomId, excludePeerId) {
    const producers = [];
    for (const [producerId, data] of this.producers.entries()) {
      if (data.roomId === roomId && data.peerId !== excludePeerId) {
        producers.push({
          producerId,
          peerId: data.peerId,
          kind: data.producer.kind,
        });
      }
    }
    return producers;
  }

  /**
   * Cleanup when user leaves
   */
  async cleanupPeer(roomId, peerId) {
    console.log(`🧹 Peer temizleniyor: ${peerId} (${roomId})`);

    // Close transports
    for (const [id, data] of this.transports.entries()) {
      if (data.roomId === roomId && data.peerId === peerId) {
        try {
          if (data.transport && !data.transport.closed) {
            data.transport.close();
          }
        } catch (err) {
          console.error(`⚠️ Transport close hatası (${id}):`, err);
        }
        this.transports.delete(id);
      }
    }

    // Remove producers
    for (const [id, data] of this.producers.entries()) {
      if (data.roomId === roomId && data.peerId === peerId) {
        data.producer.close();
        this.producers.delete(id);
      }
    }

    // Remove consumers
    for (const [id, data] of this.consumers.entries()) {
      if (data.roomId === roomId && data.peerId === peerId) {
        data.consumer.close();
        this.consumers.delete(id);
      }
    }

    console.log(`✅ Peer temizlendi: ${peerId}`);
  }

  /**
   * Cleanup room if empty
   */
  async cleanupRoom(roomId) {
    const hasTransports = Array.from(this.transports.values()).some(
      (t) => t.roomId === roomId
    );

    if (!hasTransports) {
      const router = this.routers.get(roomId);
      if (router) {
        router.close();
        this.routers.delete(roomId);
        console.log(`🗑️ Router silindi: ${roomId}`);
      }
    }
  }
}

module.exports = new MediasoupManager();
