// Логика клиента: получение расклада, переворот карт, вывод расшифровки.
'use strict';

const $ = (sel) => document.querySelector(sel);
const TAROT = window.TAROT;

const els = {
  date: $('#date'),
  startScreen: $('#start-screen'),
  spreadScreen: $('#spread-screen'),
  cards: $('#cards'),
  dealBtn: $('#deal-btn'),
  revealBtn: $('#reveal-btn'),
  shuffleBtn: $('#shuffle-btn'),
};

let spread = null; // { date, slots, cards }

// --- Загрузка расклада ---
// Расклад берём с сервера, если он есть; на статичном хостинге
// (GitHub Pages) считаем локально тем же алгоритмом.
async function getSpread(shuffle) {
  if (!shuffle) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('api/spread', { signal: controller.signal });
      if (res.ok) return res.json();
    } catch (err) {
      // сервера нет — не страшно, посчитаем сами
    } finally {
      clearTimeout(timer);
    }
  }
  const date = TAROT.localDateStr();
  const rand = shuffle ? Math.random : TAROT.mulberry32(TAROT.hashSeed(`tarot-${date}`));
  return { date, slots: TAROT.SLOTS, cards: TAROT.drawSpread(rand) };
}

async function loadSpread(shuffle = false) {
  els.dealBtn.disabled = true;
  els.dealBtn.textContent = 'Карты тасуются…';
  try {
    spread = await getSpread(shuffle);
    showSpread();
  } catch (err) {
    showError('Что-то пошло не так. Обновите страницу и попробуйте снова.');
    console.error(err);
  } finally {
    els.dealBtn.disabled = false;
    els.dealBtn.textContent = 'Открыть расклад дня';
  }
}

// --- Отображение ---
function showSpread() {
  els.startScreen.classList.add('hidden');
  els.spreadScreen.classList.remove('hidden');
  els.revealBtn.classList.remove('hidden');
  els.shuffleBtn.classList.remove('hidden');
  els.cards.innerHTML = '';

  spread.cards.forEach((card, i) => {
    const meaning = card.isReversed ? card.reversed : card.upright;
    const orientation = card.isReversed ? 'перевёрнутая карта' : 'прямая карта';

    const wrap = document.createElement('div');
    wrap.className = 'card-wrap';
    wrap.innerHTML = `
      <div class="slot">${spread.slots[i]}</div>
      <div class="card" role="button" tabindex="0"
           aria-label="Карта: ${spread.slots[i]}. Нажмите, чтобы открыть.">
        <div class="card-inner">
          <div class="face back">
            <div class="back-frame"></div>
            <div class="back-sigil">✦</div>
          </div>
          <div class="face front ${card.isReversed ? 'reversed-card' : ''}">
            <div class="front-inner">
              <div class="numeral">${card.numeral}</div>
              <div class="symbol">${card.symbol}</div>
              <div class="cname">${card.name}</div>
              <div class="orient">${orientation}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="meaning">
        <div class="keywords">${card.keywords.join(' · ')}</div>
        <p class="text">${meaning}</p>
      </div>
    `;

    const cardEl = wrap.querySelector('.card');
    const flip = () => openCard(cardEl);
    cardEl.addEventListener('click', flip);
    cardEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });

    els.cards.appendChild(wrap);
  });
}

function openCard(cardEl) {
  if (cardEl.classList.contains('open')) return;
  cardEl.classList.add('open');
  cardEl.setAttribute('aria-label', 'Карта открыта');
  const meaning = cardEl.closest('.card-wrap').querySelector('.meaning');
  setTimeout(() => meaning.classList.add('visible'), 450);
}

function showError(message) {
  let box = document.querySelector('.error');
  if (!box) {
    box = document.createElement('p');
    box.className = 'error';
    els.spreadScreen.after(box);
  }
  box.textContent = `✧ ${message}`;
}

// --- Утилиты ---
function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// --- События ---
els.dealBtn.addEventListener('click', () => loadSpread(false));
els.shuffleBtn.addEventListener('click', () => loadSpread(true));
els.revealBtn.addEventListener('click', () => {
  document.querySelectorAll('.card:not(.open)').forEach(openCard);
});

els.date.textContent = new Date().toLocaleDateString('ru-RU', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});
