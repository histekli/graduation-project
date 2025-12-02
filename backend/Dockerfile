FROM node:18-alpine

WORKDIR /app

# Package dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm install --production

# Uygulama dosyalarını kopyala
COPY . .

# Port tanımla
EXPOSE 5000

# Uygulamayı başlat
CMD ["npm", "start"]
