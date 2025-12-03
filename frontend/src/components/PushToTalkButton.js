import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, Users } from 'lucide-react';
import AudioWaveform from './AudioWaveform';

const PushToTalkButton = ({ 
  onStartTalking, 
  onStopTalking, 
  isTalking, 
  isConnected,
  remoteStreams,
  localStream,
  nearbyUsersCount = 0,
  audioPermissionGranted = false,
  audioEnabled = false
}) => {
  const [isTalkingActive, setIsTalkingActive] = useState(false);
  const audioRefs = useRef(new Map());
  
  // Toggle mantığı: Bir bas aç, bir bas kapat

  // Toggle butonu - bir kez tıkla aç, bir kez tıkla kapat
  const handleToggleClick = useCallback(() => {
    if (!isConnected) return;
    
    if (isTalkingActive) {
      setIsTalkingActive(false);
      setTimeout(() => onStopTalking(), 0);
    } else {
      setIsTalkingActive(true);
      setTimeout(() => onStartTalking(), 0);
    }
  }, [isTalkingActive, isConnected, onStartTalking, onStopTalking]);

  // Keyboard event handler (Space tuşu) - toggle
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        handleToggleClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleToggleClick]);

  // Remote stream'leri ses elementlerine bağla
  useEffect(() => {
    const handleRemoteStreams = async () => {
      // remoteStreams Map veya Object olabilir, her ikisini de destekle
      const entries = remoteStreams instanceof Map 
        ? remoteStreams.entries() 
        : Object.entries(remoteStreams || {});
      
      for (const [userId, stream] of entries) {
        let audioElement = audioRefs.current.get(userId);
        
        if (!audioElement) {
          audioElement = document.createElement('audio');
          audioElement.autoplay = true;
          audioElement.playsInline = true;
          audioElement.controls = false;
          audioElement.muted = false;
          audioElement.volume = 1.0;
          
          audioElement.setAttribute('webkit-playsinline', 'true');
          audioElement.setAttribute('playsinline', 'true');
          
          audioRefs.current.set(userId, audioElement);
          audioElement.style.display = 'none';
          document.body.appendChild(audioElement);
          
          console.log('🔊 Yeni audio element oluşturuldu:', userId);
        }
        
        if (audioElement.srcObject !== stream) {
          try {
            console.log('🎵 Stream audio element\'e atanıyor:', userId);
            console.log('📊 Stream details:', {
              id: stream.id,
              active: stream.active,
              audioTracks: stream.getAudioTracks().length,
              tracks: stream.getTracks().map(t => ({
                kind: t.kind,
                enabled: t.enabled,
                muted: t.muted,
                readyState: t.readyState
              }))
            });
            
            // Track'leri kontrol et ve unmute et
            stream.getAudioTracks().forEach((track, index) => {
              console.log(`🔊 Audio track ${index}:`, {
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState
              });
              
              // Track muted ise unmute et (bazı tarayıcılarda sorun olabilir)
              if (track.muted) {
                console.warn('⚠️ Track muted, enabling...');
                track.enabled = true; // Ensure enabled
              }
            });
            
            audioElement.srcObject = stream;
            console.log('✅ srcObject atandı, play() çağrılıyor...');
            
            const playPromise = audioElement.play();
            if (playPromise !== undefined) {
              await playPromise;
              console.log('▶️ Remote audio başarıyla başlatıldı:', userId);
              console.log('🔊 Audio element durumu:', {
                paused: audioElement.paused,
                muted: audioElement.muted,
                volume: audioElement.volume,
                readyState: audioElement.readyState
              });
            }
          } catch (error) {
            console.error('❌ Remote audio başlatma hatası:', userId, error);
            
            if (error.name === 'NotAllowedError') {
              console.log('⚠️ Kullanıcı etkileşimi bekleniyor...');
              const enableAudio = () => {
                audioElement.play().then(() => {
                  console.log('✅ Remote audio kullanıcı etkileşimi sonrası başlatıldı');
                  document.removeEventListener('click', enableAudio);
                  document.removeEventListener('touchstart', enableAudio);
                }).catch(console.error);
              };
              
              document.addEventListener('click', enableAudio, { once: true });
              document.addEventListener('touchstart', enableAudio, { once: true });
            }
          }
        }
      }

      // Artık olmayan stream'leri temizle
      for (const [userId, audioElement] of audioRefs.current.entries()) {
        if (!remoteStreams.has(userId)) {
          try {
            audioElement.srcObject = null;
            if (audioElement.parentNode) {
              audioElement.parentNode.removeChild(audioElement);
            }
            audioRefs.current.delete(userId);
            console.log('🗑️ Remote audio temizlendi:', userId);
          } catch (error) {
            console.error('❌ Remote audio temizleme hatası:', error);
          }
        }
      }
    };

    handleRemoteStreams();
  }, [remoteStreams]);

  // Component unmount'ta ses elementlerini temizle
  useEffect(() => {
    const currentAudioRefs = audioRefs.current;
    return () => {
      currentAudioRefs.forEach(audioElement => {
        audioElement.srcObject = null;
      });
      currentAudioRefs.clear();
    };
  }, []);

  return (
    <div className="flex flex-col items-center space-y-4 p-6 bg-white rounded-lg shadow-lg">
      {/* Bağlantı durumu */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        <div className={`flex items-center space-x-2 ${audioPermissionGranted ? 'text-green-600' : 'text-orange-600'}`}>
          <div className={`w-2 h-2 rounded-full ${audioPermissionGranted ? 'bg-green-500' : 'bg-orange-500'}`}></div>
          <span>{audioPermissionGranted ? 'Mikrofon Aktif' : 'İzin Bekleniyor'}</span>
        </div>
        
        <div className={`flex items-center space-x-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span>{isConnected ? 'Bağlandı' : 'Bağlantı yok'}</span>
        </div>
        
        <div className="flex items-center space-x-2 text-blue-600">
          <Users size={16} />
          <span>{nearbyUsersCount} kullanıcı</span>
        </div>
        
        <div className="flex items-center space-x-2 text-purple-600">
          <Volume2 size={16} />
          <span>{remoteStreams instanceof Map ? remoteStreams.size : Object.keys(remoteStreams || {}).length} aktif ses</span>
        </div>
      </div>

      {/* Ses Başlatılmadı Uyarısı */}
      {!audioEnabled && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2 text-yellow-800">
            <span className="text-lg">⚠️</span>
            <span className="text-sm font-medium">
              Konuşmak için yukarıdaki "🎤 Mikrofonu Etkinleştir" butonuna basın
            </span>
          </div>
        </div>
      )}

      {/* Ana Toggle butonu */}
      <div className="relative w-full max-w-sm mx-auto">
        <button
          className={`
            w-24 h-24 mx-auto rounded-full transition-all duration-200 transform
            ${isTalkingActive || isTalking
              ? 'bg-red-500 hover:bg-red-600 scale-95 shadow-lg' 
              : 'bg-green-500 hover:bg-green-600 shadow-md hover:scale-105'
            }
            ${!isConnected || !audioEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            active:scale-90 select-none
          `}
          onClick={isConnected && audioEnabled ? handleToggleClick : undefined}
          disabled={!isConnected || !audioEnabled}
        >
          {isTalkingActive || isTalking ? (
            <Mic size={32} className="text-white mx-auto" />
          ) : (
            <MicOff size={32} className="text-white mx-auto" />
          )}
        </button>

        {/* Konuşma animasyonu */}
        {(isTalkingActive || isTalking) && (
          <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping pointer-events-none"></div>
        )}
      </div>

      {/* Durum metni */}
      <div className="text-center">
        <div className={`text-lg font-medium ${
          (isTalkingActive || isTalking) ? 'text-red-600' : 'text-gray-600'
        }`}>
          {(isTalkingActive || isTalking) ? '🎤 Konuşuyorsunuz' : '🤫 Dinleme modunda'}
        </div>
        
        <div className="text-sm text-gray-500 mt-1 text-center">
          {!audioPermissionGranted 
            ? 'Mikrofonunuza erişim için izin verin'
            : !isConnected 
              ? 'WebRTC bağlantısı kuruluyor...'
              : isTalkingActive
                ? '🔴 Konuşma aktif - Durdurmak için tekrar tıkla (veya SPACE)'
                : '🟢 Konuşmak için tıkla (veya SPACE tuşu)'
          }
        </div>
      </div>

      {/* Kendi ses dalga formu */}
      {isConnected && localStream && (
        <div className="w-full space-y-2">
          <div className="text-xs text-gray-600 font-medium">Senin Sesin:</div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <AudioWaveform 
              audioStream={localStream}
              isActive={isTalkingActive || isTalking}
              color={(isTalkingActive || isTalking) ? '#EF4444' : '#10B981'}
              height={50}
            />
          </div>
        </div>
      )}

      {/* Diğer kullanıcıların ses dalga formları */}
      {((remoteStreams instanceof Map ? remoteStreams.size : Object.keys(remoteStreams || {}).length) > 0) && (
        <div className="w-full space-y-3">
          <div className="text-xs text-gray-600 font-medium">Odadaki Diğer Kullanıcılar:</div>
          <div className="space-y-3">
            {Array.from(remoteStreams instanceof Map ? remoteStreams.entries() : Object.entries(remoteStreams || {})).map(([userId, stream]) => {
              // Guard against undefined userId
              if (!userId || !stream) return null;
              
              return (
              <div key={userId} className="bg-green-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Volume2 size={16} className="text-green-600" />
                    <span className="text-sm font-medium text-gray-700">
                      Kullanıcı {String(userId).slice(0, 8)}
                    </span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </div>
                <AudioWaveform 
                  audioStream={stream}
                  isActive={true}
                  color="#10B981"
                  height={40}
                />
              </div>
            )})}
          </div>
        </div>
      )}
    </div>
  );
};

export default PushToTalkButton;
