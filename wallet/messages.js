// The café's notification texts on Wallet passes (dashboard → Notifications).
// Defaults and fill rules match assets/js/config.js (messages) and UI.fillMessage
// on the website; keep them in step.
export const DEFAULTS = {
  close: { on: true, left: 1, it: 'Ancora {left} per {reward}! Ti aspettiamo da {business}.', en: 'Just {left} to go for {reward}! See you at {business}.' },
  ready: { on: true, it: '{name}, il tuo premio è pronto: {reward}. Mostra la carta alla cassa.', en: '{name}, your reward is ready: {reward}. Show your card at the till.' },
  remind: { on: true, days: 21, it: 'Ciao {name}! Ancora {left} per {reward}. Passa a trovarci da {business}.', en: 'Hi {name}! Just {left} to go for {reward}. Come and see us at {business}.' },
  near: { on: false, it: 'Sei vicino a {business}: ancora {left} per {reward}.', en: 'You are near {business}: {left} to go for {reward}.' }
};
const PL = {
  close: 'Jeszcze {left} i odbierasz nagrodę: {reward}. {business} czeka na Ciebie!',
  ready: '{name}, Twoja nagroda czeka: {reward}. Pokaż kartę przy kasie.',
  remind: 'Cześć {name}! Jeszcze {left} i odbierasz nagrodę: {reward}. Wpadnij, {business} czeka na Ciebie.',
  near: '{business} jest tuż obok! Jeszcze {left} i odbierasz nagrodę: {reward}.'
};
for (const k of Object.keys(PL)) DEFAULTS[k].pl = PL[k];

// The language a card speaks to a customer: English to visitors browsing in
// English, otherwise the café's own (card.lang).
export const msgLang = (card, lang) => lang === 'en' ? 'en' : ['it', 'en', 'pl'].includes(card.lang) ? card.lang : 'it';
// "1 timbro / 3 timbri", "1 stamp / 3 stamps", "1 pieczątka / 3 pieczątki / 5 pieczątek".
function stampsWord(n, lang) {
  if (lang === 'en') return n === 1 ? 'stamp' : 'stamps';
  if (lang === 'pl') { const d = n % 10, h = n % 100; return n === 1 ? 'pieczątka' : d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? 'pieczątki' : 'pieczątek'; }
  return n === 1 ? 'timbro' : 'timbri';
}

const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const int = (v, lo, hi, d) => Math.max(lo, Math.min(hi, parseInt(v, 10) || d));

// Tidies what a card says about its messages, merged over the defaults.
export function readMessages(raw) {
  const mine = raw && typeof raw === 'object' ? raw : {}, out = {};
  for (const k of Object.keys(DEFAULTS)) {
    const m = mine[k] && typeof mine[k] === 'object' ? mine[k] : {};
    out[k] = {
      on: 'on' in m ? m.on === true || m.on === 'true' : DEFAULTS[k].on,
      it: str(m.it, 140) || DEFAULTS[k].it,
      en: str(m.en, 140) || DEFAULTS[k].en,
      pl: str(m.pl, 140) || DEFAULTS[k].pl
    };
    if (k === 'close') out[k].left = int(m.left, 1, 3, DEFAULTS.close.left);
    if (k === 'remind') out[k].days = int(m.days, 7, 90, DEFAULTS.remind.days);
    if (k === 'near') {
      const lat = Number(m.lat), lng = Number(m.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && m.lat !== '' && m.lng !== '') Object.assign(out[k], { lat, lng });
    }
  }
  return out;
}

// Fills {name} {left} {reward} {business}; {left} carries its noun ("1 timbro", "3 stamps").
export function fill(text, card, { name = '', left = 1, lang = 'it' } = {}) {
  const en = lang === 'en';
  const reward = (en && card.rewardEn) || card.reward || '';
  return String(text || '').replace(/\{(name|left|reward|business)\}/g, (_, k) =>
    k === 'name' ? (String(name).trim().split(/\s+/)[0] || (en ? 'there' : '')) : k === 'left' ? `${left} ${stampsWord(left, lang)}` : k === 'reward' ? reward : card.business || '')
    .replace(/^\s*[,!]\s*/, '').replace(/\s+([!?,.])/g, '$1').replace(/\s{2,}/g, ' ').trim().replace(/^./, c => c.toUpperCase());
}

// The customer was sent the daily reminder since their last visit (reminders_due in schema.sql).
export const reminded = customer => Boolean(customer.remindedAt) && customer.remindedAt >= (customer.lastVisit || customer.joinedAt || 0);

// The message a pass shows right now: an explicit notice from the server, else the
// café's reminder until the next visit, else "reward ready" or "almost there" when they apply.
export function currentMessage(card, customer, lang, notice) {
  if (notice) return str(notice, 140);
  const m = card.messages || readMessages({}), left = card.stampsNeeded - customer.stamps;
  const rule = left > 0 && m.remind.on && reminded(customer) ? m.remind
    : left <= 0 ? (m.ready.on && m.ready) : left <= m.close.left ? (m.close.on && m.close) : null;
  const ml = msgLang(card, lang);
  return rule ? fill(rule[ml], card, { name: customer.name, left, lang: ml }) : '';
}

// iPhone lock screen near the café ("near" switched on and a location saved).
export function nearLocation(card, customer, lang) {
  const n = card.messages && card.messages.near;
  if (!n || !n.on || n.lat == null) return null;
  const left = Math.max(1, card.stampsNeeded - customer.stamps);
  const ml = msgLang(card, lang);
  return { latitude: n.lat, longitude: n.lng, relevantText: fill(n[ml], card, { name: customer.name, left, lang: ml }) };
}
