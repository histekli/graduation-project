import { Platform } from 'react-native';

// PROD IP (VPS)
const SERVER_IP = '46.224.207.43';

// Use HTTPS for production IP
// Note: Since we are using self-signed certs or direct IP, verify if https works without valid cert.
// The Dockerfile exposes port 3443 for HTTPS.
// If you are using Nginx reverse proxy with LetsEncrypt on port 443, use standard port.
// For now, based on your docker-compose.prod.yml: 
// ports: - "443:3443" -> Means external 443 maps to internal 3443.

export const API_URL = `https://${SERVER_IP}`;

// Fallback for local development if needed
// export const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
