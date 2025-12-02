import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, CheckCircle, XCircle } from 'lucide-react';

const MicrophoneTest = ({ onTestComplete }) => {
  const [testState, setTestState] = useState('idle'); // idle, testing, success, failed
  const [volume, setVolume] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);

  // Ses seviyesi analizi
  const analyzeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Ortalama ses seviyesini hesapla
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedVolume = Math.min(100, (average / 255) * 100);
    
    setVolume(normalizedVolume);
    
    if (testState === 'testing') {
      animationRef.current = requestAnimationFrame(analyzeAudio);
    }
  };

  // Mikrofon testi başlat
  const startTest = async () => {
    try {
      setTestState('testing');
      setErrorMessage('');
      setVolume(0);

      // Audio context oluştur
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass();

      // Mikrofon stream'i al
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // Analyzer oluştur
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Ses analizi başlat
      analyzeAudio();

      // 3 saniye sonra başarı olarak işaretle
      setTimeout(() => {
        if (testState === 'testing') {
          setTestState('success');
          stopTest();
          if (onTestComplete) {
            onTestComplete(true);
          }
        }
      }, 3000);

    } catch (error) {
      console.error('Mikrofon test hatası:', error);
      
      let message = 'Mikrofon testi başarısız';
      if (error.name === 'NotAllowedError') {
        message = 'Mikrofon izni reddedildi';
      } else if (error.name === 'NotFoundError') {
        message = 'Mikrofon bulunamadı';
      } else if (error.name === 'NotReadableError') {
        message = 'Mikrofon kullanımda';
      }
      
      setErrorMessage(message);
      setTestState('failed');
      
      if (onTestComplete) {
        onTestComplete(false, message);
      }
    }
  };

  // Testi durdur
  const stopTest = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setVolume(0);
  };

  // Temizlik
  useEffect(() => {
    return () => {
      stopTest();
    };
  }, []);

  const getStatusIcon = () => {
    switch (testState) {
      case 'testing':
        return <Mic className="animate-pulse text-blue-500" size={24} />;
      case 'success':
        return <CheckCircle className="text-green-500" size={24} />;
      case 'failed':
        return <XCircle className="text-red-500" size={24} />;
      default:
        return <MicOff className="text-gray-400" size={24} />;
    }
  };

  const getStatusText = () => {
    switch (testState) {
      case 'testing':
        return 'Mikrofon test ediliyor... Konuşun!';
      case 'success':
        return 'Mikrofon çalışıyor! ✅';
      case 'failed':
        return `Test başarısız: ${errorMessage}`;
      default:
        return 'Mikrofonunuzu test edin';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          {getStatusIcon()}
        </div>
        
        <h3 className="text-lg font-medium mb-2">Mikrofon Testi</h3>
        
        <p className={`text-sm mb-4 ${
          testState === 'failed' ? 'text-red-600' : 
          testState === 'success' ? 'text-green-600' : 'text-gray-600'
        }`}>
          {getStatusText()}
        </p>

        {/* Ses seviyesi göstergesi */}
        {testState === 'testing' && (
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Volume2 size={16} />
              <span className="text-sm">Ses Seviyesi: {volume.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-gradient-to-r from-green-400 to-blue-500 h-4 rounded-full transition-all duration-100"
                style={{ width: `${volume}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Test butonu */}
        {testState === 'idle' && (
          <button
            onClick={startTest}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Mikrofonu Test Et
          </button>
        )}

        {/* Yeniden test butonu */}
        {testState === 'failed' && (
          <button
            onClick={startTest}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Tekrar Dene
          </button>
        )}

        {/* Başarı sonrası devam butonu */}
        {testState === 'success' && (
          <div className="text-green-600 text-sm">
            ✅ Mikrofonunuz hazır!
          </div>
        )}

        {/* Durma butonu */}
        {testState === 'testing' && (
          <button
            onClick={() => {
              setTestState('idle');
              stopTest();
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Testi Durdur
          </button>
        )}
      </div>
    </div>
  );
};

export default MicrophoneTest;
