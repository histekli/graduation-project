import React, { useState, useEffect } from 'react';
import { FaDownload, FaTimes, FaMobileAlt, FaChrome, FaBug } from 'react-icons/fa';

const InstallPWA = () => {
    console.log('🔵 InstallPWA Component Mounted');

    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [debugInfo, setDebugInfo] = useState({});
    const [showDebug, setShowDebug] = useState(false);

    useEffect(() => {
        // Check if running in standalone mode
        const isStandaloneMode =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone ||
            document.referrer.includes('android-app://');

        setIsStandalone(isStandaloneMode);

        // Check if iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(iOS);

        // Collect debug info
        const debug = {
            standalone: isStandaloneMode,
            iOS: iOS,
            userAgent: navigator.userAgent,
            hasServiceWorker: 'serviceWorker' in navigator,
            displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
            timestamp: new Date().toISOString(),
        };
        setDebugInfo(debug);

        console.log('PWA Status:', debug);

        // Don't show prompt if already installed
        if (isStandaloneMode) {
            console.log('✅ App running in standalone mode');
            return;
        }

        // Listen for beforeinstallprompt (Android/Desktop Chrome)
        const handleBeforeInstallPrompt = (e) => {
            console.log('✅ PWA install prompt available');
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallPrompt(true);
            setDebugInfo(prev => ({ ...prev, promptReceived: true }));
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Check Service Worker registration
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(reg => {
                setDebugInfo(prev => ({
                    ...prev,
                    swRegistered: !!reg,
                    swActive: reg ? !!reg.active : false
                }));
                console.log('Service Worker:', reg ? 'Registered ✅' : 'Not found ❌');
            });
        }

        // For iOS, show manual instructions after some time
        if (iOS && !isStandaloneMode) {
            const timer = setTimeout(() => {
                const dismissed = localStorage.getItem('pwa-ios-dismissed');
                if (!dismissed || (Date.now() - parseInt(dismissed)) > 7 * 24 * 60 * 60 * 1000) {
                    setShowInstallPrompt(true);
                }
            }, 5000);

            return () => {
                clearTimeout(timer);
                window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            };
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            console.log('ℹ️ Install prompt not available (iOS or already shown)');
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        console.log(`User response: ${outcome}`);

        if (outcome === 'accepted') {
            console.log('✅ User installed PWA');
        }

        setDeferredPrompt(null);
        setShowInstallPrompt(false);
    };

    const handleDismiss = () => {
        setShowInstallPrompt(false);
        const key = isIOS ? 'pwa-ios-dismissed' : 'pwa-install-dismissed';
        localStorage.setItem(key, Date.now().toString());
    };

    // Don't show if dismissed recently
    const dismissKey = isIOS ? 'pwa-ios-dismissed' : 'pwa-install-dismissed';
    const dismissedTime = localStorage.getItem(dismissKey);
    if (dismissedTime) {
        const daysSince = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
            setDebugInfo(prev => ({ ...prev, dismissed: true, daysSince: daysSince.toFixed(1) }));
        }
    }

    // Always show debug button on bottom-left
    return (
        <>
            {/* Debug Button (Always visible) */}
            <button
                onClick={() => setShowDebug(!showDebug)}
                className="fixed bottom-4 left-4 bg-gray-900 text-white p-3 rounded-full shadow-lg z-50 hover:bg-gray-800 transition-all"
                title="PWA Debug Info"
            >
                <FaBug />
            </button>

            {/* Debug Panel */}
            {showDebug && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">PWA Debug Info</h3>
                            <button onClick={() => setShowDebug(false)} className="text-gray-500 hover:text-gray-700">
                                <FaTimes />
                            </button>
                        </div>

                        <div className="space-y-3 text-sm">
                            {Object.entries(debugInfo).map(([key, value]) => (
                                <div key={key} className="flex justify-between border-b pb-2">
                                    <span className="font-medium text-gray-700">{key}:</span>
                                    <span className={`text-xs ${value === true ? 'text-green-600 font-bold' :
                                        value === false ? 'text-red-600 font-bold' :
                                            'text-gray-900'
                                        }`}>
                                        {typeof value === 'boolean' ? (value ? '✅ YES' : '❌ NO') : String(value)}
                                    </span>
                                </div>
                            ))}

                            <div className="mt-4 pt-4 border-t">
                                <p className="text-xs text-gray-600 mb-2">Status:</p>
                                {isStandalone ? (
                                    <div className="bg-green-100 text-green-800 p-2 rounded">
                                        ✅ Running in Standalone Mode
                                    </div>
                                ) : deferredPrompt ? (
                                    <div className="bg-blue-100 text-blue-800 p-2 rounded">
                                        ℹ️ Install Prompt Available
                                    </div>
                                ) : (
                                    <div className="bg-yellow-100 text-yellow-800 p-2 rounded">
                                        ⚠️ Waiting for Install Prompt...
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    localStorage.clear();
                                    window.location.reload();
                                }}
                                className="w-full mt-4 bg-red-500 text-white py-2 rounded hover:bg-red-600"
                            >
                                Clear Cache & Reload
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Install Prompt */}
            {showInstallPrompt && !isStandalone && (dismissedTime ? (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24) >= 7 : true) && (
                <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-2xl border-2 border-primary-200 p-4 z-50 animate-slide-up">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-md">
                                {isIOS ? (
                                    <FaMobileAlt className="text-white text-xl" />
                                ) : (
                                    <FaDownload className="text-white text-xl" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">GeoTalk'u Yükle</h3>
                                <p className="text-xs text-gray-600">
                                    {isIOS ? 'iOS Safari' : 'Uygulama olarak kullan'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                            aria-label="Kapat"
                        >
                            <FaTimes />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="mb-4">
                        {isIOS ? (
                            // iOS Instructions
                            <div className="space-y-3">
                                <p className="text-sm text-gray-700">
                                    GeoTalk'u uygulama gibi kullanmak için:
                                </p>
                                <ol className="text-sm text-gray-600 space-y-2 pl-4">
                                    <li className="flex items-start">
                                        <span className="font-bold text-primary-600 mr-2">1.</span>
                                        <span>Safari'de <strong>Paylaş</strong> butonuna bas (
                                            <svg className="inline w-4 h-4 mx-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                                            </svg>
                                            )</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="font-bold text-primary-600 mr-2">2.</span>
                                        <span><strong>"Ana Ekrana Ekle"</strong> seçeneğini seç</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="font-bold text-primary-600 mr-2">3.</span>
                                        <span>Ana ekrandaki <strong>GeoTalk</strong> ikonuna bas</span>
                                    </li>
                                </ol>
                                <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-xs text-green-700 flex items-center">
                                        <FaChrome className="mr-2" />
                                        Artık tam ekran uygulama gibi çalışacak!
                                    </p>
                                </div>
                            </div>
                        ) : (
                            // Android/Desktop Chrome
                            <div>
                                <p className="text-sm text-gray-700 mb-3">
                                    GeoTalk'u cihazınıza yükleyin ve uygulama gibi kullanın:
                                </p>
                                <ul className="text-sm text-gray-600 space-y-1 mb-3">
                                    <li>✓ Tam ekran deneyimi</li>
                                    <li>✓ Ana ekrandan hızlı erişim</li>
                                    <li>✓ Daha az batarya kullanımı</li>
                                    <li>✓ Offline çalışma desteği</li>
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-3">
                        {!isIOS && deferredPrompt && (
                            <button
                                onClick={handleInstallClick}
                                className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2.5 rounded-lg font-semibold hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg"
                            >
                                Şimdi Yükle
                            </button>
                        )}
                        <button
                            onClick={handleDismiss}
                            className={`${isIOS ? 'flex-1' : ''} px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition-colors`}
                        >
                            {isIOS ? 'Anladım' : 'Daha Sonra'}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default InstallPWA;
