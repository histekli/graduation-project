# 🚗 GeoTalk CarVoice - WebRTC Araç İçi Sesli İletişim Sistemi

## 📋 Genel Bakış

GeoTalk CarVoice, Janus WebRTC Gateway tabanlı SFU (Selective Forwarding Unit) mimarisi ile geliştirilmiş, gerçek zamanlı araç içi sesli iletişim ve konum paylaşım sistemidir.

## 🏗️ Mimari

### Katmanlı Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                    User & Device Layer                          │
│  📱 Mobile App (React Native + Expo)  🌐 Web App (React)       │
└─────────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                  Client Application Layer                       │
│  • React UI / React Native UI                                   │
│  • Leaflet.js (Harita)                                         │
│  • Socket.IO Client                                            │
│  • React Native WebRTC                                         │
└─────────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│            Communication & Signaling Layer                      │
│                                                                 │
│  ┌──────────────────┐         ┌──────────────────┐            │
│  │  Janus SFU       │◄───────►│  Backend Node.js │            │
│  │  Server          │         │  (Express)       │            │
│  │                  │         │  • Socket.IO     │            │
│  │  • SFU Session   │         │  • User Service  │            │
│  │    Management    │         │  • Location Svc  │            │
│  │                  │         │  • Chat Service  │            │
│  └──────────────────┘         └──────────────────┘            │
│           │                            │                        │
│           └────────────────┬───────────┘                        │
│                            │                                    │
│                   ┌────────▼─────────┐                         │
│                   │  Coturn Server   │                         │
│                   │  (STUN/TURN)     │                         │
│                   └──────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
│  ┌─────────────┐         ┌─────────────┐                      │
│  │  MongoDB    │         │   Redis     │                      │
│  │  (Users,    │         │  (Location  │                      │
│  │   Sessions, │         │   Data      │                      │
│  │   Chats)    │         │   Cache)    │                      │
│  └─────────────┘         └─────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### 🎯 Janus SFU Mimarisi

Projemiz **P2P (Peer-to-Peer)** yerine **SFU (Selective Forwarding Unit)** mimarisini kullanır:

**Avantajları:**
- ✅ Daha az bant genişliği kullanımı
- ✅ CPU kullanımı daha düşük
- ✅ Çok sayıda katılımcı desteği (50+ kullanıcı)
- ✅ Daha stabil bağlantı
- ✅ Merkezi ses kalitesi kontrolü

## 🚀 Teknolojiler

### Backend
- **Node.js + Express** - REST API
- **Socket.IO** - Gerçek zamanlı iletişim
- **Janus Gateway** - WebRTC SFU server
- **MongoDB** - Veritabanı
- **Redis** - Location cache (opsiyonel)
- **Coturn** - STUN/TURN server

### Frontend (Web)
- **React 18** - UI framework
- **Leaflet.js** - Harita görselleştirme
- **Janus JS Client** - WebRTC client
- **Socket.IO Client** - WebSocket client
- **TailwindCSS** - Styling

### Mobile (Opsiyonel)
- **React Native + Expo**
- **React Native WebRTC**
- **Leaflet for React Native**

## 📦 Kurulum

### Ön Gereksinimler

- Docker & Docker Compose
- Node.js 18+ (geliştirme için)
- Git

### 1. Projeyi Klonlayın

```bash
git clone <repo-url>
cd webrtc-car-voice-geotalk
```

### 2. Environment Dosyalarını Oluşturun

```bash
# Backend
cp .env.example .env

# Frontend
cp frontend/.env.example frontend/.env
```

### 3. Konfigürasyonu Düzenleyin

**Backend `.env` dosyasını düzenleyin:**
```bash
# Public IP adresinizi ayarlayın (Docker dışından erişim için)
HOST_IP=192.168.1.100  # Kendi IP adresiniz

# Güvenlik için secret'ları değiştirin
JWT_SECRET=your_strong_secret_here
JANUS_API_SECRET=your_janus_secret
```

**Frontend `.env` dosyasını düzenleyin:**
```bash
# Backend URL
REACT_APP_BACKEND_URL=http://localhost:5000

# Janus WebSocket (tarayıcıdan erişilebilir olmalı)
REACT_APP_JANUS_WS_URL=ws://localhost:8188
```

### 4. Docker ile Başlatın

```bash
# Tüm servisleri başlat
docker-compose up -d

# Logları izleyin
docker-compose logs -f

# Sadece belirli servisi başlat
docker-compose up -d backend
docker-compose up -d frontend
docker-compose up -d janus
docker-compose up -d coturn
```

### 5. Servisleri Kontrol Edin

```bash
# Çalışan container'ları listele
docker-compose ps

# Backend health check
curl http://localhost:5000/health

# Janus info
curl http://localhost:8088/janus/info
```

## 🔧 Geliştirme

### Backend Geliştirme

```bash
cd backend
npm install
npm run dev
```

### Frontend Geliştirme

```bash
cd frontend
npm install
npm start
```

### Janus Konfigürasyonu

Janus ayarlarını değiştirmek için:

```bash
# Janus ana konfigürasyonu
nano janus/janus.jcfg

# VideoRoom plugin konfigürasyonu
nano janus/janus.plugin.videoroom.jcfg

# Değişiklikleri uygula
docker-compose restart janus
```

## 🌐 API Endpoints

### Janus Gateway Endpoints

- `GET /janus/ice-servers` - STUN/TURN server bilgileri
- `GET /janus/rooms` - Aktif odaları listele
- `GET /janus/rooms/:roomId/participants` - Oda katılımcıları

### WebRTC Signaling (Socket.IO Events)

**Client → Server:**
- `janus_message` - Janus Gateway mesajı
- `get_ice_servers` - ICE server bilgilerini al
- `start_talking` - Konuşmaya başla
- `stop_talking` - Konuşmayı bitir

**Server → Client:**
- `janus_response` - Janus yanıtı
- `ice_servers` - ICE server bilgileri
- `janus_participant_joined` - Katılımcı katıldı
- `janus_talking_started` - Konuşma başladı
- `janus_webrtc_up` - WebRTC bağlantısı kuruldu

## 🧪 Test

### Network Üzerinde Test

```bash
# Yerel ağınızdaki IP'yi alın
./test-on-network.sh

# Mobil cihazdan erişim
# https://YOUR_IP:3001
```

### Janus Test

```bash
# Janus VideoRoom demo
# http://localhost:8088/janus/demos/videochattest.html
```

## 🐛 Troubleshooting

### Janus bağlantı hatası

```bash
# Janus loglarını kontrol edin
docker-compose logs janus

# Janus'ı yeniden başlatın
docker-compose restart janus

# Janus WebSocket portunu kontrol edin
netstat -an | grep 8188
```

### WebRTC ses bağlantısı kurulamıyor

1. **STUN/TURN kontrolü:**
```bash
# Coturn çalışıyor mu?
docker-compose ps coturn

# Coturn logları
docker-compose logs coturn
```

2. **Firewall kontrolü:**
```bash
# UDP portları açık olmalı
sudo ufw allow 3478/udp
sudo ufw allow 49160:49200/udp
sudo ufw allow 10000:10200/udp
```

3. **Browser mikrofon izni:**
- Chrome: chrome://settings/content/microphone
- Firefox: about:preferences#privacy

### MongoDB bağlantı hatası

```bash
# MongoDB çalışıyor mu?
docker-compose ps mongodb

# MongoDB'ye bağlan
docker-compose exec mongodb mongosh
```

## 📱 Mobil Uygulama (Opsiyonel)

```bash
cd mobile

# Expo ile çalıştır
npm install
expo start

# Android
expo start --android

# iOS
expo start --ios
```

## 🔐 Güvenlik

- JWT token authentication
- Janus API secret protection
- CORS policy
- Helmet.js security headers
- MongoDB injection protection
- Rate limiting (önerilir)

## 📊 Performans

### Janus SFU Kapasitesi

- **Oda başına max publisher:** 50
- **Audio bitrate:** 128 kbps (Opus codec)
- **Latency:** ~100-200ms
- **Bandwidth (per user):** ~150 kbps

### Sistem Gereksinimleri

**Minimum:**
- CPU: 2 core
- RAM: 4 GB
- Network: 10 Mbps

**Önerilen (Production):**
- CPU: 4+ core
- RAM: 8+ GB
- Network: 100+ Mbps

## 🚀 Production Deployment

### 1. SSL Sertifikası (Zorunlu)

```bash
# Let's Encrypt ile SSL
sudo certbot certonly --standalone -d your-domain.com

# Sertifikaları kopyala
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./ssl/key.pem
```

### 2. Production Environment

```bash
# .env dosyasını düzenle
NODE_ENV=production
HOST_IP=YOUR_PUBLIC_IP

# Janus WSS (secure WebSocket)
REACT_APP_JANUS_WS_URL=wss://your-domain.com:8189
```

### 3. Nginx Reverse Proxy (Önerilir)

```nginx
# Janus WebSocket proxy
location /janus/ {
    proxy_pass http://localhost:8188/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## 📄 Lisans

MIT License

## 👥 Katkıda Bulunanlar

- **Backend & Janus Integration:** [İsim]
- **Frontend & UI:** [İsim]
- **DevOps:** [İsim]

## 📞 İletişim

- Email: info@geotalk.com
- GitHub: https://github.com/your-repo

---

**GeoTalk CarVoice** - Powered by Janus WebRTC Gateway 🎬