// Расклад Таро на день — HTTP-сервер без внешних зависимостей.
// Отдаёт статику из public/ и JSON-API GET /api/spread.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { SLOTS, ARCANA } = require('./data/tarot');

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

// --- Сидированный ГПСЧ (mulberry32) — расклад дня одинаков в течение суток ---
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Три различные карты из колоды; каждая — в прямом или перевёрнутом положении.
function drawSpread(rand) {
  const pool = ARCANA.slice();
  const picked = [];
  for (let i = 0; i < SLOTS.length; i++) {
    const idx = Math.floor(rand() * pool.length);
    const card = pool.splice(idx, 1)[0];
    picked.push({ ...card, isReversed: rand() < 0.5 });
  }
  return picked;
}

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
