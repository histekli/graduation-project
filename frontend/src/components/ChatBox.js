import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, MessageCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ChatBox = ({ socket, roomId, user, isOpen, onToggle }) => {
  const { token } = useAuth(); // Token'ı AuthContext'ten al
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Reset unread count when chat is opened
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Load messages when room changes
  useEffect(() => {
    if (!roomId || !user || !token) {
      console.log('⚠️ ChatBox: roomId, user veya token eksik', { roomId, user: !!user, token: !!token });
      return;
    }

    const loadMessages = async () => {
      setIsLoading(true);
      try {
        console.log('📤 Mesajlar yükleniyor...', { roomId, tokenLength: token?.length });

        const response = await axios.get(`/api/rooms/${roomId}/messages`);

        if (response.data) {
          setMessages(response.data.messages || []);
          console.log('✅ Mesajlar yüklendi:', response.data.messages?.length || 0);
        }
      } catch (error) {
        console.error('❌ Mesaj yükleme hatası:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [roomId, user, token]);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !socket.on) return;

    const handleNewMessage = (data) => {
      console.log('💬 Yeni mesaj alındı:', data);
      if (data?.message) {
        setMessages(prev => [...prev, data.message]);

        // Increment unread count if chat is closed and message is from someone else
        if (!isOpen && data.message.sender._id !== user._id) {
          setUnreadCount(prev => prev + 1);
        }
      }
    };

    const handleMessageError = (data) => {
      console.error('❌ Mesaj hatası:', data);
      // Optionally show error to user
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_error', handleMessageError);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_error', handleMessageError);
    };
  }, [socket, isOpen, user]);

  // Send message handler
  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!newMessage.trim() || isSending) return;

    if (!socket || !socket.emit) {
      console.error('Socket not available');
      return;
    }

    setIsSending(true);
    console.log('📤 Mesaj gönderiliyor:', { roomId, content: newMessage });

    socket.emit('send_message', {
      roomId,
      content: newMessage.trim()
    });

    setNewMessage('');
    setIsSending(false);
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition-all z-50 md:bottom-6 md:right-6 bottom-20 right-4"
        aria-label="Sohbeti Aç"
      >
        <MessageCircle size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-full md:w-96 bg-white rounded-lg shadow-2xl flex flex-col z-50 max-h-[600px] md:max-h-[600px] max-h-[80vh] left-0 md:left-auto md:bottom-6 md:right-6 bottom-0 right-0 rounded-b-none md:rounded-b-lg">
      {/* Header */}
      <div className="bg-blue-500 text-white p-4 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageCircle size={20} />
          <h3 className="font-semibold">Oda Sohbeti</h3>
        </div>
        <button
          onClick={onToggle}
          className="hover:bg-blue-600 p-1 rounded transition-colors"
          aria-label="Sohbeti Kapat"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
        style={{ maxHeight: '400px' }}
      >
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm">Mesajlar yükleniyor...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MessageCircle size={48} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Henüz mesaj yok</p>
            <p className="text-xs mt-1">İlk mesajı siz gönderin!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwnMessage = message.sender._id === user._id;

            return (
              <div
                key={message._id || index}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} items-end space-x-2`}
              >
                {!isOwnMessage && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {message.sender.username.charAt(0).toUpperCase()}
                  </div>
                )}

                <div
                  className={`max-w-[75%] rounded-lg p-3 ${isOwnMessage
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                    }`}
                >
                  {!isOwnMessage && (
                    <div className="text-xs font-semibold mb-1 text-blue-600">
                      {message.sender.username}
                    </div>
                  )}
                  <div className="text-sm break-words whitespace-pre-wrap">{message.content}</div>
                  <div
                    className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                      }`}
                  >
                    {formatTime(message.createdAt)}
                  </div>
                </div>

                {isOwnMessage && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {message.sender.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 border-t bg-white rounded-b-lg">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder="Mesajınızı yazın..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            maxLength={1000}
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className={`px-4 py-2 rounded-lg transition-colors ${newMessage.trim() && !isSending
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            aria-label="Mesaj Gönder"
          >
            {isSending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2 flex justify-between items-center">
          <span>{newMessage.length}/1000 karakter</span>
          <span className="text-gray-400">Enter: Gönder</span>
        </div>
      </form>
    </div>
  );
};

export default ChatBox;
