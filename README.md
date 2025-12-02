# 🚗 GeoTalk CarVoice

**WebRTC tabanlı araç içi sesli iletişim ve konum paylaşım sistemi**

Mediasoup SFU (Selective Forwarding Unit) mimarisi ile gerçek zamanlı, düşük gecikmeli ses iletişimi.

## 🚀 Hızlı Başlangıç

```bash
# Projeyi tek komutla başlat
./start.sh

# Projeyi durdur
./stop.sh
```

**Erişim Adresleri:**

- 💻 Localhost: https://localhost:3443
- 📱 Mobil/Ağ: https://[YOUR_IP]:3443
- 🔧 Backend API: http://localhost:5000

---

## 🎯 Özellikler

- 🎤 **Push-to-Talk** sesli iletişim (Mediasoup SFU)
- 📍 **Gerçek zamanlı konum paylaşımı** (Redis cache)
- 🗺️ **Harita üzerinde kullanıcı görüntüleme** (Leaflet.js)
- 👥 **Çoklu oda** desteği (ölçeklenebilir grup sesli sohbet)
- 💬 **Anlık mesajlaşma**
- 🔐 **JWT authentication**
- 📱 **Web & Mobile** desteği (Web hazır, Mobile geliştirme aşamasında)

---

## 🏗️ Mimari

### WebRTC Architecture: SFU (Selective Forwarding Unit)

```
┌─────────────────────────────────────────────────┐
│           Client Layer (React Web)              │
│  • React UI + Leaflet.js Maps                   │
│  • Socket.IO Client + Mediasoup Client         │
└─────────────────────────────────────────────────┘
                    ↓ WebSocket + WebRTC
┌─────────────────────────────────────────────────┐
│   Communication Layer (Node.js + Mediasoup)     │
│  • Express REST API                             │
│  • Socket.IO Signaling                          │
│  • Mediasoup SFU Server (WebRTC Media)         │
│    - 12 Workers (CPU core based)               │
│    - Opus Audio Codec (48kHz Stereo)           │
│    - UDP Ports: 40000-49999                    │
│  • Coturn (STUN/TURN for NAT)                  │
└─────────────────────────────────────────────────┘
                    ↓ Data Storage
┌─────────────────────────────────────────────────┐
│          Data Layer (MongoDB + Redis)           │
│  • MongoDB: Users, Rooms, Messages              │
│  • Redis: Location Cache (60s TTL)             │
└─────────────────────────────────────────────────┘
```

**Neden SFU?**

- ✅ P2P'ye göre %75-95 daha az bant genişliği
- ✅ 50+ kullanıcı desteği (P2P: max 5-10)
- ✅ Mobil cihazlar için optimize

---

## 🚀 Kurulum ve Başlangıç

### Gereksinimler

- Docker & Docker Compose
- Node.js 18+
- Git

### 1. Projeyi Klonlayın

```bash
git clone https://github.com/histekli/graduation-project.git
cd graduation-project
```

### 2. Bağımlılıkları Yükleyin

```bash
# Backend bağımlılıkları
cd backend && npm install && cd ..

# Frontend bağımlılıkları
cd frontend && npm install && cd ..
```

### 3. SSL Sertifikalarını Oluşturun

```bash
./generate-ssl.sh
```

### 4. Projeyi Başlatın

```bash
./start.sh
```

Bu komut otomatik olarak:

- ✅ Docker servislerini başlatır (MongoDB, Redis, Janus, Coturn)
- ✅ Backend'i yeni terminalde başlatır
- ✅ Frontend'i HTTPS ile yeni terminalde başlatır
- ✅ Ağ IP'nizi gösterir

### 5. Erişim

- **Web App (Localhost):** https://localhost:3443
- **Web App (Ağ İçi):** https://[YOUR_IP]:3443
- **Backend API:** http://localhost:5000

**Not:** İlk erişimde SSL sertifika uyarısı alacaksınız, "Advanced > Proceed" ile devam edin.

### Projeyi Durdurmak

```bash
./stop.sh
```

---

## 📱 Kullanım

### İlk Adımlar

1. **Kayıt Olun:** http://localhost:3000/register
2. **Giriş Yapın:** Email ve şifreniz ile
3. **Oda Seçin:** Mevcut odalardan birine katılın veya yeni oda oluşturun
4. **Mikrofon İzni:** Tarayıcı izin isteyecek, kabul edin
5. **Konuşun:** Push-to-Talk butonuna basılı tutarak konuşun
6. **Harita:** Konumunuz ve diğer kullanıcılar haritada görünecek

### Push-to-Talk Kullanımı

- **Masaüstü:** Space tuşuna basılı tutun veya ekrandaki butona tıklayın
- **Mobil:** Mikrofon butonuna dokunun ve basılı tutun

---

## 🔧 Geliştirme

### Backend (Yerel)

```bash
cd backend
npm install
npm run dev
```

### Frontend (Yerel)

```bash
cd frontend
npm install
npm start
```

### Logları İzleme

```bash
# Tüm servisler
make logs

# Sadece backend
make logs-backend

# Sadece Janus
make logs-janus
```

### Servisleri Yönetme

```bash
make help          # Tüm komutları göster
make status        # Servis durumları
make restart       # Yeniden başlat
make stop          # Durdur
```

---

## 🧪 Test

### Backend Health Check

```bash
curl http://localhost:5000/health
```

### Mediasoup SFU Test

```bash
# Check worker count (should show 12 workers)
curl http://localhost:5000/api/sfu/status
```

### WebRTC Test

1. İki farklı tarayıcı/cihaz aç
2. Her ikisinde de aynı odaya gir
3. "Sesi Etkinleştir" butonuna bas
4. PTT butonu ile konuş
5. Diğer tarafta ses duyulmalı

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
