import { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';

/**
 * Basit WebRTC SFU Hook
 * - Mesh topoloji (her kullanıcı birbirine bağlanır)
 * - Minimal state management
 * - Temiz event handling
 */
export const useWebRTC = (roomId) => {
  const { socket } = useSocket();
  
  // States
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [audioPermissionGranted, setAudioPermissionGranted] = useState(false);

  // Refs
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // userId -> RTCPeerConnection
  const pendingCandidatesRef = useRef(new Map()); // userId -> ICE candidates queue

  // STUN/TURN configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  /**
   * 1. Initialize Audio Stream
   */
  const initializeAudio = useCallback(async () => {
    try {
      console.log('🎤 Mikrofon başlatılıyor...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      // Track'leri başlangıçta disable et
      stream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setAudioPermissionGranted(true);
      setIsConnected(true);

      console.log('✅ Mikrofon hazır');
      return stream;
    } catch (error) {
      console.error('❌ Mikrofon hatası:', error);
      setAudioPermissionGranted(false);
      throw error;
    }
  }, []);

  /**
   * 2. Create Peer Connection
   */
  const createPeerConnection = useCallback((userId) => {
    console.log('🔧 Peer connection oluşturuluyor:', userId);

    const pc = new RTCPeerConnection(rtcConfig);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
        console.log('➕ Track eklendi:', track.kind);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('🔊 Remote track alındı:', userId);
      if (event.streams && event.streams[0]) {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(userId, event.streams[0]);
          return newMap;
        });
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate:', userId);
        socket.emit('ice_candidate', {
          targetUserId: userId,
          candidate: event.candidate,
          roomId
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log('📡 Connection state:', userId, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanupPeerConnection(userId);
      }
    };

    peerConnectionsRef.current.set(userId, pc);
    return pc;
  }, [socket, roomId]);

  /**
   * 3. Create and Send Offer
   */
  const createOffer = useCallback(async (userId) => {
    try {
      console.log('📤 Offer oluşturuluyor:', userId);

      if (!localStreamRef.current) {
        console.warn('⚠️ Local stream yok!');
        return;
      }

      let pc = peerConnectionsRef.current.get(userId);
      if (!pc) {
        pc = createPeerConnection(userId);
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('webrtc_offer', {
        targetUserId: userId,
        offer,
        roomId
      });

      console.log('✅ Offer gönderildi:', userId);
    } catch (error) {
      console.error('❌ Offer hatası:', error);
    }
  }, [socket, roomId, createPeerConnection]);

  /**
   * 4. Handle Incoming Offer
   */
  const handleOffer = useCallback(async ({ fromUserId, offer }) => {
    try {
      console.log('📥 Offer alındı:', fromUserId);

      if (!localStreamRef.current) {
        console.warn('⚠️ Local stream yok, offer reddedildi');
        return;
      }

      let pc = peerConnectionsRef.current.get(fromUserId);
      if (!pc) {
        pc = createPeerConnection(fromUserId);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc_answer', {
        targetUserId: fromUserId,
        answer,
        roomId
      });

      console.log('✅ Answer gönderildi:', fromUserId);

      // Process queued ICE candidates
      const candidates = pendingCandidatesRef.current.get(fromUserId) || [];
      for (const candidate of candidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current.delete(fromUserId);
    } catch (error) {
      console.error('❌ Offer handle hatası:', error);
    }
  }, [socket, roomId, createPeerConnection]);

  /**
   * 5. Handle Incoming Answer
   */
  const handleAnswer = useCallback(async ({ fromUserId, answer }) => {
    try {
      console.log('📥 Answer alındı:', fromUserId);

      const pc = peerConnectionsRef.current.get(fromUserId);
      if (!pc) {
        console.warn('⚠️ Peer connection bulunamadı');
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Answer işlendi:', fromUserId);

      // Process queued ICE candidates
      const candidates = pendingCandidatesRef.current.get(fromUserId) || [];
      for (const candidate of candidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current.delete(fromUserId);
    } catch (error) {
      console.error('❌ Answer handle hatası:', error);
    }
  }, []);

  /**
   * 6. Handle ICE Candidate
   */
  const handleIceCandidate = useCallback(async ({ fromUserId, candidate }) => {
    try {
      const pc = peerConnectionsRef.current.get(fromUserId);
      
      if (!pc || !pc.remoteDescription) {
        // Queue candidate if remote description not set yet
        const queue = pendingCandidatesRef.current.get(fromUserId) || [];
        queue.push(candidate);
        pendingCandidatesRef.current.set(fromUserId, queue);
        console.log('⏳ ICE candidate sıraya alındı:', fromUserId);
        return;
      }

      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate eklendi:', fromUserId);
    } catch (error) {
      console.error('❌ ICE candidate hatası:', error);
    }
  }, []);

  /**
   * 7. Start/Stop Talking
   */
  const startTalking = useCallback(() => {
    if (!localStreamRef.current) return false;

    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = true;
    });
    setIsTalking(true);
    console.log('🎤 Konuşma başladı');
    return true;
  }, []);

  const stopTalking = useCallback(() => {
    if (!localStreamRef.current) return false;

    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = false;
    });
    setIsTalking(false);
    console.log('🤫 Konuşma durdu');
    return true;
  }, []);

  /**
   * 8. Cleanup Peer Connection
   */
  const cleanupPeerConnection = useCallback((userId) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
      console.log('🗑️ Peer connection temizlendi:', userId);
    }

    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });

    pendingCandidatesRef.current.delete(userId);
  }, []);

  /**
   * 9. Setup Socket Listeners
   */
  useEffect(() => {
    if (!socket || !roomId) return;

    console.log('🔌 Socket listeners kuruluyor...');

    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('ice_candidate', handleIceCandidate);

    socket.on('user_left', ({ userId }) => {
      console.log('👋 Kullanıcı ayrıldı:', userId);
      cleanupPeerConnection(userId);
    });

    return () => {
      socket.off('webrtc_offer', handleOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('user_left');
    };
  }, [socket, roomId, handleOffer, handleAnswer, handleIceCandidate, cleanupPeerConnection]);

  /**
   * 10. Cleanup on Unmount
   */
  useEffect(() => {
    return () => {
      console.log('🧹 Cleanup başlıyor...');

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Close all peer connections
      peerConnectionsRef.current.forEach((pc, userId) => {
        pc.close();
        console.log('📡 Peer closed:', userId);
      });
      peerConnectionsRef.current.clear();
    };
  }, []);

  return {
    // State
    localStream,
    remoteStreams,
    isConnected,
    isTalking,
    audioPermissionGranted,

    // Methods
    initializeAudio,
    createOffer,
    startTalking,
    stopTalking,
    cleanupPeerConnection
  };
};
