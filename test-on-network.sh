#!/bin/bash

# Yerel IP adresini al
HOST_IP=$(hostname -I | awk '{print $1}')
echo "Detected local IP: $HOST_IP"

# IP adresini environment değişkeni olarak ayarla ve docker-compose ile başlat
export HOST_IP=$HOST_IP
echo "Setting HOST_IP environment variable to $HOST_IP"
echo "Starting services..."

# HOST_IP'yi .env dosyasına yazalım ki Docker Compose bunu kullanabilsin
echo "HOST_IP=$HOST_IP" > .env

# Eski konteynerleri durdur ve kaldır
docker compose down

# Yeni konteynerleri başlat
docker compose up -d

echo ""
echo "==========================================="
echo "Uygulama başlatıldı!"
echo "Frontend: http://$HOST_IP:3000"
echo "Backend API: http://$HOST_IP:5000"
echo "WebSocket: ws://$HOST_IP:5000"
echo "==========================================="
echo ""
echo "Aynı ağdaki diğer cihazlardan bu adresi tarayıcınıza yazarak erişebilirsiniz:"
echo "http://$HOST_IP:3000"
echo ""
echo "⚠️ WebRTC Güvenlik Notları:"
echo "1) Masaüstü Chrome için: http://$HOST_IP:3000"
echo "2) Chrome'da güvenli olmayan WebRTC için: chrome://flags/#unsafely-treat-insecure-origin-as-secure"
echo "   adresinden '$HOST_IP:3000' ekleyip etkinleştirin."
echo "3) 📱 Mobil Cihazlar için:"
echo "   🍎 iOS Safari: Ayarlar → Safari → Kamera ve Mikrofon → Bu Site → İzin Ver"
echo "   🤖 Android Chrome: Adres çubuğundaki mikrofon simgesine basın → İzin Ver"  
echo "   📱 Önemli: Mobil cihazlarda 'Basit Mod' butonunu deneyin"
echo "   🔄 Sorun yaşarsanız tarayıcıyı kapatıp açın ve tekrar deneyin"
echo "4) Güvenlik duvarının 3000, 5000, 3478 ve 49160-49200 portlarına izin verdiğinden emin olun."
echo ""
echo "Uygulamayı durdurmak için: docker compose down"
echo "Logları görüntülemek için: docker compose logs -f"
