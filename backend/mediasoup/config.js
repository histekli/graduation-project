/**
 * Mediasoup Configuration
 * SFU için sunucu tarafı ayarları
 */

const os = require('os');

module.exports = {
  // Worker settings
  worker: {
    rtcMinPort: process.env.MEDIASOUP_MIN_PORT ? parseInt(process.env.MEDIASOUP_MIN_PORT) : 40000,
    rtcMaxPort: process.env.MEDIASOUP_MAX_PORT ? parseInt(process.env.MEDIASOUP_MAX_PORT) : 40200,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  },

  // Router settings (Audio only)
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
    ],
  },

  // WebRTC Transport settings
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || getLocalIp(),
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 600000,
  },
};

/**
 * Get local IP address
 */
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}
