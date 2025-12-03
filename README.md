# 🚗 GeoTalk CarVoice# 🚗 GeoTalk CarVoice

**WebRTC tabanlı araç içi sesli iletişim ve konum paylaşım sistemi\*\***WebRTC tabanlı araç içi sesli iletişim ve konum paylaşım sistemi\*\*

Mediasoup SFU (Selective Forwarding Unit) mimarisi ile gerçek zamanlı, düşük gecikmeli ses iletişimi.Mediasoup SFU (Selective Forwarding Unit) mimarisi ile gerçek zamanlı, düşük gecikmeli ses iletişimi.

## 🚀 Hızlı Başlangıç## 🚀 Hızlı Başlangıç

`bash`bash

# Projeyi tek komutla başlat# Projeyi tek komutla başlat

./start.sh./start.sh

`````



**Erişim Adresleri:****Erişim Adresleri:**

- 💻 Localhost: https://localhost:3443

- 📱 Mobil/Ağ: https://[YOUR_IP]:3443- 💻 Localhost: https://localhost:3443

- 🔧 Backend API: http://localhost:5000- 📱 Mobil/Ağ: https://[YOUR_IP]:3443

- 🔧 Backend API: http://localhost:5000

---

---

## 🎯 Özellikler

## 🎯 Özellikler

- 🎤 **Push-to-Talk** sesli iletişim (Mediasoup SFU)

- 📍 **Gerçek zamanlı konum paylaşımı** (Redis cache)- 🎤 **Push-to-Talk** sesli iletişim (Mediasoup SFU)

- 🗺️ **Harita üzerinde kullanıcı görüntüleme** (Leaflet.js)- 📍 **Gerçek zamanlı konum paylaşımı** (Redis cache)

- 👥 **Çoklu oda** desteği (ölçeklenebilir grup sesli sohbet)- 🗺️ **Harita üzerinde kullanıcı görüntüleme** (Leaflet.js)

- 💬 **Anlık mesajlaşma**- 👥 **Çoklu oda** desteği (ölçeklenebilir grup sesli sohbet)

- 🔐 **JWT authentication**- 💬 **Anlık mesajlaşma**

- 📱 **Web & Mobile** desteği- 🔐 **JWT authentication**

- 📱 **Web & Mobile** desteği (Web hazır, Mobile geliştirme aşamasında)

---

---

## 🏗️ Mimari

## 🏗️ Mimari

### WebRTC Architecture: SFU (Selective Forwarding Unit)

### WebRTC Architecture: SFU (Selective Forwarding Unit)

```

┌─────────────────────────────────────────────────┐```

│           Client Layer (React Web)              │┌─────────────────────────────────────────────────┐

│  • React UI + Leaflet.js Maps                   ││           Client Layer (React Web)              │

│  • Socket.IO Client + Mediasoup Client         ││  • React UI + Leaflet.js Maps                   │

└─────────────────────────────────────────────────┘│  • Socket.IO Client + Mediasoup Client         │

                    ↓ WebSocket + WebRTC└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐                    ↓ WebSocket + WebRTC

│   Communication Layer (Node.js + Mediasoup)     │┌─────────────────────────────────────────────────┐

│  • Express REST API                             ││   Communication Layer (Node.js + Mediasoup)     │

│  • Socket.IO Signaling                          ││  • Express REST API                             │

│  • Mediasoup SFU Server (WebRTC Media)         ││  • Socket.IO Signaling                          │

│    - 12 Workers (CPU core based)               ││  • Mediasoup SFU Server (WebRTC Media)         │

│    - Opus Audio Codec (48kHz Stereo)           ││    - 12 Workers (CPU core based)               │

│    - UDP Ports: 40000-49999                    ││    - Opus Audio Codec (48kHz Stereo)           │

│  • Coturn (STUN/TURN for NAT)                  ││    - UDP Ports: 40000-49999                    │

└─────────────────────────────────────────────────┘│  • Coturn (STUN/TURN for NAT)                  │

                    ↓ Data Storage└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐                    ↓ Data Storage

│          Data Layer (MongoDB + Redis)           │┌─────────────────────────────────────────────────┐

│  • MongoDB: Users, Rooms, Messages              ││          Data Layer (MongoDB + Redis)           │

│  • Redis: Location Cache (60s TTL)             ││  • MongoDB: Users, Rooms, Messages              │

└─────────────────────────────────────────────────┘│  • Redis: Location Cache (60s TTL)             │

```└─────────────────────────────────────────────────┘

```

**Neden SFU?**

- ✅ P2P'ye göre %75-95 daha az bant genişliği**Neden SFU?**

- ✅ 50+ kullanıcı desteği (P2P: max 5-10)

- ✅ Mobil cihazlar için optimize- ✅ P2P'ye göre %75-95 daha az bant genişliği

- ✅ 50+ kullanıcı desteği (P2P: max 5-10)

---- ✅ Mobil cihazlar için optimize



## 🚀 Kurulum---



### Gereksinimler## 🚀 Kurulum ve Başlangıç



- Docker & Docker Compose### Gereksinimler

- Node.js 18+

- Git- Docker & Docker Compose

- Node.js 18+

### Adımlar- Git



```bash### 1. Projeyi Klonlayın

# 1. Projeyi klonlayın

git clone https://github.com/histekli/graduation-project.git```bash

cd graduation-projectgit clone https://github.com/histekli/graduation-project.git

cd graduation-project

# 2. Bağımlılıkları yükleyin```

cd backend && npm install && cd ..

cd frontend && npm install && cd ..### 2. Bağımlılıkları Yükleyin



# 3. SSL sertifikalarını oluşturun```bash

cd frontend/ssl# Backend bağımlılıkları

openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"cd backend && npm install && cd ..

cd ../..

# Frontend bağımlılıkları

# 4. Projeyi başlatıncd frontend && npm install && cd ..

./start.sh```

```

### 3. SSL Sertifikalarını Oluşturun

---

```bash

## 📱 Kullanım./generate-ssl.sh

```

1. **Kayıt Olun:** Email ve şifre ile kayıt olun

2. **Giriş Yapın:** Hesabınızla giriş yapın### 4. Projeyi Başlatın

3. **Oda Seçin:** Odalardan birine katılın veya yeni oda oluşturun

4. **Mikrofon İzni:** Tarayıcı izin istediğinde kabul edin```bash

5. **Konuşun:** Push-to-Talk butonuna basılı tutarak konuşun./start.sh

```

### Push-to-Talk

Bu komut otomatik olarak:

- **Masaüstü:** Space tuşu veya ekrandaki buton

- **Mobil:** Mikrofon butonuna dokunup basılı tutun- ✅ Docker servislerini başlatır (MongoDB, Redis, Coturn)

- ✅ Backend'i yeni terminalde başlatır (Mediasoup SFU)

---- ✅ Frontend'i HTTPS ile yeni terminalde başlatır

- ✅ Ağ IP'nizi gösterir

## 📂 Proje Yapısı

### 5. Erişim

```

.- **Web App (Localhost):** https://localhost:3443

├── backend/- **Web App (Ağ İçi):** https://[YOUR_IP]:3443

│   ├── server.js                    # Express + Mediasoup- **Backend API:** http://localhost:5000

│   ├── socket/socketHandler.js      # Socket.IO events

│   ├── mediasoup/**Not:** İlk erişimde SSL sertifika uyarısı alacaksınız, "Advanced > Proceed" ile devam edin.

│   │   ├── manager.js               # SFU manager (12 workers)

│   │   └── socketHandler.js         # WebRTC signaling---

│   ├── models/                      # MongoDB schemas

│   ├── routes/                      # REST API endpoints## 📱 Kullanım

│   └── services/redisLocationService.js  # Location cache

│### İlk Adımlar

├── frontend/

│   ├── src/1. **Kayıt Olun:** http://localhost:3000/register

│   │   ├── hooks/2. **Giriş Yapın:** Email ve şifreniz ile

│   │   │   ├── useMediasoup.js      # SFU client hook3. **Oda Seçin:** Mevcut odalardan birine katılın veya yeni oda oluşturun

│   │   │   └── useGeolocation.js    # Location tracking4. **Mikrofon İzni:** Tarayıcı izin isteyecek, kabul edin

│   │   ├── components/5. **Konuşun:** Push-to-Talk butonuna basılı tutarak konuşun

│   │   │   ├── VoiceMap.js          # Leaflet map6. **Harita:** Konumunuz ve diğer kullanıcılar haritada görünecek

│   │   │   └── PushToTalkButton.js  # PTT control

│   │   └── pages/### Push-to-Talk Kullanımı

│   │       └── VoiceChat.js         # Main voice chat

│   └── ssl/                         # HTTPS certificates- **Masaüstü:** Space tuşuna basılı tutun veya ekrandaki butona tıklayın

│- **Mobil:** Mikrofon butonuna dokunun ve basılı tutun

├── docker-compose.yml               # MongoDB, Redis, Coturn

└── start.sh                         # Startup script---

```

## 🔧 Geliştirme

---

### Backend (Yerel)

## 🔧 Teknolojiler

```bash

**Backend:** Node.js, Express, Socket.IO, Mediasoup, MongoDB, Redis, JWT  cd backend

**Frontend:** React 18, mediasoup-client, Leaflet.js, Tailwind CSS  npm install

**Infrastructure:** Docker, Coturn (STUN/TURN), HTTPSnpm run dev

```

---

### Frontend (Yerel)

## 🐛 Sorun Giderme

```bash

### Ses Duymuyorumcd frontend

1. Mikrofon izni verildi mi?npm install

2. Mediasoup workers çalışıyor mu? (backend loglarına bakın)npm start

3. UDP portları açık mı? (40000-49999)```



### WebRTC Bağlanamıyor### Logları İzleme

1. HTTPS kullanıyor musunuz?

2. Coturn çalışıyor mu? `docker compose ps````bash

3. Firewall: UDP 40000-49999, TCP/UDP 3478# Tüm servisler

make logs

### MongoDB Hatası

1. `docker compose ps` - container çalışıyor mu?# Sadece backend

2. `docker compose restart db`make logs-backend



---# Sadece Janus

make logs-janus

## 📊 Performans```



- **Codec:** Opus 48kHz Stereo### Servisleri Yönetme

- **Bitrate:** 64-128 kbps/user

- **Latency:** <100ms (local)```bash

- **Max Users:** 50+ per roommake help          # Tüm komutları göster

- **CPU:** ~5-10% per 10 usersmake status        # Servis durumları

make restart       # Yeniden başlat

---make stop          # Durdur

```

## 🚀 Roadmap

---

- [x] ✅ Mediasoup SFU

- [x] ✅ Push-to-Talk## 🧪 Test

- [x] ✅ Real-time location

- [x] ✅ JWT auth### Backend Health Check

- [ ] 🔄 Mobile app (React Native)

- [ ] 🔄 Video chat```bash

- [ ] 🔄 Screen sharingcurl http://localhost:5000/health

- [ ] 🔄 Recording```



---### Mediasoup SFU Test



## 👨‍💻 Geliştirici```bash

# Check worker count (should show 12 workers)

**Hasan Can İştekaleli** - [GitHub](https://github.com/histekli)curl http://localhost:5000/api/sfu/status

```

---

### WebRTC Test

## 📄 Lisans

1. İki farklı tarayıcı/cihaz aç

MIT License2. Her ikisinde de aynı odaya gir

3. "Sesi Etkinleştir" butonuna bas

---4. PTT butonu ile konuş

5. Diğer tarafta ses duyulmalı

**⭐ Projeyi beğendiyseniz yıldız vermeyi unutmayın!**

**Beklenen Console Logs:**

```
Frontend:
🎙️ Initializing Mediasoup Device...
✅ Device initialized
📤 Creating send transport...
📥 Creating receive transport...
🆕 New producer available
✅ Consumer created for user

Backend:
✅ Mediasoup workers hazır
📡 Router oluşturuldu
🎤 Producer oluşturuldu
📡 Consumer oluşturuldu
```

### Backend Health Check

```bash
curl http://localhost:5000/health
```

### Mikrofon Testi (Tarayıcı Konsolu)

```javascript
navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then((stream) => console.log("✅ Mikrofon çalışıyor"))
  .catch((err) => console.error("❌ Mikrofon hatası:", err));
```

---

## 🛠️ Teknolojiler

### Backend

- Node.js + Express
- Socket.IO (WebSocket)
- MongoDB (Database)
- Redis (Cache)
- **Mediasoup v3** (WebRTC SFU)
- Coturn (STUN/TURN)
- JWT Authentication

### Frontend

- React 18
- Leaflet.js (Maps)
- Socket.IO Client
- **Mediasoup Client v3** (WebRTC)
- TailwindCSS
- React Router v6

### Infrastructure

- Docker & Docker Compose
- Nginx (Production için önerilir)
- SSL/TLS (Self-signed certificates)

### WebRTC Stack

- **SFU Architecture:** Mediasoup
- **Audio Codec:** Opus 48kHz Stereo
- **Transport:** WebRTC (UDP preferred, TCP fallback)
- **Ports:** 40000-49999 (UDP for media)
- **Workers:** Auto-scaled (1 per CPU core)

---

## 🔐 Güvenlik

- JWT token authentication
- Password hashing (bcryptjs)
- CORS protection
- Helmet.js security headers
- Environment variables

**Production için:**

- SSL/TLS sertifikası zorunlu (Let's Encrypt önerilir)
- `.env` dosyasında güçlü secret'lar kullanın
- MongoDB ve Redis şifreleri ayarlayın

---

## 📊 Performans

| Metrik              | Değer           |
| ------------------- | --------------- |
| Max kullanıcı/oda   | 50+             |
| Audio bitrate       | 128 kbps (Opus) |
| Latency             | 100-200 ms      |
| Bandwidth/kullanıcı | ~150 kbps       |

---

## 🐛 Sorun Giderme

### Ses gelmiyor

1. Mikrofon izni verildi mi? (Tarayıcı ayarları)
2. Janus çalışıyor mu? `make logs-janus`
3. WebRTC stats: Chrome'da `chrome://webrtc-internals`

### Bağlantı kurulamıyor

1. Tüm servisler ayakta mı? `make status`
2. Firewall portları açık mı? (3478/udp, 10000-10200/udp)
3. Backend logları: `make logs-backend`

### Docker hataları

```bash
# Container'ları temizle ve yeniden başlat
docker-compose down
docker-compose up -d

# Volume'leri de temizle (DİKKAT: Veritabanı silinir)
make clean-volumes
```

---

## 📁 Proje Yapısı

```
webrtc-car-voice-geotalk/
├── backend/                  # Node.js Backend
│   ├── services/            # JanusService, RedisLocationService
│   ├── socket/              # Socket.IO handlers
│   ├── routes/              # REST API routes
│   ├── models/              # MongoDB models
│   └── middleware/          # Auth middleware
├── frontend/                # React Frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # useJanus, useWebRTC
│   │   ├── pages/          # Page components
│   │   └── contexts/       # React contexts
│   └── public/
├── janus/                   # Janus Gateway config
├── ssl/                     # SSL certificates
├── docs/                    # Detaylı dokümantasyon
│   ├── QUICKSTART.md
│   ├── README_JANUS.md
│   ├── JANUS_INTEGRATION_SUMMARY.md
│   └── ARCHITECTURE_COMPLIANCE.md
├── docker-compose.yml       # Docker services
├── Makefile                 # Hızlı komutlar
└── start-janus.sh          # Başlatma scripti
```

---

## 📚 Dokümantasyon

- **Hızlı Başlangıç:** [docs/QUICKSTART.md](docs/QUICKSTART.md)
- **Janus Mimarisi:** [docs/README_JANUS.md](docs/README_JANUS.md)
- **Mimari Detayları:** [docs/ARCHITECTURE_COMPLIANCE.md](docs/ARCHITECTURE_COMPLIANCE.md)
- **Entegrasyon Özeti:** [docs/JANUS_INTEGRATION_SUMMARY.md](docs/JANUS_INTEGRATION_SUMMARY.md)

---

## 🎯 Yol Haritası

### Tamamlandı ✅

- [x] Janus SFU entegrasyonu
- [x] Redis location cache
- [x] Web app (React)
- [x] Push-to-talk
- [x] Gerçek zamanlı harita
- [x] Oda yönetimi

### Devam Ediyor 🔄

- [ ] React Native mobile app
- [ ] E2E encryption
- [ ] Ses kayıt özelliği

### Planlanan 📋

- [ ] Video chat desteği
- [ ] Screen sharing
- [ ] Multi-region deployment
- [ ] iOS/Android native apps

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit atın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

---

## 📄 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 👥 Geliştirici Ekibi

**CSE Bitirme Projesi** - 2025

---

## 📞 İletişim & Destek

- **GitHub Issues:** [Sorun Bildirin](https://github.com/your-repo/issues)
- **Email:** support@geotalk.com
- **Dokümantasyon:** [docs/](docs/)

---

## ⭐ Teşekkürler

- [Janus Gateway](https://janus.conf.meetecho.com/)
- [Coturn](https://github.com/coturn/coturn)
- React & Node.js Communities

---

**🎉 GeoTalk CarVoice ile güvenli ve kaliteli sesli iletişimin tadını çıkarın!**

_Son Güncelleme: Aralık 2024_
`````
