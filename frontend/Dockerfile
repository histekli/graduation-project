FROM node:18-alpine

WORKDIR /app

# OpenSSL yükle
RUN apk add --no-cache openssl

# Package dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm ci

# Uygulama dosyalarını kopyala
COPY . .

# Port tanımla
EXPOSE 3000
EXPOSE 3443

# HTTPS server scripti için gerekli paketleri yükle
RUN npm install express

# Development sunucusunu başlat
CMD ["node", "start-server.js"]
