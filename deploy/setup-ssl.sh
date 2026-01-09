#!/bin/bash

# Let's Encrypt SSL Kurulum Script
# Domain gerektirir

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Let's Encrypt SSL Setup${NC}"
echo -e "${BLUE}================================${NC}"

# Domain kontrolü
echo -e "\n${YELLOW}Domain'inizi girin (örn: myapp.com):${NC}"
read -p "Domain: " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}❌ Domain boş olamaz!${NC}"
    exit 1
fi

# Email
echo -e "\n${YELLOW}Email adresinizi girin (sertifika yenileme bildirimleri için):${NC}"
read -p "Email: " EMAIL

if [ -z "$EMAIL" ]; then
    echo -e "${RED}❌ Email boş olamaz!${NC}"
    exit 1
fi

# Certbot kurulumu
echo -e "\n${YELLOW}📦 Certbot kuruluyor...${NC}"
sudo apt-get update
sudo apt-get install -y certbot

# Geçici web server'ı durdur
echo -e "\n${YELLOW}⏸️  Backend geçici olarak durduruluyor...${NC}"
sudo systemctl stop webrtc-backend

# SSL sertifikası al
echo -e "\n${YELLOW}🔐 SSL sertifikası alınıyor...${NC}"
sudo certbot certonly --standalone \
    --preferred-challenges http \
    --email ${EMAIL} \
    --agree-tos \
    --no-eff-email \
    -d ${DOMAIN}

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ SSL sertifikası alınamadı!${NC}"
    echo -e "${YELLOW}Kontrol edilecekler:${NC}"
    echo -e "  1. Domain'in DNS kaydı doğru mu? (A record -> VM IP)"
    echo -e "  2. Firewall port 80 açık mı?"
    echo -e "  3. Domain propagation tamamlandı mı? (24 saat sürebilir)"
    sudo systemctl start webrtc-backend
    exit 1
fi

# Sertifikaları kopyala
echo -e "\n${YELLOW}📋 Sertifikalar kopyalanıyor...${NC}"
sudo mkdir -p /opt/webrtc-app/ssl
sudo cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /opt/webrtc-app/ssl/cert.pem
sudo cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem /opt/webrtc-app/ssl/key.pem
sudo chown -R $USER:$USER /opt/webrtc-app/ssl

# Backend'de SSL path'i güncelle
echo -e "\n${YELLOW}⚙️  Backend SSL yapılandırması güncelleniyor...${NC}"
cd /opt/webrtc-app/backend

# server.js'de SSL path'i kontrol et
if grep -q "ssl/cert.pem" server.js; then
    echo -e "${GREEN}✓ SSL path'leri zaten doğru${NC}"
else
    echo -e "${YELLOW}⚠️  server.js dosyasını manuel olarak güncelleyin:${NC}"
    echo -e "   cert: fs.readFileSync('/opt/webrtc-app/ssl/cert.pem')"
    echo -e "   key: fs.readFileSync('/opt/webrtc-app/ssl/key.pem')"
fi

# .env'i güncelle
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|g" .env
sed -i "s|MEDIASOUP_ANNOUNCED_IP=.*|MEDIASOUP_ANNOUNCED_IP=${DOMAIN}|g" .env

# Otomatik yenileme için cron job
echo -e "\n${YELLOW}🔄 Otomatik sertifika yenileme ayarlanıyor...${NC}"
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl restart webrtc-backend'") | crontab -

# Backend'i başlat
echo -e "\n${YELLOW}▶️  Backend başlatılıyor...${NC}"
sudo systemctl start webrtc-backend

# Durum kontrolü
sleep 5
if sudo systemctl is-active --quiet webrtc-backend; then
    echo -e "${GREEN}✓ Backend başarıyla başlatıldı${NC}"
else
    echo -e "${RED}❌ Backend başlatılamadı!${NC}"
    echo -e "${YELLOW}Logları kontrol edin: sudo journalctl -u webrtc-backend -n 50${NC}"
    exit 1
fi

echo -e "\n${BLUE}================================${NC}"
echo -e "${BLUE}  ✅ SSL Setup Tamamlandı!${NC}"
echo -e "${BLUE}================================${NC}"

echo -e "\n${GREEN}Uygulama Adresi:${NC}"
echo -e "${BLUE}https://${DOMAIN}${NC}"

echo -e "\n${GREEN}SSL Sertifikası:${NC}"
echo -e "  Geçerlilik: ${GREEN}90 gün${NC}"
echo -e "  Otomatik yenileme: ${GREEN}Aktif (her gece 03:00)${NC}"

echo -e "\n${YELLOW}📝 Notlar:${NC}"
echo -e "  - Sertifika /etc/letsencrypt/live/${DOMAIN}/ konumunda"
echo -e "  - Frontend'de CORS origin güncellendi"
echo -e "  - Mediasoup announced IP güncellendi"
