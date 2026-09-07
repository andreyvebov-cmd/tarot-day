// Публикует «Расклад Таро на день» в Telegram-канал.
// Секреты в переменных окружения: TG_BOT_TOKEN, TG_CHANNEL_ID.
// Режимы: TG_TEST=1 — только показать текст; node telegram.js --chats —
// показать чаты, которые видит бот (для поиска ID приватного канала).
'use strict';

const { SLOTS, drawSpread, hashSeed, mulberry32, localDateStr } = require('./data/tarot');

const SITE_URL = 'https://andreyvebov-cmd.github.io/tarot-day/';
const SLOT_ICONS = ['🌅', '☀️', '🌙'];

function formatMessage(spread) {
  const [y, m, d] = spread.date.split('-').map(Number);
  const dateStr = new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const lines = [`✦ <b>Таро на день</b> — ${dateStr}`, ''];
  spread.cards.forEach((card, i) => {
    const orient = card.isReversed ? 'перевёрнутая' : 'прямая';
    const meaning = card.isReversed ? card.reversed : card.upright;
    lines.push(`${SLOT_ICONS[i]} <b>${SLOTS[i]}: ${card.numeral} ${card.name}</b> (${orient})`);
    lines.push(`<i>${card.keywords.join(' · ')}</i>`);
    lines.push(meaning);
    lines.push('');
  });
  lines.push(`Переверните карты сами: ${SITE_URL}`);
  return lines.join('\n');
}

async function telegramApi(token, method, params) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram API (${method}): ${data.error_code} ${data.description}`);
  return data.result;
}

async function main() {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHANNEL_ID;

  if (process.argv.includes('--chats')) {
    if (!token) throw new Error('Задайте TG_BOT_TOKEN');
    const updates = await telegramApi(token, 'getUpdates', { limit: 100 });
    const chats = new Map();
    for (const u of updates) {
      const c = u.channel_post?.chat || u.message?.chat;
      if (c) chats.set(c.id, `${c.title || c.username || c.id} → id: ${c.id}`);
    }
    console.log(chats.size ? [...chats.values()].join('\n')
      : 'Пока пусто. Перешлите боту любое сообщение из канала и повторите.');
    return;
  }

  const date = localDateStr();
  const rand = mulberry32(hashSeed(`tarot-${date}`));
  const spread = { date, slots: SLOTS, cards: drawSpread(rand) };
  const text = formatMessage(spread);

  if (process.env.TG_TEST) {
    console.log(text);
    return;
  }

  if (!token || !chatId) {
    throw new Error('Не заданы секреты репозитория: TG_BOT_TOKEN и/или TG_CHANNEL_ID ' +
      '(Settings → Secrets and variables → Actions → New repository secret).');
  }

  const sent = await telegramApi(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: false }
  });
  console.log('Опубликовано в', JSON.stringify(sent.chat.title || sent.chat.username),
    '| message_id:', sent.message_id);
}

main().catch((e) => {
  console.error('Ошибка:', e.message);
  process.exit(1);
});
