const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4321;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); res.end(); return; }
  const allowed = urlPath === '/' || urlPath === '/index.html' ||
    (/^\/(assets|frames)\//.test(urlPath) && /\.(css|js|svg|avif|jpg|jpeg|png|webp|woff2?|otf|ttf|mp4|webm)$/i.test(urlPath));
  if (!allowed || urlPath.split('/').includes('..')) { res.writeHead(404); res.end('404 Not Found'); return; }
  let filePath = path.join(ROOT, urlPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  } else if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const headers = { 'Content-Type': contentType };

  // Edge Early Preload Link header on homepage
  if (urlPath === '/' || urlPath === '/index.html') {
    headers['Link'] = '</frames/hero60/mobile-poster.webp>; rel=preload; as=image; type=image/webp; media="(max-width: 767px)"; fetchpriority=high, </frames/hero60/poster.webp>; rel=preload; as=image; type=image/webp; media="(min-width: 768px)"; fetchpriority=high';
  }

  // Immutable caching for frame sequences
  if (urlPath.startsWith('/frames/')) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  }

  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`EverHome server running at http://localhost:${PORT}`);
});
