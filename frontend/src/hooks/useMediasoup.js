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
  const consumeAudio = useCallback(async (producerId) => {
    try {
      // Check if already consuming
      if (consumersRef.current.has(producerId)) {
        return;
      }

      console.log(`🔄 Preparing to consume producer: ${producerId}`);

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

      // Map stream to user ID - Backend should provide userId mapping ideally
      // For now, we rely on producerId or socket events to map producer -> user
      // But we can just update remoteStreams with producerId key for raw playback
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        // We need a way to know WHICH user this is.
        // For simplicity in this legacy refactor, we might key by producerId first
        // Or better, backend 'newProducer' event sends { producerId, userId }
        newMap.set(producerId, stream);
        return newMap;
      });
      remoteStreamsRef.current.set(producerId, stream);

      // Consumer events
      consumer.on('transportclose', () => {
        consumersRef.current.delete(producerId);
      });

      // Resume consumer
      if (consumer.paused) {
        // Consumer is created paused on server side? usually no unless specific config
        // But mediasoup-client consumers are paused locally if transport is unknown? No.
        // Resume just in case?
        // socket.emit('resumeConsumer', { consumerId: consumer.id });
      }

    } catch (error) {
      console.error('❌ Consume failed:', error);
    }
  }, [socket, roomId]);

  /**
   * Start Talking (Resume Producer)
   */
  const startTalking = useCallback(async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => track.enabled = true);
      setIsTalking(true);
      socket.emit('start_talking', { roomId });
    }
  }, [socket, roomId]);

  /**
   * Stop Talking (Pause Producer)
   */
  const stopTalking = useCallback(async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false);
      setIsTalking(false);
      socket.emit('stop_talking', { roomId });
    }
  }, [socket, roomId]);

  // Effect to listen for new producers
  useEffect(() => {
    if (!socket) return;

    const handleNewProducer = async ({ producerId, userId }) => {
      console.log('🔔 New producer announced:', producerId, 'for user:', userId);
      // Wait a bit for transport? No, joinAsListener handles transport creation.
      // We just need to ensure we consume.
      if (isConnected) {
        await consumeAudio(producerId);
        // After consuming, we might want to map producerId -> userId
        if (userId) {
          setRemoteStreams(prev => {
            const stream = remoteStreamsRef.current.get(producerId);
            if (stream) {
              const newMap = new Map(prev);
              newMap.set(userId, stream); // Map by UserID for UI
              return newMap;
            }
            return prev;
          });
        }
      }
    };

    socket.on('newProducer', handleNewProducer);
    return () => {
      socket.off('newProducer', handleNewProducer);
    };
  }, [socket, isConnected, consumeAudio]);

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

      // Get existing producers in room and consume them
      try {
        // Backend returns an array of objects: { producerId, peerId } ideally
        // But current implementation might just return producerIds string array
        // Let's modify frontend to handle both or request more info
        const { producers } = await new Promise((resolve, reject) => {
          socket.emit('getProducers', { roomId }, (response) => {
            if (response.error) {
              reject(new Error(response.error));
            } else {
              // Backward compatibility: response.producerIds
              // New format: response.producers = [{producerId, peerId}, ...]
              if (response.producerIds) {
                // Convert old string array to object array
                resolve({ producers: response.producerIds.map(id => ({ producerId: id, peerId: null })) });
              } else {
                resolve(response);
              }
            }
          });
        });

        console.log(`📡 Found ${producers.length} existing producers`);

        // Consume each existing producer
        for (const p of producers) {
          const { producerId, peerId } = p;
          console.log(`🔄 Consuming existing producer: ${producerId} (User: ${peerId})`);
          await consumeAudio(producerId);

          if (peerId) {
            // Map producer to user immediately if we have peerId
            setRemoteStreams(prev => {
              const stream = remoteStreamsRef.current.get(producerId);
              if (stream) {
                const newMap = new Map(prev);
                newMap.set(peerId, stream);
                return newMap;
              }
              return prev;
            });
          }
        }

        if (producers.length > 0) {
          console.log(`✅ Successfully consumed ${producers.length} existing producers`);
        }
      } catch (error) {
        console.error('❌ Failed to get/consume existing producers:', error);
      }

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

  // Latency calculation
  const [networkLatency, setNetworkLatency] = useState(0);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const intervalId = setInterval(() => {
      const start = Date.now();
      socket.emit('ping', () => {
        const latency = Date.now() - start;
        setNetworkLatency(latency);
      });
    }, 2000); // Check every 2 seconds

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
