'use strict';

const { protocol } = require('electron');
const path = require('path');
const fs = require('fs');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function registerAppProtocol() {
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.replace('app://', '');
    const filePath = path.join(__dirname, '..', 'public', url);
    const ext = path.extname(filePath);
    if (fs.existsSync(filePath)) {
      callback({ path: filePath, mimeType: MIME[ext] || 'application/octet-stream' });
    } else {
      callback({ statusCode: 404 });
    }
  });
}

module.exports = { registerAppProtocol };
