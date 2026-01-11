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
      const worker = await mediasoup.createWorker({
        ...config.worker,
        logLevel: 'debug',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp', 'rtx', 'bwe', 'score', 'simulcast', 'svc', 'sctp']
      });

      // Log worker events
      worker.on('died', () => {
        console.error(`❌ Mediasoup worker ${worker.pid} öldü! Re-spawning...`);
        // In production, we might want to exit process to let Docker restart
        // process.exit(1); 
      });

      // Pipe worker logs (if available/supported by version)
      // Note: By default worker logs go to FD 1/2 which are inherited.

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

    if (!worker) {
      throw new Error('Mediasoup worker bulunamadı (Init başarısız olabilir)');
    }

    const router = await worker.createRouter({
      mediaCodecs: config.router.mediaCodecs,
    });

    this.routers.set(roomId, router);
    console.log(`[Mediasoup] Router oluşturuldu: ${roomId}`);
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
  /**
   * Create WebRTC Transport
   */
  async createWebRtcTransport(roomId, peerId, direction, socketId) {
    const router = await this.createRouter(roomId);

    const transport = await router.createWebRtcTransport(
      config.webRtcTransport
    );

    this.transports.set(transport.id, {
      transport,
      roomId,
      peerId,
      direction, // 'send' or 'recv'
      socketId, // Store socketId to distinguish connections
    });

    console.log(`🚚 ${direction} transport oluşturuldu: ${peerId} (${roomId}) [Socket: ${socketId}]`);
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
    const { transport, roomId, peerId, socketId } = this.transports.get(transportId) || {};
    if (!transport) {
      throw new Error('Transport bulunamadı');
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
    });

    console.log(`🔍 createProducer: Adding producer ${producer.id} to Map for peerId=${peerId}, roomId=${roomId}`);
    this.producers.set(producer.id, {
      producer,
      roomId,
      peerId,
      socketId, // Inherit socketId from transport
    });
    console.log(`🔍 createProducer: Producer added. Total producers now: ${this.producers.size}`);

    console.log(`🎤 Producer oluşturuldu: ${peerId} (${kind})`);
    return producer;
  }

  /**
   * Create Consumer (User receives audio from another user)
   */
  async createConsumer(transportId, producerId, rtpCapabilities) {
    const { transport, roomId, peerId, socketId } = this.transports.get(transportId) || {};
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
      socketId, // Inherit socketId from transport
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
    console.log(`🔍 getProducersInRoom: roomId=${roomId}, excludePeerId=${excludePeerId}`);
    console.log(`🔍 Total producers in memory: ${this.producers.size}`);

    for (const [producerId, data] of this.producers.entries()) {
      console.log(`  - Producer ${producerId}: roomId=${data.roomId}, peerId=${data.peerId}, match=${data.roomId === roomId && data.peerId !== excludePeerId}`);

      if (data.roomId === roomId && data.peerId !== excludePeerId) {
        producers.push({
          producerId,
          peerId: data.peerId,
          kind: data.producer.kind,
        });
      }
    }
    console.log(`🔍 Found ${producers.length} matching producers`);
    return producers;
  }

  /**
   * Cleanup resources for a specific socket
   * This prevents removing resources of a new connection for the same user
   */
  async cleanupSocket(socketId) {
    console.log(`🧹 Socket temizleniyor: ${socketId}`);
    let removedCount = 0;

    // Close transports
    for (const [id, data] of this.transports.entries()) {
      if (data.socketId === socketId) {
        try {
          if (data.transport && !data.transport.closed) {
            data.transport.close();
          }
        } catch (err) {
          console.error(`⚠️ Transport close hatası (${id}):`, err);
        }
        this.transports.delete(id);
        removedCount++;
      }
    }

    // Remove producers
    for (const [id, data] of this.producers.entries()) {
      if (data.socketId === socketId) {
        data.producer.close();
        this.producers.delete(id);
        removedCount++;
      }
    }

    // Remove consumers
    for (const [id, data] of this.consumers.entries()) {
      if (data.socketId === socketId) {
        data.consumer.close();
        this.consumers.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`✅ Socket temizlendi: ${socketId} (${removedCount} kaynak silindi)`);
    } else {
      console.log(`ℹ️ Socket için silinecek kaynak bulunamadı: ${socketId}`);
    }
  }

  /**
   * Cleanup when user leaves (Deprecated: prefers cleanupSocket)
   * Kept for backward compatibility if needed, but updated to use cleanupSocket semantics if possible check
   * Or just keep it as "force clean everything for this user"
   */
  async cleanupPeer(roomId, peerId) {
    console.log(`🧹 Peer temizleniyor (FORCE): ${peerId} (${roomId})`);

    // ... logic same as before but maybe we should avoid using this on disconnect
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

    console.log(`✅ Peer temizlendi (FORCE): ${peerId}`);
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

// Singleton enforcement to prevent multiple instances due to require path differences
if (!global.mediasoupManagerInstance) {
  global.mediasoupManagerInstance = new MediasoupManager();
}

module.exports = global.mediasoupManagerInstance;
