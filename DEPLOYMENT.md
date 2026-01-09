# Deployment Guide

## Prerequisites
- Docker installed (for local testing)
- GitHub account
- Account on a cloud provider (Fly.io recommended for WebRTC, or DigitalOcean/AWS)

## Option 1: Fly.io (Recommended for WebRTC)
Fly.io is recommended because it supports UDP ports and public IPs required for WebRTC (Mediasoup). Standard PaaS like Railway/Render/Heroku often block UDP or allow only one HTTP port, which breaks Voice Chat.

1. **Install flyctl**: [https://fly.io/docs/hands-on/install-flyctl/](https://fly.io/docs/hands-on/install-flyctl/)
2. **Login**: `fly auth login`
3. **Launch**:
   ```bash
   fly launch
   ```
   - Select valid defaults.
   - It will detect the `Dockerfile`.
4. **Configure UDP Ports** in `fly.toml`:
   You need to expose the UDP port range used by Mediasoup.
   ```toml
   [[services]]
     protocol = "udp"
     internal_port = 2000
     ports = [{ port = "2000-2020" }]
   ```
   *Note: Using large port ranges on Fly.io might require dedicated IP.*

5. **Set Environment Variables**:
   ```bash
   fly secrets set MONGODB_URI="mongodb+srv://..."
   fly secrets set JWT_SECRET="your_secret"
   fly secrets set MEDIASOUP_MIN_PORT=2000
   fly secrets set MEDIASOUP_MAX_PORT=2020
   fly secrets set MEDIASOUP_LISTEN_IP=0.0.0.0
   # For Announced IP, Fly.io injects FLY_PUBLIC_IP usually, or you handle it in config
   ```

## Option 2: Docker on VPS (DigitalOcean / AWS / Google Cloud) - **Recommended & Simplest**
This is the most stable method because it gives you full control over UDP ports required for Voice Chat.

1. **Rent a VPS**: Get an Ubuntu 20.04/22.04 server (e.g., DigitalOcean Droplet, Hetzner, AWS EC2).
2. **Install Docker**:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```
3. **Clone Your Repository**:
   ```bash
   git clone <your-repo-url>
   cd <your-repo-folder>
   ```
4. **Deploy with One Command**:
   Replace `YOUR_SERVER_IP` with your actual server IP address.
   ```bash
   export PUBLIC_IP=YOUR_SERVER_IP
   docker compose -f docker-compose.prod.yml up -d --build
   ```
5. **Done!** 
   - Your app will be running at `https://YOUR_SERVER_IP` (Accept the self-signed cert warning, or setup Nginx+LetsEncrypt for valid SSL).


## Option 3: Railway (Limited Support)
Railway is great but might fail for Audio transport due to UDP restrictions.
1. Push to GitHub.
2. Connect Repo in Railway.
3. Add MongoDB and Redis plugins.
4. Set variables: `JWT_SECRET`, `MEDIASOUP...`
5. **Warning**: Voice might not connect.

## Mobile App Deployment
1. **Navigate to `mobile` folder**.
2. **Install EAS CLI**: `npm install -g eas-cli`
3. **Login**: `eas login`
4. **Configure Build**: `eas build:configure`
5. **Build for Android**:
   ```bash
   eas build --platform android --profile preview
   ```
   This will generate an APK (if configured) or AAB for store.
