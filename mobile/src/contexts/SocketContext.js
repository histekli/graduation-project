import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { Alert, Platform } from 'react-native';
import { API_URL } from '../config/api';

// Initial state
const initialState = {
    socket: null,
    connected: false,
    currentRoom: null,
    roomUsers: [],
    messages: [],
    joinedRoom: false
};

// Action types
const socketActions = {
    SET_SOCKET: 'SET_SOCKET',
    SET_CONNECTED: 'SET_CONNECTED',
    SET_CURRENT_ROOM: 'SET_CURRENT_ROOM',
    SET_ROOM_USERS: 'SET_ROOM_USERS',
    ADD_MESSAGE: 'ADD_MESSAGE',
    SET_MESSAGES: 'SET_MESSAGES',
    USER_JOINED: 'USER_JOINED',
    USER_LEFT: 'USER_LEFT',
    JOINED_ROOM: 'JOINED_ROOM'
};

// Reducer
function socketReducer(state, action) {
    switch (action.type) {
        case socketActions.SET_SOCKET:
            return { ...state, socket: action.payload };
        case socketActions.SET_CONNECTED:
            return { ...state, connected: action.payload };
        case socketActions.SET_CURRENT_ROOM:
            return { ...state, currentRoom: action.payload };
        case socketActions.SET_ROOM_USERS:
            return { ...state, roomUsers: action.payload };
        case socketActions.ADD_MESSAGE:
            return { ...state, messages: [...state.messages, action.payload] };
        case socketActions.SET_MESSAGES:
            return { ...state, messages: action.payload };
        case socketActions.JOINED_ROOM:
            return { ...state, joinedRoom: action.payload };
        case socketActions.USER_JOINED:
            return {
                ...state,
                roomUsers: [...state.roomUsers.filter(u => u._id !== action.payload._id), action.payload]
            };
        case socketActions.USER_LEFT:
            return {
                ...state,
                roomUsers: state.roomUsers.filter(u => u._id !== action.payload.userId)
            };
        default:
            return state;
    }
}

// Create context
const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const { user, token } = useAuth();
    const [state, dispatch] = useReducer(socketReducer, initialState);

    // Custom event emitter replacement for React Native
    // Since we can't use window.dispatchEvent easily across components
    // We'll expose a subscribe/emit mechanism
    const listenersRef = useRef({});

    const addListener = (event, callback) => {
        if (!listenersRef.current[event]) {
            listenersRef.current[event] = [];
        }
        listenersRef.current[event].push(callback);
        return () => {
            listenersRef.current[event] = listenersRef.current[event].filter(cb => cb !== callback);
        };
    };

    const emitEvent = (event, data) => {
        if (listenersRef.current[event]) {
            listenersRef.current[event].forEach(callback => callback(data));
        }
    };

    // Initialize socket
    useEffect(() => {
        if (user && token) {
            console.log('🔌 Connecting socket to:', API_URL);

            const newSocket = io(API_URL, {
                auth: {
                    token: token,
                    isGuest: token.startsWith('guest_token_'),
                    username: user.username
                },
                transports: ['websocket'], // React Native supports websocket better
                forceNew: true
            });

            dispatch({ type: socketActions.SET_SOCKET, payload: newSocket });

            newSocket.on('connect', () => {
                console.log('✅ Socket connected:', newSocket.id);
                dispatch({ type: socketActions.SET_CONNECTED, payload: true });
            });

            newSocket.on('disconnect', () => {
                console.log('❌ Socket disconnected');
                dispatch({ type: socketActions.SET_CONNECTED, payload: false });
            });

            // Room events
            newSocket.on('room_joined', (data) => {
                console.log('✅ Room joined:', data);
                dispatch({ type: socketActions.SET_CURRENT_ROOM, payload: data.room });
                dispatch({ type: socketActions.SET_ROOM_USERS, payload: data.users || [] });
                dispatch({ type: socketActions.JOINED_ROOM, payload: true });
                emitEvent('room_joined', data);
            });

            newSocket.on('room_left', (data) => {
                dispatch({ type: socketActions.SET_CURRENT_ROOM, payload: null });
                dispatch({ type: socketActions.SET_ROOM_USERS, payload: [] });
                dispatch({ type: socketActions.JOINED_ROOM, payload: false });
            });

            newSocket.on('user_joined', (data) => {
                if (data.user) {
                    dispatch({ type: socketActions.USER_JOINED, payload: data.user });
                }
            });

            newSocket.on('user_left', (data) => {
                dispatch({ type: socketActions.USER_LEFT, payload: data });
            });

            // WebRTC Signaling
            newSocket.on('webrtc_offer', (data) => emitEvent('webrtc_offer', data));
            newSocket.on('webrtc_answer', (data) => emitEvent('webrtc_answer', data));
            newSocket.on('webrtc_ice_candidate', (data) => emitEvent('webrtc_ice_candidate', data));
            newSocket.on('newProducer', (data) => emitEvent('newProducer', data));
            newSocket.on('producerClosed', (data) => emitEvent('producerClosed', data));

            return () => {
                newSocket.disconnect();
            };
        }
    }, [user, token]);

    const joinRoom = (roomId) => {
        if (state.socket && state.connected) {
            // Leave current if any
            if (state.currentRoom) {
                state.socket.emit('leave_room', { roomId: state.currentRoom._id });
            }

            state.socket.emit('join_room', { roomId });
        }
    };

    const leaveRoom = (roomId) => {
        if (state.socket && state.connected) {
            state.socket.emit('leave_room', { roomId });

            // Also notify backend API (optional but good for cleanup)
            axios.post(`/api/rooms/${roomId}/leave`).catch(e => console.log('Leave API error', e));

            dispatch({ type: socketActions.SET_CURRENT_ROOM, payload: null });
            dispatch({ type: socketActions.JOINED_ROOM, payload: false });
        }
    };

    const value = {
        socket: state.socket,
        connected: state.connected,
        currentRoom: state.currentRoom,
        roomUsers: state.roomUsers,
        joinRoom,
        leaveRoom,
        // Event Emitter for hooks
        addListener,
        emitEvent
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) throw new Error('useSocket must be used within SocketProvider');
    return context;
};
