# WebRTC için HTTPS Kurulum Kılavuzu

## Problem

WebRTC `getUserMedia()` API'si (mikrofon/kamera erişimi) **sadece güvenli bağlamda (HTTPS)** çalışır:

- ✅ `https://` üzerinden
- ✅ `localhost` üzerinden (HTTP bile olsa)
- ❌ Lokal ağda `http://192.168.x.x` gibi IP'ler üzerinden

## Çözüm: Self-Signed SSL Sertifikası

### 1. SSL Sertifikası Oluştur

```bash
./generate-ssl.sh
```

Bu komut:

- ✅ SAN (Subject Alternative Names) desteği ile sertifika oluşturur
- ✅ Localhost, local IP ve wildcard domain'leri destekler
- ✅ `ssl/` ve `frontend/ssl/` klasörlerine sertifikaları kopyalar

### 2. Frontend'i HTTPS ile Başlat

```bash
cd frontend
npm run start-https
```

Bu komut:

- ✅ React Development Server'ı HTTPS:3443 portunda başlatır
- ✅ HTTP:3000'den HTTPS:3443'e otomatik yönlendirme yapar
- ✅ WebRTC için gerekli güvenli bağlamı sağlar

### 3. Tarayıcıda Sertifika Uyarısını Kabul Et

#### Chrome

1. `https://localhost:3443` adresine git
2. "Bağlantınız gizli değil" uyarısını gör
3. **"Gelişmiş"** butonuna tıkla
4. **"localhost adresine devam et (güvenli değil)"** linkine tıkla
5. ✅ Artık site yüklendi ve WebRTC çalışacak

#### Firefox

1. `https://localhost:3443` adresine git
2. "Uyarı: Olası Güvenlik Riski İleride" uyarısını gör
3. **"Gelişmiş..."** butonuna tıkla
4. **"Riski Kabul Et ve Devam Et"** butonuna tıkla
5. ✅ Artık site yüklendi ve WebRTC çalışacak

#### Safari

1. `https://localhost:3443` adresine git
2. "Bu bağlantı özel değil" uyarısını gör
3. **"Detayları Göster"** butonuna tıkla
4. **"Web sitesini ziyaret et"** linkine tıkla
5. ✅ Artık site yüklendi ve WebRTC çalışacak

### 4. Mobil Cihazlardan Bağlanma

#### a) Yerel IP'nizi Öğrenin

```bash
hostname -I | awk '{print $1}'
# Çıktı: 10.1.245.183 (sizin IP'niz farklı olacak)
```

#### b) Mobil Tarayıcıdan Bağlanın

1. Mobil cihazınızın aynı WiFi ağında olduğundan emin olun
2. Mobil tarayıcıda: `https://10.1.245.183:3443` (kendi IP'niz ile)
3. Sertifika uyarısını kabul edin:
   - **iOS Safari**: "Devam Et" → "Web Sitesini Ziyaret Et"
   - **Android Chrome**: "Gelişmiş" → "Devam Et"
4. Mikrofon iznini verin
5. ✅ Artık WebRTC çalışıyor

## Neden Bu Gerekli?

### Tarayıcı Güvenlik Politikaları

Modern tarayıcılar, kullanıcı gizliliğini korumak için hassas API'leri (mikrofon, kamera, konum) sadece güvenli bağlamda çalıştırır:

```javascript
// ❌ HATA: http://192.168.1.100:3000 üzerinde
navigator.mediaDevices.getUserMedia({ audio: true });
// NotAllowedError: Permission denied

// ✅ ÇALIŞIR: https://192.168.1.100:3443 üzerinde
navigator.mediaDevices.getUserMedia({ audio: true });
// Promise<MediaStream>
```

### İstisnalar

- ✅ `http://localhost` - her zaman güvenli sayılır
- ✅ `http://127.0.0.1` - her zaman güvenli sayılır
- ❌ `http://192.168.x.x` - güvenli sayılmaz, HTTPS gerekli
- ❌ `http://10.x.x.x` - güvenli sayılmaz, HTTPS gerekli

## Tam Başlatma Adımları

### Tüm Servisleri Docker ile Başlat

```bash
# 1. SSL sertifikalarını oluştur
./generate-ssl.sh

# 2. Docker servislerini başlat (MongoDB, Redis, Janus, Coturn)
docker-compose up -d

# 3. Backend'i başlat (HTTP:5000)
cd backend
npm install
npm start

# 4. Frontend'i HTTPS ile başlat (HTTPS:3443)
cd ../frontend
npm install
npm run start-https
```

### Erişim URL'leri

- 🌐 **Frontend (HTTPS):** https://localhost:3443
- 🌐 **Frontend (Network):** https://10.1.245.183:3443
- 🔧 **Backend API:** http://localhost:5000
- 🎬 **Janus WebSocket:** ws://localhost:8188
- 🗄️ **MongoDB:** mongodb://localhost:27017
- 🔴 **Redis:** redis://localhost:6379

## Sorun Giderme

### Problem: "Mikrofon iznine erişilemiyor"

**Çözüm:** HTTPS kullandığınızdan emin olun

```bash
# URL'yi kontrol et
echo "Şu anda: http://localhost:3000 ❌"
echo "Olmalı: https://localhost:3443 ✅"
```

### Problem: "Sertifika güvenilir değil" uyarısı

**Çözüm:** Bu normal! Self-signed sertifika kullanıyoruz.

- Her tarayıcıda bir kez "Riski Kabul Et" demeniz gerekir
- Production'da Let's Encrypt gibi güvenilir CA kullanın

### Problem: "Mobil cihazdan bağlanamıyorum"

**Çözüm:** Firewall kontrolü

```bash
# Linux firewall portları aç
sudo ufw allow 3443/tcp
sudo ufw allow 5000/tcp
sudo ufw allow 8088/tcp
sudo ufw allow 8188/tcp
```

### Problem: "WebRTC bağlantısı kurulmuyor"

**Çözüm:** Backend ve Janus servislerini kontrol et

```bash
# Backend kontrolü
curl http://localhost:5000/health

# Janus kontrolü
curl http://localhost:8088/janus/info

# Tüm servislerin durumu
docker-compose ps
```

## Production Deployment

Production ortamında mutlaka **gerçek SSL sertifikası** kullanın:

### Let's Encrypt (Ücretsiz)

```bash
# Certbot kurulumu
sudo apt install certbot python3-certbot-nginx

# Sertifika oluştur
sudo certbot certonly --standalone -d yourdomain.com

# Sertifikalar
/etc/letsencrypt/live/yourdomain.com/fullchain.pem
/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Nginx ile Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Özet

1. ✅ `./generate-ssl.sh` - SSL sertifikası oluştur
2. ✅ `docker-compose up -d` - Backend servisleri başlat
3. ✅ `cd backend && npm start` - Backend API başlat
4. ✅ `cd frontend && npm run start-https` - Frontend HTTPS ile başlat
5. ✅ `https://localhost:3443` - Tarayıcıda sertifika uyarısını kabul et
6. ✅ Mikrofon iznini ver
7. ✅ WebRTC artık çalışıyor! 🎉
