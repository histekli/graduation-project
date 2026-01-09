#!/bin/bash

# VM'ye Deployment Script
# Bu script VM içinde çalıştırılacak

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  VM'ye Deployment${NC}"
echo -e "${BLUE}================================${NC}"

# 1. Proje dizinine git
cd /opt/webrtc-app

# 2. Git repo klonla (ilk deploy ise)
if [ ! -d ".git" ]; then
    echo -e "\n${YELLOW}📥 GitHub'dan proje indiriliyor...${NC}"
    read -p "GitHub repository URL'nizi girin: " REPO_URL
    git clone $REPO_URL .
else
    echo -e "\n${YELLOW}🔄 Proje güncelleniyor...${NC}"
    git pull origin main
fi

# 3. Environment dosyası oluştur
echo -e "\n${YELLOW}⚙️  Environment dosyası oluşturuluyor...${NC}"

if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}MongoDB Atlas connection string'inizi girin:${NC}"
    read -p "MONGODB_URI: " MONGODB_URI
    
    echo -e "${YELLOW}JWT Secret (güçlü bir şifre):${NC}"
    read -p "JWT_SECRET: " JWT_SECRET
    
    # Public IP'yi al
    PUBLIC_IP=$(curl -s http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H "Metadata-Flavor: Google")
    
    cat > backend/.env << EOF
# Server Configuration
NODE_ENV=production
PORT=3443

# MongoDB Atlas
MONGODB_URI=${MONGODB_URI}

# Redis (local container)
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRE=7d

# CORS
CORS_ORIGIN=https://${PUBLIC_IP}:3443

# Mediasoup
MEDIASOUP_ANNOUNCED_IP=${PUBLIC_IP}
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=49999

# TURN Server
TURN_SERVER_URL=turn:${PUBLIC_IP}:3478
TURN_USERNAME=webrtc
TURN_PASSWORD=webrtc123
EOF

    echo -e "${GREEN}✓ .env dosyası oluşturuldu${NC}"
else
    echo -e "${GREEN}✓ .env dosyası zaten mevcut${NC}"
fi

# 4. Frontend build
echo -e "\n${YELLOW}🏗️  Frontend build ediliyor...${NC}"
cd frontend
npm install
npm run build
cd ..

echo -e "${GREEN}✓ Frontend build tamamlandı${NC}"

# 5. Docker container'ları başlat
echo -e "\n${YELLOW}🐳 Docker container'lar başlatılıyor...${NC}"

# Eski container'ları durdur
docker-compose down

# Yeni container'ları başlat
docker-compose up -d db redis coturn

# Container'ların hazır olmasını bekle
echo -e "${YELLOW}Servisler başlatılıyor...${NC}"
sleep 10

# Backend'i başlat
cd backend
npm install
NODE_ENV=production node server.js > /var/log/webrtc-backend.log 2>&1 &
cd ..

echo -e "${GREEN}✓ Tüm servisler başlatıldı${NC}"

# 6. Sistem servisini oluştur (otomatik başlatma için)
echo -e "\n${YELLOW}⚡ Sistem servisi oluşturuluyor...${NC}"

sudo tee /etc/systemd/system/webrtc-backend.service > /dev/null << EOF
[Unit]
Description=WebRTC Voice Chat Backend
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/webrtc-app/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable webrtc-backend
sudo systemctl start webrtc-backend

echo -e "${GREEN}✓ Sistem servisi oluşturuldu${NC}"

# 7. Status kontrolü
echo -e "\n${BLUE}================================${NC}"
echo -e "${BLUE}  ✅ Deployment Tamamlandı!${NC}"
echo -e "${BLUE}================================${NC}"

PUBLIC_IP=$(curl -s http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H "Metadata-Flavor: Google")

echo -e "\n${GREEN}Uygulama Adresi:${NC}"
echo -e "${BLUE}https://${PUBLIC_IP}:3443${NC}"

echo -e "\n${YELLOW}⚠️  Not: Self-signed SSL sertifikası kullanılıyor${NC}"
echo -e "${YELLOW}Tarayıcıda güvenlik uyarısını kabul etmelisiniz${NC}"

echo -e "\n${YELLOW}📝 Let's Encrypt SSL kurulumu için:${NC}"
echo -e "${GREEN}./deploy/setup-ssl.sh${NC}"

echo -e "\n${YELLOW}📊 Logları görüntülemek için:${NC}"
echo -e "${GREEN}tail -f /var/log/webrtc-backend.log${NC}"
echo -e "${GREEN}docker-compose logs -f${NC}"
