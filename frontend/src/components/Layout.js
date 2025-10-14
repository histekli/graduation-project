import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { FaCar, FaSignOutAlt, FaUser, FaHome, FaWifi, FaExclamationTriangle } from 'react-icons/fa';

const Layout = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <FaCar className="text-2xl text-primary-500" />
              <span className="text-xl font-bold text-gray-900">CarVoice</span>
            </Link>

            {/* Navigation & User Menu */}
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              {user && (
                <div className="flex items-center space-x-1 text-sm">
                  {connected ? (
                    <FaWifi className="text-green-500" title="Bağlı" />
                  ) : (
                    <FaExclamationTriangle className="text-red-500" title="Bağlantı Yok" />
                  )}
                  <span className={`hidden sm:inline ${connected ? 'text-green-600' : 'text-red-600'}`}>
                    {connected ? 'Bağlı' : 'Bağlantı Yok'}
                  </span>
                </div>
              )}

              {user ? (
                /* Authenticated Navigation */
                <div className="flex items-center space-x-4">
                  <Link 
                    to="/dashboard" 
                    className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <FaHome className="text-sm" />
                    <span className="hidden sm:inline">Anasayfa</span>
                  </Link>

                  <Link 
                    to="/profile" 
                    className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <FaUser className="text-sm" />
                    <span className="hidden sm:inline">Profil</span>
                  </Link>

                  {/* User Info */}
                  <div className="flex items-center space-x-2">
                    {user.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={user.username}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user.username?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <span className="hidden sm:inline text-sm font-medium text-gray-700">
                      {user.username}
                    </span>
                  </div>

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors p-2 rounded-md hover:bg-gray-100"
                    title="Çıkış Yap"
                  >
                    <FaSignOutAlt className="text-sm" />
                    <span className="hidden sm:inline">Çıkış</span>
                  </button>
                </div>
              ) : (
                /* Unauthenticated Navigation */
                <div className="flex items-center space-x-4">
                  <Link 
                    to="/login" 
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Giriş Yap
                  </Link>
                  <Link 
                    to="/register" 
                    className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    Kayıt Ol
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <FaCar className="text-primary-500" />
              <span className="text-gray-600">
                © 2024 CarVoice - WebRTC Araç İçi İletişim Sistemi
              </span>
            </div>
            <div className="text-sm text-gray-500">
              CSE Bitirme Projesi
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
