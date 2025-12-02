/**
 * useJanus Hook - Janus Gateway SFU entegrasyonu
 * GeoTalk Car Voice WebRTC projesi için
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

// Janus JS adapter - npm paketinden
const Janus = window.Janus; // CDN'den yüklenecek

const useJanus = (roomId, options = {}) => {
  const { socket } = useSocket();
  
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [audioTracks, setAudioTracks] = useState(new Map());
  const [error, setError] = useState(null);
  
  // Refs
  const janusRef = useRef(null);
  const pluginHandleRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamsRef = useRef(new Map());
  const iceServersRef = useRef([]);
  
  /**
   * Janus'ı başlat
   */
  const initializeJanus = useCallback(async () => {
    try {
      console.log('🎬 Janus başlatılıyor...');
      
      // Janus kütüphanesinin yüklenip yüklenmediğini kontrol et
      if (!window.Janus) {
        throw new Error('Janus kütüphanesi yüklenmedi. CDN bağlantısını kontrol edin.');
      }
      
      // ICE servers'ı backend'den al
      if (socket) {
        socket.emit('get_ice_servers');
        
        // ICE servers yanıtını bekle
        socket.once('ice_servers', (iceConfig) => {
          console.log('✅ ICE servers alındı:', iceConfig);
          iceServersRef.current = iceConfig.iceServers || [];
        });
      }
      
      // Janus'ı initialize et
      await new Promise((resolve, reject) => {
        Janus.init({
          debug: process.env.NODE_ENV === 'development' ? 'all' : false,
          dependencies: Janus.useDefaultDependencies(),
          callback: () => {
            console.log('✅ Janus initialized');
            resolve();
          }
        });
      });
      
      // Janus Gateway'e bağlan
      await connectToJanus();
      
      setIsInitialized(true);
      console.log('✅ Janus başlatıldı');
      
    } catch (err) {
      console.error('❌ Janus başlatma hatası:', err);
      setError(err.message);
      toast.error('Ses bağlantısı kurulamadı');
    }
  }, [socket]);
  
  /**
   * Janus Gateway'e bağlan
   */
  const connectToJanus = useCallback(async () => {
    try {
      // Janus Gateway URL'i
      const janusUrl = process.env.REACT_APP_JANUS_WS_URL || 'ws://localhost:8188';
      
      console.log('🔌 Janus Gateway\'e bağlanılıyor:', janusUrl);
      
      return new Promise((resolve, reject) => {
        janusRef.current = new Janus({
          server: janusUrl,
          iceServers: iceServersRef.current.length > 0 ? iceServersRef.current : [
            { urls: 'stun:stun.l.google.com:19302' }
          ],
          success: () => {
            console.log('✅ Janus Gateway\'e bağlandı');
            setIsConnected(true);
            
            // VideoRoom plugin'ini attach et
            attachVideoRoomPlugin()
              .then(resolve)
              .catch(reject);
          },
          error: (error) => {
            console.error('❌ Janus bağlantı hatası:', error);
            setIsConnected(false);
            reject(error);
          },
          destroyed: () => {
            console.log('🔌 Janus bağlantısı kapatıldı');
            setIsConnected(false);
          }
        });
      });
      
    } catch (err) {
      console.error('❌ Janus bağlantı hatası:', err);
      throw err;
    }
  }, []);
  
  /**
   * VideoRoom plugin'ini attach et
   */
  const attachVideoRoomPlugin = useCallback(async () => {
    try {
      console.log('🔌 VideoRoom plugin attach ediliyor...');
      
      return new Promise((resolve, reject) => {
        janusRef.current.attach({
          plugin: 'janus.plugin.videoroom',
          opaqueId: `geotalk_${Math.random().toString(36).substr(2, 9)}`,
          
          success: (pluginHandle) => {
            console.log('✅ VideoRoom plugin attach edildi');
            pluginHandleRef.current = pluginHandle;
            resolve(pluginHandle);
          },
          
          error: (error) => {
            console.error('❌ VideoRoom plugin attach hatası:', error);
            reject(error);
          },
          
          onmessage: (msg, jsep) => {
            handlePluginMessage(msg, jsep);
          },
          
          onlocaltrack: (track, on) => {
            handleLocalTrack(track, on);
          },
          
          onremotetrack: (track, mid, on) => {
            handleRemoteTrack(track, mid, on);
          },
          
          oncleanup: () => {
            console.log('🧹 VideoRoom cleanup');
            cleanupTracks();
          }
        });
      });
      
    } catch (err) {
      console.error('❌ VideoRoom plugin attach hatası:', err);
      throw err;
    }
  }, []);
  
  /**
   * Plugin mesajlarını işle
   */
  const handlePluginMessage = useCallback((msg, jsep) => {
    console.log('📨 VideoRoom mesajı:', msg);
    
    const event = msg.videoroom;
    
    switch (event) {
      case 'joined':
        console.log('✅ Odaya başarıyla katıldınız');
        handleJoinedEvent(msg);
        break;
        
      case 'event':
        if (msg.publishers) {
          console.log('📡 Publishers güncellendi:', msg.publishers);
          handlePublishersEvent(msg.publishers);
        }
        break;
        
      case 'talking':
        console.log('🎤 Konuşma başladı:', msg.id);
        handleTalkingEvent(msg.id, true);
        break;
        
      case 'stopped-talking':
        console.log('🤫 Konuşma bitti:', msg.id);
        handleTalkingEvent(msg.id, false);
        break;
        
      case 'leaving':
        console.log('👋 Katılımcı ayrıldı:', msg.leaving);
        handleLeavingEvent(msg.leaving);
        break;
        
      default:
        console.log('📨 Bilinmeyen VideoRoom event:', event);
    }
    
    // JSEP (WebRTC offer/answer) işle
    if (jsep) {
      handleJsep(jsep);
    }
  }, []);
  
  /**
   * Odaya katıldı event'ini işle
   */
  const handleJoinedEvent = useCallback((msg) => {
    // Mevcut publishers'ı al
    if (msg.publishers && msg.publishers.length > 0) {
      handlePublishersEvent(msg.publishers);
    }
    
    // Kendi yayınını başlat
    if (options.autoPublish !== false) {
      publishAudio();
    }
  }, [options.autoPublish]);
  
  /**
   * Publishers event'ini işle
   */
  const handlePublishersEvent = useCallback((publishers) => {
    publishers.forEach(publisher => {
      // Publisher'ı dinlemeye başla
      subscribeToPublisher(publisher);
    });
  }, []);
  
  /**
   * Talking event'ini işle
   */
  const handleTalkingEvent = useCallback((publisherId, isTalking) => {
    setParticipants(prev => {
      return prev.map(p => 
        p.id === publisherId 
          ? { ...p, isTalking } 
          : p
      );
    });
  }, []);
  
  /**
   * Leaving event'ini işle
   */
  const handleLeavingEvent = useCallback((leavingId) => {
    setParticipants(prev => prev.filter(p => p.id !== leavingId));
    
    // Remote stream'i temizle
    if (remoteStreamsRef.current.has(leavingId)) {
      const stream = remoteStreamsRef.current.get(leavingId);
      stream.getTracks().forEach(track => track.stop());
      remoteStreamsRef.current.delete(leavingId);
    }
    
    setAudioTracks(prev => {
      const newTracks = new Map(prev);
      newTracks.delete(leavingId);
      return newTracks;
    });
  }, []);
  
  /**
   * JSEP işle
   */
  const handleJsep = useCallback((jsep) => {
    console.log('📞 JSEP alındı:', jsep.type);
    
    pluginHandleRef.current.handleRemoteJsep({ jsep });
  }, []);
  
  /**
   * Local track işle
   */
  const handleLocalTrack = useCallback((track, on) => {
    console.log(`🎤 Local track ${on ? 'added' : 'removed'}:`, track.kind);
    
    if (on) {
      const stream = new MediaStream([track]);
      localStreamRef.current = stream;
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
    }
  }, []);
  
  /**
   * Remote track işle
   */
  const handleRemoteTrack = useCallback((track, mid, on) => {
    console.log(`🔊 Remote track ${on ? 'added' : 'removed'}:`, track.kind, mid);
    
    if (on) {
      const stream = new MediaStream([track]);
      
      // Publisher ID'yi tespit et (mid'den)
      const publisherId = mid; // Basitleştirilmiş
      
      remoteStreamsRef.current.set(publisherId, stream);
      
      setAudioTracks(prev => {
        const newTracks = new Map(prev);
        newTracks.set(publisherId, track);
        return newTracks;
      });
    }
  }, []);
  
  /**
   * Odaya katıl
   */
  const joinRoom = useCallback(async (displayName = 'User') => {
    try {
      if (!pluginHandleRef.current) {
        throw new Error('Plugin handle yok');
      }
      
      console.log('🚪 Odaya katılma isteği gönderiliyor:', roomId);
      
      const joinRequest = {
        request: 'join',
        room: parseInt(roomId),
        ptype: 'publisher',
        display: displayName
      };
      
      pluginHandleRef.current.send({ message: joinRequest });
      
    } catch (err) {
      console.error('❌ Odaya katılma hatası:', err);
      toast.error('Odaya katılamadınız');
      throw err;
    }
  }, [roomId]);
  
  /**
   * Ses yayınını başlat
   */
  const publishAudio = useCallback(async () => {
    try {
      if (!pluginHandleRef.current) {
        throw new Error('Plugin handle yok');
      }
      
      console.log('🎤 Ses yayını başlatılıyor...');
      
      // Mikrofon izni al
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      
      localStreamRef.current = stream;
      
      // Janus'a ses göndermeye başla
      pluginHandleRef.current.createOffer({
        tracks: [
          { type: 'audio', capture: true, recv: true }
        ],
        success: (jsep) => {
          console.log('✅ Offer oluşturuldu:', jsep);
          
          const publishRequest = {
            request: 'configure',
            audio: true,
            video: false
          };
          
          pluginHandleRef.current.send({
            message: publishRequest,
            jsep: jsep
          });
          
          setIsPublishing(true);
          console.log('✅ Ses yayını başlatıldı');
        },
        error: (error) => {
          console.error('❌ Offer oluşturma hatası:', error);
          toast.error('Ses yayını başlatılamadı');
        }
      });
      
    } catch (err) {
      console.error('❌ Ses yayını hatası:', err);
      toast.error('Mikrofon erişimi reddedildi');
      throw err;
    }
  }, []);
  
  /**
   * Publisher'a abone ol (dinle)
   */
  const subscribeToPublisher = useCallback(async (publisher) => {
    try {
      console.log('📡 Publisher\'a abone olunuyor:', publisher.id);
      
      // Yeni bir plugin handle oluştur (subscriber için)
      janusRef.current.attach({
        plugin: 'janus.plugin.videoroom',
        opaqueId: `geotalk_sub_${publisher.id}`,
        
        success: (pluginHandle) => {
          console.log('✅ Subscriber plugin attach edildi');
          
          const subscribeRequest = {
            request: 'join',
            room: parseInt(roomId),
            ptype: 'subscriber',
            feed: publisher.id
          };
          
          pluginHandle.send({ message: subscribeRequest });
        },
        
        onmessage: (msg, jsep) => {
          console.log('📨 Subscriber mesajı:', msg);
          
          if (jsep) {
            pluginHandle.createAnswer({
              jsep: jsep,
              tracks: [
                { type: 'audio', capture: false, recv: true }
              ],
              success: (answerJsep) => {
                console.log('✅ Answer oluşturuldu');
                
                const startRequest = {
                  request: 'start',
                  room: parseInt(roomId)
                };
                
                pluginHandle.send({
                  message: startRequest,
                  jsep: answerJsep
                });
              },
              error: (error) => {
                console.error('❌ Answer oluşturma hatası:', error);
              }
            });
          }
        },
        
        onremotetrack: (track, mid, on) => {
          console.log(`🔊 Subscriber remote track ${on ? 'added' : 'removed'}:`, track.kind);
          
          if (on) {
            const stream = new MediaStream([track]);
            remoteStreamsRef.current.set(publisher.id, stream);
            
            setAudioTracks(prev => {
              const newTracks = new Map(prev);
              newTracks.set(publisher.id, track);
              return newTracks;
            });
            
            // Participant listesine ekle
            setParticipants(prev => {
              const exists = prev.find(p => p.id === publisher.id);
              if (!exists) {
                return [...prev, {
                  id: publisher.id,
                  display: publisher.display,
                  isTalking: false
                }];
              }
              return prev;
            });
          }
        }
      });
      
    } catch (err) {
      console.error('❌ Publisher\'a abone olma hatası:', err);
    }
  }, [roomId]);
  
  /**
   * Track'leri temizle
   */
  const cleanupTracks = useCallback(() => {
    // Local stream temizle
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Remote streams temizle
    remoteStreamsRef.current.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    remoteStreamsRef.current.clear();
    
    setAudioTracks(new Map());
    setIsPublishing(false);
  }, []);
  
  /**
   * Odadan ayrıl
   */
  const leaveRoom = useCallback(async () => {
    try {
      console.log('🚪 Odadan ayrılma isteği gönderiliyor');
      
      if (pluginHandleRef.current) {
        const leaveRequest = {
          request: 'leave'
        };
        
        pluginHandleRef.current.send({ message: leaveRequest });
        
        // Detach plugin
        pluginHandleRef.current.detach();
        pluginHandleRef.current = null;
      }
      
      // Track'leri temizle
      cleanupTracks();
      
      setParticipants([]);
      
    } catch (err) {
      console.error('❌ Odadan ayrılma hatası:', err);
    }
  }, [cleanupTracks]);
  
  /**
   * Janus'ı kapat
   */
  const destroyJanus = useCallback(async () => {
    try {
      console.log('🔌 Janus kapatılıyor...');
      
      await leaveRoom();
      
      if (janusRef.current) {
        janusRef.current.destroy();
        janusRef.current = null;
      }
      
      setIsConnected(false);
      setIsInitialized(false);
      
      console.log('✅ Janus kapatıldı');
      
    } catch (err) {
      console.error('❌ Janus kapatma hatası:', err);
    }
  }, [leaveRoom]);
  
  // Component mount/unmount
  useEffect(() => {
    if (roomId && socket) {
      initializeJanus();
    }
    
    return () => {
      destroyJanus();
    };
  }, [roomId, socket]);
  
  return {
    isInitialized,
    isConnected,
    isPublishing,
    participants,
    audioTracks,
    error,
    joinRoom,
    leaveRoom,
    publishAudio,
    localStream: localStreamRef.current
  };
};

export default useJanus;