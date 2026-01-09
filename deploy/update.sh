#!/bin/bash

# CI/CD - Sürekli Deployment Script
# GitHub'dan otomatik güncelleme

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Proje Güncelleme${NC}"
echo -e "${BLUE}================================${NC}"

cd /opt/webrtc-app

# 1. Git pull
echo -e "\n${YELLOW}📥 GitHub'dan güncellemeler çekiliyor...${NC}"
git pull origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Git pull başarısız!${NC}"
    exit 1
fi

# 2. Backend dependencies güncelle
echo -e "\n${YELLOW}📦 Backend dependencies güncelleniyor...${NC}"
cd backend
npm install
cd ..

# 3. Frontend rebuild
echo -e "\n${YELLOW}🏗️  Frontend yeniden build ediliyor...${NC}"
cd frontend
npm install
npm run build
cd ..

# 4. Docker container'ları güncelle (gerekirse)
echo -e "\n${YELLOW}🐳 Docker container'lar kontrol ediliyor...${NC}"
docker-compose pull
docker-compose up -d db redis coturn

# 5. Backend'i restart et
echo -e "\n${YELLOW}🔄 Backend restart ediliyor...${NC}"
sudo systemctl restart webrtc-backend

# Başlamasını bekle
sleep 5

# 6. Health check
echo -e "\n${YELLOW}🏥 Health check yapılıyor...${NC}"
if curl -k -s https://localhost:3443/health > /dev/null; then
    echo -e "${GREEN}✓ Backend çalışıyor${NC}"
else
    echo -e "${RED}❌ Backend başlatılamadı!${NC}"
    echo -e "${YELLOW}Logları kontrol edin:${NC}"
    echo -e "sudo journalctl -u webrtc-backend -n 50"
    exit 1
fi

echo -e "\n${BLUE}================================${NC}"
echo -e "${BLUE}  ✅ Güncelleme Tamamlandı!${NC}"
echo -e "${BLUE}================================${NC}"

echo -e "\n${GREEN}Yeni sürüm başarıyla deploy edildi!${NC}"
echo -e "\n${YELLOW}📊 Logları görüntülemek için:${NC}"
echo -e "${GREEN}sudo journalctl -u webrtc-backend -f${NC}"
