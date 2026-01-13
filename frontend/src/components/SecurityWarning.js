import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Smartphone } from 'lucide-react';

const SecurityWarning = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    setIsMobile(isMobileDevice);

    // HTTP ve localhost dışında uyarı göster
    const isInsecure = window.location.protocol === 'http:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';

    if (isInsecure) {
      setShowWarning(true);
    }
  }, []);

  if (!showWarning) {
    return null;
  }

  const isHttpWarning = window.location.protocol === 'http:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          {isMobile ? (
            <Smartphone className="h-5 w-5 text-yellow-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          )}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            {isMobile ? 'Mobil Cihaz Uyarısı' : 'Güvenlik Uyarısı'}
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            {isHttpWarning && (
              <div className="mb-3">
                <p className="font-medium flex items-center">
                  <Shield size={16} className="mr-2" />
                  Güvensiz Bağlantı Tespit Edildi
                </p>
                <p className="mt-1">
                  Bu site HTTP üzerinden çalışıyor. Sesli iletişim için güvenli (HTTPS) bağlantı gereklidir.
                  Mikrofon erişimi engellenebilir.
                </p>
              </div>
            )}

            {isMobile && (
              <div className="mb-3">
                <p className="font-medium flex items-center">
                  <Smartphone size={16} className="mr-2" />
                  Mobil Cihaz Mikrofon İzni Rehberi
                </p>

                {/* iOS Rehberi */}
                {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                    <p className="font-medium text-blue-800">🍎 iOS Safari:</p>
                    <ul className="mt-1 text-sm list-disc list-inside space-y-1 text-blue-700">
                      <li>Ayarlar → Safari → Kamera ve Mikrofon</li>
                      <li>Bu site için "Sor" veya "İzin Ver" seçin</li>
                      <li>Safari'yi tamamen kapatıp açın</li>
                      <li>Site adres çubuğunda mikrofon simgesini kontrol edin</li>
                    </ul>
                  </div>
                )}

                {/* Android Rehberi */}
                {/Android/.test(navigator.userAgent) && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <p className="font-medium text-green-800">🤖 Android Chrome:</p>
                    <ul className="mt-1 text-sm list-disc list-inside space-y-1 text-green-700">
                      <li>Adres çubuğundaki mikrofon simgesine basın</li>
                      <li>"İzin Ver" veya "Allow" seçin</li>
                      <li>Chrome Ayarlar → Site Ayarları → Mikrofon kontrol edin</li>
                      <li>Cihaz ayarlarında Chrome'a mikrofon izni verin</li>
                    </ul>
                  </div>
                )}

                <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                  <li>Tarayıcıyı tam ekran modunda kullanın</li>
                  <li>Cihazınızın sesli modunun açık olduğundan emin olun</li>
                  <li>Diğer ses uygulamalarını kapatın</li>
                  <li>WiFi bağlantınızın kararlı olduğundan emin olun</li>
                </ul>
              </div>
            )}

            <div className="mt-3">
              <p className="font-medium">🔧 Sorun Giderme Adımları:</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Tarayıcının mikrofon iznini kontrol edin (adres çubuğundaki kilit simgesi)</li>
                <li>Diğer ses uygulamalarını kapatın</li>
                <li>Sayfayı yenilemeyi deneyin (F5 veya Ctrl+R)</li>
                {!isMobile && <li>Chrome kullanıyorsanız: chrome://settings/content/microphone adresini kontrol edin</li>}
              </ul>
            </div>
          </div>

          <div className="mt-3">
            <button
              onClick={() => setShowWarning(false)}
              className="text-yellow-800 hover:text-yellow-600 text-sm font-medium"
            >
              Anladım, kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityWarning;
