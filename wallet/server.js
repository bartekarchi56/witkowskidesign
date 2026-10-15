// Timbro wallet server.
//   POST /apple   (form field "data" = JSON {card, customer, lang}) → .pkpass file
//   POST /google  (same)                                            → redirect to Google Wallet
//   GET  /img/strip?icon=&color=&ink=&need=&have=                   → stamp strip PNG (Google hero image)
//   GET  /img/icon?icon=&color=                                     → square logo PNG (Google program logo)
//   GET  /health
import http from 'node:http';
import { settings, appleReady, googleReady } from './settings.js';
import { readPassRequest } from './input.js';
import { buildApplePass } from './apple.js';
import { buildGoogleSaveUrl } from './google.js';
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
      return send(res, 200, JSON.stringify({ ok: true, apple: appleReady(), google: googleReady() }), { 'content-type': 'application/json' });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/img/')) {
      const q = Object.fromEntries(url.searchParams);
      const card = { color: q.color, ink: q.ink, stampsNeeded: q.need, stamp: q.stamp, style: q.style, type: q.type, strip: q.strip };
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
      if (req.method !== 'POST' || !originAllowed(req) || !settings.supabase.url || !appleReady()) return send(res, 403, 'No', cors);
      const { token, code } = JSON.parse(await readBody(req) || '{}');
      const targets = await rpc('wallet_targets', { p_token: String(token || ''), p_code: String(code || '') });
      const results = await pushPassUpdate(targets);
      return send(res, 200, JSON.stringify({ phones: targets.length, results }), { ...cors, 'content-type': 'application/json' });
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
      return send(res, 303, '', { location: buildGoogleSaveUrl(data, req.headers.origin) });
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
