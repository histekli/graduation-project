import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  const createOfferRef = useRef(null);
  const negotiatingRef = useRef(new Set()); // Track ongoing negotiations per user
  const pendingOffersRef = useRef(new Map()); // Bekleyen offer'lar (local stream hazır değilken)
  const createAnswerRef = useRef(null); // createAnswer fonksiyonu için ref
  
  // Dinamik host IP'yi al
  const getHostIP = () => {
    return window.location.hostname;
  };
  
  // STUN/TURN konfigürasyonu - useMemo ile optimize edildi
  const rtcConfig = useMemo(() => ({
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
    bundlePolicy: 'max-compat',
    rtcpMuxPolicy: 'require',
    rtcpMuxPolicy: 'require'
  }), []); // Hostname değişmediği için bağımlılık yok

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
    // Güvenlik kontrolleri
    const isSecureContext = window.isSecureContext;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    
    // navigator.mediaDevices var mı?
    if (!navigator.mediaDevices) {
      console.warn('⚠️ navigator.mediaDevices desteklenmiyor');
      
      // Eski API'yi dene
      if (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia) {
        console.log('✅ Legacy getUserMedia API bulundu');
        return 'legacy';
      } else {
        console.error('❌ Hiçbir getUserMedia API desteklenmiyor');
        
        // Güvenlik kısıtlaması mı?
        if (!isSecureContext && !isLocalhost) {
          console.error('🔒 Güvenlik kısıtlaması nedeniyle APIlar engellenmiş');
          return 'security-blocked';
        }
        
        return 'none';
      }
    }
    
    // getUserMedia fonksiyonu var mı?
    if (!navigator.mediaDevices.getUserMedia) {
      console.warn('⚠️ navigator.mediaDevices.getUserMedia desteklenmiyor');
      return 'legacy';
    }
    
    // Başarılı - sadece ilk seferde log bas
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
      
      // Track'ler başlangıçta disabled, kullanıcı konuşmaya başladığında enabled olacak
      stream.getAudioTracks().forEach(track => {
        track.enabled = false;
        console.log('🔇 Audio track başlangıçta disabled:', track.label);
      });
      
      // Mevcut peer connectionlara trackleri ekle
      if (peers.size > 0) {
        console.log('🔄 Mevcut peer connectionlara trackler ekleniyor:', peers.size);
        console.log('👥 Peer IDs:', Array.from(peers.keys()));
        
        peers.forEach((peerConnection, userId) => {
          console.log('🔍 Peer kontrol ediliyor:', userId, 'State:', peerConnection.signalingState, 'Connection:', peerConnection.connectionState);
          
          // Connection kapalı mı kontrol et
          if (peerConnection.signalingState === 'closed') {
            console.warn('⚠️ Peer connection closed, skipping track addition:', userId);
            return;
          }
          
          // Connection stable mı kontrol et - STABLE değilse bekleyelim
          if (peerConnection.signalingState !== 'stable') {
            console.warn('⚠️ Peer connection not stable, will retry after stable. State:', peerConnection.signalingState, userId);
            
            // Stable olunca tekrar dene
            const onStable = () => {
              if (peerConnection.signalingState === 'stable') {
                console.log('✅ Peer stable oldu, track ekleniyor:', userId);
                const senders = peerConnection.getSenders();
                const tracksToAdd = stream.getTracks().filter(track => {
                  return !senders.some(sender => sender.track === track);
                });
                
                if (tracksToAdd.length > 0) {
                  console.log('➕ Stable sonrası track ekleniyor:', userId, tracksToAdd.length);
                  tracksToAdd.forEach(track => {
                    peerConnection.addTrack(track, stream);
                  });
                  
                  // Renegotiation
                  if (createOfferRef.current) {
                    console.log('📞 Renegotiation offer gönderiliyor:', userId);
                    createOfferRef.current(userId);
                  }
                }
              }
            };
            
            // SignalingState change event'ini dinle
            peerConnection.addEventListener('signalingstatechange', onStable, { once: true });
            
            // 1 saniye sonra da kontrol et (fallback)
            setTimeout(onStable, 1000);
            return;
          }
          
          const senders = peerConnection.getSenders();
          console.log('📊 Mevcut senders:', senders.length);
          
          const tracksToAdd = stream.getTracks().filter(track => {
            return !senders.some(sender => sender.track === track);
          });
          
          console.log('📊 Eklenecek trackler:', tracksToAdd.length);
          
          if (tracksToAdd.length > 0) {
            try {
              console.log('➕ Trackler ekleniyor:', userId, tracksToAdd.length);
              tracksToAdd.forEach(track => {
                console.log('🎵 Track ekleniyor:', track.kind, track.label);
                peerConnection.addTrack(track, stream);
              });
              
              // Renegotiation gerekli - yeni offer gönder
              if (createOfferRef.current) {
                console.log('📞 Renegotiation için offer gönderiliyor:', userId);
                createOfferRef.current(userId);
              }
            } catch (trackError) {
              console.error('❌ Track ekleme hatası:', userId, trackError);
            }
          } else {
            console.log('ℹ️ Eklenecek track yok (zaten ekli):', userId);
          }
        });
      } else {
        console.log('ℹ️ Henüz peer connection yok');
      }
      
      // Bekleyen offer'ları işle (eğer varsa)
      if (pendingOffersRef.current.size > 0) {
        console.log('📨 Bekleyen offer\'lar işleniyor:', pendingOffersRef.current.size);
        for (const [userId, offer] of pendingOffersRef.current.entries()) {
          console.log('📞 Bekleyen offer işleniyor:', userId);
          try {
            // createAnswerRef kullan
            if (createAnswerRef.current) {
              await createAnswerRef.current(offer, userId);
              pendingOffersRef.current.delete(userId);
            }
          } catch (error) {
            console.error('❌ Bekleyen offer işleme hatası:', userId, error);
          }
        }
      }
      
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
  }, [initializeAudioContext, checkMicrophonePermission, isMobile, isIOS, checkMediaDevicesSupport, getLegacyUserMedia, peers]);

  // Peer connection oluşturma - useCallback ile optimize edildi
  const createPeerConnection = useCallback((userId) => {
    console.log('🔧 Creating peer connection for:', userId);
    const peerConnection = new RTCPeerConnection(rtcConfig);
    
    // ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate generated for:', userId);
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
      console.log('🔊 Remote stream alındı:', userId, 'Streams:', event.streams.length);
      console.log('📊 Track detayları:', event.track.kind, 'ID:', event.track.id, 'Enabled:', event.track.enabled, 'Muted:', event.track.muted, 'ReadyState:', event.track.readyState);
      
      // Track unmute event'ini dinle
      event.track.onunmute = () => {
        console.log('🔊 Track unmuted:', userId, event.track.kind);
      };
      
      event.track.onmute = () => {
        console.log('🔇 Track muted:', userId, event.track.kind);
      };
      
      event.track.onended = () => {
        console.log('🔴 Track ended:', userId, event.track.kind);
      };
      
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        console.log('🎵 Stream tracks:', stream.getTracks().map(t => ({ 
          kind: t.kind, 
          id: t.id,
          enabled: t.enabled, 
          muted: t.muted,
          readyState: t.readyState,
          label: t.label
        })));
        
        // Audio track kontrolü
        const audioTracks = stream.getAudioTracks();
        console.log('🎤 Audio tracks sayısı:', audioTracks.length);
        if (audioTracks.length === 0) {
          console.warn('⚠️ Remote stream\'de audio track yok!');
        } else {
          // Her audio track için event listener'lar ekle
          audioTracks.forEach(track => {
            track.onunmute = () => {
              console.log('🔊 Audio track unmuted (stream level):', userId);
            };
            track.onmute = () => {
              console.log('🔇 Audio track muted (stream level):', userId);
            };
          });
        }
        
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(userId, stream);
          return newMap;
        });
      }
    };

    // Connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      console.log(`📡 Peer ${userId} connection state:`, peerConnection.connectionState);
      
      // Connection failed durumunda yeniden başlat
      if (peerConnection.connectionState === 'failed') {
        console.warn('⚠️ Peer connection failed, attempting restart:', userId);
        
        // Negotiation flag'ini temizle
        negotiatingRef.current.delete(userId);
        
        // Peer'ı temizle ve yeniden oluştur
        setPeers(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
        
        // Kısa bir gecikme sonra yeniden bağlan
        setTimeout(() => {
          if (createOfferRef.current) {
            console.log('🔄 Restarting peer connection:', userId);
            createOfferRef.current(userId);
          }
        }, 500);
      }
      
      // Disconnected durumunda da flag'i temizle
      if (peerConnection.connectionState === 'disconnected') {
        negotiatingRef.current.delete(userId);
      }
    };
    
    // ICE connection state monitoring
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🧊 Peer ${userId} ICE state:`, peerConnection.iceConnectionState);
      
      // ICE failed durumunda da flag'i temizle
      if (peerConnection.iceConnectionState === 'failed') {
        negotiatingRef.current.delete(userId);
      }
    };
    
    // Negotiation needed - devre dışı (manuel kontrol daha güvenli)
    peerConnection.onnegotiationneeded = async () => {
      console.log('🔄 Negotiation needed for peer (ignoring):', userId);
      // Otomatik renegotiation devre dışı - track'ler zaten connection'a ekleniyor
    };

    return peerConnection;
  }, [socket, roomId, rtcConfig]);

  // Offer oluşturma ve gönderme - useCallback ile optimize edildi
  const createOffer = useCallback(async (targetUserId) => {
    try {
      // Zaten negotiation devam ediyorsa atla
      if (negotiatingRef.current.has(targetUserId)) {
        console.log('⏭️ Skipping offer - already negotiating with:', targetUserId);
        return;
      }
      
      console.log('📞 Creating offer for:', targetUserId);
      negotiatingRef.current.add(targetUserId);
      
      // Mevcut peer connection'ı kontrol et
      let peerConnection = peers.get(targetUserId);
      
      // Connection kapalı veya yok ise yeni oluştur
      if (!peerConnection || peerConnection.signalingState === 'closed') {
        console.log('🆕 Creating new peer connection for:', targetUserId);
        peerConnection = createPeerConnection(targetUserId);
        setPeers(prev => new Map(prev).set(targetUserId, peerConnection));
      } else if (peerConnection.signalingState !== 'stable') {
        console.log('⚠️ Peer connection not stable, state:', peerConnection.signalingState);
        negotiatingRef.current.delete(targetUserId);
        return;
      } else {
        console.log('♻️ Reusing existing peer connection for:', targetUserId);
      }
      
      // Local stream ekleme (sadece henüz eklenmemişse)
      if (localStreamRef.current) {
        const senders = peerConnection.getSenders();
        const tracksToAdd = localStreamRef.current.getTracks().filter(track => {
          return !senders.some(sender => sender.track === track);
        });
        
        if (tracksToAdd.length > 0) {
          console.log('🎤 Adding local tracks to peer connection:', tracksToAdd.length);
          tracksToAdd.forEach(track => {
            console.log('🎵 Adding track:', track.kind, 'enabled:', track.enabled);
            peerConnection.addTrack(track, localStreamRef.current);
          });
        }
      } else {
        console.warn('⚠️ No local stream available for offer - Skipping offer creation');
        negotiatingRef.current.delete(targetUserId);
        return; // Local stream yoksa offer gönderme!
      }

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      console.log('📝 Offer created, setting local description');
      await peerConnection.setLocalDescription(offer);

      if (socket && typeof socket.emit === 'function') {
        socket.emit('webrtc_offer', {
          offer,
          targetUserId,
          roomId
        });
        console.log('✅ Offer başarıyla gönderildi:', targetUserId);
      } else {
        console.error('Socket bağlantısı yok veya emit metodu bulunamadı (webrtc-offer)');
      }
      
    } catch (error) {
      console.error('❌ Offer oluşturma hatası:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      // Hata durumunda flag'i temizle
      negotiatingRef.current.delete(targetUserId);
    } finally {
      // Negotiation flag'ini temizle (kısa timeout - cevap hızlı gelecek)
      setTimeout(() => {
        negotiatingRef.current.delete(targetUserId);
      }, 200); // 200ms sonra temizle
    }
  }, [roomId, socket, createPeerConnection, peers]);

  // Answer oluşturma ve gönderme - useCallback ile optimize edildi
  const createAnswer = useCallback(async (offer, fromUserId) => {
    try {
      console.log('📞 Creating answer for:', fromUserId);
      
      // Mevcut peer connection'ı kontrol et
      let peerConnection = peers.get(fromUserId);
      let isNewConnection = false;
      
      // Connection kapalı veya yok ise yeni oluştur
      if (!peerConnection || peerConnection.signalingState === 'closed') {
        console.log('🆕 Creating new peer connection for answer:', fromUserId);
        peerConnection = createPeerConnection(fromUserId);
        setPeers(prev => new Map(prev).set(fromUserId, peerConnection));
        isNewConnection = true;
      } else {
        console.log('♻️ Reusing existing peer connection for answer:', fromUserId);
        
        // Eğer stable değilse, önce rollback yap
        if (peerConnection.signalingState !== 'stable') {
          console.log('⚠️ Peer not stable, rolling back. Current state:', peerConnection.signalingState);
          // Yeni peer oluştur
          peerConnection.close();
          peerConnection = createPeerConnection(fromUserId);
          setPeers(prev => new Map(prev).set(fromUserId, peerConnection));
          isNewConnection = true;
        }
      }
      
      // Local stream ekleme - SADECE yeni connection ise
      if (isNewConnection && localStreamRef.current) {
        const senders = peerConnection.getSenders();
        const tracksToAdd = localStreamRef.current.getTracks().filter(track => {
          return !senders.some(sender => sender.track === track);
        });
        
        if (tracksToAdd.length > 0) {
          console.log('🎤 Adding local tracks to NEW peer connection (answer):', tracksToAdd.length);
          tracksToAdd.forEach(track => {
            console.log('🎵 Adding track:', track.kind, 'enabled:', track.enabled);
            peerConnection.addTrack(track, localStreamRef.current);
          });
        }
      } else if (!isNewConnection) {
        console.log('♻️ Existing connection, tracks already added - skipping');
      } else {
        console.warn('⚠️ No local stream available for answer');
      }

      console.log('📝 Setting remote description (offer)');
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      console.log('📝 Answer created, setting local description');
      await peerConnection.setLocalDescription(answer);

      if (socket && typeof socket.emit === 'function') {
        socket.emit('webrtc_answer', {
          answer,
          targetUserId: fromUserId,
          roomId
        });
        console.log('✅ Answer başarıyla gönderildi:', fromUserId);
      } else {
        console.error('Socket bağlantısı yok veya emit metodu bulunamadı (webrtc-answer)');
      }
      
    } catch (error) {
      console.error('❌ Answer oluşturma hatası:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }, [roomId, socket, createPeerConnection, peers]);

  // createAnswer'ı ref'e ata (initializeAudio'da kullanmak için)
  useEffect(() => {
    createAnswerRef.current = createAnswer;
  }, [createAnswer]);

  // Push-to-talk başlatma - geliştirilmiş versiyon
  const startTalking = useCallback(() => {
    console.log('🎤 startTalking çağrıldı:', { 
      hasStream: !!localStream, 
      isTalking, 
      hasPermission: audioPermissionGranted 
    });
    
    if (!localStream || !audioPermissionGranted) {
      console.log('⚠️ Konuşma başlatılamıyor:', { 
        hasStream: !!localStream, 
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
        console.log('🎤 Audio track enabled:', track.label, 'Current enabled:', track.enabled);
      });
      
      console.log('✅ Konuşma başladı - Track\'ler aktif');
      return true;
    } catch (error) {
      console.error('❌ Konuşma başlatma hatası:', error);
      setIsTalking(false);
      return false;
    }
  }, [localStream, isTalking, audioPermissionGranted]);

  // Push-to-talk bitirme - geliştirilmiş versiyon  
  const stopTalking = useCallback(() => {
    console.log('🤫 stopTalking çağrıldı:', { hasStream: !!localStream, isTalking });
    
    if (!localStream) {
      console.warn('⚠️ Local stream yok, konuşma durdurulamıyor');
      return false;
    }

    try {
      setIsTalking(false);
      
      // Audio track'leri devre dışı bırak (stream'i kapatmak yerine)
      localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
        console.log('🤫 Audio track disabled:', track.label, 'Current enabled:', track.enabled);
      });
      
      console.log('✅ Konuşma başarıyla durduruldu');
      return true;
    } catch (error) {
      console.error('❌ Konuşma bitirme hatası:', error);
      return false;
    }
  }, [localStream]);

  // createOffer ref'ini güncelle (circular dependency önlemek için)
  useEffect(() => {
    createOfferRef.current = createOffer;
  }, [createOffer]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || typeof socket.on !== 'function' || typeof socket.off !== 'function') {
      console.log('⚠️ WebRTC: Socket bağlantısı yok veya on/off metodları bulunamadı');
      return;
    }

    console.log('🔌 WebRTC: Socket event listeners kuruluyor');

    try {
      // WebRTC offer geldiğinde
      socket.on('webrtc_offer', async ({ offer, fromUserId }) => {
        try {
          console.log('📞 WebRTC: Offer alındı:', fromUserId);
          
          // Local stream yoksa önce bekle
          if (!localStreamRef.current) {
            console.warn('⚠️ Offer alındı ama local stream henüz hazır değil. Offer saklanıyor:', fromUserId);
            // Offer'ı sakla ve ses başlatılınca işle
            pendingOffersRef.current.set(fromUserId, offer);
            return;
          }
          
          await createAnswer(offer, fromUserId);
        } catch (error) {
          console.error('❌ WebRTC: Offer işleme hatası:', error);
        }
      });

      // WebRTC answer geldiğinde
      socket.on('webrtc_answer', async ({ answer, fromUserId }) => {
        try {
          console.log('📞 Answer alındı:', fromUserId);
          const peerConnection = peers.get(fromUserId);
          
          if (!peerConnection) {
            console.warn('⚠️ Peer connection not found for answer:', fromUserId);
            return;
          }
          
          // Closed check
          if (peerConnection.signalingState === 'closed') {
            console.warn('⚠️ Peer connection closed, cannot set answer:', fromUserId);
            return;
          }
          
          // State kontrolü - answer sadece 'have-local-offer' state'inde set edilebilir
          if (peerConnection.signalingState !== 'have-local-offer') {
            console.warn('⚠️ Cannot set answer, wrong state:', peerConnection.signalingState);
            return;
          }
          
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('✅ Answer başarıyla işlendi:', fromUserId);
          
          // Negotiation flag'ini temizle
          negotiatingRef.current.delete(fromUserId);
          
        } catch (error) {
          console.error('❌ Answer işleme hatası:', error);
          negotiatingRef.current.delete(fromUserId);
        }
      });

      // ICE candidate geldiğinde
      socket.on('ice_candidate', async ({ candidate, fromUserId }) => {
        try {
          console.log('🧊 ICE candidate alındı:', fromUserId);
          const peerConnection = peers.get(fromUserId);
          
          if (!peerConnection) {
            console.warn('⚠️ Peer connection not found for ICE candidate:', fromUserId);
            return;
          }
          
          // Peer connection state kontrolü
          if (peerConnection.signalingState === 'closed') {
            console.warn('⚠️ Cannot add ICE candidate, peer connection closed:', fromUserId);
            return;
          }
          
          // Remote description olmadan ICE candidate eklenemez
          if (!peerConnection.remoteDescription) {
            console.warn('⚠️ Remote description not set yet, queueing ICE candidate:', fromUserId);
            // ICE candidate'i kuyruğa al (WebRTC otomatik olarak yönetecek)
            return;
          }
          
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          // ICE candidate hataları genellikle kritik değil
          if (error.name !== 'InvalidStateError') {
            console.error('❌ ICE candidate işleme hatası:', error);
          }
        }
      });

      // Yeni kullanıcı odaya katıldığında
      socket.on('user_joined', (data) => {
        try {
          const userId = data.userId || (data.user && data.user._id);
          if (userId && userId !== socket.userId) {
            console.log('👋 Yeni kullanıcı katıldı:', userId);
            
            // Local stream hazırsa offer gönder, değilse bekle (ses başlatılınca gönderilecek)
            if (localStreamRef.current) {
              console.log('📞 Yeni kullanıcıya offer gönderiliyor:', userId);
              createOffer(userId);
            } else {
              console.log('⏳ Local stream henüz hazır değil, kullanıcı ses başlattığında offer gönderilecek:', userId);
            }
          }
        } catch (error) {
          console.error('❌ Kullanıcı katılma işleme hatası:', error);
        }
      });

      // Odaya katıldığımızda mevcut kullanıcılara offer gönder
      // NOT: Sadece local stream hazırsa offer gönder
      socket.on('room_joined', (data) => {
        try {
          if (data.users && Array.isArray(data.users)) {
            console.log('🏠 Odaya katıldık, mevcut kullanıcılar:', data.users.length);
            
            // Local stream yoksa offer gönderme - ses başlatıldığında otomatik olarak gönderilecek
            if (!localStreamRef.current) {
              console.log('⏳ Local stream henüz hazır değil, ses başlatılınca offer gönderilecek');
              return;
            }
            
            console.log('📞 Mevcut kullanıcılara offer gönderiliyor');
            data.users.forEach(user => {
              if (user._id && user._id !== socket.userId) {
                console.log('📞 Mevcut kullanıcıya offer gönderiliyor:', user._id);
                createOffer(user._id);
              }
            });
          }
        } catch (error) {
          console.error('❌ Oda katılım işleme hatası:', error);
        }
      });

      // Kullanıcı odadan ayrıldığında
      socket.on('user_left', ({ userId }) => {
        try {
          console.log('👋 Kullanıcı ayrıldı:', userId);
          
          // Negotiation flag'ini temizle
          negotiatingRef.current.delete(userId);
          
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
          socket.off('user_joined');
          socket.off('user_left');
          socket.off('room_joined');
        } catch (error) {
          console.error('❌ Socket event dinleyicileri temizleme hatası:', error);
        }
      };
    } catch (error) {
      console.error('❌ Socket event dinleyicileri kurma hatası:', error);
      return () => {};
    }
  }, [socket, roomId]); // peers, createAnswer, createOffer zaten ref olarak kullanılıyor

  // Cleanup - geliştirilmiş versiyon
  useEffect(() => {
    return () => {
      console.log('🧹 WebRTC cleanup başlıyor...');
      
      // Negotiation flags'i temizle
      negotiatingRef.current.clear();
      
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
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
          console.log('🎵 Audio context closed');
        } catch (error) {
          console.error('❌ Error closing audio context:', error);
        }
        audioContextRef.current = null;
      }
    };
  }, []); // Sadece component unmount'ta çalışsın!

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
    isIOS,
    createOffer, // Export for manual offer sending
    peers
  };
};
