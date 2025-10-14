import React from 'react';
import { Link } from 'react-router-dom';
import { FaCar, FaMicrophone, FaMapMarkerAlt, FaUsers, FaMobile, FaLaptop } from 'react-icons/fa';

const HomePage = () => {
  const features = [
    {
      icon: FaMicrophone,
      title: 'Sesli İletişim',
      description: 'WebRTC ile gerçek zamanlı, yüksek kaliteli sesli iletişim kurun'
    },
    {
      icon: FaMapMarkerAlt,
      title: 'Konum Paylaşımı',
      description: 'GPS ile anlık konum paylaşımı ve harita üzerinde görüntüleme'
    },
    {
      icon: FaUsers,
      title: 'Grup Sohbeti',
      description: 'Çoklu kullanıcı desteği ile grup halinde sesli ve metin sohbeti'
    },
    {
      icon: FaMobile,
      title: 'Mobil Uyumlu',
      description: 'React Native ile iOS ve Android cihazlarda sorunsuz çalışır'
    },
    {
      icon: FaLaptop,
      title: 'Web Tarayıcı',
      description: 'Modern araçlardaki web tarayıcıları ile uyumlu arayüz'
    },
    {
      icon: FaCar,
      title: 'Araç İçi Entegrasyon',
      description: 'Bluetooth ve araç ses sistemi entegrasyonu'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="p-4 bg-white/10 rounded-full">
                <FaCar className="text-6xl" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              CarVoice
            </h1>
            <p className="text-xl md:text-2xl mb-4 text-primary-100">
              WebRTC Tabanlı Araç İçi Sesli İletişim Sistemi
            </p>
            <p className="text-lg mb-8 text-primary-200 max-w-2xl mx-auto">
              Sürücüler arasında gerçek zamanlı sesli iletişim kurun, konumunuzu paylaşın 
              ve harita üzerinde birbirinizi görün. Modern araçlar ve mobil cihazlar için optimize edilmiştir.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/register" 
                className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
              >
                Hemen Başlayın
              </Link>
              <Link 
                to="/login" 
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
              >
                Giriş Yapın
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Özellikler
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Modern teknolojilerle güçlendirilmiş kapsamlı iletişim çözümü
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-primary-100 text-primary-600 rounded-full">
                    <feature.icon className="text-2xl" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Nasıl Çalışır?
            </h2>
            <p className="text-xl text-gray-600">
              Üç basit adımda iletişim kurmaya başlayın
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Kayıt Olun
              </h3>
              <p className="text-gray-600">
                Hızlı kayıt işlemi ile hesabınızı oluşturun ve giriş yapın
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Odaya Katılın
              </h3>
              <p className="text-gray-600">
                Mevcut bir odaya katılın veya yeni bir oda oluşturun
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                İletişim Kurun
              </h3>
              <p className="text-gray-600">
                Sesli konuşma başlatın ve konumunuzu diğer kullanıcılarla paylaşın
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Hemen Denemeye Başlayın
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Ücretsiz hesap oluşturun ve CarVoice'un tüm özelliklerini keşfedin
          </p>
          <Link 
            to="/register" 
            className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors inline-block"
          >
            Ücretsiz Başlayın
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
