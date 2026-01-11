import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Users, Plus, MapPin, Clock, Mic, LogOut, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const DashboardPage = () => {
  const { user, token, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [publicRooms, setPublicRooms] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: '',
    description: '',
    isPublic: true,
    maxUsers: 10
  });

  // Dashboard verilerini yükle
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Public odalar her zaman yüklenebilir (authentication gerektirmez)
      const roomsPromise = axios.get('/api/rooms/public');

      // Kullanıcı listesi sadece kayıtlı kullanıcılar için
      let usersPromise;
      if (!user?.isGuest) {
        usersPromise = axios.get('/api/users/online');
      }

      // API çağrılarını paralel olarak yap
      const responses = await Promise.all(
        user?.isGuest ? [roomsPromise] : [roomsPromise, usersPromise]
      );

      // Rooms data
      const roomsResponse = responses[0];
      if (roomsResponse.data) {
        const formattedRooms = roomsResponse.data.rooms?.map(room => ({
          ...room,
          userCount: room.users?.length || 0,
          creator: room.creator?.username || 'Bilinmeyen'
        })) || [];
        setPublicRooms(formattedRooms);
        console.log('📋 Rooms loaded:', formattedRooms.length);
      }

      // Users data (sadece kayıtlı kullanıcılar için)
      if (!user?.isGuest && responses[1]) {
        const usersResponse = responses[1];
        if (usersResponse.data) {
          setOnlineUsers(usersResponse.data.users || []);
          console.log('👥 Users loaded:', usersResponse.data.users?.length || 0);
        }
      } else if (user?.isGuest) {
        console.log('👤 Misafir kullanıcı - Kullanıcı listesi atlanıyor');
        setOnlineUsers([]);
      }

    } catch (error) {
      console.error('❌ Dashboard data error:', error);

      if (error.response?.status === 401) {
        toast.error('Oturum süreniz dolmuş, lütfen tekrar giriş yapın');
        logout();
        return;
      }

      toast.error('Veriler yüklenirken hata oluştu');

      // Fallback mock data in case of network error
      const mockRooms = [
        {
          _id: '1',
          name: 'Genel Sohbet',
          description: 'Herkese açık genel sohbet odası',
          userCount: 5,
          maxUsers: 20,
          isPublic: true,
          createdAt: new Date(),
          creator: 'admin'
        },
        {
          _id: '2',
          name: 'Ankara Trafik',
          description: 'Ankara trafiği hakkında bilgi paylaşımı',
          userCount: 3,
          maxUsers: 15,
          isPublic: true,
          createdAt: new Date(Date.now() - 3600000),
          creator: 'user1'
        }
      ];

      const mockUsers = [
        { _id: '1', username: 'Ali_Veli', currentRoom: { name: 'Genel Sohbet' }, isOnline: true },
        { _id: '2', username: 'Mehmet_K', currentRoom: null, isOnline: true },
        { _id: '3', username: 'Ayşe_Y', currentRoom: { name: 'Ankara Trafik' }, isOnline: true }
      ];

      setPublicRooms(mockRooms);
      setOnlineUsers(mockUsers);
    } finally {
      setLoading(false);
    }
  };

  // Dashboard verilerini yükle
  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time Room Updates with SocketContext
  useEffect(() => {
    if (socket) {
      console.log('🔌 Dashboard: Socket connected, listening for updates...');

      const handleRoomCreated = (room) => {
        console.log('🆕 Dashboard: Yeni oda:', room.name);
        setPublicRooms(prev => {
          // Prevent duplicates
          if (prev.some(r => r._id === room._id)) return prev;
          return [room, ...prev];
        });
        toast.success(`Yeni oda: ${room.name}`, { duration: 3000, position: 'top-right' });
      };

      const handleRoomDeleted = (roomId) => {
        console.log('🗑️ Dashboard: Oda silindi:', roomId);
        setPublicRooms(prev => prev.filter(r => r._id !== roomId));
      };

      const handleRoomCountUpdate = (data) => {
        // data: { roomId, userCount } (Backend'de bunu emit etmek gerekir)
        // Şimdilik pas geçiyoruz veya implemente edebiliriz.
      };

      socket.on('room_created', handleRoomCreated);
      socket.on('room_deleted', handleRoomDeleted);
      // socket.on('room_updated', ...); 

      return () => {
        socket.off('room_created', handleRoomCreated);
        socket.off('room_deleted', handleRoomDeleted);
      };
    }
  }, [socket]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();

    if (!newRoom.name.trim()) {
      toast.error('Oda adı gerekli');
      return;
    }

    // Misafir kullanıcılar oda oluşturamaz
    if (user?.isGuest) {
      toast.error('Misafir kullanıcılar oda oluşturamaz. Lütfen kayıt olun.');
      return;
    }

    try {
      console.log('🏗️ Creating room:', newRoom);
      console.log('👤 User:', user);
      console.log('🔐 Token exists:', !!token);

      // İşlem başlamadan önce localStorage temizle
      window.localStorage.removeItem('current_room_id');

      const response = await axios.post('/api/rooms/create', newRoom);

      console.log('✅ Oda oluşturuldu:', response.data);
      toast.success('Oda başarıyla oluşturuldu!');
      setShowCreateRoom(false);
      setNewRoom({ name: '', description: '', isPublic: true, maxUsers: 10 });

      // Oluşturulan odaya otomatik olarak git
      if (response.data && response.data.room && response.data.room._id) {
        const roomId = response.data.room._id;
        console.log('🚪 Odaya yönlendiriliyor:', roomId);

        // Oda oluşturulduğunda kullanıcı zaten otomatik olarak odaya ekleniyor
        // Bu yüzden tekrar join işlemi yapmaya gerek yok

        // Oda ID'sini localStorage'a kaydedelim (VoiceChat bileşeninde kullanılacak)
        localStorage.setItem('current_room_id', roomId);

        // Yeni oda oluşturma bayrağı ekleyelim - bu, VoiceChat'te kontrol edilecek
        sessionStorage.setItem('new_room_created', roomId);

        // Yönlendirme öncesi tüm event'lerin tamamlanması için biraz bekleyelim
        setTimeout(() => {
          // Sessiz katılım için flag ekleyelim - bu flag VoiceChat'te kontrol edilecek
          sessionStorage.setItem('silent_room_join', 'true');
          navigate(`/voice/${roomId}`);
        }, 500);
      } else {
        console.error('❌ Oda ID bulunamadı:', response.data);
        toast.error('Oda ID bulunamadı');
        fetchDashboardData(); // Listeyi yenile
      }

    } catch (error) {
      console.error('❌ Room creation error:', error);

      if (error.response?.status === 401) {
        toast.error('Oturum süreniz dolmuş, lütfen tekrar giriş yapın');
        logout();
        return;
      }

      const errorMessage = error.response?.data?.error || error.message || 'Oda oluşturulurken hata oluştu';
      toast.error(errorMessage);
    }
  };

  const joinRoom = async (roomId) => {
    try {
      console.log('🚪 Joining room:', roomId);

      // Misafir kullanıcılar için direkt yönlendirme
      if (user?.isGuest) {
        console.log('👤 Misafir kullanıcı - Direkt voice chat\'e yönlendiriliyor');
        navigate(`/voice/${roomId}`);
        return;
      }

      // localStorage'daki önceki oda bilgisini temizle
      window.localStorage.removeItem('current_room_id');

      // Herhangi bir odada hala mevcut olabilecek durumu temizle
      if (user?.currentRoom) {
        try {
          await axios.post(`/api/rooms/${user.currentRoom}/leave`);
          console.log('✅ Önceki odadan çıkış yapıldı');
        } catch (leaveError) {
          console.error('⚠️ Önceki odadan çıkarken hata:', leaveError);
        }
      }

      // Önce API'den oda durumunu kontrol edelim
      const checkResponse = await axios.get(`/api/rooms/${roomId}`);
      const roomData = checkResponse.data?.room;

      // Kullanıcının zaten odada olup olmadığını kontrol edelim
      const userInRoom = roomData?.users?.some(u => u._id === user?._id || u.user?._id === user?._id);

      if (userInRoom) {
        console.log('⚠️ Kullanıcı zaten odada:', roomId);

        try {
          await axios.post(`/api/rooms/${roomId}/leave`);
          console.log('✅ Odadan çıkış yapıldı, tekrar katılınacak');

          // Temiz bir şekilde yeniden katıl
          await axios.post(`/api/rooms/${roomId}/join`);
          navigate(`/voice/${roomId}`);
        } catch (err) {
          console.error('⚠️ Oda işlemleri sırasında hata:', err);
          navigate(`/voice/${roomId}`); // Yine de yönlendir
        }
        return;
      }

      // Normal katılım işlemi
      await axios.post(`/api/rooms/${roomId}/join`);
      navigate(`/voice/${roomId}`);

    } catch (error) {
      console.error('❌ Room join error:', error);

      if (error.response?.status === 401) {
        toast.error('Oturum süreniz dolmuş, lütfen tekrar giriş yapın');
        logout();
        return;
      }

      // API'den "zaten odadasınız" hatası gelirse, önce çıkış yapıp sonra tekrar girmeyi deneyelim
      if (error.response?.data?.error?.includes('zaten') ||
        error.response?.data?.message?.includes('zaten')) {
        console.log('⚠️ Kullanıcı zaten odada, önce çıkıp sonra tekrar girilecek');

        try {
          await axios.post(`/api/rooms/${roomId}/leave`);
          console.log('✅ Odadan çıkış yapıldı, tekrar katılınacak');

          await axios.post(`/api/rooms/${roomId}/join`);
          navigate(`/voice/${roomId}`);
        } catch (err) {
          console.error('❌ Oda işlemleri sırasında hata:', err);
          navigate(`/voice/${roomId}`);
        }
        return;
      }

      const errorMessage = error.response?.data?.error || 'Odaya katılırken hata oluştu';
      toast.error(errorMessage);
    }
  };

  const deleteRoom = async (roomId, roomName) => {
    if (!window.confirm(`"${roomName}" odasını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      await axios.delete(`/api/rooms/${roomId}`);
      toast.success('Oda başarıyla silindi');
      fetchDashboardData(); // Listeyi yenile
    } catch (error) {
      console.error('❌ Room delete error:', error);

      if (error.response?.status === 401) {
        toast.error('Oturum süreniz dolmuş, lütfen tekrar giriş yapın');
        logout();
        return;
      }

      const errorMessage = error.response?.data?.error || 'Oda silinirken hata oluştu';
      toast.error(errorMessage);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Başarıyla çıkış yapıldı');
    navigate('/');
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 60) {
      return `${minutes} dakika önce`;
    } else if (hours < 24) {
      return `${hours} saat önce`;
    } else {
      return new Date(date).toLocaleDateString('tr-TR');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-600">Dashboard yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">
                🚗 CarVoice Dashboard
              </h1>
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Hoş geldiniz, {user?.username}</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateRoom(true)}
                className="flex items-center space-x-2 bg-blue-500 text-white px-3 py-2 rounded-md hover:bg-blue-600 transition-colors"
              >
                <Plus size={16} />
                <span className="hidden sm:block">Oda Oluştur</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-600 hover:text-red-600 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
              >
                <LogOut size={16} />
                <span className="hidden sm:block">Çıkış</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Misafir Uyarısı */}


        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="text-blue-600 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Aktif Odalar</p>
                <p className="text-2xl font-bold text-gray-900">{publicRooms.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Mic className="text-green-600 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Çevrimiçi Kullanıcı</p>
                <p className="text-2xl font-bold text-gray-900">{onlineUsers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <MapPin className="text-purple-600 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Toplam Katılım</p>
                <p className="text-2xl font-bold text-gray-900">
                  {publicRooms.reduce((sum, room) => sum + room.userCount, 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="text-yellow-600 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Aktif Konuşma</p>
                <p className="text-2xl font-bold text-gray-900">
                  {onlineUsers.filter(u => u.currentRoom).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Public Rooms */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      Genel Odalar
                    </h2>
                    <p className="text-gray-600 text-sm mt-1">
                      Katılabileceğiniz açık odalar
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateRoom(true)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    + Yeni Oda
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Misafir Kullanıcılar için Hızlı Test Odası */}


                {publicRooms.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="text-gray-300 text-4xl mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-2">Henüz oda yok</p>
                    <p className="text-gray-400 text-sm mb-4">İlk odayı siz oluşturun!</p>
                    <button
                      onClick={() => setShowCreateRoom(true)}
                      className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      <Plus size={16} className="mr-2" />
                      Oda Oluştur
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {publicRooms.map((room) => (
                      <div key={room._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-medium text-gray-900">{room.name}</h3>
                              {room.userCount > 0 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <Mic size={10} className="mr-1" />
                                  Aktif
                                </span>
                              )}
                            </div>
                            {room.description && (
                              <p className="text-gray-600 text-sm mb-3">{room.description}</p>
                            )}
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span className="flex items-center">
                                <Users size={14} className="mr-1" />
                                {room.userCount}/{room.maxUsers}
                              </span>
                              <span className="flex items-center">
                                <Clock size={14} className="mr-1" />
                                {formatTime(room.createdAt)}
                              </span>
                              <span className="flex items-center">
                                👤 {typeof room.creator === 'object' ? room.creator?.username : room.creator}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {(typeof room.creator === 'object' ? room.creator?.username : room.creator) === user?.username && (
                              <button
                                onClick={() => deleteRoom(room._id, room.name)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                title="Odayı Sil"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => joinRoom(room._id)}
                              disabled={room.userCount >= room.maxUsers}
                              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${room.userCount >= room.maxUsers
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                                }`}
                            >
                              {room.userCount >= room.maxUsers ? 'Dolu' : 'Katıl'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Online Users */}
          <div>
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Çevrimiçi Kullanıcılar
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  {onlineUsers.length} kişi aktif
                </p>
              </div>

              <div className="p-6">
                {onlineUsers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Çevrimiçi kullanıcı yok</p>
                ) : (
                  <div className="space-y-3">
                    {onlineUsers.slice(0, 8).map((onlineUser) => (
                      <div key={onlineUser._id} className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {onlineUser.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {onlineUser.username}
                          </p>
                          {onlineUser.currentRoom ? (
                            <div className="flex items-center text-xs text-green-600">
                              <Mic size={10} className="mr-1" />
                              <span className="truncate">{onlineUser.currentRoom.name}</span>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">Lobby'de bekliyor</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {onlineUsers.length > 8 && (
                      <div className="text-center pt-2">
                        <span className="text-sm text-gray-500">
                          +{onlineUsers.length - 8} kişi daha
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm mt-6">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Hızlı İşlemler</h3>
              </div>
              <div className="p-6 space-y-3">
                <Link
                  to="/voice/test"
                  className="flex items-center space-x-3 p-3 text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <Mic size={20} className="text-blue-600" />
                  <span>Ses Testi Yap</span>
                </Link>
                <Link
                  to="/profile"
                  className="flex items-center space-x-3 p-3 text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <Users size={20} className="text-green-600" />
                  <span>Profili Düzenle</span>
                </Link>
                <button
                  onClick={() => setShowCreateRoom(true)}
                  className="flex items-center space-x-3 p-3 text-gray-700 hover:bg-gray-50 rounded-md transition-colors w-full text-left"
                >
                  <Plus size={20} className="text-purple-600" />
                  <span>Hızlı Oda Oluştur</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Yeni Oda Oluştur</h3>
              <button
                onClick={() => setShowCreateRoom(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Oda Adı *
                </label>
                <input
                  type="text"
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Oda adını girin"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <textarea
                  value={newRoom.description}
                  onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Oda açıklaması (opsiyonel)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maksimum Kullanıcı
                </label>
                <select
                  value={newRoom.maxUsers}
                  onChange={(e) => setNewRoom({ ...newRoom, maxUsers: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={5}>5 Kullanıcı</option>
                  <option value={10}>10 Kullanıcı</option>
                  <option value={20}>20 Kullanıcı</option>
                  <option value={50}>50 Kullanıcı</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={newRoom.isPublic}
                  onChange={(e) => setNewRoom({ ...newRoom, isPublic: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isPublic" className="ml-2 text-sm text-gray-700">
                  Genel oda (herkes katılabilir)
                </label>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateRoom(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                  Oda Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
