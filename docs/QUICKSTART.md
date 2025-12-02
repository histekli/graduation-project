# 🚀 Hızlı Başlangıç - GeoTalk CarVoice (Janus SFU)

## ⚡ 5 Dakikada Başlangıç

### 1. Gereksinimler

```bash
# Docker kurulu mu?
docker --version
docker-compose --version

# Yoksa:
# Ubuntu/Debian: sudo apt install docker.io docker-compose
# macOS: brew install docker docker-compose
```

### 2. Başlatma

```bash
# Tek komutla başlat
make install

# VEYA
./start-janus.sh
```

### 3. Erişim

- **Web App:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **Janus WebSocket:** ws://localhost:8188

✅ Hepsi bu kadar!

---

## 📱 Mobil Cihazdan Erişim

```bash
# IP adresinizi bulun
make info

# Mobil tarayıcıdan:
https://YOUR_IP:3001
```

⚠️ **Not:** HTTPS için tarayıcıda "Advanced → Proceed" seçeneğini kullanın (self-signed sertifika)

---

## 🔧 Yararlı Komutlar

```bash
# Tüm komutları göster
make help

# Logları izle
make logs

# Servisleri yeniden başlat
make restart

# Servisleri durdur
make stop

# Janus'ı test et
make test-janus

# Backend'i test et
make test-backend

# Sistem bilgilerini göster
make info
```

---

## 🎯 İlk Kullanım

### 1. Kayıt Ol
- http://localhost:3000 adresine git
- "Register" butonuna tıkla
- Kullanıcı adı, email, şifre gir

### 2. Giriş Yap
- Login sayfasında bilgilerini gir
- Dashboard'a yönlendirileceksin

### 3. Odaya Katıl
- "Rooms" menüsünden bir oda seç
- "Join Room" butonuna tıkla
- Mikrofon izni ver

### 4. Konuşmaya Başla
- **Push-to-Talk:** Butona basılı tut ve konuş
- Haritada konumunu ve diğer kullanıcıları gör
- Ses odası üzerinden diğer kullanıcılarla iletişim kur

---

## 🎤 WebRTC Ses Test

### Tarayıcı Konsolu Test

```javascript
// Tarayıcı konsolunda çalıştır
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('✅ Mikrofon erişimi başarılı');
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(err => console.error('❌ Mikrofon hatası:', err));
```

### Janus Bağlantı Test

```bash
# Terminal'de çalıştır
curl http://localhost:8088/janus/info

# Çıktı:
# {
#   "janus": "server_info",
#   "name": "Janus WebRTC Server",
#   ...
# }
```

---

## 🐛 Sorun Giderme

### Ses gelmiyor

1. **Mikrofon izni kontrol:**
   - Chrome: `chrome://settings/content/microphone`
   - Firefox: `about:preferences#privacy`

2. **Janus bağlantısı kontrol:**
   ```bash
   make logs-janus
   ```

3. **WebRTC bağlantısı kontrol:**
   - Tarayıcı konsolu: `chrome://webrtc-internals`
   - Stats grafiklerini incele

### Janus başlamıyor

```bash
# Janus container'ı kontrol et
docker-compose ps janus

# Janus loglarını incele
make logs-janus

# Janus'ı yeniden başlat
make restart-janus
```

### TURN server çalışmıyor

```bash
# Coturn loglarını incele
make logs-coturn

# Coturn'ü yeniden başlat
docker-compose restart coturn

# TURN test et
curl http://localhost:3478
```

### Backend bağlantı hatası

```bash
# Backend durumunu kontrol et
make status

# Backend loglarını incele
make logs-backend

# Health check
curl http://localhost:5000/health
```

### MongoDB bağlantı hatası

```bash
# MongoDB container'ı kontrol et
docker-compose ps db

# MongoDB logları
docker-compose logs db

# MongoDB shell'e bağlan
make mongo-shell
```

---

## 🌐 Network Üzerinde Test

### Yerel Ağda Paylaşım

```bash
# 1. IP adresinizi bulun
make info

# 2. Firewall portlarını açın
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 5000/tcp  # Backend
sudo ufw allow 8188/tcp  # Janus WS
sudo ufw allow 3478/udp  # STUN/TURN

# 3. Mobil cihazdan erişin
# https://YOUR_IP:3001
```

### Port Yönlendirme (Router)

Eğer internet üzerinden erişmek istiyorsanız:

1. Router admin paneline girin
2. Port forwarding ayarları:
   - `3000` → Frontend
   - `5000` → Backend
   - `8188` → Janus WebSocket
   - `3478 (UDP)` → STUN/TURN
   - `10000-10200 (UDP)` → RTP/RTCP

---

## 🔐 Güvenlik (Production)

### SSL Sertifikası Kurulumu

```bash
# Let's Encrypt ile ücretsiz SSL
sudo apt install certbot

# Sertifika al
sudo certbot certonly --standalone -d yourdomain.com

# Sertifikaları kopyala
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/key.pem

# Servisleri yeniden başlat
make restart
```

### Environment Değişkenlerini Güncelle

```bash
# .env dosyasını düzenle
nano .env

# Önemli değişiklikler:
NODE_ENV=production
JWT_SECRET=STRONG_RANDOM_SECRET_HERE
JANUS_API_SECRET=ANOTHER_STRONG_SECRET
```

---

## 📊 Performans Monitoring

### Docker Stats

```bash
# Resource kullanımını izle
docker stats
```

### Janus Stats

```bash
# Janus admin API ile stats al
curl http://localhost:8989/admin \
  -H "Content-Type: application/json" \
  -d '{"janus":"list_sessions","admin_secret":"carvoice_janus_admin"}'
```

---

## 🚀 Production Deployment

### Önerilen Setup

```
[Users] → [Nginx Reverse Proxy] → [Docker Containers]
                ↓
          [Let's Encrypt SSL]
                ↓
         [Janus SFU Server]
                ↓
          [TURN/STUN Server]
```

### Nginx Konfigürasyonu

```nginx
# /etc/nginx/sites-available/carvoice

# Janus WebSocket
location /janus/ {
    proxy_pass http://localhost:8188/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Backend API
location /api/ {
    proxy_pass http://localhost:5000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Frontend
location / {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## 📚 Daha Fazla Bilgi

- **Detaylı Dokümantasyon:** `make docs`
- **Janus Mimarisi:** `cat README_JANUS.md`
- **API Dokümantasyonu:** http://localhost:5000/api-docs
- **Janus Official Docs:** https://janus.conf.meetecho.com/docs/

---

## 💡 İpuçları

1. **Geliştirme Modu:**
   ```bash
   # Backend
   make dev-backend
   
   # Frontend
   make dev-frontend
   ```

2. **Veritabanı Backup:**
   ```bash
   make backup-db
   ```

3. **Logları Temizle:**
   ```bash
   docker-compose logs --tail=100 -f
   ```

4. **Resource Limitleri:**
   - Janus: 2 CPU, 4GB RAM
   - Backend: 1 CPU, 2GB RAM
   - Frontend: 1 CPU, 1GB RAM

---

## 🎉 Başarılı!

Artık GeoTalk CarVoice sisteminiz Janus SFU ile çalışıyor!

Sorularınız için:
- GitHub Issues
- Email: support@geotalk.com

**Happy Talking! 🎤**