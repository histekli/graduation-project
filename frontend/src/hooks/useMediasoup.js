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
            resolve(response);
          }
        });
      });

      // Create transport on device
      const sendTransport = deviceRef.current.createSendTransport(transportOptions);

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
              rtpParameters
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
            resolve(response);
          }
        });
      });

      // Create transport on device
      const recvTransport = deviceRef.current.createRecvTransport(transportOptions);

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
   * Initialize Audio (request mic permission and setup stream)
   */
  const initializeAudio = useCallback(async () => {
    try {
      console.log('🎤 Requesting microphone permission...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      setLocalStream(stream);
      setAudioPermissionGranted(true);
      console.log('✅ Microphone access granted');

      // Initialize device and transports
      await initDevice();
      await createSendTransport();
      await createRecvTransport();

      // Get existing producers in room
      await getExistingProducers();

      return stream;
    } catch (error) {
      console.error('❌ Audio initialization failed:', error);
      throw error;
    }
  }, [initDevice, createSendTransport, createRecvTransport]);

  /**
   * Get Existing Producers (users already talking in room)
   */
  const getExistingProducers = useCallback(async () => {
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

      // Consume each producer
      for (const producerId of producerIds) {
        await consumeAudio(producerId);
      }
    } catch (error) {
      console.error('❌ Failed to get existing producers:', error);
    }
  }, [socket, roomId]);

  /**
   * Consume Audio from a Producer
   */
  const consumeAudio = useCallback(async (producerId) => {
    try {
      if (!recvTransportRef.current) {
        console.warn('⚠️ Receive transport not ready, cannot consume');
        return;
      }

      console.log(`📥 Consuming producer: ${producerId}`);

      // Request consumer from server
      const { id, kind, rtpParameters, producerUserId } = await new Promise((resolve, reject) => {
        socket.emit('consume', {
          rtpCapabilities: deviceRef.current.rtpCapabilities,
          producerId
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

      // Resume consumer
      await new Promise((resolve, reject) => {
        socket.emit('resumeConsumer', { consumerId: consumer.id }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve();
          }
        });
      });

      // Store consumer
      consumersRef.current.set(producerId, consumer);

      // Create MediaStream for this consumer
      const stream = new MediaStream([consumer.track]);
      
      // Update remote streams (using Map)
      const newRemoteStreams = new Map(remoteStreamsRef.current);
      newRemoteStreams.set(producerUserId, stream);
      remoteStreamsRef.current = newRemoteStreams;
      setRemoteStreams(newRemoteStreams);

      console.log(`✅ Consumer created for user: ${producerUserId}`);
    } catch (error) {
      console.error(`❌ Failed to consume producer ${producerId}:`, error);
    }
  }, [socket]);

  /**
   * Start Talking (produce audio to server)
   */
  const startTalking = useCallback(async () => {
    try {
      if (!localStream || !sendTransportRef.current) {
        console.warn('⚠️ Cannot start talking: stream or transport not ready');
        return;
      }

      if (producerRef.current) {
        console.warn('⚠️ Already producing');
        return;
      }

      console.log('🎙️ Starting to talk...');

      const audioTrack = localStream.getAudioTracks()[0];
      
      // Produce audio
      const producer = await sendTransportRef.current.produce({
        track: audioTrack,
        codecOptions: {
          opusStereo: true,
          opusDtx: true
        }
      });

      producerRef.current = producer;
      setIsTalking(true);

      console.log('✅ Producer created, now talking');
    } catch (error) {
      console.error('❌ Failed to start talking:', error);
    }
  }, [localStream]);

  /**
   * Stop Talking (pause producer)
   */
  const stopTalking = useCallback(() => {
    try {
      if (!producerRef.current) {
        console.warn('⚠️ Not producing');
        return;
      }

      console.log('🔇 Stopping talking...');

      producerRef.current.pause();
      setIsTalking(false);

      console.log('✅ Producer paused');
    } catch (error) {
      console.error('❌ Failed to stop talking:', error);
    }
  }, []);

  /**
   * Socket Event: New Producer Available
   */
  useEffect(() => {
    if (!socket) return;

    const handleNewProducer = ({ producerId }) => {
      console.log(`🆕 New producer available: ${producerId}`);
      consumeAudio(producerId);
    };

    const handleProducerClosed = ({ producerId, userId: producerUserId }) => {
      console.log(`🚪 Producer closed: ${producerId}`);
      
      // Remove consumer
      const consumer = consumersRef.current.get(producerId);
      if (consumer) {
        consumer.close();
        consumersRef.current.delete(producerId);
      }

      // Remove remote stream (using Map)
      const newRemoteStreams = new Map(remoteStreamsRef.current);
      newRemoteStreams.delete(producerUserId);
      remoteStreamsRef.current = newRemoteStreams;
      setRemoteStreams(newRemoteStreams);
    };

    socket.on('newProducer', handleNewProducer);
    socket.on('producerClosed', handleProducerClosed);

    return () => {
      socket.off('newProducer', handleNewProducer);
      socket.off('producerClosed', handleProducerClosed);
    };
  }, [socket, consumeAudio]);

  /**
   * Cleanup on unmount or room change
   */
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up Mediasoup resources...');

      // Close producer
      if (producerRef.current) {
        producerRef.current.close();
        producerRef.current = null;
      }

      // Close all consumers
      consumersRef.current.forEach(consumer => consumer.close());
      consumersRef.current.clear();

      // Close transports
      if (sendTransportRef.current) {
        sendTransportRef.current.close();
        sendTransportRef.current = null;
      }
      if (recvTransportRef.current) {
        recvTransportRef.current.close();
        recvTransportRef.current = null;
      }

      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      setLocalStream(null);
      setRemoteStreams({});
      setIsConnected(false);
      setIsTalking(false);
    };
  }, [localStream, roomId]);

  return {
    localStream,
    remoteStreams,
    isConnected,
    isTalking,
    audioPermissionGranted,
    initializeAudio,
    startTalking,
    stopTalking
  };
};

export default useMediasoup;
