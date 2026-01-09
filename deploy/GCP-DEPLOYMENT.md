# 🚀 Google Cloud Platform Deployment Rehberi

WebRTC Voice Chat uygulamasını Google Cloud'a deploy etmek için adım adım rehber.

## 📋 Gereksinimler

- Google Cloud hesabı (300$ ücretsiz kredi)
- Google Cloud SDK kurulu (gcloud CLI)
- GitHub repository
- MongoDB Atlas hesabı (ücretsiz tier)

## 🎯 Mimari

```
┌─────────────────────────────────────────┐
│         Google Cloud Platform           │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │    Compute Engine VM (e2-medium)   │ │
│  │                                     │ │
│  │  ├─ Docker (MongoDB, Redis, TURN) │ │
│  │  ├─ Node.js Backend (Port 3443)   │ │
│  │  ├─ Mediasoup SFU                  │ │
│  │  └─ Static Frontend                │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │       Firewall Rules               │ │
│  │  - HTTP/HTTPS (80, 443)            │ │
│  │  - Mediasoup UDP (40000-49999)     │ │
│  │  - TURN (3478, 5349)               │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
              │
              ▼
   ┌───────────────────────┐
   │   MongoDB Atlas       │
   │   (Managed Database)  │
   └───────────────────────┘
```

## 📦 Adım 1: Google Cloud SDK Kurulumu

### Linux/Mac:
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

### Windows:
[Google Cloud SDK Installer](https://cloud.google.com/sdk/docs/install) indirin ve çalıştırın.

## 🔧 Adım 2: GCP Projesi Oluşturma

1. [Google Cloud Console](https://console.cloud.google.com)'a gidin
2. Yeni proje oluşturun (örn: `webrtc-voice-chat`)
3. Proje ID'sini not alın

```bash
# Proje ID'yi ayarlayın
export GCP_PROJECT_ID="your-project-id"
gcloud config set project $GCP_PROJECT_ID
```

## 🗄️ Adım 3: MongoDB Atlas Kurulumu

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)'a gidin
2. Ücretsiz hesap oluşturun
3. **Create a Cluster** → **M0 Free Tier** seçin
4. **Google Cloud** ve yakın bölge seçin (örn: `europe-west1`)
5. Cluster oluşturulurken:

### Database Access:
```
Username: webrtc_user
Password: [güçlü şifre oluşturun]
Role: Read and write to any database
```

### Network Access:
```
IP Address: 0.0.0.0/0 (geliştirme için)
# Production'da VM IP'sini ekleyin
```

6. **Connect** → **Connect your application** → Connection string'i kopyalayın:
```
mongodb+srv://webrtc_user:<password>@cluster0.xxxxx.mongodb.net/voice-chat?retryWrites=true&w=majority
```

## 🚀 Adım 4: VM Oluşturma ve Deployment

### 4.1. Script'leri çalıştırılabilir yapın:
```bash
chmod +x deploy/*.sh
```

### 4.2. GCP Infrastructure Setup:
```bash
./deploy/gcp-setup.sh
```

Bu script:
- ✅ Statik IP adresi oluşturur
- ✅ Firewall kurallarını ayarlar
- ✅ VM oluşturur (Ubuntu 22.04, e2-medium)
- ✅ Docker ve Docker Compose kurulur

**Output:**
```
Public IP: 34.78.xxx.xxx
```
Bu IP'yi not alın!

### 4.3. VM'ye Bağlanın:
```bash
gcloud compute ssh webrtc-voice-chat --zone=europe-west1-b
```

### 4.4. Projeyi Deploy Edin:
VM içinde:
```bash
sudo -i
cd /opt/webrtc-app
git clone https://github.com/your-username/webrtc-car-voice-geotalk.git .
./deploy/deploy-to-vm.sh
```

Script sizden soracak:
- MongoDB Atlas connection string
- JWT Secret (güçlü şifre)

## 🔐 Adım 5: SSL Kurulumu (Opsiyonel - Domain varsa)

### Domain yoksa:
Self-signed sertifika ile çalışır (browser'da uyarı verir)

### Domain varsa:

1. **DNS Ayarları:**
```
A Record: @ -> [VM Public IP]
A Record: www -> [VM Public IP]
```

2. **DNS Propagation bekleyin:** (~24 saat)

3. **Kontrol edin:**
```bash
dig +short yourdomain.com
```

4. **Let's Encrypt kurulumu:**
```bash
./deploy/setup-ssl.sh
```

Script sizden soracak:
- Domain adı (örn: myapp.com)
- Email adresi

## ✅ Adım 6: Test ve Doğrulama

### Health Check:
```bash
curl -k https://[VM-IP]:3443/health
```

**Beklenen output:**
```json
{
  "status": "OK",
  "timestamp": "2025-12-03T...",
  "environment": "production",
  "services": {
    "mongodb": "connected",
    "redis": "connected",
    "mediasoup": "active"
  }
}
```

### Tarayıcıdan Test:
```
https://[VM-IP]:3443
```

**Not:** Self-signed SSL varsa "Advanced" → "Proceed" tıklayın

## 🔄 Adım 7: Sürekli Güncelleme (CI/CD)

### Manuel Güncelleme:
```bash
# VM'ye bağlan
gcloud compute ssh webrtc-voice-chat --zone=europe-west1-b

# Güncellemeyi çalıştır
sudo /opt/webrtc-app/deploy/update.sh
```

### Otomatik Güncelleme (GitHub Webhook):
1. GitHub repo → Settings → Webhooks
2. Add webhook:
   - Payload URL: `https://[VM-IP]:3443/api/deploy`
   - Content type: `application/json`
   - Secret: [güçlü şifre]
   - Events: `push` (main branch)

## 📊 Monitoring ve Loglar

### Backend Logları:
```bash
sudo journalctl -u webrtc-backend -f
```

### Docker Logları:
```bash
docker-compose logs -f
```

### Sistem Durumu:
```bash
sudo systemctl status webrtc-backend
docker-compose ps
```

## 💰 Maliyet Tahmini

**e2-medium VM (2 vCPU, 4GB RAM):**
- Aylık: ~$30-40
- Network egress: ~$0.12/GB

**MongoDB Atlas M0 Free Tier:**
- Ücretsiz (512MB)

**Toplam: ~$30-40/ay**

### Maliyet Optimizasyonu:
```bash
# Daha küçük VM (e2-small) - ~$20/ay
gcloud compute instances stop webrtc-voice-chat
gcloud compute instances set-machine-type webrtc-voice-chat --machine-type=e2-small
gcloud compute instances start webrtc-voice-chat
```

## 🔧 Troubleshooting

### Problem: VM'ye SSH yapamıyorum
```bash
gcloud compute instances list
gcloud compute ssh webrtc-voice-chat --zone=europe-west1-b --troubleshoot
```

### Problem: Backend başlamıyor
```bash
sudo journalctl -u webrtc-backend -n 100
sudo systemctl restart webrtc-backend
```

### Problem: MongoDB bağlantı hatası
1. MongoDB Atlas Network Access kontrol edin
2. Connection string'de şifre doğru mu?
3. `.env` dosyasını kontrol edin

### Problem: WebRTC bağlantısı yok
1. Firewall kuralları açık mı?
```bash
gcloud compute firewall-rules list
```

2. TURN server çalışıyor mu?
```bash
docker-compose ps coturn
```

3. Mediasoup announced IP doğru mu?
```bash
cat backend/.env | grep MEDIASOUP_ANNOUNCED_IP
```

## 📚 Faydalı Komutlar

```bash
# VM'yi durdur (maliyet tasarrufu)
gcloud compute instances stop webrtc-voice-chat

# VM'yi başlat
gcloud compute instances start webrtc-voice-chat

# VM'yi sil (dikkat!)
gcloud compute instances delete webrtc-voice-chat

# Firewall kurallarını listele
gcloud compute firewall-rules list

# Statik IP'yi listele
gcloud compute addresses list

# VM metriklerini görüntüle
gcloud compute instances get-serial-port-output webrtc-voice-chat
```

## 🎓 Best Practices

1. **Güvenlik:**
   - SSH key authentication kullanın
   - `.env` dosyasını git'e eklemeyin
   - JWT secret'ı güçlü tutun
   - Production'da 0.0.0.0/0 yerine specific IP'ler kullanın

2. **Backup:**
   ```bash
   # MongoDB backup (Atlas otomatik yapar)
   # VM backup
   gcloud compute disks snapshot webrtc-voice-chat
   ```

3. **Monitoring:**
   - Google Cloud Monitoring kullanın
   - Alert'ler kurun (CPU > 80%, Disk > 80%)

4. **Scaling:**
   - Load balancer ekleyin
   - Multiple VM instances
   - Managed instance group

## 📞 Destek

- GitHub Issues: [Link to your repo]
- Documentation: [Link to docs]
- Email: your-email@example.com

## 📄 Lisans

MIT License - Production kullanımı için uygun
