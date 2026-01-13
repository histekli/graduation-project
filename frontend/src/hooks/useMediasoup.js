import { useState, useRef, useEffect, useCallback } from 'react';
import { Device } from 'mediasoup-client';

/**
 * useMediasoup Hook - SFU Architecture with Mediasoup
 * 
 * Architecture:
 * - Client sends audio to server (Producer)
 * - Server forwards to all other clients (Consumers)
 * - Much simpler than P2P mesh
 */
const useMediasoup = (socket, roomId, userId) => {
  // State
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [audioPermissionGranted, setAudioPermissionGranted] = useState(false);

  // Refs
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producerRef = useRef(null);
  const consumersRef = useRef(new Map()); // producerId -> consumer
  const remoteStreamsRef = useRef(new Map());
  const localStreamRef = useRef(null); // Add ref for localStream

  /**
   * Initialize Mediasoup Device
   */
  const initDevice = useCallback(async () => {
    try {
      console.log('🎙️ Initializing Mediasoup Device...');

      // Get RTP capabilities from server
      const routerRtpCapabilities = await new Promise((resolve, reject) => {
        socket.emit('getRouterRtpCapabilities', { roomId }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.rtpCapabilities);
          }
        });
      });

      // Create device
      const device = new Device();
      await device.load({ routerRtpCapabilities });
      deviceRef.current = device;

      console.log('✅ Device initialized');
      setIsConnected(true);
      return device;
    } catch (error) {
      console.error('❌ Device initialization failed:', error);
      throw error;
    }
  }, [socket, roomId]);

  /**
   * Create Send Transport (for uploading audio to server)
   */
  const createSendTransport = useCallback(async () => {
    try {
      console.log('📤 Creating send transport...');

      // Request transport from server
      const transportOptions = await new Promise((resolve, reject) => {
        socket.emit('createWebRtcTransport', {
          roomId,
          direction: 'send'
        }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            console.log('🔍 Backend send transport ID:', response.id);
            resolve(response);
          }
        });
      });

      // Create transport on device
      const sendTransport = deviceRef.current.createSendTransport(transportOptions);
      console.log('🔍 Frontend send transport ID:', sendTransport.id);
      console.log('🔍 IDs eşleşiyor mu?', sendTransport.id === transportOptions.id);

      // Handle 'connect' event
      sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await new Promise((resolve, reject) => {
            socket.emit('connectTransport', {
              transportId: sendTransport.id,
              dtlsParameters
            }, (response) => {
              if (response.error) {
                reject(new Error(response.error));
              } else {
                resolve();
              }
            });
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      // Handle 'produce' event
      sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const { producerId } = await new Promise((resolve, reject) => {
            socket.emit('produce', {
              transportId: sendTransport.id,
              kind,
              rtpParameters,
              roomId // Add roomId for backend to broadcast newProducer to room
            }, (response) => {
              if (response.error) {
                reject(new Error(response.error));
              } else {
                resolve(response);
              }
            });
          });
          callback({ id: producerId });
        } catch (error) {
          errback(error);
        }
      });

      sendTransportRef.current = sendTransport;
      console.log('✅ Send transport created');
      return sendTransport;
    } catch (error) {
      console.error('❌ Send transport creation failed:', error);
      throw error;
    }
  }, [socket, roomId]);

  /**
   * Create Receive Transport (for downloading audio from server)
   */
  const createRecvTransport = useCallback(async () => {
    try {
      console.log('📥 Creating receive transport...');

      // Request transport from server
      const transportOptions = await new Promise((resolve, reject) => {
        socket.emit('createWebRtcTransport', {
          roomId,
          direction: 'recv'
        }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            console.log('🔍 Backend recv transport ID:', response.id);
            resolve(response);
          }
        });
      });

      // Create transport on device
      if (!deviceRef.current) {
        console.warn('⚠️ Device not initialized, initializing now...');
        await initDevice();
      }
      const recvTransport = deviceRef.current.createRecvTransport(transportOptions);
      console.log('🔍 Frontend recv transport ID:', recvTransport.id);
      console.log('🔍 IDs eşleşiyor mu?', recvTransport.id === transportOptions.id);

      // Handle 'connect' event
      recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await new Promise((resolve, reject) => {
            socket.emit('connectTransport', {
              transportId: recvTransport.id,
              dtlsParameters
            }, (response) => {
              if (response.error) {
                reject(new Error(response.error));
              } else {
                resolve();
              }
            });
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      recvTransportRef.current = recvTransport;
      console.log('✅ Receive transport created');
      return recvTransport;
    } catch (error) {
      console.error('❌ Receive transport creation failed:', error);
      throw error;
    }
  }, [socket, roomId]);

  /**
   * Consume Audio from a remote producer
   */
  const consumeAudio = useCallback(async (producerId, userId) => {
    try {
      // Check if already consuming
      if (consumersRef.current.has(producerId)) {
        return;
      }

      // Safety check: Transport must be ready
      if (!recvTransportRef.current) {
        console.warn('⚠️ consumeAudio called but recvTransport is not ready');
        return;
      }

      console.log(`🔄 Preparing to consume producer: ${producerId} for user: ${userId}`);

      const { rtpCapabilities } = deviceRef.current;

      // Request consumer details from server
      const {
        id,
        kind,
        rtpParameters
      } = await new Promise((resolve, reject) => {
        socket.emit('consume', {
          transportId: recvTransportRef.current.id,
          producerId,
          rtpCapabilities,
          roomId // roomId is needed for backend checks
        }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });

      // Create consumer on device
      const consumer = await recvTransportRef.current.consume({
        id,
        producerId,
        kind,
        rtpParameters
      });

      console.log('✅ Consumer created:', consumer.id);

      // Store consumer
      consumersRef.current.set(producerId, consumer);

      // Extract stream and store it
      const stream = new MediaStream();
      stream.addTrack(consumer.track);

      // Map stream to USER ID directly
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        // Use userId if available, otherwise fallback to producerId
        // This solves the 'Remote stream not found' issue in VoiceChat.js
        const key = userId || producerId;
        newMap.set(key, stream);
        return newMap;
      });
      // Also keep in ref
      remoteStreamsRef.current.set(userId || producerId, stream);
      remoteStreamsRef.current.set(producerId, stream);

      // Consumer events
      consumer.on('transportclose', () => {
        consumersRef.current.delete(producerId);
      });

      // Resume consumer
      // Always resume consumer after creation to ensure playback
      await new Promise((resolve) => {
        socket.emit('resumeConsumer', {
          consumerId: consumer.id,
          roomId
        }, () => resolve());
      });
      console.log('▶️ Consumer resumed');

    } catch (error) {
      console.error('❌ Consume failed:', error);
    }
  }, [socket, roomId]);

  /**
   * Start Talking (Resume Producer)
   */
  const startTalking = useCallback(async () => {
    if (producerRef.current) {
      try {
        await producerRef.current.resume();
        setIsTalking(true);
        console.log('▶️ Producer resumed');
      } catch (err) {
        console.error('❌ Failed to resume producer:', err);
      }
    } else {
      console.warn('⚠️ No producer to resume');
    }
  }, []);

  /**
   * Stop Talking (Pause Producer)
   */
  const stopTalking = useCallback(async () => {
    if (producerRef.current) {
      try {
        await producerRef.current.pause();
        setIsTalking(false);
        console.log('⏸️ Producer paused');
      } catch (err) {
        console.error('❌ Failed to pause producer:', err);
      }
    }
  }, []);

  // Effect to listen for new producers
  useEffect(() => {
    if (!socket) return;

    const handleNewProducer = async ({ producerId, userId, peerId }) => {
      // Backend uses 'peerId' in some events and 'userId' in others. Handle both.
      const actualUserId = userId || peerId;
      console.log('🔔 New producer announced:', producerId, 'for user:', actualUserId);

      try {
        // Ensure device is initialized
        if (!deviceRef.current) {
          console.log('⚠️ Device not initialized, initializing now...');
          await initDevice();
        }

        // Ensure receive transport exists
        if (!recvTransportRef.current) {
          console.log('⚠️ Recv transport missing, creating now...');
          await createRecvTransport();
        }

        // Consume the audio passing the USER ID
        await consumeAudio(producerId, actualUserId);

      } catch (error) {
        console.error('❌ Failed to handle new producer:', error);
      }
    };

    socket.on('newProducer', handleNewProducer);
    return () => {
      socket.off('newProducer', handleNewProducer);
    };
  }, [socket, consumeAudio, initDevice, createRecvTransport]);

  /**
    * Join as Listener (Receive Only) - No Mic Permission Needed
    */
  const joinAsListener = useCallback(async () => {
    try {
      console.log('🎧 Joining as listener...');

      // Initialize device if not ready
      if (!deviceRef.current) {
        await initDevice();
      }

      // Create receive transport if not ready
      if (!recvTransportRef.current) {
        await createRecvTransport();
      }

      // Note: We don't need to call getProducers anymore!
      // Backend automatically sends 'newProducer' events for all existing producers
      // when we join the room. This eliminates race conditions completely.
      console.log('✅ Receive transport ready. Waiting for newProducer events from backend...');

      setIsConnected(true);
      return true;
    } catch (error) {
      console.error('❌ Join as listener failed:', error);
      throw error;
    }
  }, [initDevice, createRecvTransport, socket, roomId, consumeAudio]);

  /**
   * Enable Microphone (Send Audio)
   */
  const enableMicrophone = useCallback(async () => {
    try {
      // Check if already initialized
      if (localStreamRef.current && localStreamRef.current.active) {
        console.log('✅ Audio already initialized, reusing existing stream');
        return localStreamRef.current;
      }

      console.log('🎤 Requesting microphone permission...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localStreamRef.current = stream; // Update ref
      setLocalStream(stream);
      setAudioPermissionGranted(true);
      console.log('✅ Microphone access granted');

      // Initialize device if not ready (might be ready from joinAsListener)
      if (!deviceRef.current) {
        await initDevice();
      }

      // Create send transport if not ready
      if (!sendTransportRef.current) {
        await createSendTransport();
      }

      // Ensure receive transport exists too (for full duplex)
      if (!recvTransportRef.current) {
        await createRecvTransport();
        // Also consume if we just created recv transport
        await joinAsListener();
      }

      // NOW CREATE PRODUCER - Actually send audio to server
      if (sendTransportRef.current && !producerRef.current) {
        const audioTrack = stream.getAudioTracks()[0];
        console.log('🎤 Creating producer from audio track...');

        try {
          const producer = await sendTransportRef.current.produce({
            track: audioTrack,
            codecOptions: {
              opusStereo: true,
              opusDtx: true,
            },
          });

          producerRef.current = producer;
          console.log('✅ Producer created:', producer.id);

          // Pause producer by default (user will unpause with PTT button)
          await producer.pause();
          console.log('⏸️ Producer paused (waiting for PTT)');
        } catch (err) {
          console.error('❌ Failed to create producer:', err);
          throw err;
        }
      }

      return stream;
    } catch (error) {
      console.error('❌ Enable microphone failed:', error);
      throw error;
    }
  }, [initDevice, createSendTransport, createRecvTransport, joinAsListener]);

  /**
   * Initialize Audio (Legacy wrapper)
   */
  const initializeAudio = useCallback(async () => {
    await joinAsListener();
    return await enableMicrophone();
  }, [joinAsListener, enableMicrophone]);

  // Handle socket disconnection/reconnection
  useEffect(() => {
    if (!socket) return;

    const onDisconnect = () => {
      console.log('🔌 Socket disconnected, cleaning up Mediasoup...');
      setIsConnected(false);
      setIsTalking(false);

      // Clean up transports
      if (sendTransportRef.current) {
        try { sendTransportRef.current.close(); } catch (e) { }
        sendTransportRef.current = null;
      }
      if (recvTransportRef.current) {
        try { recvTransportRef.current.close(); } catch (e) { }
        recvTransportRef.current = null;
      }

      // Clean up producer
      if (producerRef.current) {
        try { producerRef.current.close(); } catch (e) { }
        producerRef.current = null;
      }

      // Clean up consumers
      consumersRef.current.forEach(consumer => {
        try { consumer.close(); } catch (e) { }
      });
      consumersRef.current.clear();

      // Reset Device? Usually not needed unless router capabilities change drastically, 
      // but safer to reset if router changes.
      deviceRef.current = null;

      // Clear remote streams
      setRemoteStreams(new Map());
      remoteStreamsRef.current.clear();
    };

    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  // Real End-to-End Latency Measurement
  const [networkLatency, setNetworkLatency] = useState(0);

  useEffect(() => {
    const measureLatency = async () => {
      // Try to use sendTransport or recvTransport stats
      const transport = sendTransportRef.current || recvTransportRef.current;

      if (transport) {
        try {
          const stats = await transport._handler._pc.getStats();
          let rtt = 0;
          let jitterBuffer = 0;

          stats.forEach(report => {
            // Get RTT from candidate pair
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              rtt = (report.currentRoundTripTime || 0) * 1000;
            }

            // Get jitter buffer delay
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
              if (report.jitterBufferDelay && report.jitterBufferEmittedCount) {
                jitterBuffer = (report.jitterBufferDelay / report.jitterBufferEmittedCount) * 1000;
              }
            }
          });

          // Total latency = Capture(30ms) + Network(RTT/2) + JitterBuffer + Decode(15ms)
          // Dinleyici modunda capture süresi eklemeye gerek yok ama tutarlılık için basit tutuyoruz
          const totalLatency = Math.round(30 + (rtt / 2) + (jitterBuffer || 30) + 15);
          setNetworkLatency(totalLatency);

        } catch (error) {
          console.warn('Latency measure failed:', error);
        }
      } else if (socket && socket.connected) {
        // Fallback to socket ping if no transport
        const start = Date.now();
        // Socket.io 'ping' event requires backend support or acknowledgment
        // If backend doesn't have custom 'ping' listener, standard packet RTT is harder to get directly here.
        // Assuming backend handles ack callbacks:
        socket.emit('ping', (response) => {
          setNetworkLatency(Date.now() - start);
        });

        // Alternative: If 'ping' is not handled by backend, use volatile emit with ack
        // But let's assume socket connection implies some baseline latency
      }
    };

    const intervalId = setInterval(measureLatency, 2000); // 2 saniyede bir güncelle (daha canlı)
    measureLatency(); // Initial measurement

    return () => clearInterval(intervalId);
  }, [socket, isConnected]);

  return {
    localStream,
    remoteStreams,
    isConnected,
    isTalking,
    audioPermissionGranted,
    enableMicrophone,
    joinAsListener,
    initializeAudio,
    startTalking,
    stopTalking,
    networkLatency
  };
};

export default useMediasoup;
