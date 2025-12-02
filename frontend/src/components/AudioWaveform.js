import React, { useEffect, useRef } from 'react';

const AudioWaveform = ({ audioStream, isActive, width = '100%', height = 60, color = '#EF4444' }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    if (!audioStream || !canvasRef.current) return;

    // Eğer audio context zaten varsa kullan
    if (!audioContextRef.current) {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = context;

      // Analiz için gerekli bağlantıları kur
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // MediaStream'i Audio'ya bağla
      const source = context.createMediaStreamSource(audioStream);
      source.connect(analyser);
    }

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Dalga formunu çizen fonksiyon
    const draw = () => {
      if (!canvasRef.current) return;

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
        const y = canvas.height / 2 - barHeight / 2;
        canvasCtx.fillRect(x, y, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    // Animasyonu başlat
    if (isActive && analyserRef.current) {
      animationRef.current = requestAnimationFrame(draw);
    }

    // Component unmount olduğunda temizle
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [audioStream, isActive, color]);

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
