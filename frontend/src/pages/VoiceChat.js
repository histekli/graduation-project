import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import useMediasoup from '../hooks/useMediasoup';
import { useGeolocation } from '../hooks/useGeolocation';
import VoiceMap from '../components/VoiceMap';
import PushToTalkButton from '../components/PushToTalkButton';
import SecurityWarning from '../components/SecurityWarning';


import AudioWaveform from '../components/AudioWaveform';
import ChatBox from '../components/ChatBox';
import { MapPin, Users, LogOut, Volume2 } from 'lucide-react';

// Helper functions
const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

const checkMediaDevicesSupport = () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      return 'security-blocked';
    }
    return 'none';
  }
  if (navigator.mediaDevices.getSupportedConstraints) {
    return 'modern';
  }
  return 'legacy';
};

const VoiceChat = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket, connected, joinRoom: socketJoinRoom } = useSocket();
  const { user } = useAuth();

  // States
  const [room, setRoom] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);
  const [talkingUsers, setTalkingUsers] = useState([]);
  const [isMapVisible, setIsMapVisible] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Loading timeout - 5 saniye sonra loading'i kapat
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('⏰ Loading timeout reached');
        setLoading(false);
        if (!socket || !connected) {
          setError('Bağlantı kurulamadı - lütfen sayfayı yenileyin');
        }
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [loading, socket, connected]);

  // Hooks - Using Mediasoup SFU
  const {
    isConnected,
    isTalking,
    localStream,
    remoteStreams,
    audioPermissionGranted,
    initializeAudio,
    joinAsListener, // New!
    enableMicrophone, // New!
    startTalking,
    stopTalking,
    networkLatency
  } = useMediasoup(socket, roomId, user?._id);

  // Debug room state updates
  useEffect(() => {
    if (roomUsers.length > 0) {
      console.log('👥 [DEBUG Frontend] roomUsers updated:', roomUsers);
    }
  }, [roomUsers]);

  useEffect(() => {
    if (remoteStreams.size > 0) {
      console.log('🔄 [DEBUG Frontend] remoteStreams updated:', Array.from(remoteStreams.entries()));
    }
  }, [remoteStreams]);

  // Auto-join as listener when connected
  useEffect(() => {
    if (socket && roomId && !isConnected) {
      console.log('🎧 Auto-joining as listener...');
      // Use a small delay to ensure socket is ready
      const timer = setTimeout(() => {
        joinAsListener().catch(err => {
          console.error('❌ Auto-join failed:', err);
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [socket, roomId, isConnected, joinAsListener]);
  // Sync audioEnabled state with hook state
  useEffect(() => {
    if (localStream && audioPermissionGranted) {
      console.log('🎤 Ses izni ve akışı tespit edildi, arayüz güncelleniyor.');
      setAudioEnabled(true);
    }
  }, [localStream, audioPermissionGranted]);

  const {
    position,
    error: locationError,
    isTracking,
    nearbyUsers,
    startTracking,
    stopTracking,
    calculateDistance
  } = useGeolocation();

  // Oda bilgilerini al ve kullanıcıyı odaya ekle
  useEffect(() => {
    if (!roomId) {
      console.log('⚠️ Room ID missing');
      setError('Oda ID bulunamadı');
      setLoading(false);
      return;
    }



    if (!socket || !connected) {
      console.log('⚠️ Socket not ready, waiting...:', { socket: !!socket, connected });
      // Socket hazır olmadığında loading state'i koruyoruz
      return;
    }

    // Yeni bir katılım görevi oluştur
    const joinRoomTask = async () => {
      try {
        setError(null);
        console.log('🏠 Oda durumu kontrol ediliyor:', roomId);

        // Dashboard'dan sessiz katılım kontrolü
        const isSilentJoin = sessionStorage.getItem('silent_room_join') === 'true';
        if (isSilentJoin) {
          console.log('🔇 Sessiz katılım modu aktif - tekrar katılma işlemi yapılmayacak');
          sessionStorage.removeItem('silent_room_join'); // Kullandıktan sonra temizle

          // Mevcut localStorage oda ID'si doğru mu kontrol et
          if (localStorage.getItem('current_room_id') === roomId) {
            console.log('✅ Oda ID doğrulandı, tekrar katılım yapılmayacak');
            setLoading(false);
            return; // Katılım işlemini tekrarlama
          }
        }

        // Ek olarak, eğer location.state içinde yeni oda oluşturma bayrağı varsa, tekrar katılma
        const isNewRoomCreation = sessionStorage.getItem('new_room_created') === roomId;
        if (isNewRoomCreation) {
          console.log('🆕 Yeni oluşturulan oda algılandı:', roomId);
          sessionStorage.removeItem('new_room_created'); // Kullandıktan sonra temizle
          // Mevcut localStorage oda ID'si doğru mu kontrol et
          if (localStorage.getItem('current_room_id') === roomId) {
            console.log('✅ Yeni oda ID doğrulandı, tekrar katılım yapılmayacak');
            setLoading(false);
            return; // Katılım işlemini tekrarlama
          }
        }

        // Oda ID'sini localStorage'a kaydet (eğer yoksa)
        if (!localStorage.getItem('current_room_id')) {
          localStorage.setItem('current_room_id', roomId);
        }

        // Önce mevcut durumu kontrol et (zaten bu odada mı?)
        if (socket.currentRoom && socket.currentRoom._id === roomId) {
          console.log('⚠️ Zaten bu odadayız:', roomId);
          setLoading(false);
          return;
        }

        // SocketContext'teki joinRoom fonksiyonunu kullan
        if (socketJoinRoom && typeof socketJoinRoom === 'function') {
          console.log('🔄 Odaya katılım işlemi başlatılıyor:', roomId);
          socketJoinRoom(roomId);
        } else {
          throw new Error('Join room function not available');
        }

        // Loading durumunu hemen kapatma, event listener'lar room_joined eventini beklesin
      } catch (error) {
        console.error('❌ Oda katılım hatası:', error);
        setError('Odaya katılılamadı: ' + error.message);
        setLoading(false);
      }
    };

    // Sayfa ilk açıldığında veya yenilendiğinde oda bağlantısı kurulur
    joinRoomTask();
  }, [socket, roomId, connected, socketJoinRoom, user]);

  // Socket event listeners
  useEffect(() => {
    // Daha güvenli socket kontrolü
    if (!socket || !connected) {
      console.log('⚠️ Socket or connection not ready');
      return;
    }

    // Socket metodlarının varlığını kontrol et
    if (typeof socket !== 'object' || !socket.on || typeof socket.on !== 'function') {
      console.log('⚠️ Socket object invalid or missing methods');
      return;
    }

    console.log('🔌 Setting up socket listeners');

    // Event handler fonksiyonları
    const handleRoomJoined = (data) => {
      console.log('✅ Odaya başarıyla katıldı:', data);
      if (data?.room && data?.users) {
        setRoom(data.room);
        setRoomUsers(data.users || []);
        setLoading(false); // Artık yükleme tamamlandı

        // Odaya katıldığımızı localStorage'da işaretleyelim
        localStorage.setItem('current_room_id', data.room._id);

        // Odaya başarıyla katıldıktan SONRA konum tracking'i başlat
        // Bu, backend'de currentRoom set edildikten sonra olur
        if (!isTracking) {
          console.log('🔍 Odaya katılım başarılı, konum tracking otomatik başlatılıyor...');
          startTracking();
        }
      }
    };

    const handleRoomUsersUpdated = (users) => {
      console.log('👥 Oda kullanıcıları güncellendi:', users);
      if (Array.isArray(users)) {
        setRoomUsers(users);
      }
    };

    const handleUserJoined = (data) => {
      console.log('👤 Yeni kullanıcı odaya katıldı:', data);
      if (data?.user) {
        // Eğer user tam bir user objesi ise
        setRoomUsers(prevUsers => {
          // Eğer bu kullanıcı zaten listede varsa, onu güncelle
          const userExists = prevUsers.some(u => u._id === data.user._id);
          if (userExists) {
            return prevUsers.map(u => u._id === data.user._id ? data.user : u);
          }
          // Yoksa yeni kullanıcıyı ekle
          return [...prevUsers, data.user];
        });
      } else if (data?.userId) {
        // Eğer user tam bir obje değil sadece ID ve username içeriyorsa
        // Burada backend'den tam kullanıcı listesini talep etmek veya
        // elimizdeki sınırlı bilgi ile bir kullanıcı eklemek mantıklı olabilir

        // Basit kullanıcı eklemesi
        const newUser = {
          _id: data.userId,
          username: data.username,
          location: data.location || null,
          isOnline: true
        };

        setRoomUsers(prevUsers => {
          const userExists = prevUsers.some(u => u._id === data.userId);
          if (userExists) return prevUsers;
          return [...prevUsers, newUser];
        });
      }
    };

    const handleUserLeft = (data) => {
      console.log('👤 Kullanıcı odadan ayrıldı:', data);
      if (data?.userId) {
        setRoomUsers(prevUsers => prevUsers.filter(user => user._id !== data.userId));
        // Konuşma listesinden de çıkar
        setTalkingUsers(prev => prev.filter(id => id !== data.userId));
      }
    };

    const handleUserStartedTalking = (data) => {
      console.log('🎤 Kullanıcı konuşmaya başladı:', data);
      if (data?.userId) {
        setTalkingUsers(prev => [...prev.filter(id => id !== data.userId), data.userId]);

        // Remote stream'i kontrol et
        const remoteStream = remoteStreams.get(data.userId);
        if (remoteStream) {
          console.log('🔊 Remote stream durumu:', {
            userId: data.userId,
            active: remoteStream.active,
            audioTracks: remoteStream.getAudioTracks().map(t => ({
              enabled: t.enabled,
              muted: t.muted,
              readyState: t.readyState,
              label: t.label
            }))
          });
        } else {
          console.warn('⚠️ Remote stream bulunamadı:', data.userId);
        }
      }
    };

    const handleUserStoppedTalking = (data) => {
      console.log('🤫 Kullanıcı konuşmayı bıraktı:', data);
      if (data?.userId) {
        setTalkingUsers(prev => prev.filter(id => id !== data.userId));
      }
    };

    const handleRoomError = (data) => {
      console.error('❌ Oda hatası:', data);
      setError(data?.message || 'Bilinmeyen hata');
      setLoading(false);
    };

    // Try-catch ile event listener ekleme
    try {
      // Standart oda olayları
      socket.on('room_joined', handleRoomJoined);
      socket.on('room_users_updated', handleRoomUsersUpdated);

      // Kullanıcı giriş-çıkış olayları (standardize edilmiş)
      socket.on('user_joined', handleUserJoined);
      socket.on('user_left', handleUserLeft);

      // Konuşma olayları
      socket.on('user_started_talking', handleUserStartedTalking);
      socket.on('user_stopped_talking', handleUserStoppedTalking);

      socket.on('error', handleRoomError);

      // Auth Hatası - Token geçersizse çıkış yap
      socket.on('auth_error', () => {
        console.error('❌ Socket Auth Hatası - Oturum kapatılıyor');
        localStorage.removeItem('carvoice_token');
        window.location.href = '/login';
      });

      console.log('✅ Socket event listeners attached successfully');

      // Odaya katıldıktan hemen sonra güncel kullanıcı listesini al
      socket.emit('get_room_users', { roomId });

    } catch (error) {
      console.error('❌ Failed to attach socket listeners:', error);
      return;
    }

    // Cleanup function
    return () => {
      try {
        if (socket && typeof socket.off === 'function') {
          // Standart oda olayları
          socket.off('room_joined', handleRoomJoined);
          socket.off('room_users_updated', handleRoomUsersUpdated);

          // Kullanıcı giriş-çıkış olayları (standardize edilmiş)
          socket.off('user_joined', handleUserJoined);
          socket.off('user_left', handleUserLeft);

          // Konuşma olayları
          socket.off('user_started_talking', handleUserStartedTalking);
          socket.off('user_stopped_talking', handleUserStoppedTalking);

          socket.off('error', handleRoomError);

          console.log('🧹 Socket event listeners cleaned up');

          // Odadan ayrılma olayını da tetikleyelim - component unmount olunca
          if (roomId) {
            socket.emit('leave_room', { roomId });
            console.log('🚪 Component unmount: Odadan çıkılıyor');

            // API call to leave room
            // API call to leave room
            axios.post(`/api/rooms/${roomId}/leave`)
              .catch(err => {
                // Ignore 401 errors on unmount (token may be cleared)
                if (err.response?.status !== 401) {
                  console.error('Component unmount oda ayrılma API hatası:', err);
                }
              });

          }
        }
      } catch (error) {
        console.error('❌ Error during socket cleanup:', error);
      }
    };
  }, [socket, connected, roomId, user]);

  // Ses başlatma - SFU ile sadeleştirilmiş versiyon
  const handleEnableAudio = async () => {
    try {
      setError(null);
      console.log('🎤 Ses başlatma işlemi başlıyor (SFU)...');

      await initializeAudio();
      setAudioEnabled(true);
      console.log('✅ Ses başarıyla başlatıldı (SFU)');

      console.log('✅ Mikrofon başarıyla etkinleştirildi! SFU üzerinden ses iletiliyor.');

    } catch (error) {
      console.error('❌ Ses başlatma hatası:', error);

      let userFriendlyMessage = error.message;

      // Mikrofon izin hatalarını kontrol et
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        userFriendlyMessage = 'Mikrofon izni reddedildi. Lütfen tarayıcı ayarlarından mikrofon iznini etkinleştirin.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        userFriendlyMessage = 'Mikrofon bulunamadı. Lütfen bir mikrofon bağlayın.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        userFriendlyMessage = 'Mikrofon başka bir uygulama tarafından kullanılıyor olabilir.';
      }

      // HTTPS uyarısı
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        userFriendlyMessage += '\n\n🔒 Güvenlik: Bu site HTTPS üzerinden çalışmıyor. Sesli iletişim için güvenli bağlantı gerekli olabilir.';
      }

      setError(userFriendlyMessage);
    }
  };

  // Konum takibi başlatma
  const handleEnableLocation = () => {
    startTracking();
  };

  // Konuşma başlama
  const handleStartTalking = () => {
    console.log('📲 handleStartTalking çağrıldı');
    if (audioEnabled) {
      startTalking();
      // Notify other users via socket for UI updates
      if (socket && connected) {
        socket.emit('start_talking', { roomId });
      }
    }
  };

  // Konuşma bitirme
  const handleStopTalking = () => {
    console.log('📲 handleStopTalking çağrıldı');
    if (audioEnabled) {
      stopTalking();
      // Notify other users via socket for UI updates
      if (socket && connected) {
        socket.emit('stop_talking', { roomId });
      }
    }
  };

  // Kullanıcıya tıklandığında
  const handleUserClick = (user) => {
    console.log('👤 Kullanıcıya tıklandı:', user);
    // Burada kullanıcı ile direkt bağlantı kurma işlevi eklenebilir
  };

  // Odadan ayrılma fonksiyonu
  const leaveRoom = () => {
    console.log('🚪 Odadan ayrılma işlemi başlatılıyor');

    // Misafir kullanıcılar için basitleştirilmiş akış
    if (user?.isGuest) {
      console.log('👤 Misafir kullanıcı - Basitleştirilmiş odadan ayrılma');

      // Konum izlemeyi durdur
      if (typeof stopTracking === 'function') {
        stopTracking();
        console.log('✅ Konum izleme durduruldu');
      }

      // Medya akışlarını temizle
      if (localStream) {
        try {
          localStream.getTracks().forEach(track => track.stop());
          console.log('✅ Medya akışları temizlendi');
        } catch (err) {
          console.error('❌ Medya akışı temizleme hatası:', err);
        }
      }

      navigate('/dashboard');
      return;
    }

    // Socket.io emit ile odadan ayrılma sinyali gönder
    if (socket && connected && typeof socket.emit === 'function') {
      socket.emit('leave_room', { roomId });
      console.log('✅ Socket leave_room eventi gönderildi');

      // SocketContext'teki currentRoom durumunu temizlemek için localStorage temizle
      window.localStorage.removeItem('current_room_id');
    }

    // Konum izlemeyi durdur
    if (typeof stopTracking === 'function') {
      stopTracking();
      console.log('✅ Konum izleme durduruldu');
    }

    // Medya akışlarını temizle
    if (localStream) {
      try {
        localStream.getTracks().forEach(track => track.stop());
        console.log('✅ Medya akışları temizlendi');
      } catch (err) {
        console.error('❌ Medya akışı temizleme hatası:', err);
      }
    }

    // API üzerinden odadan ayrılalım (bu backend user.currentRoom'u temizleyecek)
    // API üzerinden odadan ayrılalım (bu backend user.currentRoom'u temizleyecek)
    axios.post(`/api/rooms/${roomId}/leave`)
      .then(() => console.log('✅ API odadan ayrılma başarılı'))
      .catch(err => {
        // Ignore 401 errors on unmount (token may be cleared)
        if (err.response?.status !== 401) {
          console.error('❌ API odadan ayrılma hatası:', err);
        }
      })
      .finally(() => {
        // Ayrılma işlemi tamamlandı, dashboard'a yönlendir
        console.log('🔄 Dashboard sayfasına yönlendiriliyor');
        navigate('/dashboard');
      });
  };

  // Butondan odadan ayrılma
  const handleLeaveRoom = () => {
    leaveRoom();
  };

  // Tarayıcı geri tuşu için popstate olayını dinle
  useEffect(() => {
    const handlePopState = (event) => {
      console.log('⬅️ Geri tuşuna basıldı');

      // Olay varsayılan davranışını engelleyelim ve kendi ayrılma işlemimizi yapalım
      event.preventDefault();

      // Kullanıcı odada mı kontrol et
      if (roomId && socket && connected) {
        leaveRoom();
      }
    };

    // Tarayıcı geçmişini güncelle, ancak URL'yi değiştirme
    window.history.pushState({ roomId }, document.title);

    // Geri tuşu olayını dinle
    window.addEventListener('popstate', handlePopState);

    // Component unmount olduğunda temizle
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [roomId, socket, connected, navigate, localStream, stopTracking]); // eslint-disable-line react-hooks/exhaustive-deps

  // Yakındaki kullanıcılara mesafe ekle
  const nearbyUsersWithDistance = nearbyUsers.map(user => {
    if (position && user.location) {
      const distance = calculateDistance(
        position.latitude,
        position.longitude,
        user.location.latitude,
        user.location.longitude
      );
      return { ...user, distance };
    }
    return user;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-600">Odaya katılınıyor...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-4">
          <div className="text-red-600 text-center mb-4">
            <div className="text-4xl mb-2">⚠️</div>
            <div className="text-lg font-medium">Hata Oluştu</div>
            <div className="text-sm mt-2">{error}</div>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
          >
            Dashboard'a Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Üst Bar - Sabit Yükseklik */}
      <div className="flex-none bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">{room?.name || 'Sesli Sohbet'}</h1>
              {connected && (
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                  Bağlı
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {/* Ağ Gecikmesi */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-md">
                <span className="text-xs text-gray-600">📡</span>
                <span className="text-sm font-medium">{networkLatency}ms</span>
              </div>
              {/* Harita Toggle */}
              <button
                onClick={() => setIsMapVisible(!isMapVisible)}
                className={`p-2 rounded-md ${isMapVisible ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <MapPin size={20} />
              </button>
              {/* Ayrıl Butonu */}
              <button
                onClick={handleLeaveRoom}
                className="flex items-center space-x-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Ayrıl</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ana İçerik - Kalan Alan */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Güvenlik Uyarısı - Compact */}
          <SecurityWarning />

          {/* Grid Layout - Tek Ekran */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100%-1rem)]">

            {/* Ana İçerik - Harita */}
            <div className="lg:col-span-2">
              {isMapVisible ? (
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium text-gray-900">Konum Haritası</h2>
                      {!isTracking && (
                        <button
                          onClick={handleEnableLocation}
                          className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600"
                        >
                          Konumu Etkinleştir
                        </button>
                      )}
                    </div>
                    {locationError && (
                      <div className="text-red-600 text-sm mt-2">
                        ⚠️ {locationError}
                      </div>
                    )}
                  </div>

                  <div className="h-96 lg:h-[500px]">
                    <VoiceMap
                      currentPosition={position}
                      nearbyUsers={nearbyUsersWithDistance}
                      talkingUsers={talkingUsers}
                      onUserClick={handleUserClick}
                      className="h-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-8 text-center">
                  <MapPin size={48} className="text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Harita Gizlendi</h3>
                  <p className="text-gray-600 mb-4">
                    Yakınınızdaki kullanıcıları görmek için haritayı etkinleştirin
                  </p>
                  <button
                    onClick={() => setIsMapVisible(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    Haritayı Göster
                  </button>
                </div>
              )}
            </div>

            {/* Yan Panel - Ses Kontrolü */}
            <div className="space-y-6">

              {/* Push-to-Talk */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-medium text-gray-900">Ses Kontrolü</h3>
                </div>

                <div className="p-4">
                  {!audioEnabled ? (
                    <div className="space-y-4">


                      {/* API desteklenmiyorsa uyarı */}
                      {checkMediaDevicesSupport() === 'none' && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="text-red-800 text-sm">
                            <strong>⚠️ Uyumsuz Tarayıcı</strong>
                            <br />
                            Bu tarayıcı mikrofon erişimini desteklemiyor.
                            Lütfen güncel Chrome, Firefox veya Safari kullanın.
                          </div>
                        </div>
                      )}

                      {/* Güvenlik sorunu uyarısı */}
                      {checkMediaDevicesSupport() === 'security-blocked' && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="text-yellow-800 text-sm">
                            <strong>🔒 Güvenlik Kısıtlaması</strong>
                            <br />
                            HTTP bağlantılarda mikrofon erişimi güvenlik nedeniyle engellenmiştir.
                            <br />
                            <strong>📱 Mobil Çözüm:</strong>
                            <br />
                            <div className="mt-3 p-3 bg-white rounded-lg border border-yellow-300">
                              <strong>🌐 HTTPS Adresi:</strong><br />
                              <code className="text-blue-600">
                                https://{window.location.hostname}:3443{window.location.pathname}
                              </code>
                              <br />
                              <button
                                onClick={() => {
                                  const httpsUrl = `https://${window.location.hostname}:3443${window.location.pathname}${window.location.search}`;
                                  window.location.href = httpsUrl;
                                }}
                                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                              >
                                🔒 HTTPS'e Geç
                              </button>
                            </div>
                            <br />
                            <strong>💻 Masaüstü Çözüm:</strong>
                            <br />
                            • Chrome: chrome://flags/#unsafely-treat-insecure-origin-as-secure
                            <br />
                            • Firefox: about:config → media.navigator.permission.disabled
                            <br />
                            <em>⚠️ Not: Bu ayarlar sadece geliştirme için önerilir.</em>
                          </div>
                        </div>
                      )}

                      {/* Mobil ve Masaüstü Etkinleştirme */}
                      <div className="text-center">
                        <Volume2 size={48} className="text-gray-300 mx-auto mb-4" />
                        <h4 className="text-lg font-medium text-gray-900 mb-2">Ses Erişimi</h4>



                        <p className="text-gray-600 mb-4">
                          Konuşmak için mikrofonunuza erişim izni gerekli
                        </p>

                        <div className="space-y-3">
                          <button
                            onClick={() => {
                              // Using the new separated method
                              enableMicrophone().catch(err => setError('Mikrofon hatası: ' + err.message));
                            }}
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-lg shadow-md transition-all w-full"
                          >
                            🎤 Mikrofonu Etkinleştir
                          </button>


                        </div>

                        {/* Mobil için ek ipuçları */}
                        {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
                          <div className="mt-4 text-xs text-gray-500">
                            <p>💡 İpucu: Mikrofon izni vermezseniz ses özelliklerini kullanamazsınız</p>
                            <p>🔄 Sorun yaşarsanız sayfayı yenileyin ve tekrar deneyin</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <PushToTalkButton
                      onStartTalking={handleStartTalking}
                      onStopTalking={handleStopTalking}
                      isTalking={isTalking}
                      isConnected={isConnected}
                      remoteStreams={remoteStreams}
                      localStream={localStream}
                      nearbyUsersCount={nearbyUsersWithDistance.length}
                      audioPermissionGranted={audioPermissionGranted}
                      audioEnabled={audioEnabled}
                    />
                  )}
                </div>
              </div>

              {/* Kullanıcı Listesi */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-medium text-gray-900">
                    Kullanıcılar ({roomUsers.length})
                  </h3>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {roomUsers.map((roomUser) => (
                    <div
                      key={roomUser._id}
                      className={`p-3 border-b border-gray-100 ${talkingUsers.includes(roomUser._id) ? 'bg-red-50' : ''
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${talkingUsers.includes(roomUser._id) ? 'bg-red-500 animate-pulse' : 'bg-blue-500'
                            }`}>
                            {roomUser.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{roomUser.username}</div>
                            {roomUser.location && position && (
                              <div className="text-xs text-gray-500">
                                {calculateDistance(
                                  position.latitude,
                                  position.longitude,
                                  roomUser.location.latitude,
                                  roomUser.location.longitude
                                ).toFixed(1)}km uzaklık
                              </div>
                            )}
                          </div>
                        </div>

                        {talkingUsers.includes(roomUser._id) && (
                          <span className="text-red-500 text-xs font-medium">
                            🎤 Konuşuyor
                          </span>
                        )}
                      </div>

                      {/* Ses Barı - Sadece konuşanlar için göster */}
                      {talkingUsers.includes(roomUser._id) && (
                        <div className="w-full mt-2">
                          {user && user._id === roomUser._id && localStream ? (
                            // Kendi ses barımız (konuşuyorsak)
                            <AudioWaveform
                              audioStream={localStream}
                              isActive={true}
                              height={30}
                              color="#ef4444"
                            />
                          ) : remoteStreams instanceof Map && remoteStreams.has(roomUser._id) ? (
                            // Diğer kullanıcıların ses barları (konuşuyorlarsa)
                            <AudioWaveform
                              audioStream={remoteStreams.get(roomUser._id)}
                              isActive={true}
                              height={30}
                              color="#ef4444"
                            />
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}

                  {roomUsers.length === 0 && (
                    <div className="p-4 text-center text-gray-500">
                      Henüz başka kullanıcı yok
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Chat Box Component */}
        {room && socket && user && (
          <ChatBox
            socket={socket}
            roomId={roomId}
            user={user}
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen(!isChatOpen)}
          />
        )}
        {/* Audio Playback Elements - INVISIBLE */}
        {/* Audio Playback Elements - INVISIBLE */}
        {Array.from(remoteStreams).map(([userId, stream]) => {
          // Only render if stream is active and has tracks
          if (stream && stream.active && stream.getAudioTracks().length > 0) {
            return (
              <audio
                key={userId}
                ref={el => {
                  if (el) {
                    if (el.srcObject !== stream) {
                      el.srcObject = stream;
                    }
                    // Attempt to play immediately
                    el.play().catch(e => {
                      console.warn(`⚠️ Autoplay prevented for ${userId}, waiting for interaction:`, e);
                      // Add a one-time click listener to document to retry play
                      const retryPlay = () => {
                        el.play().catch(err => console.error('❌ Retry play failed:', err));
                        document.removeEventListener('click', retryPlay);
                        document.removeEventListener('touchstart', retryPlay);
                      };
                      document.addEventListener('click', retryPlay);
                      document.addEventListener('touchstart', retryPlay);
                    });
                  }
                }}
                autoPlay
                playsInline
                controls={false}
                style={{ display: 'none' }}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default VoiceChat;
