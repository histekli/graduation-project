# WebRTC Based Mobile/Car Voice GeoTalk System

Bu proje, araç kullanıcıları için WebRTC tabanlı sesli iletişim ve konum paylaşımı sistemidir. Kullanıcılar harita üzerinde birbirlerini görebilir ve sesli olarak iletişim kurabilirler.

## 🚗 Özellikler

- **Gerçek Zamanlı Sesli İletişim**: WebRTC ile P2P sesli konuşma
- **Konum Paylaşımı**: GPS tabanlı gerçek zamanlı konum görüntüleme
- **Harita Entegrasyonu**: Leaflet.js ile interaktif harita
- **Mobil & Web Desteği**: React Native ve React ile hibrit uygulama
- **Sohbet Sistemi**: Metin tabanlı anlık mesajlaşma
- **Dinleme Modu**: Sadece dinleme için özel mod

## 🛠️ Teknoloji Yığını

### Backend

- **Node.js** + **Express** - API sunucusu
- **Socket.IO** - WebSocket iletişimi
- **MongoDB** - Veritabanı
- **JWT** - Kimlik doğrulama

### Frontend (Web)

- **React** - UI framework
- **Tailwind CSS** - Styling
- **Leaflet.js** - Harita görüntüleme
- **Socket.IO Client** - Gerçek zamanlı iletişim

### Mobile

- **React Native** + **Expo** - Hibrit mobil uygulama
- **React Native WebRTC** - P2P iletişim
- **Expo Location** - GPS erişimi

### Infrastructure

- **Docker** + **Docker Compose** - Konteynerleştirme
- **Coturn** - STUN/TURN sunucusu

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Docker ve Docker Compose
- Node.js 18+ (geliştirme için)
- Git

### Kurulum

1. **Projeyi klonlayın:**

```bash
git clone <repo-url>
cd webrtc-car-voice-geotalk
```

2. **Docker ile başlatın:**

```bash
# Tüm servisleri başlat (öncelikle)
docker compose up db backend frontend --build -d

# STUN/TURN sunucusu opsiyonel (geliştirme için gerekli değil)
# docker compose up coturn -d
```

3. **Uygulamalara erişin:**

- Web UI: http://localhost:3000
- Backend API: http://localhost:5000
- MongoDB: localhost:27017

4. **İlk kullanım:**

- http://localhost:3000 adresine gidin
- Kayıt olun veya giriş yapın
- Dashboard'da mevcut odaları görün
- "Oda Oluştur" butonuyla yeni oda açın
- Odaya katılarak sesli iletişim başlatın

## 🔄 Servis Yönetimi

### Servisleri Durdurma ve Başlatma

```bash
# Tüm servisleri durdur
docker compose down

# Tüm servisleri başlat
docker compose up -d

# Sadece belirli servisleri başlat
docker compose up db backend frontend -d

# Servisleri yeniden başlat (güncellemeleri almak için)
docker compose restart

# Belirli servisi yeniden başlat
docker compose restart frontend
docker compose restart backend
```

### Temizlik ve Reset

```bash
# Tüm servisleri durdur ve container'ları sil
docker compose down

# Container'ları ve volume'ları sil (VERİLER SİLİNİR!)
docker compose down -v

# Docker image'larını yeniden build et
docker compose build --no-cache

# Tam reset (tüm veriler silinir)
docker compose down -v
docker system prune -f
docker compose up --build -d
```

### Log Görüntüleme

```bash
# Tüm servislerin logları
docker compose logs -f

# Belirli servisin logları
docker compose logs frontend -f
docker compose logs backend -f

# Son 50 log satırını göster
docker compose logs --tail=50
```

### Container Durumu

```bash
# Çalışan servisleri görüntüle
docker compose ps

# Detaylı durum bilgisi
docker compose top
```

### 🚀 Hızlı Test Komutları

```bash
# Hızlı reset ve başlat
docker compose down && docker compose up -d

# Frontend'i yeniden build et (kod değişikliklerinden sonra)
docker compose down frontend && docker compose up frontend -d --build

# Backend'i yeniden başlat
docker compose restart backend

# Tüm logları canlı takip et
docker compose logs -f

# Sadece frontend loglarını izle
docker compose logs frontend -f --tail=20
```

### 🎤 Yeni Özellikler (Son Güncelleme - 12 Ekim 2025)

**✅ WebRTC Ses İletişimi Tamamlandı:**

- Gerçek zamanlı P2P ses aktarımı
- Push-to-talk (Basılı tutarak konuş) butonu
- Space tuşu ile konuşma kontrolü
- Ses seviyesi göstergeleri
- Mikrofon izinleri yönetimi

**✅ Harita ve Konum Sistemi:**

- Leaflet.js ile etkileşimli harita görünümü
- GPS tabanlı konum paylaşımı
- Yakındaki kullanıcıları haritada görüntüleme
- Konuşan kullanıcıların haritada vurgulanması
- Gerçek zamanlı konum güncellemeleri

**✅ Voice Chat Sayfası:** `/voice/:roomId`

- Sesli sohbet için özel arayüz
- Gerçek zamanlı konum haritası
- Kullanıcı listesi ve konuşma durumu
- Push-to-talk kontrolü
- Mobil uyumlu responsive tasarım

**✅ Dashboard Sayfası:** `/dashboard`

- Ana kontrol paneli ve oda yönetimi
- Gerçek zamanlı istatistikler (aktif odalar, kullanıcılar, konuşmalar)
- Genel odalar listesi ve arama
- Çevrimiçi kullanıcı listesi
- Hızlı oda oluşturma ve katılma
- Kullanıcı aktivite durumu gösterimi

**✅ Dashboard Sayfası Tamamlandı:**

- Gerçek zamanlı oda listesi ve istatistikleri
- Çevrimiçi kullanıcı listesi
- Oda oluşturma ve katılma fonksiyonları
- Kullanıcı aktivite durumu takibi
- Modern ve responsive UI tasarımı

**🔧 Ses İletişim Sorunları Çözüldü:**

- **Mikrofon İzin Yönetimi**: Otomatik izin kontrolü ve kullanıcı dostu hata mesajları
- **Mobil Uyumluluk**: iOS Safari ve Android Chrome için özel optimizasyonlar
- **HTTPS/HTTP Uyarıları**: Güvenlik gereksinimleri için kullanıcı bilgilendirme
- **WebRTC Bağlantı İyileştirmeleri**: Geliştirilmiş STUN/TURN konfigürasyonu
- **Ses Kalitesi**: Echo cancellation, noise suppression ve auto gain control
- **Push-to-Talk Kontrolü**: Mouse, touch ve keyboard (SPACE) desteği
- **Audio Context Yönetimi**: Mobil tarayıcılar için audio context başlatma
- **Gerçek Zamanlı Ses Seviyesi**: Mikrofon test modülü eklendi
- **Hata Yakalama**: Detaylı hata raporlama ve sorun giderme ipuçları

**✅ Backend Güncellemeleri:**

- WebRTC signaling event'leri
- Konum güncelleme API'leri
- Konuşma durumu broadcasting
- Kullanıcı odasına katılma/ayrılma events
- Room management API'leri (create, join, leave)
- Online users tracking sistemi
- TURN sunucu konfigürasyonu iyileştirildi

### Geliştirme Modu

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm start

# Mobile (Gelecek sürümde eklenecek)
# cd mobile
# npm install
# expo start
```

## 📱 Mobil Uygulama

Mobil uygulama henüz geliştirilme aşamasındadır. Şu anda web tarayıcısı üzerinden kullanabilirsiniz.

## 🗂️ Proje Yapısı

```
webrtc-car-voice-geotalk/
├── backend/           # Node.js API sunucusu
│   ├── models/        # MongoDB şemaları
│   ├── routes/        # API endpoint'leri
│   ├── socket/        # WebSocket işleyicileri (WebRTC sinyalleşme)
│   └── server.js      # Ana sunucu dosyası
├── frontend/          # React web uygulaması
│   ├── src/
│   │   ├── components/
│   │   │   ├── VoiceMap.js       # 🆕 Leaflet harita komponenti
│   │   │   └── PushToTalkButton.js # 🆕 Ses kontrolü
│   │   ├── contexts/  # React Context API
│   │   ├── hooks/     # 🆕 Özel React hooks
│   │   │   ├── useWebRTC.js      # 🆕 WebRTC ses yönetimi
│   │   │   └── useGeolocation.js # 🆕 GPS konum takibi
│   │   ├── pages/
│   │   │   └── VoiceChat.js      # 🆕 Sesli sohbet sayfası
│   │   └── styles/
│   │       └── voice.css         # 🆕 Ses UI stilleri
│   └── package.json   # + leaflet, react-leaflet, lucide-react
├── docker-compose.yml # Docker konfigürasyonu
└── README.md
```

## 🔧 Konfigürasyon

### TURN Sunucusu

Production ortamında `docker-compose.yml` içindeki `COTURN_EXTERNAL_IP` değerini sunucunuzun gerçek IP adresi ile değiştirin.

### Environment Variables

- `JWT_SECRET`: JWT token şifreleme anahtarı
- `TURN_SECRET`: TURN sunucu kimlik doğrulama anahtarı
- `MONGODB_URI`: MongoDB bağlantı URI'si

## 🎯 Geliştirme Aşamaları

- [x] Proje yapısı ve Docker konfigürasyonu
- [x] Backend API ve WebSocket sinyalleşme
- [x] Frontend React uygulaması (Temel UI)
- [x] Kullanıcı kimlik doğrulama (JWT)
- [x] MongoDB veritabanı modelleri
- [x] Socket.IO WebRTC sinyalleşme altyapısı
- [x] **WebRTC P2P ses iletişimi** 🆕
- [x] **Harita entegrasyonu (Leaflet.js)** 🆕
- [x] **Konum paylaşımı ve GPS entegrasyonu** 🆕
- [x] **Push-to-talk kontrolleri** 🆕
- [x] **Dashboard ve oda yönetimi sistemi** 🆕
- [ ] Mobil uygulama (React Native)
- [ ] Sohbet sistemi (Text messaging)
- [ ] Production optimizasyonları

## 📄 Lisans

Bu proje eğitim amaçlı geliştirilmiştir.
