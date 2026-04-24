const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html',
    '.json': 'application/json',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.png':  'image/png',
};

const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    let filePath = urlPath;

    // Route shortcuts
    if (urlPath === '/' || urlPath === '/5min')  filePath = '/dashboard_5m.html';
    if (urlPath === '/15min') filePath = '/dashboard_15m.html';
    if (urlPath === '/1hour') filePath = '/dashboard_1h.html';

    const abs = path.join(ROOT, filePath);

    fs.readFile(abs, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        const ext = path.extname(abs);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
        res.end(data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Dashboard running at: http://localhost:${PORT}`);
    console.log(`   /5min  → 5-Minute Sniper`);
    console.log(`   /15min → 15-Minute Momentum`);
    console.log(`   /1hour → 1-Hour Trend\n`);
});
