import React, { useEffect, useRef, useState } from 'react';

const AudioWaveform = ({ audioStream, isActive, width = '100%', height = 60, color = '#EF4444' }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const analyserRef = useRef(null);
  const [audioContext, setAudioContext] = useState(null);

  useEffect(() => {
    if (!audioStream) return;

    // Web Audio API'yi başlat
    const context = new (window.AudioContext || window.webkitAudioContext)();
    setAudioContext(context);

    // Analiz için gerekli bağlantıları kur
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // MediaStream'i Audio'ya bağla
    const source = context.createMediaStreamSource(audioStream);
    source.connect(analyser);

    // Canvas'ı hazırla ve boyutlandır
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasCtx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Dalga formunu çizen fonksiyon
    const draw = () => {
      if (!canvasRef.current || !isActive) return;

      // Animasyonu devam ettir
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isActive) {
        // Konuşma yoksa düz çizgi göster
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, canvas.height / 2);
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.strokeStyle = color;
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
        return;
      }

      canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        canvasCtx.fillStyle = color;
        // Dalgaları ortalı göster
        const y = canvas.height / 2 - barHeight / 2;
        canvasCtx.fillRect(x, y, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    // Animasyonu başlat
    if (isActive) {
      animationRef.current = requestAnimationFrame(draw);
    }

    // Component unmount olduğunda temizle
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [audioStream, isActive, color]);

  // isActive değiştiğinde animasyonu başlat veya durdur
  useEffect(() => {
    if (isActive && audioContext && analyserRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvasRef.current) return;

        animationRef.current = requestAnimationFrame(draw);

        analyserRef.current.getByteFrequencyData(dataArray);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          
          canvasCtx.fillStyle = color;
          const y = canvas.height / 2 - barHeight / 2;
          canvasCtx.fillRect(x, y, barWidth, barHeight);

          x += barWidth + 1;
        }
      };

      animationRef.current = requestAnimationFrame(draw);
    } else if (!isActive && animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Konuşma yokken düz çizgi göster
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, canvas.height / 2);
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.strokeStyle = color;
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, audioContext, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={typeof width === 'number' ? width : 300} 
      height={height}
      className="w-full rounded-lg"
      style={{ width: width }}
    />
  );
};

export default AudioWaveform;
