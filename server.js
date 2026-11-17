const net = require('net');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production' && false;
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

const cert = fs.readFileSync(path.join(__dirname, 'cert.pem'));
const key = fs.readFileSync(path.join(__dirname, 'key.pem'));

const mimeMap = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

function serveStaticUploads(req, res) {
  if (req.url && req.url.startsWith('/uploads/')) {
    const cleanUrl = req.url.split('?')[0];
    const filePath = path.join(__dirname, 'public', cleanUrl);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000',
      });
      fs.createReadStream(filePath).pipe(res);
      return true;
    }
  }
  return false;
}

app.prepare().then(() => {
  const requestHandler = (req, res) => {
    if (serveStaticUploads(req, res)) return;
    handle(req, res);
  };

  const httpServer = http.createServer(requestHandler);
  const httpsServer = https.createServer({ cert, key }, requestHandler);

  // Dual HTTP + HTTPS Sniffer Server on port 3000
  const server = net.createServer((socket) => {
    socket.once('data', (buffer) => {
      if (buffer[0] === 0x16) {
        // TLS ClientHello -> Route to HTTPS
        httpsServer.emit('connection', socket);
      } else {
        // Plain HTTP -> Route to HTTP
        httpServer.emit('connection', socket);
      }
      socket.unshift(buffer);
    });
  });

  server.listen(3000, () => {
    console.log('> Ready on http://localhost:3000 AND https://localhost:3000');
  });

  // Auto-Scheduler: Check for scheduled listings due for publishing every 15s
  setInterval(() => {
    try {
      const stateFile = path.join(__dirname, '.data', 'ebay_state.json');
      if (fs.existsSync(stateFile)) {
        const raw = fs.readFileSync(stateFile, 'utf8');
        const state = JSON.parse(raw);
        const nowIso = new Date().toISOString();
        const dueListings = (state.listings || []).filter(
          (l) => l.scheduledTime && l.scheduledTime <= nowIso && (l.status === 'SCHEDULED' || l.status === 'DRAFT' || l.hasUnpublishedChanges || !l.ebayListingId)
        );
        if (dueListings.length > 0) {
          console.log(`[Auto-Scheduler] ${dueListings.length} scheduled listings reached go-live time. Triggering auto-publish...`);
          const req = http.request(
            {
              hostname: 'localhost',
              port: 3000,
              path: '/api/ebay/listings/publish-drafts',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            },
            () => {}
          );
          req.on('error', () => {});
          req.write(JSON.stringify({ onlyDue: true }));
          req.end();
        }
      }
    } catch {
      // ignore
    }
  }, 15000);
});
