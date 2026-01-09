#!/bin/bash

# Google Cloud Platform Deployment Script
# WebRTC Voice Chat Application

set -e

echo "🚀 Google Cloud Platform Deployment başlatılıyor..."

# Renkli çıktı
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Değişkenler (Kullanıcı tarafından doldurulacak)
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
VM_NAME="${VM_NAME:-webrtc-voice-chat}"
ZONE="${GCP_ZONE:-europe-west1-b}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-medium}"
DISK_SIZE="${DISK_SIZE:-30GB}"
PUBLIC_IP_NAME="${PUBLIC_IP_NAME:-webrtc-static-ip}"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  GCP Deployment Configuration${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "Project ID: ${GREEN}${PROJECT_ID}${NC}"
echo -e "VM Name: ${GREEN}${VM_NAME}${NC}"
echo -e "Zone: ${GREEN}${ZONE}${NC}"
echo -e "Machine Type: ${GREEN}${MACHINE_TYPE}${NC}"
echo -e "Disk Size: ${GREEN}${DISK_SIZE}${NC}"

# 1. GCP CLI kurulu mu kontrol et
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI kurulu değil!${NC}"
    echo -e "${YELLOW}Kurulum: https://cloud.google.com/sdk/docs/install${NC}"
    exit 1
fi

echo -e "${GREEN}✓ gcloud CLI kurulu${NC}"

# 2. Proje seçimi
echo -e "\n${YELLOW}📋 GCP Projesini ayarlıyorum...${NC}"
gcloud config set project ${PROJECT_ID}

# 3. API'leri etkinleştir
echo -e "\n${YELLOW}🔌 Gerekli API'leri etkinleştiriyorum...${NC}"
gcloud services enable compute.googleapis.com
gcloud services enable dns.googleapis.com
gcloud services enable certificatemanager.googleapis.com

# 4. Statik IP adresi oluştur (varsa atla)
echo -e "\n${YELLOW}🌐 Statik IP adresi oluşturuluyor...${NC}"
if gcloud compute addresses describe ${PUBLIC_IP_NAME} --region=${ZONE%-*} &> /dev/null; then
    echo -e "${GREEN}✓ Statik IP zaten mevcut${NC}"
    EXTERNAL_IP=$(gcloud compute addresses describe ${PUBLIC_IP_NAME} --region=${ZONE%-*} --format="get(address)")
else
    gcloud compute addresses create ${PUBLIC_IP_NAME} --region=${ZONE%-*}
    EXTERNAL_IP=$(gcloud compute addresses describe ${PUBLIC_IP_NAME} --region=${ZONE%-*} --format="get(address)")
fi

echo -e "${GREEN}✓ Statik IP: ${EXTERNAL_IP}${NC}"

# 5. Firewall kuralları oluştur
echo -e "\n${YELLOW}🔥 Firewall kuralları oluşturuluyor...${NC}"

# HTTPS/HTTP
if ! gcloud compute firewall-rules describe allow-https-http &> /dev/null; then
    gcloud compute firewall-rules create allow-https-http \
        --allow tcp:80,tcp:443 \
        --source-ranges 0.0.0.0/0 \
        --target-tags webrtc-server \
        --description "Allow HTTPS and HTTP traffic"
    echo -e "${GREEN}✓ HTTP/HTTPS firewall kuralı oluşturuldu${NC}"
else
    echo -e "${GREEN}✓ HTTP/HTTPS firewall kuralı zaten mevcut${NC}"
fi

# Mediasoup UDP ports
if ! gcloud compute firewall-rules describe allow-mediasoup-udp &> /dev/null; then
    gcloud compute firewall-rules create allow-mediasoup-udp \
        --allow udp:40000-49999 \
        --source-ranges 0.0.0.0/0 \
        --target-tags webrtc-server \
        --description "Allow Mediasoup WebRTC UDP ports"
    echo -e "${GREEN}✓ Mediasoup UDP firewall kuralı oluşturuldu${NC}"
else
    echo -e "${GREEN}✓ Mediasoup UDP firewall kuralı zaten mevcut${NC}"
fi

# TURN server
if ! gcloud compute firewall-rules describe allow-turn &> /dev/null; then
    gcloud compute firewall-rules create allow-turn \
        --allow tcp:3478,udp:3478,tcp:5349,udp:49160-49200 \
        --source-ranges 0.0.0.0/0 \
        --target-tags webrtc-server \
        --description "Allow TURN server ports"
    echo -e "${GREEN}✓ TURN firewall kuralı oluşturuldu${NC}"
else
    echo -e "${GREEN}✓ TURN firewall kuralı zaten mevcut${NC}"
fi

# 6. VM oluştur
echo -e "\n${YELLOW}💻 Compute Engine VM oluşturuluyor...${NC}"
if gcloud compute instances describe ${VM_NAME} --zone=${ZONE} &> /dev/null; then
    echo -e "${YELLOW}⚠ VM zaten mevcut. Yeniden oluşturmak için önce silin.${NC}"
    read -p "VM'yi silip yeniden oluşturmak ister misiniz? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gcloud compute instances delete ${VM_NAME} --zone=${ZONE} --quiet
    else
        echo -e "${BLUE}Mevcut VM kullanılıyor...${NC}"
        exit 0
    fi
fi

gcloud compute instances create ${VM_NAME} \
    --zone=${ZONE} \
    --machine-type=${MACHINE_TYPE} \
    --boot-disk-size=${DISK_SIZE} \
    --boot-disk-type=pd-standard \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --tags=webrtc-server \
    --address=${PUBLIC_IP_NAME} \
    --metadata=startup-script='#!/bin/bash
        # Update system
        apt-get update
        apt-get upgrade -y
        
        # Install Docker
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        
        # Install Docker Compose
        apt-get install -y docker-compose
        
        # Install Git
        apt-get install -y git
        
        # Create app directory
        mkdir -p /opt/webrtc-app
        chown -R $USER:$USER /opt/webrtc-app
    '

echo -e "${GREEN}✓ VM oluşturuldu: ${VM_NAME}${NC}"
echo -e "${GREEN}✓ Public IP: ${EXTERNAL_IP}${NC}"

# 7. Sonraki adımlar
echo -e "\n${BLUE}================================${NC}"
echo -e "${BLUE}  ✅ GCP Setup Tamamlandı!${NC}"
echo -e "${BLUE}================================${NC}"

echo -e "\n${YELLOW}📝 Sonraki Adımlar:${NC}"
echo -e "1. VM'ye bağlan:"
echo -e "   ${GREEN}gcloud compute ssh ${VM_NAME} --zone=${ZONE}${NC}"
echo -e ""
echo -e "2. Projeyi klonla ve deploy et:"
echo -e "   ${GREEN}./deploy/deploy-to-vm.sh${NC}"
echo -e ""
echo -e "3. MongoDB Atlas kurulumu:"
echo -e "   ${GREEN}https://www.mongodb.com/cloud/atlas${NC}"
echo -e "   - Ücretsiz tier seç"
echo -e "   - Network Access: ${EXTERNAL_IP} ekle"
echo -e "   - Connection string'i kopyala"
echo -e ""
echo -e "4. Let's Encrypt SSL kurulumu:"
echo -e "   ${GREEN}./deploy/setup-ssl.sh${NC}"
echo -e ""
echo -e "${BLUE}Public IP: ${EXTERNAL_IP}${NC}"
echo -e "${YELLOW}Bu IP'yi domain'inizle eşleştirin veya doğrudan kullanın${NC}"
