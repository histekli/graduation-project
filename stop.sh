#!/bin/bash

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Servisler Durduruluyor${NC}"
echo -e "${BLUE}================================${NC}"

# Node.js process'lerini durdur
echo -e "\n${YELLOW}1. Backend ve Frontend durduruluyor...${NC}"

# Process'leri topla
BACKEND_PIDS=$(pgrep -f "node.*server.js" 2>/dev/null)
FRONTEND_PIDS=$(pgrep -f "react-scripts" 2>/dev/null)
START_PIDS=$(pgrep -f "node.*start" 2>/dev/null)

# Tüm PID'leri birleştir
ALL_PIDS="$BACKEND_PIDS $FRONTEND_PIDS $START_PIDS"

if [ -z "$ALL_PIDS" ] || [ "$ALL_PIDS" = "  " ]; then
    echo -e "${GREEN}✓ Hiç çalışan servis bulunamadı${NC}"
else
    echo -e "${YELLOW}   Process'ler durduruluyor...${NC}"
    
    # Önce nazikçe durdur
    for pid in $ALL_PIDS; do
        if [ ! -z "$pid" ]; then
            kill $pid 2>/dev/null
        fi
    done
    
    sleep 2
    
    # Hala çalışanları zorla durdur (sudo gerekebilir)
    REMAINING_PIDS=$(pgrep -f "node.*(server\.js|react-scripts|start)" 2>/dev/null)
    if [ ! -z "$REMAINING_PIDS" ]; then
        echo -e "${YELLOW}   Bazı process'ler hala çalışıyor, zorla durduruluyor (sudo gerekebilir)...${NC}"
        for pid in $REMAINING_PIDS; do
            if [ ! -z "$pid" ]; then
                sudo kill -9 $pid 2>/dev/null
            fi
        done
    fi
    
    echo -e "${GREEN}✓ Node.js servisleri durduruldu${NC}"
fi

# Docker servislerini durdur (opsiyonel)
read -p "Docker servislerini de durdurmak istiyor musunuz? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${YELLOW}2. Docker servisleri durduruluyor...${NC}"
    docker compose down
    echo -e "${GREEN}✓ Docker servisleri durduruldu${NC}"
else
    echo -e "\n${BLUE}Docker servisleri çalışmaya devam ediyor${NC}"
fi

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}  Tüm Servisler Durduruldu!${NC}"
echo -e "${GREEN}================================${NC}\n"
