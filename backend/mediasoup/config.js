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

  // Router settings (Optimized for Low-Latency Voice Communication)
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,           // 48kHz = Full-band (best quality)
        channels: 2,                 // Stereo for spatial audio
        parameters: {
          // LATENCY OPTIMIZATION
          ptime: 20,                // 20ms frame = low latency + good quality balance

          // QUALITY OPTIMIZATION (Voice-optimized)
          maxaveragebitrate: 32000, // 32kbps total (16kbps per channel) - excellent for voice
          useinbandfec: 1,          // Forward Error Correction - critical for mobile networks
          usedtx: 0,                // Disable DTX - no startup delay when speaking

          // STEREO SETTINGS
          stereo: 1,                // Enable stereo
          'sprop-stereo': 1,        // Signal stereo capability to receiver

          // OPUS-SPECIFIC
          cbr: 0,                   // VBR (Variable Bitrate) for better quality
          'x-google-start-bitrate': 32, // Hint to start at 32kbps
        },
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
