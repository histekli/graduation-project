const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

// Build edilen React uygulamasını serve et
app.use(express.static(path.join(__dirname, '../build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

const options = {
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

https.createServer(options, app).listen(3443, () => {
  console.log('🔒 HTTPS Server running on port 3443');
  console.log('📱 Mobil cihazlar için: https://[IP]:3443');
});
