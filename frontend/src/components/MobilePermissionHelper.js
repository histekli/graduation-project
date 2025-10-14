import React, { useState } from 'react';
import { Mic, AlertTriangle, CheckCircle, Smartphone } from 'lucide-react';

const MobilePermissionHelper = ({ onPermissionGranted, onPermissionDenied }) => {
  const [step, setStep] = useState(1);
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    setStep(2);

    try {
      // Kullanıcı etkileşimi gerekli - bu fonksiyonu button click'ten çağırmalıyız
      console.log('📱 Manuel mikrofon izni isteniyor...');
      
      // En basit getUserMedia çağrısı
      let stream;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } else {
        // Legacy API
        const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (getUserMedia) {
          stream = await new Promise((resolve, reject) => {
            getUserMedia.call(navigator, { audio: true, video: false }, resolve, reject);
          });
        } else {
          throw new Error('getUserMedia desteklenmiyor');
        }
      }

      console.log('✅ Manuel izin başarılı');
      setStep(3);
      
      // Stream'i hemen kapat - sadece izin almak için kullandık
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      if (onPermissionGranted) {
        onPermissionGranted();
      }
      
    } catch (error) {
      console.error('❌ Manuel izin hatası:', error);
      setStep(4);
      
      if (onPermissionDenied) {
        onPermissionDenied(error);
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const resetSteps = () => {
    setStep(1);
    setIsRequesting(false);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center mb-3">
        <Smartphone className="text-blue-600 mr-2" size={20} />
        <h3 className="font-medium text-blue-800">Mobil Mikrofon İzni Yardımcısı</h3>
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-blue-700 text-sm">
            Mobil cihazınızda mikrofon iznini manuel olarak isteyebilirsiniz:
          </p>
          <button
            onClick={handleRequestPermission}
            disabled={isRequesting}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center"
          >
            <Mic className="mr-2" size={16} />
            {isRequesting ? 'İzin İsteniyor...' : 'Mikrofon İzni İste'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center text-yellow-700">
            <AlertTriangle className="mr-2" size={16} />
            <span className="text-sm">Tarayıcınız izin isteyecek...</span>
          </div>
          <p className="text-yellow-700 text-sm">
            Lütfen açılacak popup'ta "İzin Ver" veya "Allow" seçeneğine tıklayın.
          </p>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="flex items-center text-green-700">
            <CheckCircle className="mr-2" size={16} />
            <span className="text-sm">İzin başarıyla verildi!</span>
          </div>
          <p className="text-green-700 text-sm">
            Artık normal "Mikrofonu Etkinleştir" butonunu kullanabilirsiniz.
          </p>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <div className="flex items-center text-red-700">
            <AlertTriangle className="mr-2" size={16} />
            <span className="text-sm">İzin verilemedi</span>
          </div>
          <p className="text-red-700 text-sm">
            Lütfen tarayıcı ayarlarınızı kontrol edin veya sayfayı yenileyip tekrar deneyin.
          </p>
          <button
            onClick={resetSteps}
            className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 text-sm"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-xs text-blue-600">
          💡 Bu işlem sadece mikrofon izni almak içindir. Gerçek mikrofon başlatma işlemi sonra yapılacak.
        </p>
      </div>
    </div>
  );
};

export default MobilePermissionHelper;
