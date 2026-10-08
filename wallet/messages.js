// The café's notification texts on Wallet passes (dashboard → Notifications).
// Defaults and fill rules match assets/js/config.js (messages) and UI.fillMessage
// on the website; keep them in step.
export const DEFAULTS = {
  close: { on: true, left: 1, it: 'Ancora {left} per {reward}! Ti aspettiamo da {business}.', en: 'Just {left} to go for {reward}! See you at {business}.' },
  ready: { on: true, it: '{name}, il tuo premio è pronto: {reward}. Mostra la carta alla cassa.', en: '{name}, your reward is ready: {reward}. Show your card at the till.' },
  remind: { on: true, days: 21, it: 'Ciao {name}! Ancora {left} per {reward}. Passa a trovarci da {business}.', en: 'Hi {name}! Just {left} to go for {reward}. Come and see us at {business}.' },
  near: { on: false, it: 'Sei vicino a {business}: ancora {left} per {reward}.', en: 'You are near {business}: {left} to go for {reward}.' }
};

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
      en: str(m.en, 140) || DEFAULTS[k].en
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
  const noun = en ? (left === 1 ? 'stamp' : 'stamps') : (left === 1 ? 'timbro' : 'timbri');
  const reward = (en && card.rewardEn) || card.reward || '';
  return String(text || '').replace(/\{(name|left|reward|business)\}/g, (_, k) =>
    k === 'name' ? (name || (en ? 'there' : '')) : k === 'left' ? `${left} ${noun}` : k === 'reward' ? reward : card.business || '')
    .replace(/^\s*[,!]\s*/, '').replace(/\s{2,}/g, ' ').trim().replace(/^./, c => c.toUpperCase());
}

// The message a pass shows right now: an explicit notice from the server
// (e.g. a reminder), else "reward ready" or "almost there" when they apply.
export function currentMessage(card, customer, lang, notice) {
  if (notice) return str(notice, 140);
  const m = card.messages || readMessages({}), left = card.stampsNeeded - customer.stamps;
  const rule = left <= 0 ? (m.ready.on && m.ready) : left <= m.close.left ? (m.close.on && m.close) : null;
  return rule ? fill(rule[lang], card, { name: customer.name, left, lang }) : '';
}

// iPhone lock screen near the café ("near" switched on and a location saved).
export function nearLocation(card, customer, lang) {
  const n = card.messages && card.messages.near;
  if (!n || !n.on || n.lat == null) return null;
  const left = Math.max(1, card.stampsNeeded - customer.stamps);
  return { latitude: n.lat, longitude: n.lng, relevantText: fill(n[lang], card, { name: customer.name, left, lang }) };
}
