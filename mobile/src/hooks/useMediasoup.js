import { useState, useRef, useEffect, useCallback } from 'react';
import { Device } from 'mediasoup-client';
import { mediaDevices, MediaStream } from 'react-native-webrtc';

const useMediasoup = (socket, roomId, userId) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState(new Map()); // Map<userId, stream>
    const [isConnected, setIsConnected] = useState(false);
    const [isTalking, setIsTalking] = useState(false);
    const [audioPermissionGranted, setAudioPermissionGranted] = useState(false);

    const deviceRef = useRef(null);
    const sendTransportRef = useRef(null);
    const recvTransportRef = useRef(null);
    const producerRef = useRef(null);
    const consumersRef = useRef(new Map()); // producerId -> consumer
    const remoteStreamsRef = useRef(new Map());
    const localStreamRef = useRef(null);

    // Initialize Mediasoup Device
    const initDevice = useCallback(async () => {
        try {
            console.log('🎙️ Initializing Mediasoup Device...');

            const routerRtpCapabilities = await new Promise((resolve, reject) => {
                socket.emit('getRouterRtpCapabilities', { roomId }, (response) => {
                    if (response.error) reject(new Error(response.error));
                    else resolve(response.rtpCapabilities);
                });
            });

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

    // Create Send Transport
    const createSendTransport = useCallback(async () => {
        try {
            console.log('📤 Creating send transport...');

            const transportOptions = await new Promise((resolve, reject) => {
                socket.emit('createWebRtcTransport', { roomId, direction: 'send' }, (response) => {
                    if (response.error) reject(new Error(response.error));
                    else resolve(response);
                });
            });

            const sendTransport = deviceRef.current.createSendTransport(transportOptions);

            sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                try {
                    await new Promise((resolve, reject) => {
                        socket.emit('connectTransport', {
                            transportId: sendTransport.id,
                            dtlsParameters
                        }, (response) => {
                            if (response.error) reject(new Error(response.error));
                            else resolve();
                        });
                    });
                    callback();
                } catch (error) {
                    errback(error);
                }
            });

            sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
                try {
                    const { producerId } = await new Promise((resolve, reject) => {
                        socket.emit('produce', {
                            transportId: sendTransport.id,
                            kind,
                            rtpParameters,
                            roomId
                        }, (response) => {
                            if (response.error) reject(new Error(response.error));
                            else resolve(response);
                        });
                    });
                    callback({ id: producerId });
                } catch (error) {
                    errback(error);
                }
            });

            sendTransportRef.current = sendTransport;
            return sendTransport;
        } catch (error) {
            console.error('❌ Send transport creation failed:', error);
            throw error;
        }
    }, [socket, roomId]);

    // Create Recv Transport
    const createRecvTransport = useCallback(async () => {
        try {
            console.log('📥 Creating receive transport...');

            const transportOptions = await new Promise((resolve, reject) => {
                socket.emit('createWebRtcTransport', { roomId, direction: 'recv' }, (response) => {
                    if (response.error) reject(new Error(response.error));
                    else resolve(response);
                });
            });

            const recvTransport = deviceRef.current.createRecvTransport(transportOptions);

            recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                try {
                    await new Promise((resolve, reject) => {
                        socket.emit('connectTransport', {
                            transportId: recvTransport.id,
                            dtlsParameters
                        }, (response) => {
                            if (response.error) reject(new Error(response.error));
                            else resolve();
                        });
                    });
                    callback();
                } catch (error) {
                    errback(error);
                }
            });

            recvTransportRef.current = recvTransport;
            return recvTransport;
        } catch (error) {
            console.error('❌ Receive transport creation failed:', error);
            throw error;
        }
    }, [socket, roomId]);

    // Consume Audio
    const consumeAudio = useCallback(async (producerId) => {
        try {
            if (!recvTransportRef.current) {
                console.warn('⚠️ Receive transport not ready, cannot consume');
                return;
            }

            console.log(`📥 Consuming producer: ${producerId}`);

            const { id, kind, rtpParameters, producerUserId } = await new Promise((resolve, reject) => {
                socket.emit('consume', {
                    transportId: recvTransportRef.current.id,
                    rtpCapabilities: deviceRef.current.rtpCapabilities,
                    producerId,
                    roomId
                }, (response) => {
                    if (response.error) reject(new Error(response.error));
                    else resolve(response);
                });
            });

            const consumer = await recvTransportRef.current.consume({
                id,
                producerId,
                kind,
                rtpParameters
            });

            await new Promise((resolve, reject) => {
                socket.emit('resumeConsumer', { consumerId: consumer.id }, (response) => {
                    if (response.error) reject(new Error(response.error));
                    else resolve();
                });
            });

            consumersRef.current.set(producerId, consumer);

            // Create MediaStream for this consumer
            // In React Native WebRTC, we typically construct a stream
            const stream = new MediaStream([consumer.track]);

            const newRemoteStreams = new Map(remoteStreamsRef.current);
            newRemoteStreams.set(producerUserId, stream);
            remoteStreamsRef.current = newRemoteStreams;
            setRemoteStreams(newRemoteStreams);

            console.log(`✅ Consumer created for user: ${producerUserId}`);

        } catch (error) {
            console.error(`❌ Failed to consume producer ${producerId}:`, error);
        }
    }, [socket, roomId]);

    // Join as Listener
    const joinAsListener = useCallback(async () => {
        try {
            console.log('🎧 Joining as listener...');

            if (!deviceRef.current) await initDevice();
            if (!recvTransportRef.current) await createRecvTransport();

            try {
                const { producerIds } = await new Promise((resolve, reject) => {
                    socket.emit('getProducers', { roomId }, (response) => {
                        if (response.error) reject(new Error(response.error));
                        else resolve(response);
                    });
                });

                console.log(`📡 Found ${producerIds.length} existing producers`);
                for (const producerId of producerIds) {
                    await consumeAudio(producerId);
                }
            } catch (error) {
                console.error('❌ Failed to get producers:', error);
            }

            setIsConnected(true);
            return true;
        } catch (error) {
            console.error('❌ Join as listener failed:', error);
            throw error;
        }
    }, [initDevice, createRecvTransport, socket, roomId, consumeAudio]);

    // Enable Microphone
    const enableMicrophone = useCallback(async () => {
        try {
            if (localStreamRef.current) return localStreamRef.current; // active check needs implementation

            console.log('🎤 Requesting microphone permission...');
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: false
            });

            localStreamRef.current = stream;
            setLocalStream(stream);
            setAudioPermissionGranted(true);

            if (!deviceRef.current) await initDevice();
            if (!sendTransportRef.current) await createSendTransport();
            if (!recvTransportRef.current) {
                await createRecvTransport();
                await joinAsListener();
            }

            return stream;
        } catch (error) {
            console.error('❌ Enable microphone failed:', error);
            throw error;
        }
    }, [initDevice, createSendTransport, createRecvTransport, joinAsListener]);

    // Start Talking
    const startTalking = useCallback(async () => {
        try {
            const stream = localStreamRef.current;
            const transport = sendTransportRef.current;

            if (!stream || !transport) return;

            if (producerRef.current) {
                producerRef.current.resume();
                setIsTalking(true);
                return;
            }

            const audioTrack = stream.getAudioTracks()[0];
            if (!audioTrack) return;

            const producer = await transport.produce({
                track: audioTrack,
                codecOptions: { opusStereo: true, opusDtx: true }
            });

            producerRef.current = producer;
            setIsTalking(true);
        } catch (error) {
            console.error('❌ Failed to start talking:', error);
        }
    }, []);

    // Stop Talking
    const stopTalking = useCallback(() => {
        if (producerRef.current) {
            producerRef.current.pause();
            setIsTalking(false);
        }
    }, []);

    // Handle Socket Events
    useEffect(() => {
        if (!socket) return;

        // We used emitEvent in SocketContext, but here we can't easily listen unless we access socket directly
        // Passed 'socket' prop is the socket instance, so standard .on works

        const handleNewProducer = ({ producerId }) => {
            consumeAudio(producerId);
        };

        const handleProducerClosed = ({ producerId, userId: producerUserId }) => {
            const consumer = consumersRef.current.get(producerId);
            if (consumer) {
                consumer.close();
                consumersRef.current.delete(producerId);
            }
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

    // Cleanup
    useEffect(() => {
        return () => {
            if (producerRef.current) producerRef.current.close();
            consumersRef.current.forEach(c => c.close());
            consumersRef.current.clear();
            if (sendTransportRef.current) sendTransportRef.current.close();
            if (recvTransportRef.current) recvTransportRef.current.close();
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
                localStreamRef.current = null;
            }
            setLocalStream(null);
            setRemoteStreams(new Map());
        };
    }, []);

    return {
        localStream,
        remoteStreams,
        isConnected,
        isTalking,
        audioPermissionGranted,
        joinAsListener,
        enableMicrophone,
        startTalking,
        stopTalking
    };
};

export default useMediasoup;
