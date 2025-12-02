import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaCar, FaEye, FaEyeSlash, FaEnvelope, FaLock, FaUserSecret, FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestNickname, setGuestNickname] = useState('');

  const { login, loginAsGuest, user, error, clearError } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Clear errors when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast.error('Tüm alanları doldurun');
      return;
    }

    setIsLoading(true);
    
    const result = await login(formData.email, formData.password);
    
    setIsLoading(false);
    
    if (result.success) {
      navigate('/dashboard');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleGuestLogin = async (e) => {
    e.preventDefault();
    
    if (!guestNickname.trim()) {
      toast.error('Lütfen bir kullanıcı adı girin');
      return;
    }

    if (guestNickname.length < 3) {
      toast.error('Kullanıcı adı en az 3 karakter olmalı');
      return;
    }

    if (guestNickname.length > 20) {
      toast.error('Kullanıcı adı en fazla 20 karakter olabilir');
      return;
    }

    setIsLoading(true);
    
    const result = await loginAsGuest(guestNickname.trim());
    
    setIsLoading(false);
    
    if (result.success) {
      setShowGuestModal(false);
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary-100 text-primary-600 rounded-full">
              <FaCar className="text-4xl" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Hesabınıza Giriş Yapın
          </h2>
          <p className="text-gray-600">
            CarVoice ile sesli iletişim kurarak başlayın
          </p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                E-posta Adresi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaEnvelope className="text-gray-400 text-sm" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="ornek@email.com"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Şifre
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="text-gray-400 text-sm" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  className="pl-10 pr-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Şifrenizi girin"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={togglePasswordVisibility}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <FaEyeSlash className="text-gray-400 hover:text-gray-600" />
                  ) : (
                    <FaEye className="text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Giriş Yapılıyor...
                </div>
              ) : (
                'Giriş Yap'
              )}
            </button>
          </form>

          {/* Ayırıcı */}
          <div className="mt-6 flex items-center justify-center">
            <div className="border-t border-gray-300 flex-grow"></div>
            <span className="px-4 text-sm text-gray-500">veya</span>
            <div className="border-t border-gray-300 flex-grow"></div>
          </div>

          {/* Hızlı Giriş Butonu */}
          <button
            onClick={() => setShowGuestModal(true)}
            className="mt-4 w-full bg-green-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2"
          >
            <FaUserSecret className="text-lg" />
            <span>Hızlı Giriş (Kayıt Olmadan)</span>
          </button>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Hesabınız yok mu?{' '}
              <Link 
                to="/register" 
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Kayıt olun
              </Link>
            </p>
          </div>

          {/* Demo Account Info */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Demo Hesap:</strong> Hızlı test için demo verilerle giriş yapabilirsiniz.
            </p>
          </div>
        </div>
      </div>

      {/* Hızlı Giriş Modal */}
      {showGuestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            {/* Kapatma butonu */}
            <button
              onClick={() => setShowGuestModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <FaTimes className="text-xl" />
            </button>

            {/* Modal içeriği */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-full">
                  <FaUserSecret className="text-3xl" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Hızlı Giriş
              </h3>
              <p className="text-gray-600 text-sm">
                Kayıt olmadan hızlıca sohbete başlayın! Sadece bir kullanıcı adı seçin.
              </p>
            </div>

            <form onSubmit={handleGuestLogin} className="space-y-4">
              <div>
                <label htmlFor="guestNickname" className="block text-sm font-medium text-gray-700 mb-2">
                  Kullanıcı Adı
                </label>
                <input
                  id="guestNickname"
                  type="text"
                  value={guestNickname}
                  onChange={(e) => setGuestNickname(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Örn: Yolcu123"
                  disabled={isLoading}
                  maxLength={20}
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  3-20 karakter arası
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>⚠️ Dikkat:</strong> Misafir modunda verileriniz kaydedilmez. 
                  Çıkış yaptığınızda tüm bilgileriniz silinir.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-green-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Giriş Yapılıyor...
                  </div>
                ) : (
                  'Hızlı Giriş Yap'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
