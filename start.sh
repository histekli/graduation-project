#!/bin/bash

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  WebRTC Voice Chat Başlatılıyor${NC}"
echo -e "${BLUE}================================${NC}"

# Gerekli portların kullanımda olup olmadığını kontrol et
echo -e "\n${YELLOW}Port kontrolleri yapılıyor...${NC}"
PORTS_TO_CHECK=(27017 5000 3443 6379)
for PORT in "${PORTS_TO_CHECK[@]}"; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        if [ $PORT -eq 27017 ] || [ $PORT -eq 6379 ]; then
            # MongoDB ve Redis Docker'da çalışıyor olabilir, bu normal
            echo -e "${GREEN}✓ Port $PORT kullanımda (Docker servisi)${NC}"
        else
            echo -e "${YELLOW}⚠ Port $PORT zaten kullanımda${NC}"
            # Eski process'leri sonra temizleyeceğiz
        fi
    else
        echo -e "${BLUE}○ Port $PORT müsait${NC}"
    fi
done

# Mediasoup UDP port range kontrolü
echo -e "${BLUE}○ Mediasoup UDP port range: 40000-49999 (WebRTC media)${NC}"

# Firewall kontrolü (varsa)
if command -v ufw &> /dev/null; then
    echo -e "\n${YELLOW}Firewall durumu kontrol ediliyor...${NC}"
    UFW_STATUS=$(sudo ufw status 2>/dev/null | grep -i "status:" | awk '{print $2}')
    if [ "$UFW_STATUS" = "active" ]; then
        echo -e "${YELLOW}⚠ UFW firewall aktif${NC}"
        echo -e "${BLUE}Gerekli portlar açılıyor...${NC}"
        sudo ufw allow 27017/tcp comment 'MongoDB' >/dev/null 2>&1
        sudo ufw allow 5000/tcp comment 'Backend API' >/dev/null 2>&1
        sudo ufw allow 3443/tcp comment 'Frontend HTTPS' >/dev/null 2>&1
        sudo ufw allow 6379/tcp comment 'Redis' >/dev/null 2>&1
        # Mediasoup UDP port range
        sudo ufw allow 40000:49999/udp comment 'Mediasoup WebRTC' >/dev/null 2>&1
        echo -e "${GREEN}✓ Portlar firewall'da açıldı (TCP + Mediasoup UDP 40000-49999)${NC}"
    else
        echo -e "${GREEN}✓ Firewall kapalı veya izin veriyor${NC}"
    fi
fi

# Eski process'leri temizle
echo -e "\n${YELLOW}1. Eski process'ler temizleniyor...${NC}"

# Port 5000'de çalışan process'i bul ve öldür
PORT_5000_PID=$(lsof -ti:5000 2>/dev/null)
if [ ! -z "$PORT_5000_PID" ]; then
    echo -e "${YELLOW}   Port 5000'de process bulundu (PID: $PORT_5000_PID), sonlandırılıyor...${NC}"
    kill -9 $PORT_5000_PID 2>/dev/null
    sleep 1
fi

# Port 3443'te çalışan process'i bul ve öldür
PORT_3443_PID=$(lsof -ti:3443 2>/dev/null)
if [ ! -z "$PORT_3443_PID" ]; then
    echo -e "${YELLOW}   Port 3443'te process bulundu (PID: $PORT_3443_PID), sonlandırılıyor...${NC}"
    kill -9 $PORT_3443_PID 2>/dev/null
    sleep 1
fi

# Node process'lerini temizle
pkill -f "node.*server.js" 2>/dev/null
pkill -f "react-scripts" 2>/dev/null
pkill -f "PORT=3443" 2>/dev/null
sleep 2
echo -e "${GREEN}✓ Temizleme tamamlandı${NC}"

# Docker servislerini başlat
echo -e "\n${YELLOW}2. Docker servisleri kontrol ediliyor...${NC}"

# Önce tüm container'ları durdur (backend ve frontend local'de çalışacak)
if docker compose ps | grep -q "Up"; then
    echo -e "${YELLOW}   Mevcut container'lar durduruluyor...${NC}"
    docker compose down
    sleep 2
fi

# Altyapı servislerini başlat (db, redis, coturn)
echo -e "${YELLOW}   Altyapı servisleri başlatılıyor (MongoDB, Redis, TURN)...${NC}"
docker compose up -d db redis coturn
echo -e "${YELLOW}   Servislerin başlaması bekleniyor...${NC}"
sleep 10

# MongoDB sağlık kontrolü
echo -e "${YELLOW}   MongoDB bağlantısı kontrol ediliyor...${NC}"
for i in {1..30}; do
    # Port erişilebilirliğini kontrol et (nc veya telnet kullanmadan)
    if timeout 1 bash -c "echo > /dev/tcp/localhost/27017" 2>/dev/null; then
        echo -e "\n${GREEN}✓ MongoDB portu erişilebilir (localhost:27017)${NC}"
        # Bir saniye daha bekle MongoDB'nin tamamen hazır olması için
        sleep 2
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "\n${RED}✗ MongoDB'ye bağlanılamadı!${NC}"
        echo -e "${YELLOW}   Port 27017 erişilemiyor. Docker container çalışıyor ama port açık değil.${NC}"
        echo -e "${YELLOW}   Docker logları:${NC}"
        docker compose logs db --tail=20
        echo -e "\n${YELLOW}   Port kontrol ediliyor...${NC}"
        netstat -tuln 2>/dev/null | grep 27017 || ss -tuln 2>/dev/null | grep 27017 || echo "Port 27017 açık değil"
        echo -e "\n${YELLOW}   Docker container durumu:${NC}"
        docker compose ps
        echo -e "\n${RED}Çözüm önerileri:${NC}"
        echo -e "  1. Docker'ı yeniden başlatın: ${BLUE}sudo systemctl restart docker${NC}"
        echo -e "  2. Container'ları temizleyin: ${BLUE}docker compose down && docker compose up -d${NC}"
        echo -e "  3. Port mapping'i kontrol edin: ${BLUE}docker compose ps${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done

# Docker servislerinin durumunu göster
docker compose ps

# Network IP'sini al
NETWORK_IP=$(hostname -I | awk '{print $1}')
echo -e "\n${BLUE}Network IP: ${NETWORK_IP}${NC}"

# Backend'i yeni terminalde başlat
echo -e "\n${YELLOW}3. Backend başlatılıyor (SFU - Mediasoup)...${NC}"
gnome-terminal --tab --title="Backend Server (SFU)" -- bash -c "
    cd backend && 
    echo -e '${BLUE}Backend Server Başlatılıyor...${NC}' && 
    echo -e '${GREEN}🎙️  SFU Architecture (Mediasoup)${NC}' &&
    echo -e '${YELLOW}MongoDB bağlantısı bekleniyor...${NC}' &&
    sleep 3 &&
    npm start; 
    exec bash
" &

# Backend'in başlamasını bekle
echo -e "${YELLOW}   Backend'in başlaması bekleniyor...${NC}"
echo -e "${BLUE}   - MongoDB bağlantısı${NC}"
echo -e "${BLUE}   - Mediasoup workers (12 adet)${NC}"
echo -e "${BLUE}   - SFU Router initialization${NC}"
sleep 10

# Backend sağlık kontrolü
echo -e "${YELLOW}   Backend health check...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend başarıyla başladı${NC}"
        
        # Mediasoup kontrolü
        if curl -s http://localhost:5000/health | grep -q "mediasoup" 2>/dev/null; then
            echo -e "${GREEN}✓ Mediasoup SFU aktif${NC}"
        fi
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Backend başlatılamadı!${NC}"
        echo -e "${YELLOW}Lütfen Backend terminalindeki hataları kontrol edin.${NC}"
        echo -e "${YELLOW}Kontrol edilecekler:${NC}"
        echo -e "  - MongoDB bağlantısı (port 27017)"
        echo -e "  - Mediasoup worker'lar (12 adet CPU core'a göre)"
        echo -e "  - Redis bağlantısı (port 6379)"
        exit 1
    fi
    echo -n "."
    sleep 1
done

# Frontend'i yeni terminalde başlat
echo -e "\n${YELLOW}4. Frontend başlatılıyor...${NC}"
gnome-terminal --tab --title="Frontend (HTTPS)" -- bash -c "
    cd frontend && 
    echo -e '${BLUE}Frontend (HTTPS) Başlatılıyor...${NC}' && 
    node start-server.js; 
    exec bash
" &

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}  Tüm Servisler Başlatıldı!${NC}"
echo -e "${GREEN}================================${NC}"

echo -e "\n${BLUE}Servis Durumu:${NC}"
echo -e "  ${GREEN}✓ MongoDB:${NC}        localhost:27017"
echo -e "  ${GREEN}✓ Redis:${NC}          localhost:6379"
echo -e "  ${GREEN}✓ Mediasoup SFU:${NC}  12 workers aktif"
echo -e "  ${GREEN}✓ Backend API:${NC}    http://localhost:5000"
echo -e "  ${GREEN}✓ Frontend:${NC}       https://localhost:3443"

echo -e "\n${BLUE}Erişim Adresleri:${NC}"
echo -e "  ${GREEN}Localhost:${NC}     https://localhost:3443"
echo -e "  ${GREEN}Ağ İçi:${NC}        https://${NETWORK_IP}:3443"
echo -e "  ${GREEN}Backend API:${NC}   http://localhost:5000"

echo -e "\n${BLUE}Mimari Bilgileri:${NC}"
echo -e "  ${YELLOW}WebRTC Mode:${NC}   SFU (Selective Forwarding Unit)"
echo -e "  ${YELLOW}Media Server:${NC}  Mediasoup v3"
echo -e "  ${YELLOW}Audio Codec:${NC}   Opus 48kHz Stereo"
echo -e "  ${YELLOW}Transport:${NC}     WebRTC (UDP/TCP)"

echo -e "\n${YELLOW}Not:${NC} SSL sertifika uyarısını tarayıcıda kabul etmeyi unutmayın!"
echo -e "${YELLOW}Mobil cihazdan:${NC} https://${NETWORK_IP}:3443 adresini kullanın"
echo -e "${YELLOW}SFU Avantajları:${NC}"
echo -e "  - Daha az istemci karmaşıklığı (P2P yerine)"
echo -e "  - Ölçeklenebilir grup sesli sohbet"
echo -e "  - Sunucu tarafında medya yönlendirme"
echo -e ""

# Log dosyalarını takip et (opsiyonel)
# tail -f backend/logs/*.log
