import { Platform } from 'react-native';

// User's LAN IP detected: 10.167.155.13
// We will use HTTP (Port 5000) to avoid SSL issues on mobile
const LAN_IP = '10.167.155.13';
const PORT = '5000';

const DEV_API_URL = Platform.OS === 'android'
    ? `http://10.0.2.2:${PORT}` // Android Emulator
    : `http://localhost:${PORT}`; // iOS Simulator

// For Physical Device, use LAN IP
export const API_URL = `http://${LAN_IP}:${PORT}`;

// If you want to use Emulator uncomment below:
// export const API_URL = DEV_API_URL;
