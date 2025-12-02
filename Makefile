# GeoTalk CarVoice - Janus SFU Makefile
# Hızlı kurulum ve yönetim komutları

.PHONY: help install start stop restart logs clean build test

# Varsayılan hedef
.DEFAULT_GOAL := help

# Renkli çıktı
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m # No Color

help: ## Bu yardım mesajını göster
	@echo "$(GREEN)GeoTalk CarVoice - Janus SFU$(NC)"
	@echo "$(GREEN)=============================$(NC)"
	@echo ""
	@echo "$(YELLOW)Kullanılabilir komutlar:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'

install: ## Projeyi kur ve environment dosyalarını oluştur
	@echo "$(YELLOW)📦 Proje kuruluyor...$(NC)"
	@./start-janus.sh

start: ## Tüm servisleri başlat
	@echo "$(YELLOW)🚀 Servisler başlatılıyor...$(NC)"
	@./start-janus.sh

stop: ## Tüm servisleri durdur
	@echo "$(YELLOW)🛑 Servisler durduruluyor...$(NC)"
	@docker-compose down
	@echo "$(GREEN)✅ Servisler durduruldu$(NC)"

restart: ## Tüm servisleri yeniden başlat
	@echo "$(YELLOW)🔄 Servisler yeniden başlatılıyor...$(NC)"
	@docker-compose restart
	@echo "$(GREEN)✅ Servisler yeniden başlatıldı$(NC)"

restart-janus: ## Sadece Janus'ı yeniden başlat
	@echo "$(YELLOW)🎬 Janus yeniden başlatılıyor...$(NC)"
	@docker-compose restart janus
	@echo "$(GREEN)✅ Janus yeniden başlatıldı$(NC)"

restart-backend: ## Sadece backend'i yeniden başlat
	@echo "$(YELLOW)🔧 Backend yeniden başlatılıyor...$(NC)"
	@docker-compose restart backend
	@echo "$(GREEN)✅ Backend yeniden başlatıldı$(NC)"

restart-frontend: ## Sadece frontend'i yeniden başlat
	@echo "$(YELLOW)🎨 Frontend yeniden başlatılıyor...$(NC)"
	@docker-compose restart frontend
	@echo "$(GREEN)✅ Frontend yeniden başlatıldı$(NC)"

logs: ## Tüm logları göster
	@docker-compose logs -f

logs-janus: ## Janus loglarını göster
	@docker-compose logs -f janus

logs-backend: ## Backend loglarını göster
	@docker-compose logs -f backend

logs-frontend: ## Frontend loglarını göster
	@docker-compose logs -f frontend

logs-coturn: ## Coturn loglarını göster
	@docker-compose logs -f coturn

status: ## Servislerin durumunu göster
	@echo "$(YELLOW)📊 Servis durumları:$(NC)"
	@docker-compose ps

build: ## Docker image'larını yeniden build et
	@echo "$(YELLOW)🔨 Docker image'ları build ediliyor...$(NC)"
	@docker-compose build --no-cache
	@echo "$(GREEN)✅ Build tamamlandı$(NC)"

clean: ## Tüm container'ları, volume'leri ve image'ları temizle
	@echo "$(RED)🧹 Tüm veriler temizleniyor...$(NC)"
	@read -p "Emin misiniz? Tüm veriler silinecek! [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		docker system prune -af; \
		echo "$(GREEN)✅ Temizlik tamamlandı$(NC)"; \
	else \
		echo "$(YELLOW)İptal edildi$(NC)"; \
	fi

clean-volumes: ## Sadece volume'leri temizle (veritabanı verilerini sil)
	@echo "$(RED)🗑️  Volume'ler temizleniyor...$(NC)"
	@read -p "Emin misiniz? MongoDB verileri silinecek! [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		echo "$(GREEN)✅ Volume'ler temizlendi$(NC)"; \
	else \
		echo "$(YELLOW)İptal edildi$(NC)"; \
	fi

dev-backend: ## Backend'i development modunda çalıştır (local)
	@echo "$(YELLOW)🔧 Backend development modu başlatılıyor...$(NC)"
	@cd backend && npm install && npm run dev

dev-frontend: ## Frontend'i development modunda çalıştır (local)
	@echo "$(YELLOW)🎨 Frontend development modu başlatılıyor...$(NC)"
	@cd frontend && npm install && npm start

test-janus: ## Janus bağlantısını test et
	@echo "$(YELLOW)🧪 Janus bağlantısı test ediliyor...$(NC)"
	@curl -s http://localhost:8088/janus/info | jq . || echo "$(RED)❌ Janus'a erişilemiyor$(NC)"

test-backend: ## Backend health check
	@echo "$(YELLOW)🧪 Backend test ediliyor...$(NC)"
	@curl -s http://localhost:5000/health | jq . || echo "$(RED)❌ Backend'e erişilemiyor$(NC)"

shell-backend: ## Backend container'a bağlan
	@docker-compose exec backend /bin/sh

shell-janus: ## Janus container'a bağlan
	@docker-compose exec janus /bin/bash

mongo-shell: ## MongoDB shell'e bağlan
	@docker-compose exec db mongosh carvoice

backup-db: ## MongoDB backup al
	@echo "$(YELLOW)💾 MongoDB backup alınıyor...$(NC)"
	@docker-compose exec -T db mongodump --db=carvoice --archive > backup_$(shell date +%Y%m%d_%H%M%S).dump
	@echo "$(GREEN)✅ Backup tamamlandı: backup_$(shell date +%Y%m%d_%H%M%S).dump$(NC)"

restore-db: ## MongoDB backup'ı geri yükle (Usage: make restore-db FILE=backup.dump)
	@echo "$(YELLOW)📥 MongoDB backup geri yükleniyor...$(NC)"
	@docker-compose exec -T db mongorestore --db=carvoice --archive < $(FILE)
	@echo "$(GREEN)✅ Restore tamamlandı$(NC)"

info: ## Sistem bilgilerini göster
	@echo "$(GREEN)=============================$(NC)"
	@echo "$(GREEN)GeoTalk CarVoice - Sistem Bilgileri$(NC)"
	@echo "$(GREEN)=============================$(NC)"
	@echo ""
	@echo "$(YELLOW)🌐 Network:$(NC)"
	@echo "  Host IP: $$(ip route get 1 | awk '{print $$7;exit}' || echo 'localhost')"
	@echo ""
	@echo "$(YELLOW)📦 Docker:$(NC)"
	@echo "  Docker version: $$(docker --version)"
	@echo "  Docker Compose version: $$(docker-compose --version)"
	@echo ""
	@echo "$(YELLOW)🔗 Servis URL'leri:$(NC)"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend: http://localhost:5000"
	@echo "  Janus WS: ws://localhost:8188"
	@echo "  Janus HTTP: http://localhost:8088"
	@echo ""

docs: ## Dokümantasyonu göster
	@cat README_JANUS.md

update: ## Projeyi güncelle (git pull + rebuild)
	@echo "$(YELLOW)🔄 Proje güncelleniyor...$(NC)"
	@git pull
	@docker-compose build
	@docker-compose up -d
	@echo "$(GREEN)✅ Proje güncellendi$(NC)"

# Hızlı erişim kısayolları
up: start ## Alias for start
down: stop ## Alias for stop
ps: status ## Alias for status
log: logs ## Alias for logs