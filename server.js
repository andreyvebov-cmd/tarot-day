// Расклад Таро на день — HTTP-сервер без внешних зависимостей.
// Отдаёт статику из public/ и JSON-API GET /api/spread.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { SLOTS, drawSpread, hashSeed, mulberry32, localDateStr } = require('./data/tarot');

const BASE_PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/spread') {
    const date = localDateStr();
    // По умолчанию — сид из даты (расклад дня); ?shuffle=1 — случайный расклад.
    const rand = url.searchParams.get('shuffle')
      ? Math.random
      : mulberry32(hashSeed(`tarot-${date}`));
    sendJson(res, 200, { date, slots: SLOTS, cards: drawSpread(rand) });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  // Общий модуль данных для браузера (на статике его кладёт workflow).
  if (url.pathname === '/tarot-data.js') {
    fs.readFile(path.join(__dirname, 'data', 'tarot.js'), (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  serveStatic(req, res, decodeURIComponent(url.pathname));
});

// Запуск: основной порт, при занятости — следующий свободный.
function listen(port, attemptsLeft) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
    } else {
      console.error('Не удалось запустить сервер:', err.message);
      process.exit(1);
    }
  });
  server.listen(port, () => {
    console.log(`✦ Расклад Таро на день: http://localhost:${port}`);
  });
}

listen(BASE_PORT, 5);
