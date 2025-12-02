/**
 * Janus Gateway Service
 * GeoTalk Car Voice WebRTC projesi için Janus SFU entegrasyonu
 */

const axios = require('axios');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class JanusService {
  constructor() {
    this.config = {
      // Janus Gateway URL'leri
      httpUrl: process.env.JANUS_HTTP_URL || 'http://localhost:8088/janus',
      wsUrl: process.env.JANUS_WS_URL || 'ws://localhost:8188',
      adminUrl: process.env.JANUS_ADMIN_URL || 'http://localhost:8989/admin',

      // API secrets
      apiSecret: process.env.JANUS_API_SECRET || 'carvoice_janus_secret',
      adminSecret: process.env.JANUS_ADMIN_SECRET || 'carvoice_janus_admin',

      // STUN/TURN ayarları
      stunServer: process.env.STUN_SERVER || 'stun.l.google.com:19302',
      turnServer: process.env.TURN_SERVER || `turn:${process.env.HOST_IP || 'localhost'}:3478`,
      turnUser: process.env.TURN_USER || 'carvoice',
      turnCredential: process.env.TURN_SECRET || 'carvoice_turn_secret_2024'
    };

    // Session ve room yönetimi
    this.sessions = new Map();          // sessionId -> session bilgileri
    this.rooms = new Map();            // roomId -> room bilgileri
    this.participants = new Map();     // userId -> participant bilgileri
    this.roomParticipants = new Map(); // roomId -> Set(userIds)

    // WebSocket bağlantısı
    this.ws = null;
    this.isConnected = false;
    this.reconnectTimer = null;

    // Event callbacks
    this.eventCallbacks = new Map();

    console.log('🚀 Janus Service başlatıldı');
    this.initialize();
  }

  /**
   * Janus Gateway'e WebSocket bağlantısı başlat
   */
  async initialize() {
    try {
      console.log('🔌 Janus Gateway\'e bağlanılıyor...');
      await this.connectWebSocket();
      await this.createDefaultRooms();
      console.log('✅ Janus Service başarıyla başlatıldı');
    } catch (error) {
      console.error('❌ Janus Service başlatma hatası:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * WebSocket bağlantısı kur
   */
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl, 'janus-protocol');

        this.ws.on('open', () => {
          console.log('✅ Janus WebSocket bağlantısı kuruldu');
          this.isConnected = true;
          this.clearReconnectTimer();
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            this.handleJanusMessage(message);
          } catch (error) {
            console.error('❌ Janus mesaj parsing hatası:', error);
          }
        });

        this.ws.on('close', () => {
          console.log('🔌 Janus WebSocket bağlantısı kapandı');
          this.isConnected = false;
          this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
          console.error('❌ Janus WebSocket hatası:', error);
          this.isConnected = false;
          reject(error);
        });

        // Timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Janus WebSocket bağlantı zaman aşımı'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Yeniden bağlantı planla
   */
  scheduleReconnect() {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      console.log('🔄 Janus Gateway\'e yeniden bağlanılıyor...');
      this.initialize();
    }, 5000);
  }

  /**
   * Yeniden bağlantı timer'ını temizle
   */
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Janus'tan gelen mesajları işle
   */
  handleJanusMessage(message) {
    try {
      console.log('📨 Janus mesajı alındı:', message.janus, message.transaction);

      switch (message.janus) {
        case 'success':
          this.handleSuccessMessage(message);
          break;

        case 'error':
          this.handleErrorMessage(message);
          break;

        case 'event':
          this.handleEventMessage(message);
          break;

        case 'webrtcup':
          this.handleWebRTCUp(message);
          break;

        case 'hangup':
          this.handleHangup(message);
          break;

        case 'detached':
          this.handleDetached(message);
          break;

        default:
          console.log('⚠️ Bilinmeyen Janus mesaj türü:', message.janus);
      }
    } catch (error) {
      console.error('❌ Janus mesaj işleme hatası:', error);
    }
  }

  /**
   * Success mesajlarını işle
   */
  handleSuccessMessage(message) {
    if (message.data && message.data.id) {
      console.log('✅ Janus session/handle oluşturuldu:', message.data.id);
    }
  }

  /**
   * Error mesajlarını işle
   */
  handleErrorMessage(message) {
    console.error('❌ Janus error:', message.error);
  }

  /**
   * Event mesajlarını işle
   */
  handleEventMessage(message) {
    try {
      const pluginData = message.plugindata;
      if (pluginData && pluginData.plugin === 'janus.plugin.videoroom') {
        this.handleVideoRoomEvent(message);
      }
    } catch (error) {
      console.error('❌ Event işleme hatası:', error);
    }
  }

  /**
   * VideoRoom plugin eventlerini işle
   */
  handleVideoRoomEvent(message) {
    try {
      const data = message.plugindata.data;
      const event = data.videoroom;

      console.log('🎬 VideoRoom event:', event, data);

      switch (event) {
        case 'joined':
          this.handleParticipantJoined(message);
          break;

        case 'left':
          this.handleParticipantLeft(message);
          break;

        case 'talking':
          this.handleTalkingEvent(message);
          break;

        case 'stopped-talking':
          this.handleStoppedTalkingEvent(message);
          break;

        case 'event':
          if (data.publishers) {
            this.handlePublishersUpdate(message);
          }
          break;
      }

      // Event callback'lerini çağır
      this.triggerEventCallbacks('videoroom_event', {
        event,
        data,
        message
      });

    } catch (error) {
      console.error('❌ VideoRoom event işleme hatası:', error);
    }
  }

  /**
   * WebRTC bağlantı kuruldu
   */
  handleWebRTCUp(message) {
    console.log('🔗 WebRTC bağlantısı kuruldu:', message.session_id);
    this.triggerEventCallbacks('webrtc_up', message);
  }

  /**
   * WebRTC bağlantısı kesildi
   */
  handleHangup(message) {
    console.log('📞 WebRTC bağlantısı kesildi:', message.session_id);
    this.triggerEventCallbacks('hangup', message);
  }

  /**
   * Handle detached
   */
  handleDetached(message) {
    console.log('🔌 Handle detached:', message.session_id);
  }

  /**
   * Katılımcı odaya katıldı
   */
  handleParticipantJoined(message) {
    try {
      const data = message.plugindata.data;
      const roomId = data.room;
      const userId = data.id;

      console.log('👋 Katılımcı odaya katıldı:', { roomId, userId });

      // Room participants güncelle
      if (!this.roomParticipants.has(roomId)) {
        this.roomParticipants.set(roomId, new Set());
      }
      this.roomParticipants.get(roomId).add(userId);

      this.triggerEventCallbacks('participant_joined', {
        roomId,
        userId,
        data
      });

    } catch (error) {
      console.error('❌ Participant joined işleme hatası:', error);
    }
  }

  /**
   * Katılımcı odadan ayrıldı
   */
  handleParticipantLeft(message) {
    try {
      const data = message.plugindata.data;
      const roomId = data.room;
      const userId = data.id;

      console.log('👋 Katılımcı odadan ayrıldı:', { roomId, userId });

      // Room participants güncelle
      if (this.roomParticipants.has(roomId)) {
        this.roomParticipants.get(roomId).delete(userId);
      }

      this.triggerEventCallbacks('participant_left', {
        roomId,
        userId,
        data
      });

    } catch (error) {
      console.error('❌ Participant left işleme hatası:', error);
    }
  }

  /**
   * Konuşma başladı
   */
  handleTalkingEvent(message) {
    try {
      const data = message.plugindata.data;
      const roomId = data.room;
      const userId = data.id;

      console.log('🎤 Konuşma başladı:', { roomId, userId });

      this.triggerEventCallbacks('talking_started', {
        roomId,
        userId,
        data
      });

    } catch (error) {
      console.error('❌ Talking event işleme hatası:', error);
    }
  }

  /**
   * Konuşma bitti
   */
  handleStoppedTalkingEvent(message) {
    try {
      const data = message.plugindata.data;
      const roomId = data.room;
      const userId = data.id;

      console.log('🤫 Konuşma bitti:', { roomId, userId });

      this.triggerEventCallbacks('talking_stopped', {
        roomId,
        userId,
        data
      });

    } catch (error) {
      console.error('❌ Stopped talking event işleme hatası:', error);
    }
  }

  /**
   * Publishers güncellendi
   */
  handlePublishersUpdate(message) {
    try {
      const data = message.plugindata.data;
      const publishers = data.publishers || [];

      console.log('📡 Publishers güncellendi:', publishers.length, 'publisher');

      this.triggerEventCallbacks('publishers_updated', {
        publishers,
        data
      });

    } catch (error) {
      console.error('❌ Publishers update işleme hatası:', error);
    }
  }

  /**
   * Janus'a mesaj gönder
   */
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.ws) {
        reject(new Error('Janus bağlantısı yok'));
        return;
      }

      try {
        // Transaction ID ekle
        message.transaction = uuidv4();

        // API secret ekle
        if (this.config.apiSecret) {
          message.apisecret = this.config.apiSecret;
        }

        const messageStr = JSON.stringify(message);
        this.ws.send(messageStr);

        console.log('📤 Janus\'a mesaj gönderildi:', message.janus, message.transaction);
        resolve(message.transaction);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * HTTP API üzerinden istek gönder
   */
  async sendHttpRequest(endpoint, data) {
    try {
      const url = `${this.config.httpUrl}${endpoint}`;

      // API secret ekle
      if (this.config.apiSecret) {
        data.apisecret = this.config.apiSecret;
      }

      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      console.error('❌ Janus HTTP istek hatası:', error.message);
      throw error;
    }
  }

  /**
   * Janus session oluştur
   */
  async createSession() {
    try {
      const transaction = await this.sendMessage({
        janus: 'create'
      });

      // Response bekle (gerçek implementasyonda promise based yaklaşım kullanılabilir)
      return transaction;
    } catch (error) {
      console.error('❌ Janus session oluşturma hatası:', error);
      throw error;
    }
  }

  /**
   * VideoRoom plugin handle oluştur
   */
  async attachVideoRoomPlugin(sessionId) {
    try {
      const transaction = await this.sendMessage({
        janus: 'attach',
        session_id: sessionId,
        plugin: 'janus.plugin.videoroom'
      });

      return transaction;
    } catch (error) {
      console.error('❌ VideoRoom plugin attach hatası:', error);
      throw error;
    }
  }

  /**
   * Varsayılan odaları oluştur
   */
  async createDefaultRooms() {
    try {
      console.log('🏠 Varsayılan odalar oluşturuluyor...');

      // Ana sesli sohbet odası
      await this.createRoom({
        roomId: 1234,
        description: 'GeoTalk Ana Sesli Sohbet Odası',
        publishers: 50,
        audiocodec: 'opus',
        bitrate: 128000,
        record: false
      });

      // Test odası
      await this.createRoom({
        roomId: 5678,
        description: 'GeoTalk Test Odası',
        publishers: 10,
        audiocodec: 'opus',
        bitrate: 64000,
        record: false
      });

      console.log('✅ Varsayılan odalar oluşturuldu');
    } catch (error) {
      console.error('❌ Varsayılan oda oluşturma hatası:', error);
      // Hata olsa bile devam et, odalar manuel oluşturulabilir
    }
  }

  /**
   * Yeni oda oluştur
   */
  async createRoom(options) {
    try {
      const {
        roomId,
        description = 'GeoTalk Voice Room',
        publishers = 20,
        audiocodec = 'opus',
        bitrate = 128000,
        record = false
      } = options;

      console.log('🏠 Yeni oda oluşturuluyor:', roomId);

      const roomData = {
        janus: 'create',
        // Session ve handle gerekli - şimdilik HTTP API kullan
      };

      // HTTP API ile oda oluştur
      const response = await this.sendHttpRequest('', {
        janus: 'create'
      });

      // Room bilgilerini kaydet
      this.rooms.set(roomId, {
        id: roomId,
        description,
        publishers,
        audiocodec,
        bitrate,
        record,
        participants: new Set(),
        createdAt: new Date()
      });

      console.log('✅ Oda oluşturuldu:', roomId);
      return roomId;

    } catch (error) {
      console.error('❌ Oda oluşturma hatası:', error);
      throw error;
    }
  }

  /**
   * Odaya katıl
   */
  async joinRoom(userId, roomId, displayName = null) {
    try {
      console.log('🚪 Kullanıcı odaya katılıyor:', { userId, roomId, displayName });

      // Kullanıcı bilgilerini kaydet
      this.participants.set(userId, {
        id: userId,
        roomId,
        displayName: displayName || `User_${userId}`,
        joinedAt: new Date(),
        isTalking: false
      });

      // Room participants güncelle
      if (!this.roomParticipants.has(roomId)) {
        this.roomParticipants.set(roomId, new Set());
      }
      this.roomParticipants.get(roomId).add(userId);

      console.log('✅ Kullanıcı odaya katıldı:', { userId, roomId });

      return {
        success: true,
        roomId,
        userId,
        participants: Array.from(this.roomParticipants.get(roomId) || [])
      };

    } catch (error) {
      console.error('❌ Odaya katılma hatası:', error);
      throw error;
    }
  }

  /**
   * Odadan ayrıl
   */
  async leaveRoom(userId, roomId) {
    try {
      console.log('🚪 Kullanıcı odadan ayrılıyor:', { userId, roomId });

      // Kullanıcı bilgilerini temizle
      this.participants.delete(userId);

      // Room participants güncelle
      if (this.roomParticipants.has(roomId)) {
        this.roomParticipants.get(roomId).delete(userId);
      }

      console.log('✅ Kullanıcı odadan ayrıldı:', { userId, roomId });

      return {
        success: true,
        roomId,
        userId
      };

    } catch (error) {
      console.error('❌ Odadan ayrılma hatası:', error);
      throw error;
    }
  }

  /**
   * Oda katılımcılarını getir
   */
  getRoomParticipants(roomId) {
    const participantIds = this.roomParticipants.get(roomId) || new Set();
    const participants = [];

    for (const userId of participantIds) {
      const participant = this.participants.get(userId);
      if (participant) {
        participants.push(participant);
      }
    }

    return participants;
  }

  /**
   * Konuşma durumunu güncelle
   */
  updateTalkingStatus(userId, isTalking) {
    const participant = this.participants.get(userId);
    if (participant) {
      participant.isTalking = isTalking;
      console.log('🎤 Konuşma durumu güncellendi:', { userId, isTalking });
    }
  }

  /**
   * STUN/TURN sunucu bilgilerini getir
   */
  getIceServers() {
    return {
      iceServers: [
        { urls: `stun:${this.config.stunServer}` },
        {
          urls: this.config.turnServer,
          username: this.config.turnUser,
          credential: this.config.turnCredential
        }
      ]
    };
  }

  /**
   * Event callback kaydet
   */
  on(eventName, callback) {
    if (!this.eventCallbacks.has(eventName)) {
      this.eventCallbacks.set(eventName, []);
    }
    this.eventCallbacks.get(eventName).push(callback);
  }

  /**
   * Event callback'lerini tetikle
   */
  triggerEventCallbacks(eventName, data) {
    const callbacks = this.eventCallbacks.get(eventName) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('❌ Event callback hatası:', error);
      }
    });
  }

  /**
   * Service'i kapat
   */
  async close() {
    try {
      console.log('🔌 Janus Service kapatılıyor...');

      this.clearReconnectTimer();

      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      this.isConnected = false;
      this.sessions.clear();
      this.rooms.clear();
      this.participants.clear();
      this.roomParticipants.clear();
      this.eventCallbacks.clear();

      console.log('✅ Janus Service kapatıldı');
    } catch (error) {
      console.error('❌ Janus Service kapatma hatası:', error);
    }
  }
}

module.exports = JanusService;
