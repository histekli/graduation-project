const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // API isteklerini backend'e yönlendir
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '', // /api prefix'ini kaldır
      },
      logLevel: 'debug',
    })
  );

  // Socket.IO isteklerini backend'e yönlendir
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      ws: true, // WebSocket desteği
      logLevel: 'debug',
      secure: false,
      timeout: 30000,
      proxyTimeout: 30000,
    })
  );
};
