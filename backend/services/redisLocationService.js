/**
 * Redis Location Cache Service
 * GeoTalk Car Voice - Location data caching with Redis
 */

const redis = require('redis');

class RedisLocationService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    
    // Konfigürasyon
    this.config = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      ttl: 60, // Location cache TTL (saniye)
      maxRetries: 3,
      retryDelay: 1000
    };
    
    console.log('🔴 Redis Location Service başlatılıyor...');
    this.initialize();
  }

  /**
   * Redis'e bağlan
   */
  async initialize() {
    try {
      // Redis client oluştur
      this.client = redis.createClient({
        url: this.config.url,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > this.config.maxRetries) {
              console.error('❌ Redis bağlantısı başarısız (max retries)');
              return new Error('Redis connection failed');
            }
            console.log(`🔄 Redis yeniden bağlanıyor... (${retries})`);
            return this.config.retryDelay;
          }
        }
      });

      // Event listeners
      this.client.on('connect', () => {
        console.log('🔴 Redis bağlantısı kuruluyor...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis hazır');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis hatası:', err.message);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('🔌 Redis bağlantısı kapandı');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis yeniden bağlanıyor...');
      });

      // Bağlan
      await this.client.connect();
      console.log('✅ Redis Location Service başarıyla başlatıldı');

    } catch (error) {
      console.error('❌ Redis başlatma hatası:', error);
      // Geliştirme modunda Redis olmadan devam et
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Geliştirme modunda Redis olmadan çalışıyor...');
      }
    }
  }

  /**
   * Kullanıcının konumunu cache'e kaydet
   */
  async setUserLocation(userId, location) {
    if (!this.isConnected) {
      console.warn('⚠️ Redis bağlı değil, konum cache\'lenemedi');
      return null;
    }

    try {
      const key = `location:${userId}`;
      const data = {
        userId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || null,
        timestamp: Date.now(),
        ...location
      };

      // JSON olarak kaydet
      await this.client.setEx(
        key,
        this.config.ttl,
        JSON.stringify(data)
      );

      console.log(`📍 Konum cache'lendi: ${userId}`);
      return data;

    } catch (error) {
      console.error('❌ Konum cache hatası:', error);
      return null;
    }
  }

  /**
   * Kullanıcının konumunu cache'den al
   */
  async getUserLocation(userId) {
    if (!this.isConnected) {
      return null;
    }

    try {
      const key = `location:${userId}`;
      const data = await this.client.get(key);

      if (data) {
        return JSON.parse(data);
      }

      return null;

    } catch (error) {
      console.error('❌ Konum okuma hatası:', error);
      return null;
    }
  }

  /**
   * Oda içindeki tüm kullanıcıların konumlarını al
   */
  async getRoomUserLocations(roomId, userIds) {
    if (!this.isConnected) {
      return [];
    }

    try {
      const locations = [];

      for (const userId of userIds) {
        const location = await this.getUserLocation(userId);
        if (location) {
          locations.push(location);
        }
      }

      return locations;

    } catch (error) {
      console.error('❌ Oda konumları okuma hatası:', error);
      return [];
    }
  }

  /**
   * Kullanıcının konumunu cache'den sil
   */
  async deleteUserLocation(userId) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const key = `location:${userId}`;
      await this.client.del(key);
      console.log(`🗑️ Konum cache'den silindi: ${userId}`);
      return true;

    } catch (error) {
      console.error('❌ Konum silme hatası:', error);
      return false;
    }
  }

  /**
   * Coğrafi yakınlıktaki kullanıcıları bul (basit implementasyon)
   * Not: Gerçek production için Redis GEO komutları kullanılabilir
   */
  async findNearbyUsers(latitude, longitude, radiusKm = 10) {
    if (!this.isConnected) {
      return [];
    }

    try {
      // Tüm location key'lerini al
      const keys = await this.client.keys('location:*');
      const nearbyUsers = [];

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const location = JSON.parse(data);
          const distance = this.calculateDistance(
            latitude,
            longitude,
            location.latitude,
            location.longitude
          );

          if (distance <= radiusKm) {
            nearbyUsers.push({
              ...location,
              distance: distance.toFixed(2)
            });
          }
        }
      }

      // Mesafeye göre sırala
      nearbyUsers.sort((a, b) => a.distance - b.distance);

      return nearbyUsers;

    } catch (error) {
      console.error('❌ Yakın kullanıcı arama hatası:', error);
      return [];
    }
  }

  /**
   * İki konum arasındaki mesafeyi hesapla (Haversine formülü)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Dünya yarıçapı (km)
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * Dereceyi radyana çevir
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Redis GEO komutları ile gelişmiş konum yönetimi
   * (Production için önerilen)
   */
  async setUserLocationGeo(userId, location) {
    if (!this.isConnected) {
      return null;
    }

    try {
      const geoKey = 'locations:geo';
      
      // GEOADD komutu ile konum ekle
      await this.client.geoAdd(geoKey, {
        longitude: location.longitude,
        latitude: location.latitude,
        member: userId
      });

      // Detaylı bilgileri ayrı kaydet
      const key = `location:${userId}`;
      const data = {
        userId,
        ...location,
        timestamp: Date.now()
      };

      await this.client.setEx(
        key,
        this.config.ttl,
        JSON.stringify(data)
      );

      console.log(`📍 GEO konum cache'lendi: ${userId}`);
      return data;

    } catch (error) {
      console.error('❌ GEO konum cache hatası:', error);
      return null;
    }
  }

  /**
   * Redis GEO ile yakındaki kullanıcıları bul
   */
  async findNearbyUsersGeo(latitude, longitude, radiusKm = 10) {
    if (!this.isConnected) {
      return [];
    }

    try {
      const geoKey = 'locations:geo';
      
      // GEORADIUS komutu ile yakındaki kullanıcıları bul
      const nearby = await this.client.geoRadius(
        geoKey,
        {
          longitude,
          latitude
        },
        radiusKm,
        'km',
        {
          WITHDIST: true,
          WITHCOORD: true,
          COUNT: 100,
          SORT: 'ASC'
        }
      );

      // Detaylı bilgileri al
      const users = [];
      for (const item of nearby) {
        const userId = item.member;
        const location = await this.getUserLocation(userId);
        if (location) {
          users.push({
            ...location,
            distance: parseFloat(item.distance).toFixed(2)
          });
        }
      }

      return users;

    } catch (error) {
      console.error('❌ GEO yakın kullanıcı arama hatası:', error);
      return [];
    }
  }

  /**
   * Session data cache (opsiyonel)
   */
  async setSession(sessionId, data, ttl = 3600) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const key = `session:${sessionId}`;
      await this.client.setEx(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('❌ Session cache hatası:', error);
      return false;
    }
  }

  /**
   * Session data al
   */
  async getSession(sessionId) {
    if (!this.isConnected) {
      return null;
    }

    try {
      const key = `session:${sessionId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Session okuma hatası:', error);
      return null;
    }
  }

  /**
   * Cache istatistikleri
   */
  async getStats() {
    if (!this.isConnected) {
      return null;
    }

    try {
      const info = await this.client.info('stats');
      const dbsize = await this.client.dbSize();
      
      return {
        connected: this.isConnected,
        dbSize: dbsize,
        info
      };
    } catch (error) {
      console.error('❌ Stats hatası:', error);
      return null;
    }
  }

  /**
   * Cache'i temizle
   */
  async flushAll() {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.flushAll();
      console.log('🧹 Redis cache temizlendi');
      return true;
    } catch (error) {
      console.error('❌ Cache temizleme hatası:', error);
      return false;
    }
  }

  /**
   * Redis bağlantısını kapat
   */
  async close() {
    try {
      if (this.client) {
        await this.client.quit();
        console.log('✅ Redis bağlantısı kapatıldı');
      }
    } catch (error) {
      console.error('❌ Redis kapatma hatası:', error);
    }
  }
}

module.exports = RedisLocationService;