import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Users, MapPin } from 'lucide-react';
import AudioWaveform from './AudioWaveform';

const PushToTalkButton = ({ 
  onStartTalking, 
  onStopTalking, 
  isTalking, 
  isConnected,
  remoteStreams,
  localStream,
  nearbyUsersCount = 0,
  audioPermissionGranted = false
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [keyPressed, setKeyPressed] = useState(false);
  const audioRefs = useRef(new Map());

  // Keyboard event handlers (Space tuşu için)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space' && !keyPressed && !event.repeat) {
        event.preventDefault();
        setKeyPressed(true);
        setIsPressed(true);
        onStartTalking();
      }
    };

    const handleKeyUp = (event) => {
      if (event.code === 'Space' && keyPressed) {
        event.preventDefault();
        setKeyPressed(false);
        setIsPressed(false);
        onStopTalking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [keyPressed, onStartTalking, onStopTalking]);

  // Mouse event handlers
  const handleMouseDown = () => {
    if (!keyPressed) {
      setIsPressed(true);
      onStartTalking();
    }
  };

  const handleMouseUp = () => {
    if (!keyPressed) {
      setIsPressed(false);
      onStopTalking();
    }
  };

  // Touch event handlers (mobil için)
  const handleTouchStart = (e) => {
    e.preventDefault();
    if (!keyPressed) {
      setIsPressed(true);
      onStartTalking();
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    if (!keyPressed) {
      setIsPressed(false);
      onStopTalking();
    }
  };

  // Remote stream'leri ses elementlerine bağla - geliştirilmiş versiyon
  useEffect(() => {
    const handleRemoteStreams = async () => {
      for (const [userId, stream] of remoteStreams.entries()) {
        let audioElement = audioRefs.current.get(userId);
        
        if (!audioElement) {
          audioElement = document.createElement('audio');
          audioElement.autoplay = true;
          audioElement.playsInline = true;
          audioElement.controls = false;
          audioElement.muted = false;
          audioElement.volume = 1.0;
          
          // Mobil tarayıcılar için ek ayarlar
          audioElement.setAttribute('webkit-playsinline', 'true');
          audioElement.setAttribute('playsinline', 'true');
          
          audioRefs.current.set(userId, audioElement);
          
          // Audio element'i DOM'a ekle (bazı tarayıcılarda gerekli)
          audioElement.style.display = 'none';
          document.body.appendChild(audioElement);
          
          console.log('🔊 Yeni audio element oluşturuldu:', userId);
        }
        
        if (audioElement.srcObject !== stream) {
          try {
            audioElement.srcObject = stream;
            
            // Play promise'i handle et
            const playPromise = audioElement.play();
            if (playPromise !== undefined) {
              await playPromise;
            }
            
            console.log('▶️ Remote audio başlatıldı:', userId);
          } catch (error) {
            console.error('❌ Remote audio başlatma hatası:', userId, error);
            
            // Kullanıcı etkileşimi gerekebilir
            if (error.name === 'NotAllowedError') {
              console.log('⚠️ Kullanıcı etkileşimi bekleniyor...');
              
              // Ses oynatma için kullanıcı tıklaması bekle
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
    return () => {
      audioRefs.current.forEach(audioElement => {
        audioElement.srcObject = null;
      });
      audioRefs.current.clear();
    };
  }, []);

  return (
    <div className="flex flex-col items-center space-y-4 p-6 bg-white rounded-lg shadow-lg">
      {/* Bağlantı durumu - geliştirilmiş */}
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
          <span>{remoteStreams.size} aktif ses</span>
        </div>
      </div>

      {/* Ana Push-to-Talk butonu */}
      <div className="relative">
        <button
          className={`
            w-24 h-24 rounded-full transition-all duration-200 transform
            ${isPressed || isTalking 
              ? 'bg-red-500 hover:bg-red-600 scale-95 shadow-lg' 
              : 'bg-blue-500 hover:bg-blue-600 shadow-md hover:scale-105'
            }
            ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            active:scale-90 select-none
          `}
          onMouseDown={isConnected ? handleMouseDown : undefined}
          onMouseUp={isConnected ? handleMouseUp : undefined}
          onMouseLeave={isConnected ? handleMouseUp : undefined}
          onTouchStart={isConnected ? handleTouchStart : undefined}
          onTouchEnd={isConnected ? handleTouchEnd : undefined}
          disabled={!isConnected}
        >
          {isPressed || isTalking ? (
            <Mic size={32} className="text-white mx-auto" />
          ) : (
            <MicOff size={32} className="text-white mx-auto" />
          )}
        </button>

        {/* Konuşma animasyonu */}
        {(isPressed || isTalking) && (
          <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping"></div>
        )}
      </div>

      {/* Durum metni */}
      <div className="text-center">
        <div className={`text-lg font-medium ${
          isPressed || isTalking ? 'text-red-600' : 'text-gray-600'
        }`}>
          {isPressed || isTalking ? '🎤 Konuşuyorsunuz' : '🤫 Dinleme modunda'}
        </div>
        
        <div className="text-sm text-gray-500 mt-1 text-center">
          {!audioPermissionGranted 
            ? 'Mikrofonunuza erişim için izin verin'
            : isConnected 
              ? 'Konuşmak için basılı tutun veya SPACE tuşunu kullanın'
              : 'WebRTC bağlantısı kuruluyor...'
          }
        </div>
      </div>

      {/* Ses dalga formu */}
      {isConnected && (
        <div className="w-full mt-2 p-1 bg-gray-50 rounded-lg">
          <AudioWaveform 
            audioStream={localStream}
            isActive={isPressed || isTalking}
            color={isPressed || isTalking ? '#EF4444' : '#3B82F6'}
            height={40}
          />
        </div>
      )}

      {/* Ses seviyeleri göstergesi */}
      {remoteStreams.size > 0 && (
        <div className="w-full bg-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-600 mb-2">Aktif Sesler:</div>
          <div className="space-y-2">
            {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
              <div key={userId} className="flex items-center space-x-2">
                <Volume2 size={16} className="text-green-500" />
                <div className="flex-1 bg-green-200 rounded-full h-2">
                  <div className="bg-green-500 rounded-full h-2 w-3/4 animate-pulse"></div>
                </div>
                <span className="text-xs text-gray-600">Kullanıcı {userId.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kısayol bilgisi */}
      <div className="text-xs text-gray-400 text-center border-t pt-2">
        <div>💡 İpucu: Space tuşuna basarak da konuşabilirsiniz</div>
        <div>🗺️ Haritada yakınınızdaki kullanıcıları görebilirsiniz</div>
      </div>
    </div>
  );
};

export default PushToTalkButton;
