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
        const { producerIds } = await new Promise((resolve, reject) => {
          socket.emit('getProducers', { roomId }, (response) => {
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        });

        console.log(`📡 Found ${producerIds.length} existing producers`);

        // Consume each existing producer
        for (const producerId of producerIds) {
          console.log(`🔄 Consuming existing producer: ${producerId}`);
          await consumeAudio(producerId);
        }

        if (producerIds.length > 0) {
          console.log(`✅ Successfully consumed ${producerIds.length} existing producers`);
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
