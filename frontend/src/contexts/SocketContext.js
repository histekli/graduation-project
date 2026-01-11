import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

// Initial state
const initialState = {
  socket: null,
  connected: false,
  currentRoom: null,
  roomUsers: [],
  messages: [],
  onlineUsers: [],
  error: null
};

// Action types
const socketActions = {
  SET_SOCKET: 'SET_SOCKET',
  SET_CONNECTED: 'SET_CONNECTED',
  SET_CURRENT_ROOM: 'SET_CURRENT_ROOM',
  SET_ROOM_USERS: 'SET_ROOM_USERS',
  ADD_MESSAGE: 'ADD_MESSAGE',
  SET_MESSAGES: 'SET_MESSAGES',
  UPDATE_ONLINE_USERS: 'UPDATE_ONLINE_USERS',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  USER_JOINED: 'USER_JOINED',
  USER_LEFT: 'USER_LEFT',
  USER_LOCATION_UPDATED: 'USER_LOCATION_UPDATED'
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
      return {
        ...state,
        messages: [...state.messages, action.payload]
      };

    case socketActions.SET_MESSAGES:
      return { ...state, messages: action.payload };

    case socketActions.UPDATE_ONLINE_USERS:
      return { ...state, onlineUsers: action.payload };

    case socketActions.SET_ERROR:
      return { ...state, error: action.payload };

    case socketActions.CLEAR_ERROR:
      return { ...state, error: null };

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

    case socketActions.USER_LOCATION_UPDATED:
      return {
        ...state,
        roomUsers: state.roomUsers.map(user =>
          user._id === action.payload.userId
            ? { ...user, location: action.payload.location }
            : user
        )
      };

    default:
      return state;
  }
}

// Create context
const SocketContext = createContext();

// Provider component
export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [state, dispatch] = useReducer(socketReducer, initialState);

  // Initialize socket connection
  useEffect(() => {
    if (user && token) {
      console.log('� Socket bağlantısı başlatılıyor...', {
        user: user.username,
        isGuest: token.startsWith('guest_token_'),
        token: token ? 'mevcut' : 'yok'
      });

      const newSocket = io('/', {
        auth: {
          token: token,
          isGuest: token.startsWith('guest_token_'),
          username: user.username
        },
        transports: ['polling', 'websocket'],
        upgrade: true,
        rememberUpgrade: false,
        // forceNew: true, // Removed - keep connection alive across navigations
        reconnection: true,
        timeout: 20000,
        path: '/socket.io'
      });

      console.log('🔌 Socket objesi oluşturuldu:', newSocket);

      dispatch({ type: socketActions.SET_SOCKET, payload: newSocket });

      // Connection handlers
      newSocket.on('connect', () => {
        console.log('✅ Socket connected:', newSocket.id);
        dispatch({ type: socketActions.SET_CONNECTED, payload: true });
        dispatch({ type: socketActions.CLEAR_ERROR });
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        dispatch({ type: socketActions.SET_CONNECTED, payload: false });

        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          newSocket.connect();
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        dispatch({ type: socketActions.SET_ERROR, payload: 'Bağlantı hatası' });
        dispatch({ type: socketActions.SET_CONNECTED, payload: false });
      });

      // Room events - standardı alt çizgi olarak belirledik
      newSocket.on('room_joined', handleRoomJoined);

      function handleRoomJoined(data) {
        console.log('✅ Room joined:', data);
        dispatch({ type: socketActions.SET_CURRENT_ROOM, payload: data.room });
        dispatch({ type: socketActions.SET_ROOM_USERS, payload: data.users || [] });

        // Bildirim gösterme kontrolü
        // 1. Sessiz mod ise bildirim gösterme
        // 2. Oda yaratıcısı ise ve yeni oda oluşturulmuşsa, zaten "Oda başarıyla oluşturuldu" bildirimi var
        const showNotification = !data.silent &&
          !data.room_created &&
          sessionStorage.getItem('silent_room_join') !== 'true';

        // Kontrol sonrası bildirimi göster veya gizle
        if (showNotification) {
          toast.success(data.message || 'Odaya katıldınız');
        } else {
          console.log('🔇 Bildirim gösterilmedi (sessiz mod veya odayı oluşturan kullanıcı)');
        }

        // Sessiz mod bayrağını temizle (kullanıldıysa)
        sessionStorage.removeItem('silent_room_join');
      }

      newSocket.on('room_left', handleRoomLeft);

      function handleRoomLeft(data) {
        console.log('➡️ Room left:', data);
        dispatch({ type: socketActions.SET_CURRENT_ROOM, payload: null });
        dispatch({ type: socketActions.SET_ROOM_USERS, payload: [] });
        dispatch({ type: socketActions.SET_MESSAGES, payload: [] });
        toast(data.message || 'Odadan ayrıldınız');
      }

      newSocket.on('user_joined', handleUserJoined);

      function handleUserJoined(data) {
        console.log('👤 User joined:', data);
        if (data.user) {
          dispatch({ type: socketActions.USER_JOINED, payload: data.user });
          toast(`${data.user.username} odaya katıldı`);
        } else if (data.username) {
          const simpleUser = {
            _id: data.userId,
            username: data.username,
            location: data.location || null
          };
          dispatch({ type: socketActions.USER_JOINED, payload: simpleUser });
          toast(`${data.username} odaya katıldı`);
        }
      }

      newSocket.on('user_left', handleUserLeft);
      newSocket.on('user_left_room', handleUserLeft);

      function handleUserLeft(data) {
        console.log('👤 User left:', data);
        dispatch({ type: socketActions.USER_LEFT, payload: data });
        if (data.username) {
          toast(`${data.username} odadan ayrıldı`);
        }
      }

      // Oda kullanıcıları güncellemesi
      newSocket.on('room_users_updated', handleRoomUsersUpdated);

      function handleRoomUsersUpdated(users) {
        console.log('👥 Room users updated:', users);
        if (Array.isArray(users)) {
          dispatch({ type: socketActions.SET_ROOM_USERS, payload: users });
        }
      }

      // Message events
      newSocket.on('new_message', (data) => {
        console.log('💬 New message:', data);
        dispatch({ type: socketActions.ADD_MESSAGE, payload: data.message });
      });

      newSocket.on('message_deleted', (data) => {
        console.log('🗑️ Message deleted:', data);
        window.dispatchEvent(new CustomEvent('message_deleted', { detail: data }));
      });

      // Location events
      newSocket.on('user_location_updated', (data) => {
        console.log('📍 Location updated:', data);
        dispatch({ type: socketActions.USER_LOCATION_UPDATED, payload: data });
      });

      newSocket.on('location_updated', (data) => {
        console.log('📍 My location updated:', data);
        // Optionally show a toast or update UI
      });

      newSocket.on('location_update_success', (data) => {
        console.log('📍 Location updated:', data);
        toast.success('Konumunuz güncellendi');
      });

      // WebRTC signaling events
      newSocket.on('webrtc_offer', (data) => {
        console.log('🎵 WebRTC offer received:', data);
        // Handle WebRTC offer (will be implemented in WebRTC context)
        window.dispatchEvent(new CustomEvent('webrtc_offer', { detail: data }));
      });

      newSocket.on('webrtc_answer', (data) => {
        console.log('🎵 WebRTC answer received:', data);
        // Handle WebRTC answer
        window.dispatchEvent(new CustomEvent('webrtc_answer', { detail: data }));
      });

      newSocket.on('webrtc_ice_candidate', (data) => {
        console.log('🧊 ICE candidate received:', data);
        // Handle ICE candidate
        window.dispatchEvent(new CustomEvent('webrtc_ice_candidate', { detail: data }));
      });

      // User activity events
      newSocket.on('user_started_talking', (data) => {
        console.log('🎤 User started talking:', data);
        window.dispatchEvent(new CustomEvent('user_started_talking', { detail: data }));
      });

      newSocket.on('user_stopped_talking', (data) => {
        console.log('🔇 User stopped talking:', data);
        window.dispatchEvent(new CustomEvent('user_stopped_talking', { detail: data }));
      });

      newSocket.on('user_speaking', (data) => {
        window.dispatchEvent(new CustomEvent('user_speaking', { detail: data }));
      });

      // Room events
      newSocket.on('room_created', (data) => {
        console.log('🏗️ Room created:', data);
        window.dispatchEvent(new CustomEvent('room_created', { detail: data }));
      });

      newSocket.on('room_deleted', (data) => {
        console.log('🗑️ Room deleted:', data);
        window.dispatchEvent(new CustomEvent('room_deleted', { detail: data }));
      });

      newSocket.on('room_updated', (data) => {
        console.log('📝 Room updated:', data);
        window.dispatchEvent(new CustomEvent('room_updated', { detail: data }));
      });

      // Error events
      newSocket.on('error', (data) => {
        console.error('❌ Socket error:', data);
        dispatch({ type: socketActions.SET_ERROR, payload: data.message });
        toast.error(data.message || 'Bir hata oluştu');
      });

      // No cleanup - socket stays alive across navigations
      // Only disconnects when user/token changes (which triggers new useEffect)
      return () => {
        console.log('🔌 Socket cleanup - keeping connection alive');
        // Don't disconnect - will reconnect with same socket on remount
      };

    } else if (state.socket) {
      // User logged out, disconnect socket
      state.socket.disconnect();
      dispatch({ type: socketActions.SET_SOCKET, payload: null });
      dispatch({ type: socketActions.SET_CONNECTED, payload: false });
      dispatch({ type: socketActions.SET_CURRENT_ROOM, payload: null });
      dispatch({ type: socketActions.SET_ROOM_USERS, payload: [] });
      dispatch({ type: socketActions.SET_MESSAGES, payload: [] });
    }
  }, [user, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket action functions
  const joinRoom = (roomId) => {
    if (state.socket && state.connected) {
      // Önceki oda durumunu kontrol et
      if (state.currentRoom && state.currentRoom._id === roomId) {
        console.log('⚠️ Zaten bu odadasınız:', roomId);
        // Zaten bu odada olduğumuz için hiçbir şey yapma ve bildirimleri engelle
        return;
      }

      // Eğer kullanıcı başka bir odadaysa, önce o odadan çık
      if (state.currentRoom && state.currentRoom._id) {
        console.log('⚠️ Başka bir odadan çıkılıyor:', state.currentRoom._id);
        state.socket.emit('leave_room', { roomId: state.currentRoom._id });
        // State'i hemen temizle, socket event'ini bekleme
        dispatch({ type: socketActions.SET_CURRENT_ROOM, payload: null });
        dispatch({ type: socketActions.SET_ROOM_USERS, payload: [] });
      }

      // Oda ID'sini localStorage'a kaydet - persistance için
      localStorage.setItem('current_room_id', roomId);

      // Kısa bir gecikme ile yeni odaya katılım yap (önceki odadan çıkışın işlenmesi için)
      setTimeout(() => {
        // Yeni odaya katıl
        state.socket.emit('join_room', { roomId });
      }, 100);
    } else {
      toast.error('Bağlantı yok, lütfen bekleyin');
    }
  };

  const leaveRoom = (roomId) => {
    if (state.socket && state.connected) {
      // localStorage'dan oda bilgisini temizle
      localStorage.removeItem('current_room_id');

      // Önce state'i temizle, sonra event'i gönder
      dispatch({ type: socketActions.SET_CURRENT_ROOM, payload: null });
      dispatch({ type: socketActions.SET_ROOM_USERS, payload: [] });
      dispatch({ type: socketActions.SET_MESSAGES, payload: [] });

      // Odadan ayrılma eventi gönder
      state.socket.emit('leave_room', { roomId });

      // Ayrıca sunucu tarafında currentRoom'u temizle
      // Ayrıca sunucu tarafında currentRoom'u temizle
      axios.post(`/api/rooms/${roomId}/leave`)
        .catch(err => console.error('Oda ayrılma API hatası:', err));
    }
  };

  const sendMessage = (roomId, content, type = 'text', replyTo = null) => {
    if (state.socket && state.connected) {
      state.socket.emit('send_message', {
        roomId,
        content,
        type,
        replyTo
      });
    } else {
      toast.error('Bağlantı yok, mesaj gönderilemedi');
    }
  };

  const updateLocation = (longitude, latitude, address = '') => {
    if (state.socket && state.connected) {
      state.socket.emit('location_update', {
        longitude,
        latitude,
        address
      });
    }
  };

  const toggleMute = (roomId, isMuted) => {
    if (state.socket && state.connected) {
      state.socket.emit('toggle_mute', { roomId, isMuted });
    }
  };

  // WebRTC signaling functions
  const sendWebRTCOffer = (targetUserId, offer, roomId) => {
    if (state.socket && state.connected) {
      state.socket.emit('webrtc_offer', {
        targetUserId,
        offer,
        roomId
      });
    }
  };

  const sendWebRTCAnswer = (targetUserId, answer, roomId) => {
    if (state.socket && state.connected) {
      state.socket.emit('webrtc_answer', {
        targetUserId,
        answer,
        roomId
      });
    }
  };

  const sendICECandidate = (targetUserId, candidate, roomId) => {
    if (state.socket && state.connected) {
      state.socket.emit('webrtc_ice_candidate', {
        targetUserId,
        candidate,
        roomId
      });
    }
  };

  const clearError = () => {
    dispatch({ type: socketActions.CLEAR_ERROR });
  };

  const value = {
    socket: state.socket,
    connected: state.connected,
    currentRoom: state.currentRoom,
    roomUsers: state.roomUsers,
    messages: state.messages,
    onlineUsers: state.onlineUsers,
    error: state.error,

    // Actions
    joinRoom,
    leaveRoom,
    sendMessage,
    updateLocation,
    toggleMute,
    clearError,

    // WebRTC
    sendWebRTCOffer,
    sendWebRTCAnswer,
    sendICECandidate
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

// Hook to use socket context
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
