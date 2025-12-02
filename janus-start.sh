#!/bin/bash

# GeoTalk CarVoice - Janus SFU ile Başlatma Scripti
# =================================================

set -e

echo "🚗 GeoTalk CarVoice - Janus SFU Başlatılıyor..."
echo "============================================="

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Public IP adresini tespit et
echo -e "\n${YELLOW}📡 Network bilgileri alınıyor...${NC}"

if command -v ip &> /dev/null; then
    HOST_IP=$(ip route get 1 | awk '{print $7;exit}')
elif command -v ifconfig &> /dev/null; then
    HOST_IP=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1)
else
    HOST_IP="127.0.0.1"
fi

echo -e "${GREEN}✅ Host IP: $HOST_IP${NC}"

# .env dosyasını kontrol et ve oluştur
echo -e "\n${YELLOW}📝 Environment dosyaları kontrol ediliyor...${NC}"

if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env dosyası bulunamadı, oluşturuluyor...${NC}"
    cp .env.example .env
    
    # HOST_IP'yi güncelle
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/HOST_IP=.*/HOST_IP=$HOST_IP/" .env
    else
        # Linux
        sed -i "s/HOST_IP=.*/HOST_IP=$HOST_IP/" .env
    fi
    
    echo -e "${GREEN}✅ .env dosyası oluşturuldu${NC}"
else
    echo -e "${GREEN}✅ .env dosyası mevcut${NC}"
fi

if [ ! -f frontend/.env ]; then
    echo -e "${YELLOW}⚠️  frontend/.env dosyası bulunamadı, oluşturuluyor...${NC}"
    cp frontend/.env.example frontend/.env
    
    # IP'yi güncelle
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/localhost/$HOST_IP/g" frontend/.env
    else
        sed -i "s/localhost/$HOST_IP/g" frontend/.env
    fi
    
    echo -e "${GREEN}✅ frontend/.env dosyası oluşturuldu${NC}"
else
    echo -e "${GREEN}✅ frontend/.env dosyası mevcut${NC}"
fi

# Docker kontrol
echo -e "\n${YELLOW}🐳 Docker kontrol ediliyor...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker bulunamadı. Lütfen Docker'ı yükleyin.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose bulunamadı. Lütfen Docker Compose'u yükleyin.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker mevcut${NC}"

# Eski container'ları temizle
echo -e "\n${YELLOW}🧹 Eski container'lar temizleniyor...${NC}"
docker-compose down 2>/dev/null || true

# Janus konfigürasyon dizinini kontrol et
if [ ! -d "janus" ]; then
    echo -e "${YELLOW}⚠️  Janus konfigürasyon dizini bulunamadı${NC}"
    echo -e "${RED}❌ janus/ dizini mevcut değil. Lütfen Janus konfigürasyonunu kontrol edin.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Janus konfigürasyonu mevcut${NC}"

# Docker container'ları başlat
echo -e "\n${YELLOW}🚀 Docker container'ları başlatılıyor...${NC}"
echo -e "${YELLOW}   Bu işlem birkaç dakika sürebilir...${NC}"

export HOST_IP=$HOST_IP
docker-compose up -d

# Container'ların başlamasını bekle
echo -e "\n${YELLOW}⏳ Servisler başlatılıyor...${NC}"
sleep 10

# Servisleri kontrol et
echo -e "\n${YELLOW}🔍 Servisler kontrol ediliyor...${NC}"

SERVICES=("mongodb" "backend" "frontend" "janus" "coturn")
ALL_OK=true

for service in "${SERVICES[@]}"; do
    if docker-compose ps | grep -q "$service.*Up"; then
        echo -e "${GREEN}✅ $service çalışıyor${NC}"
    else
        echo -e "${RED}❌ $service başlatılamadı${NC}"
        ALL_OK=false
    fi
done

# Servis URL'leri
echo -e "\n${GREEN}=============================================${NC}"
echo -e "${GREEN}🎉 GeoTalk CarVoice Başlatıldı!${NC}"
echo -e "${GREEN}=============================================${NC}"

echo -e "\n📱 ${YELLOW}Erişim URL'leri:${NC}"
echo -e "   Frontend (Web):      ${GREEN}http://$HOST_IP:3000${NC}"
echo -e "   Frontend (HTTPS):    ${GREEN}https://$HOST_IP:3001${NC}"
echo -e "   Backend API:         ${GREEN}http://$HOST_IP:5000${NC}"
echo -e "   Janus WebSocket:     ${GREEN}ws://$HOST_IP:8188${NC}"
echo -e "   Janus HTTP API:      ${GREEN}http://$HOST_IP:8088/janus${NC}"
echo -e "   MongoDB:             ${GREEN}mongodb://$HOST_IP:27017${NC}"

echo -e "\n🎬 ${YELLOW}Janus Gateway:${NC}"
echo -e "   WebSocket:           ${GREEN}ws://$HOST_IP:8188${NC}"
echo -e "   HTTP API:            ${GREEN}http://$HOST_IP:8088${NC}"
echo -e "   Admin API:           ${GREEN}http://$HOST_IP:8989${NC}"

echo -e "\n🔄 ${YELLOW}TURN/STUN Server (Coturn):${NC}"
echo -e "   STUN:                ${GREEN}stun:$HOST_IP:3478${NC}"
echo -e "   TURN:                ${GREEN}turn:$HOST_IP:3478${NC}"

echo -e "\n📊 ${YELLOW}Kullanışlı Komutlar:${NC}"
echo -e "   Logları izle:        ${GREEN}docker-compose logs -f${NC}"
echo -e "   Janus logları:       ${GREEN}docker-compose logs -f janus${NC}"
echo -e "   Backend logları:     ${GREEN}docker-compose logs -f backend${NC}"
echo -e "   Servisleri durdur:   ${GREEN}docker-compose down${NC}"
echo -e "   Servisleri yeniden başlat: ${GREEN}docker-compose restart${NC}"

echo -e "\n📚 ${YELLOW}Dokümantasyon:${NC}"
echo -e "   Janus detayları:     ${GREEN}cat README_JANUS.md${NC}"

if [ "$ALL_OK" = true ]; then
    echo -e "\n${GREEN}✅ Tüm servisler başarıyla başlatıldı!${NC}"
    echo -e "${GREEN}🚀 Uygulamayı kullanmaya başlayabilirsiniz!${NC}"
else
    echo -e "\n${RED}⚠️  Bazı servisler başlatılamadı. Logları kontrol edin:${NC}"
    echo -e "${YELLOW}docker-compose logs${NC}"
fi

echo -e "\n${GREEN}=============================================${NC}"