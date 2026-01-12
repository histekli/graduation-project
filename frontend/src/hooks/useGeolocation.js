import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';

export const useGeolocation = () => {
  const { socket } = useSocket();
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const watchId = useRef(null);

  // GPS konum alma seçenekleri - YÜKSEK HASSASIYET
  const geoOptions = {
    enableHighAccuracy: true, // GPS kullan, daha hassas konum
    timeout: 10000, // 10 saniye timeout
    maximumAge: 5000 // 5 saniye cache (daha fresh data)
  };

  // Konum takibini başlat
  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation bu tarayıcıda desteklenmiyor');
      // Fallback konum kullan (İstanbul)
      const fallbackLocation = {
        latitude: 41.0082,
        longitude: 28.9784,
        accuracy: 1000,
        timestamp: Date.now()
      };
      setPosition(fallbackLocation);
      if (socket && typeof socket.emit === 'function') {
        socket.emit('location_update', fallbackLocation);
      }
      console.log('📍 Fallback konum kullanıldı (Geolocation desteklenmiyor)');
      return;
    }

    setIsTracking(true);
    setError(null);
    console.log('🔍 Konum takibi başlatılıyor...');

    // İlk konum alımı
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };

        setPosition(locationData);

        // Sunucuya konum gönder - SOCKET HAZIR MI KONTROL ET
        if (socket && socket.connected && typeof socket.emit === 'function') {
          socket.emit('location_update', locationData);
          console.log('📍 İlk konum sunucuya gönderildi:', locationData);
        } else {
          console.warn('⚠️ İlk konum alındı ama socket bağlı değil, tekrar deneniyor...');
          // Socket bağlanınca otomatik gönderilecek (watchPosition ile)
        }
      },
      (error) => {
        console.error('❌ Konum hatası kodu:', error.code, 'mesaj:', error.message);

        // Daha kullanıcı dostu hata mesajları
        let errorMsg = 'Konum alınamadı';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Konum izni reddedildi. Tarayıcı ayarlarından izin vermeniz gerekiyor.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Konum bilgisi alınamadı. Lütfen başka bir ağa bağlanmayı deneyin.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Konum bilgisi alınamadı (zaman aşımı). Lütfen tekrar deneyin.';

            // Zamanaşımı durumunda fallback konum kullan (Ankara)
            const fallbackLocation = {
              latitude: 39.9334,
              longitude: 32.8597,
              accuracy: 1000,
              timestamp: Date.now()
            };
            setPosition(fallbackLocation);
            if (socket && typeof socket.emit === 'function') {
              socket.emit('location_update', fallbackLocation);
            }
            errorMsg = 'Konum alınamadı, varsayılan konum kullanılıyor. Lütfen konum izinlerini kontrol edin.';
            console.log('📍 Fallback konum kullanıldı (Zaman aşımı nedeniyle)');
            break;
          default:
            errorMsg = `Konum hatası: ${error.message}`;
        }

        setError(errorMsg);
      },
      geoOptions
    );

    // Sürekli konum takibi
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };

        setPosition(locationData);

        // Sunucuya konum gönder (throttle ile) - SOCKET BAĞLI MI KONTROL ET
        if (socket && socket.connected && typeof socket.emit === 'function') {
          throttledLocationUpdate(locationData);
        } else {
          console.warn('⚠️ Konum güncellendi ama socket bağlı değil (throttled)');
        }
      },
      (error) => {
        console.error('❌ Konum takip hatası kodu:', error.code, 'mesaj:', error.message);

        // Daha kullanıcı dostu hata mesajları
        let errorMsg = 'Konum takibi yapılamıyor';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Konum izni reddedildi. Tarayıcı ayarlarından izin vermeniz gerekiyor.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Konum bilgisi alınamıyor. Lütfen başka bir ağa bağlanmayı deneyin.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Konum bilgisi alınamadı (zaman aşımı). Lütfen tekrar deneyin.';
            break;
          default:
            errorMsg = `Konum hatası: ${error.message}`;
        }

        setError(errorMsg);
      },
      geoOptions
    );
  };

  // Konum takibini durdur
  const stopTracking = () => {
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setIsTracking(false);
    console.log('📍 Konum takibi durduruldu');
  };

  // Throttled location update (5 saniyede bir)
  const throttledLocationUpdate = useRef(
    throttle((locationData) => {
      try {
        if (socket && socket.connected && typeof socket.emit === 'function') {
          socket.emit('location_update', locationData);
          console.log('📍 Konum güncellendi (throttled):', locationData);
        } else {
          console.warn('⚠️ Throttled update: Socket bağlı değil');
        }
      } catch (error) {
        console.error('❌ Konum gönderme hatası:', error);
      }
    }, 5000)
  ).current;

  // İki nokta arası mesafe hesaplama (Haversine formülü)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Dünya yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Yakındaki kullanıcıları filtrele - useCallback ile optimize edildi
  const filterNearbyUsers = useCallback((users, maxDistance = 10) => {
    if (!position || !users || !Array.isArray(users)) return [];

    return users.filter(user => {
      if (!user || !user.location || !user.location.latitude || !user.location.longitude) return false;

      try {
        const distance = calculateDistance(
          position.latitude,
          position.longitude,
          user.location.latitude,
          user.location.longitude
        );

        return distance <= maxDistance;
      } catch (error) {
        console.error('❌ Mesafe hesaplama hatası:', error);
        return false;
      }
    });
  }, [position]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || typeof socket.on !== 'function' || typeof socket.off !== 'function') {
      console.log('Socket bağlantısı yok veya on/off metodları bulunamadı');
      return;
    }

    try {
      // İlk odaya girişte tüm konumları al
      socket.on('room_locations_initial', (data) => {
        console.log('📍 Oda konumları yüklendi:', data.locations);
        if (data.locations && Array.isArray(data.locations)) {
          setNearbyUsers(data.locations.map(loc => ({
            userId: loc.userId,
            username: loc.username,
            avatar: loc.avatar,
            location: {
              latitude: loc.latitude,
              longitude: loc.longitude,
              timestamp: loc.timestamp
            }
          })));
        }
      });

      // Diğer kullanıcıların konum güncellemelerini dinle
      socket.on('user_location_update', (userData) => {
        console.log('📍 Kullanıcı konumu güncellendi:', userData);

        setNearbyUsers(prev => {
          const updated = prev.filter(user => user.userId !== userData.userId);
          return [...updated, {
            userId: userData.userId,
            username: userData.username,
            location: userData.location
          }];
        });
      });

      // Kullanıcı odadan ayrıldığında listeden çıkar
      socket.on('user_left', (data) => {
        if (data && data.userId) {
          setNearbyUsers(prev => prev.filter(user => user.userId !== data.userId));
        }
      });

      return () => {
        try {
          socket.off('room_locations_initial');
          socket.off('user_location_update');
          socket.off('user_left');
        } catch (error) {
          console.error('Socket event off hatası:', error);
        }
      };
    } catch (error) {
      console.error('Socket event dinleme hatası:', error);
      return () => { };
    }
  }, [socket]);

  // Component unmount'ta konum takibini durdur
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  return {
    position,
    error,
    isTracking,
    nearbyUsers,
    startTracking,
    stopTracking,
    calculateDistance
  };
};

// Throttle utility function
function throttle(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
