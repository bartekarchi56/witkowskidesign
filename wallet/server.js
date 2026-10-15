// Timbro wallet server.
//   POST /apple   (form field "data" = JSON {card, customer, lang}) → .pkpass file
//   POST /google  (same)                                            → redirect to Google Wallet
//   GET  /img/strip?card=&need=&have=  (or the look: color=&ink=&stamp=…) → stamp strip PNG (Google hero image)
//   GET  /img/icon?card=  (or the look)                                  → square stamp PNG (Google program logo)
//   POST /notify  {token, code}  (the till, after a stamp)               → updates the customer's Wallet cards
//   GET  /reminders?key=  (once a day, e.g. cron-job.org)                → sends due "we miss you" reminders
//   GET  /health
import http from 'node:http';
import { settings, appleReady, googleReady, googleProblem } from './settings.js';
import { readPassRequest } from './input.js';
import { buildApplePass } from './apple.js';
import { buildGoogleSaveUrl, updateGoogleObject } from './google.js';
import { pushPassUpdate } from './apns.js';
import { strip, icon } from './images.js';

const MAX_BODY = 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('Request too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parse(req, body) {
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) return JSON.parse(body);
  return JSON.parse(new URLSearchParams(body).get('data') || '{}');
}

// Calls one of the database's public functions (supabase/schema.sql).
async function rpc(name, args) {
  const { url, anonKey } = settings.supabase;
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, 'content-type': 'application/json', 'content-profile': 'timbro' },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error(`${name}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Artwork kept as files on the website (e.g. /assets/demo/sowa/owl-stamp.png) becomes
// data the image code can read. Only the website's own /assets/ folder, cached.
const files = new Map();
async function resolveArt(card) {
  const site = settings.allowedOrigins[0];
  for (const k of ['logo', 'stampImage', 'stripImage']) {
    const v = card[k];
    if (!site || typeof v !== 'string' || !/^\/assets\/[\w\/.-]+\.(png|svg|jpe?g|webp)$/.test(v)) continue;
    if (!files.has(v)) {
      const r = await fetch(site + v);
      if (!r.ok) continue;
      const type = r.headers.get('content-type') || (v.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
      files.set(v, `data:${type.split(';')[0]};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`);
    }
    card[k] = files.get(v);
  }
  return card;
}

// The name drawn as an image by the website (logoAuto) is only sent when a pass
// is first added; keep the latest per card so updated passes look the same.
const art = new Map();

// A database card with its artwork, for Google's image requests (kept a minute).
const looks = new Map();
async function cardById(id) {
  const hit = looks.get(id);
  if (hit && hit.until > Date.now()) return hit.card;
  const live = await rpc('get_card', { p_card_id: id });
  const card = live ? await resolveArt({ ...live, ...(art.get(id) || {}) }) : null;
  looks.set(id, { card, until: Date.now() + 60000 });
  return card;
}

// With the database connected, take the card and stamps from Supabase, using
// the customer's own secret; only the images drawn by the website are kept.
async function trusted(raw) {
  const { url, anonKey } = settings.supabase;
  if (!url) return raw;
  if (!raw?.customer?.secret && settings.demoCards.includes(raw?.card?.id)) return raw;   // a demo card, not in the database
  const r = await fetch(`${url}/rest/v1/rpc/get_my_card`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, 'content-type': 'application/json', 'content-profile': 'timbro' },
    body: JSON.stringify({ p_code: raw?.customer?.id || '', p_secret: raw?.customer?.secret || '' })
  });
  const live = r.ok ? await r.json() : null;
  if (!live) throw new Error('Card not found');
  const sent = raw.card || {};
  if (sent.logoAuto || sent.markImage) art.set(live.card.id, { logoAuto: sent.logoAuto, markImage: sent.markImage });
  return { lang: raw.lang, customer: { ...live.customer, secret: raw.customer.secret }, card: { ...live.card, logoAuto: sent.logoAuto, markImage: sent.markImage } };
}

// GET  /passkit/v1/devices/:device/registrations/:passType?passesUpdatedSince=tag  → which passes changed
// POST /passkit/v1/devices/:device/registrations/:passType/:serial                → the phone saved a pass
// DELETE (same)                                                                     → the phone removed it
// GET  /passkit/v1/passes/:passType/:serial                                        → the latest pass
// POST /passkit/v1/log                                                             → errors reported by phones
// The serial is "<card id>-<customer code>"; the pass's token is the customer's secret.
async function passkit(req, res, url) {
  const parts = url.pathname.split('/').slice(3).map(decodeURIComponent);
  const auth = (req.headers.authorization || '').replace(/^ApplePass\s+/i, '');
  const code = serial => (/-([A-Z0-9]{6})$/i.exec(serial || '') || [])[1] || '';
  if (!settings.supabase.url) return send(res, 503, 'No database');
  if (parts[0] === 'log') { console.log('passkit log', (await readBody(req)).slice(0, 500)); return send(res, 200, ''); }
  const passType = parts[0] === 'devices' ? parts[3] : parts[1];
  if (passType !== settings.apple.passTypeIdentifier) return send(res, 404, '');

  if (parts[0] === 'devices' && parts[2] === 'registrations') {
    const device = parts[1];
    if (req.method === 'GET' && !parts[4]) {
      const since = parseInt(url.searchParams.get('passesUpdatedSince'), 10) || 0;
      const r = await rpc('wallet_updated', { p_device: device, p_since: since });
      return r.serialNumbers.length ? send(res, 200, JSON.stringify(r), { 'content-type': 'application/json' }) : send(res, 204, '');
    }
    const serial = parts[4];
    if (req.method === 'POST') {
      const { pushToken } = JSON.parse(await readBody(req) || '{}');
      const status = await rpc('wallet_register', { p_code: code(serial), p_secret: auth, p_device: device, p_push: String(pushToken || '') });
      return send(res, status, '');
    }
    if (req.method === 'DELETE') {
      return send(res, await rpc('wallet_unregister', { p_code: code(serial), p_secret: auth, p_device: device }), '');
    }
  }
  if (parts[0] === 'passes' && req.method === 'GET') {
    const serial = parts[2];
    const live = await rpc('get_my_card', { p_code: code(serial), p_secret: auth });
    if (!live) return send(res, 401, '');
    const kept = art.get(live.card.id) || {};
    const lang = ['it', 'en', 'pl'].includes(live.card.lang) ? live.card.lang : 'it';
    const data = readPassRequest({ lang, card: await resolveArt({ ...live.card, ...kept }), customer: { ...live.customer, secret: auth } });
    const pkpass = await buildApplePass(data);
    return send(res, 200, pkpass, { 'content-type': 'application/vnd.apple.pkpass', 'last-modified': new Date().toUTCString() });
  }
  return send(res, 404, '');
}

const send = (res, status, body, headers = {}) => { res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers }); res.end(body); };

function originAllowed(req) {
  if (!settings.allowedOrigins.length) return true;
  return settings.allowedOrigins.includes(req.headers.origin || '');
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, settings.publicUrl);
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, JSON.stringify({ ok: true, apple: appleReady(), google: googleReady(), ...(googleReady() ? {} : { googleMissing: googleProblem() }) }), { 'content-type': 'application/json' });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/img/')) {
      const q = Object.fromEntries(url.searchParams);
      const stored = q.card && /^[a-z0-9-]{1,40}$/.test(q.card) && settings.supabase.url ? await cardById(q.card) : null;
      const card = stored || { color: q.color, ink: q.ink, stampsNeeded: q.need, stamp: q.stamp, style: q.style, type: q.type, strip: q.strip };
      const png = url.pathname === '/img/strip'
        ? await strip(card, Math.max(0, parseInt(q.have, 10) || 0), { w: 1032, h: 336 })
        : await icon(card, 660);
      return send(res, 200, png, { 'content-type': 'image/png', 'cache-control': 'public, max-age=300' });
    }

    // ---- Apple's PassKit web service: phones register passes and fetch new versions ----
    if (url.pathname.startsWith('/passkit/v1/')) return await passkit(req, res, url);

    // ---- After a stamp the till asks us to wake the customer's phones ----
    if (url.pathname === '/notify') {
      const cors = { 'access-control-allow-origin': req.headers.origin && originAllowed(req) ? req.headers.origin : 'null', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST' };
      if (req.method === 'OPTIONS') return send(res, 204, '', cors);
      if (req.method !== 'POST' || !originAllowed(req) || !settings.supabase.url || !(appleReady() || googleReady())) return send(res, 403, 'No', cors);
      const { token, code } = JSON.parse(await readBody(req) || '{}');
      const out = {};
      if (appleReady()) {
        // iPhones: an empty push; Wallet then asks /passkit for the new pass.
        const targets = await rpc('wallet_targets', { p_token: String(token || ''), p_code: String(code || '') });
        Object.assign(out, { phones: targets.length, results: await pushPassUpdate(targets) });
      }
      if (googleReady()) {
        // Android: we change the saved card ourselves (the till may only read its own café's cards).
        const live = await rpc('stamper_lookup', { p_token: String(token || ''), p_code: String(code || '') });
        if (live) {
          looks.delete(live.card.id);
          const lang = ['it', 'en', 'pl'].includes(live.card.lang) ? live.card.lang : 'it';
          out.google = await updateGoogleObject(readPassRequest({ lang, card: live.card, customer: live.customer })).catch(e => e.message);
        }
      }
      return send(res, 200, JSON.stringify(out), { ...cors, 'content-type': 'application/json' });
    }

    // ---- Once a day: the café's reminder to customers who haven't been in for a while ----
    if (url.pathname === '/reminders') {
      if (!settings.supabase.url) return send(res, 503, 'No database');
      const due = await rpc('reminders_due', { p_key: url.searchParams.get('key') || req.headers['x-timbro-key'] || '' });
      const out = { reminded: due.length, apple: 0, google: 0 };
      // iPhones: an empty push; the new pass carries the reminder (see currentMessage).
      const tokens = due.flatMap(d => d.pushTokens);
      if (tokens.length && appleReady()) out.apple = (await pushPassUpdate(tokens)).filter(r => r.status === 200).length;
      if (googleReady()) {
        for (let i = 0; i < due.length; i += 10) {
          const st = await Promise.all(due.slice(i, i + 10).map(d => {
            const lang = ['it', 'en', 'pl'].includes(d.card.lang) ? d.card.lang : 'it';
            return updateGoogleObject(readPassRequest({ lang, card: d.card, customer: d.customer })).catch(() => 0);
          }));
          out.google += st.filter(x => x === 200).length;
        }
      }
      return send(res, 200, JSON.stringify(out), { 'content-type': 'application/json' });
    }

    if (req.method === 'POST' && (url.pathname === '/apple' || url.pathname === '/google')) {
      if (!originAllowed(req)) return send(res, 403, 'This site is not allowed to create passes.');
      const got = await trusted(parse(req, await readBody(req)));
      await resolveArt(got.card);
      const data = readPassRequest(got);

      if (url.pathname === '/apple') {
        if (!appleReady()) return send(res, 503, 'Apple Wallet is not set up yet. See wallet/README.md.');
        const pkpass = await buildApplePass(data);
        return send(res, 200, pkpass, {
          'content-type': 'application/vnd.apple.pkpass',
          'content-disposition': `attachment; filename="${data.card.id}.pkpass"`
        });
      }
      if (!googleReady()) return send(res, 503, 'Google Wallet is not set up yet. See wallet/README.md.');
      const live = Boolean(data.customer.secret);
      // Saved before? Google keeps the old object, so bring it up to date too.
      if (live) await updateGoogleObject(data).catch(() => {});
      return send(res, 303, '', { location: buildGoogleSaveUrl(data, req.headers.origin, live) });
    }

    send(res, 404, 'Not found');
  } catch (err) {
    send(res, 400, `Could not create the pass: ${err.message}`);
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(settings.port, () => {
    console.log(`Wallet server on ${settings.publicUrl} (Apple ${appleReady() ? 'ready' : 'not set up'}, Google ${googleReady() ? 'ready' : 'not set up'})`);
  });
}
