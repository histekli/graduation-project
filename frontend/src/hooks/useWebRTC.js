import { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';

export const useWebRTC = (roomId) => {
  const { socket } = useSocket();
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [peers, setPeers] = useState(new Map());
  const [audioPermissionGranted, setAudioPermissionGranted] = useState(false);
  const [audioContext, setAudioContext] = useState(null);
  
  const localStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  
  // Dinamik host IP'yi al
  const getHostIP = () => {
    return window.location.hostname;
  };
  
  // STUN/TURN konfigürasyonu
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.nextcloud.com:443' },
      // Yerel TURN sunucusu - ağdaki diğer cihazlarla iletişim için
      { 
        urls: [
          `turn:${getHostIP()}:3478`,
          `turn:${getHostIP()}:3478?transport=tcp`,
          `turns:${getHostIP()}:5349?transport=tcp`
        ],
        username: 'carvoice',
        credential: 'carvoice_turn_secret_2024'
      }
    ],
    // WebRTC güvenlik ayarları - yerel ağda test için
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  // Audio context başlatma (mobil uyumluluk için)
  const initializeAudioContext = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
        setAudioContext(audioContextRef.current);
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      console.log('🎵 Audio context initialized');
      return audioContextRef.current;
    } catch (error) {
      console.error('❌ Audio context initialization failed:', error);
      throw error;
    }
  }, []);

  // Mobil tarayıcı tespiti
  const isMobile = useCallback(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  const isIOS = useCallback(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, []);

  // Mikrofon erişim kontrolü
  const checkMicrophonePermission = useCallback(async () => {
    try {
      // Mobil cihazlarda permission API genellikle desteklenmez
      if (isMobile()) {
        console.log('📱 Mobil cihaz tespit edildi, getUserMedia ile direkt deneme yapılacak');
        return 'prompt';
      }
      
      const permission = await navigator.permissions.query({ name: 'microphone' });
      return permission.state;
    } catch (error) {
      console.log('⚠️ Permission API not supported, proceeding with getUserMedia');
      return 'prompt';
    }
  }, [isMobile]);

  // MediaDevices API desteği kontrolü
  const checkMediaDevicesSupport = useCallback(() => {
    console.log('🔍 MediaDevices desteği kontrol ediliyor...');
    
    // Güvenlik kontrolleri
    const isSecureContext = window.isSecureContext;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    
    console.log('� Güvenlik bilgileri:', {
      isSecureContext,
      isLocalhost,
      isHttps,
      protocol: window.location.protocol,
      hostname: window.location.hostname
    });
    
    console.log('�🔍 navigator:', {
      hasNavigator: !!navigator,
      hasMediaDevices: !!navigator?.mediaDevices,
      hasGetUserMedia: !!navigator?.mediaDevices?.getUserMedia,
      hasLegacyGetUserMedia: !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia),
      userAgent: navigator.userAgent
    });
    
    // navigator.mediaDevices var mı?
    if (!navigator.mediaDevices) {
      console.log('⚠️ navigator.mediaDevices desteklenmiyor');
      
      // Eski API'yi dene
      if (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia) {
        console.log('✅ Legacy getUserMedia API bulundu');
        return 'legacy';
      } else {
        console.log('❌ Hiçbir getUserMedia API desteklenmiyor');
        
        // Güvenlik kısıtlaması mı?
        if (!isSecureContext && !isLocalhost) {
          console.log('🔒 Güvenlik kısıtlaması nedeniyle APIlar engellenmiş');
          return 'security-blocked';
        }
        
        return 'none';
      }
    }
    
    // getUserMedia fonksiyonu var mı?
    if (!navigator.mediaDevices.getUserMedia) {
      console.log('⚠️ navigator.mediaDevices.getUserMedia desteklenmiyor');
      return 'legacy';
    }
    
    console.log('✅ Modern MediaDevices API destekleniyor');
    return 'modern';
  }, []);

  // Legacy getUserMedia wrapper
  const getLegacyUserMedia = useCallback((constraints) => {
    return new Promise((resolve, reject) => {
      const getUserMedia = navigator.getUserMedia || 
                          navigator.webkitGetUserMedia || 
                          navigator.mozGetUserMedia || 
                          navigator.msGetUserMedia;
      
      if (!getUserMedia) {
        reject(new Error('getUserMedia API desteklenmiyor'));
        return;
      }
      
      getUserMedia.call(navigator, constraints, resolve, reject);
    });
  }, []);

  // Mikrofon başlatma - mobil optimizeli versiyon
  const initializeAudio = useCallback(async () => {
    try {
      const isMobileDevice = isMobile();
      const isIOSDevice = isIOS();
      const apiSupport = checkMediaDevicesSupport();
      
      console.log('🎤 Mikrofon başlatma başlıyor...', {
        isMobile: isMobileDevice,
        isIOS: isIOSDevice,
        apiSupport,
        userAgent: navigator.userAgent
      });

      // API desteği yoksa hata ver
      if (apiSupport === 'none') {
        throw new Error('Bu tarayıcı mikrofon erişimini desteklemiyor. Lütfen daha güncel bir tarayıcı kullanın.');
      }

      // Mobil cihazlarda önce kullanıcı etkileşimi gerekli
      if (isMobileDevice) {
        console.log('📱 Mobil cihaz için özel başlatma prosedürü');
        
        // iOS için özel audio context başlatma
        if (isIOSDevice) {
          console.log('🍎 iOS cihaz tespit edildi');
          await initializeAudioContext();
        }
      } else {
        // Masaüstü için normal audio context başlatma
        await initializeAudioContext();
      }
      
      // İzin kontrolü
      const permissionState = await checkMicrophonePermission();
      console.log('🎤 Mikrofon izin durumu:', permissionState);
      
      // Mobil için optimize edilmiş constraints
      const constraints = {
        audio: isMobileDevice ? {
          // Mobil için minimal constraints
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // Mobilde sorun çıkarabilir
          sampleRate: 16000,
          channelCount: 1,
          // iOS için ek ayarlar
          ...(isIOSDevice && {
            volume: 1.0,
            echoCancellationType: 'browser'
          })
        } : {
          // Masaüstü için full constraints
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          sampleSize: 16,
          channelCount: 1
        },
        video: false
      };
      
      console.log('🎤 getUserMedia çağrılıyor...', { constraints, apiSupport });
      
      // Mobil cihazlarda timeout ekle
      const timeoutMs = isMobileDevice ? 15000 : 5000;
      
      // API türüne göre stream al
      let streamPromise;
      if (apiSupport === 'modern') {
        streamPromise = navigator.mediaDevices.getUserMedia(constraints);
      } else {
        // Legacy API kullan
        console.log('🔧 Legacy getUserMedia API kullanılıyor');
        streamPromise = getLegacyUserMedia(constraints);
      }
      
      const stream = await Promise.race([
        streamPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Mikrofon erişim zaman aşımı')), timeoutMs)
        )
      ]);
      
      // Stream'i doğrula
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('Ses track\'i bulunamadı');
      }
      
      // Mobil cihazlarda track ayarlarını kontrol et
      if (isMobileDevice) {
        audioTracks.forEach((track, index) => {
          console.log(`📱 Mobil audio track ${index}:`, {
            label: track.label,
            enabled: track.enabled,
            readyState: track.readyState,
            settings: track.getSettings ? track.getSettings() : 'N/A'
          });
        });
      }
      
      console.log('✅ Mikrofon başarıyla başlatıldı:', {
        tracks: audioTracks.length,
        isMobile: isMobileDevice,
        settings: audioTracks[0].getSettings ? audioTracks[0].getSettings() : 'N/A'
      });
      
      setLocalStream(stream);
      localStreamRef.current = stream;
      setAudioPermissionGranted(true);
      setIsConnected(true);
      
      return stream;
    } catch (error) {
      console.error('❌ Mikrofon erişim hatası:', error);
      setAudioPermissionGranted(false);
      
      // Mobil özel hata mesajları
      let errorMessage = 'Mikrofon erişim hatası';
      
      if (isMobile()) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          if (isIOS()) {
            errorMessage = '🍎 iOS Safari: Ayarlar > Safari > Kamera ve Mikrofon > Bu Site > Mikrofon İzin Ver';
          } else {
            errorMessage = '📱 Android: Tarayıcı adres çubuğundaki mikrofon simgesine basın ve "İzin Ver" seçin';
          }
        } else if (error.message === 'Mikrofon erişim zaman aşımı') {
          errorMessage = '📱 Mobil cihazlarda mikrofon izni zaman aldı. Lütfen tekrar deneyin ve izin verin.';
        }
      } else {
        // Masaüstü hata mesajları
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Mikrofon izni reddedildi. Adres çubuğundaki mikrofon simgesine tıklayın.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'Mikrofon bulunamadı. Cihazınızın mikrofonunu kontrol edin.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = 'Mikrofon kullanımda. Diğer uygulamaları kapatıp tekrar deneyin.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Mikrofon ayarları desteklenmiyor. Daha basit ayarlarla tekrar deneniyor...';
        } else if (error.name === 'SecurityError') {
          errorMessage = 'Güvenlik hatası. HTTPS bağlantısı gerekli.';
        }
      }
      
      const customError = new Error(errorMessage);
      customError.originalError = error;
      throw customError;
    }
  }, [initializeAudioContext, checkMicrophonePermission, isMobile, isIOS, checkMediaDevicesSupport, getLegacyUserMedia]);

  // Peer connection oluşturma
  const createPeerConnection = (userId) => {
    const peerConnection = new RTCPeerConnection(rtcConfig);
    
    // ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        if (socket && typeof socket.emit === 'function') {
          socket.emit('ice_candidate', {
            candidate: event.candidate,
            targetUserId: userId,
            roomId
          });
        } else {
          console.log('Socket bağlantısı yok veya emit metodu bulunamadı (ICE candidate)');
        }
      }
    };

    // Remote stream handling
    peerConnection.ontrack = (event) => {
      console.log('🔊 Remote stream alındı:', userId);
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, event.streams[0]);
        return newMap;
      });
    };

    // Connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      console.log(`📡 Peer ${userId} connection state:`, peerConnection.connectionState);
    };

    return peerConnection;
  };

  // Offer oluşturma ve gönderme
  const createOffer = async (targetUserId) => {
    try {
      const peerConnection = createPeerConnection(targetUserId);
      
      // Local stream ekleme
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current);
        });
      }

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      setPeers(prev => new Map(prev).set(targetUserId, peerConnection));

      if (socket && typeof socket.emit === 'function') {
        socket.emit('webrtc_offer', {
          offer,
          targetUserId,
          roomId
        });
      } else {
        console.error('Socket bağlantısı yok veya emit metodu bulunamadı (webrtc-offer)');
      }

      console.log('📞 Offer gönderildi:', targetUserId);
    } catch (error) {
      console.error('❌ Offer oluşturma hatası:', error);
    }
  };

  // Answer oluşturma ve gönderme
  const createAnswer = async (offer, fromUserId) => {
    try {
      const peerConnection = createPeerConnection(fromUserId);
      
      // Local stream ekleme
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current);
        });
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      setPeers(prev => new Map(prev).set(fromUserId, peerConnection));

      if (socket && typeof socket.emit === 'function') {
        socket.emit('webrtc_answer', {
          answer,
          targetUserId: fromUserId,
          roomId
        });
      } else {
        console.error('Socket bağlantısı yok veya emit metodu bulunamadı (webrtc-answer)');
      }

      console.log('📞 Answer gönderildi:', fromUserId);
    } catch (error) {
      console.error('❌ Answer oluşturma hatası:', error);
    }
  };

  // Push-to-talk başlatma - geliştirilmiş versiyon
  const startTalking = useCallback(() => {
    if (!localStream || isTalking || !audioPermissionGranted) {
      console.log('⚠️ Konuşma başlatılamıyor:', { 
        hasStream: !!localStream, 
        isTalking, 
        hasPermission: audioPermissionGranted 
      });
      return false;
    }

    try {
      setIsTalking(true);
      
      // Audio context'i aktifleştir (mobil için önemli)
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      // Audio track'leri etkinleştir
      localStream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log('🎤 Audio track enabled:', track.label);
      });
      
      // Tüm bağlı peer'lere ses akışını gönder
      let connectedPeers = 0;
      peers.forEach((peerConnection, userId) => {
        if (peerConnection.connectionState === 'connected' || peerConnection.connectionState === 'connecting') {
          connectedPeers++;
          
          // Track'leri peer connection'a ekle
          localStream.getTracks().forEach(track => {
            const sender = peerConnection.getSenders().find(s => s.track === track);
            if (!sender) {
              try {
                peerConnection.addTrack(track, localStream);
                console.log('📡 Track added to peer:', userId);
              } catch (error) {
                console.error('❌ Error adding track to peer:', error);
              }
            }
          });
        }
      });
      
      console.log('🎤 Konuşma başladı -', connectedPeers, 'peer\'e gönderiliyor');
      return true;
    } catch (error) {
      console.error('❌ Konuşma başlatma hatası:', error);
      setIsTalking(false);
      return false;
    }
  }, [localStream, isTalking, audioPermissionGranted, peers]);

  // Push-to-talk bitirme - geliştirilmiş versiyon  
  const stopTalking = useCallback(() => {
    if (!localStream || !isTalking) {
      return false;
    }

    try {
      setIsTalking(false);
      
      // Audio track'leri devre dışı bırak (stream'i kapatmak yerine)
      localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
        console.log('🤫 Audio track disabled:', track.label);
      });
      
      console.log('🤫 Konuşma bitti');
      return true;
    } catch (error) {
      console.error('❌ Konuşma bitirme hatası:', error);
      return false;
    }
  }, [localStream, isTalking]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || typeof socket.on !== 'function' || typeof socket.off !== 'function') {
      console.log('Socket bağlantısı yok veya on/off metodları bulunamadı (WebRTC)');
      return;
    }

    try {
      // WebRTC offer geldiğinde
      socket.on('webrtc_offer', async ({ offer, fromUserId }) => {
        try {
          console.log('📞 Offer alındı:', fromUserId);
          await createAnswer(offer, fromUserId);
        } catch (error) {
          console.error('❌ Offer işleme hatası:', error);
        }
      });

      // WebRTC answer geldiğinde
      socket.on('webrtc_answer', async ({ answer, fromUserId }) => {
        try {
          console.log('📞 Answer alındı:', fromUserId);
          const peerConnection = peers.get(fromUserId);
          if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          }
        } catch (error) {
          console.error('❌ Answer işleme hatası:', error);
        }
      });

      // ICE candidate geldiğinde
      socket.on('ice_candidate', async ({ candidate, fromUserId }) => {
        try {
          console.log('🧊 ICE candidate alındı:', fromUserId);
          const peerConnection = peers.get(fromUserId);
          if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (error) {
          console.error('❌ ICE candidate işleme hatası:', error);
        }
      });

      // Yeni kullanıcı odaya katıldığında
      socket.on('user_joined_room', ({ userId }) => {
        try {
          console.log('👋 Yeni kullanıcı katıldı, offer gönderiliyor:', userId);
          createOffer(userId);
        } catch (error) {
          console.error('❌ Kullanıcı katılma işleme hatası:', error);
        }
      });

      // Kullanıcı odadan ayrıldığında
      socket.on('user_left_room', ({ userId }) => {
        try {
          console.log('👋 Kullanıcı ayrıldı:', userId);
          const peerConnection = peers.get(userId);
          if (peerConnection) {
            peerConnection.close();
            setPeers(prev => {
              const newMap = new Map(prev);
              newMap.delete(userId);
              return newMap;
            });
          }
          
          setRemoteStreams(prev => {
            const newMap = new Map(prev);
            newMap.delete(userId);
            return newMap;
          });
        } catch (error) {
          console.error('❌ Kullanıcı ayrılma işleme hatası:', error);
        }
      });

      return () => {
        try {
          socket.off('webrtc_offer');
          socket.off('webrtc_answer');
          socket.off('ice_candidate');
          socket.off('user_joined_room');
          socket.off('user_left_room');
        } catch (error) {
          console.error('❌ Socket event dinleyicileri temizleme hatası:', error);
        }
      };
    } catch (error) {
      console.error('❌ Socket event dinleyicileri kurma hatası:', error);
      return () => {};
    }
  }, [socket, peers, roomId, createAnswer, createOffer]);

  // Cleanup - geliştirilmiş versiyon
  useEffect(() => {
    return () => {
      console.log('🧹 WebRTC cleanup başlıyor...');
      
      // Local stream'i temizle
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 Local track stopped:', track.label);
        });
      }
      
      // Peer connections'ları temizle
      peers.forEach((peerConnection, userId) => {
        try {
          peerConnection.close();
          console.log('📡 Peer connection closed:', userId);
        } catch (error) {
          console.error('❌ Error closing peer connection:', error);
        }
      });
      
      // Audio context'i temizle
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
          console.log('🎵 Audio context closed');
        } catch (error) {
          console.error('❌ Error closing audio context:', error);
        }
      }
    };
  }, []); // Sadece component unmount'ta çalışsın

  // Mikrofon izin durumunu kontrol et (sayfa yüklendiğinde)
  useEffect(() => {
    const checkInitialPermission = async () => {
      try {
        const permissionState = await checkMicrophonePermission();
        if (permissionState === 'granted') {
          setAudioPermissionGranted(true);
        }
      } catch (error) {
        console.log('⚠️ Initial permission check failed:', error);
      }
    };
    
    checkInitialPermission();
  }, [checkMicrophonePermission]);

  // Mobil için basit mikrofon başlatma
  const initializeAudioMobile = useCallback(async () => {
    try {
      console.log('📱 Mobil mikrofon başlatma (basit mod)');
      
      const apiSupport = checkMediaDevicesSupport();
      console.log('📱 API desteği:', apiSupport);
      
      // API desteği yoksa hata ver
      if (apiSupport === 'none') {
        throw new Error('Bu mobil tarayıcı mikrofon erişimini desteklemiyor. Lütfen Chrome, Firefox veya Safari kullanın.');
      }
      
      // En basit constraints
      const simpleConstraints = {
        audio: true,
        video: false
      };
      
      console.log('📱 Basit getUserMedia çağrısı yapılıyor...', { apiSupport });
      
      let stream;
      if (apiSupport === 'modern') {
        stream = await navigator.mediaDevices.getUserMedia(simpleConstraints);
      } else {
        // Legacy API kullan
        console.log('📱 Legacy API kullanılıyor...');
        stream = await getLegacyUserMedia(simpleConstraints);
      }
      
      console.log('✅ Mobil mikrofon basit modda başarıyla başlatıldı');
      
      setLocalStream(stream);
      localStreamRef.current = stream;
      setAudioPermissionGranted(true);
      setIsConnected(true);
      
      return stream;
    } catch (error) {
      console.error('❌ Mobil basit mod mikrofon hatası:', error);
      
      // Mobil özel hata mesajı
      let mobileError = 'Mobil mikrofon erişimi başarısız: ';
      if (error.message.includes('getUserMedia')) {
        mobileError += 'Tarayıcınız mikrofon erişimini desteklemiyor. Chrome veya Firefox deneyin.';
      } else if (error.name === 'NotAllowedError') {
        mobileError += 'Mikrofon izni reddedildi. Tarayıcı ayarlarından izin verin.';
      } else {
        mobileError += error.message;
      }
      
      const customError = new Error(mobileError);
      customError.originalError = error;
      throw customError;
    }
  }, [checkMediaDevicesSupport, getLegacyUserMedia]);

  return {
    isConnected,
    isTalking,
    localStream,
    remoteStreams,
    audioPermissionGranted,
    audioContext,
    initializeAudio,
    initializeAudioMobile,
    startTalking,
    stopTalking,
    checkMicrophonePermission,
    checkMediaDevicesSupport,
    isMobile,
    isIOS
  };
};
