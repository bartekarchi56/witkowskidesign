/*
 * Online orders: Wolt, Uber Eats, Glovo and Deliveroo, next to the card's own numbers in Results.
 * The platforms don't open their order data to other apps, so the café downloads its order
 * report (CSV or Excel) from each partner portal and uploads it here. The file is read in the
 * browser; only date, amount, currency and order number of each order are kept (no customer data).
 *
 *   ONLINE.read(file)                 → { headers, rows, platform, map, currency } (map: guessed columns)
 *   ONLINE.parse(read, map, platform) → { orders, skipped, bad }
 *   ONLINE.list(cardId) / .save(cardId, orders) / .clear(cardId, platform)   (database, or this browser in demo)
 *   ONLINE.compute(orders, { days })  → numbers and series for the chosen period
 *   ONLINE.sample(card, now)          → example orders for demos
 * An order: { p: platform, id, t: time (ms), v: amount, c: currency }.
 */
(function () {
  const DAY = 864e5;
  const PLATFORMS = {
    wolt: { name: 'Wolt', color: '#009DE0' },
    ubereats: { name: 'Uber Eats', color: '#06C167' },
    glovo: { name: 'Glovo', color: '#FFC244' },
    deliveroo: { name: 'Deliveroo', color: '#00CCBC' }
  };

  // ---------- reading the file ----------
  const plain = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLowerCase().trim();

  function csvRows(text) {
    text = text.replace(/^\uFEFF/, '');
    const first = text.split(/\r?\n/).find(l => l.trim()) || '';
    const delim = [';', ',', '\t', '|'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  let xlsxLib = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return xlsxLib = xlsxLib || new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/xlsx.core.min.js', document.querySelector('script[src*="online.js"]').src).href;
      s.onload = () => ok(window.XLSX); s.onerror = () => { xlsxLib = null; no(new Error('xlsx')); };
      document.head.appendChild(s);
    });
  }

  async function tableOf(file) {
    if (/\.(xlsx|xlsm|xls|ods)$/i.test(file.name)) {
      const X = await loadXlsx();
      const wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      // The sheet with the most rows (reports often start with a summary sheet).
      const sheets = wb.SheetNames.map(n => X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }));
      return sheets.sort((a, b) => b.length - a.length)[0] || [];
    }
    return csvRows(await file.text());
  }

  // Header words in the platforms' languages (IT, EN, PL, ES, DE, FR, PT).
  const WORDS = {
    id: /(order|zamowien|ordine|pedido|bestell|commande|encomenda).*(id|nr|no|number|numer|numero|code|kod|codice|codigo|#)|^(id|order|nr|#)$|^(order|delivery) ?id|^id (zamowienia|ordine|pedido)|(^|\s)(nr|numer|numero|number|no|id|codice|codigo|code|kod)\W*(zamowienia|ordine|pedido|order|commande|bestellung)|reference|referencja|riferimento/,
    date: /date|data|datum|fecha|czas|time|hora|ora|godzina|placed|created|utworzon|creat|zeit|heure|dia/,
    time: /(^|\s)(time|godzina|ora|hora|zeit|heure|czas)$/,
    total: /total|gross|brutto|lordo|bruto|sales|sprzedaz|vendit|venta|umsatz|value|wartosc|valore|valor|amount|kwota|importe|importo|betrag|montant|subtotal|price|cena|prezzo|precio|basket|koszyk|suma|sum/,
    status: /status|stato|estado|state|stan/,
    currency: /^(currency|waluta|valuta|moneda|wahrung|devise|moeda)$/
  };
  // Amount columns that are not what the customer paid for the food.
  const NOT_TOTAL = /fee|oplat|commission|prowizj|commission|provision|tax|vat|iva|mwst|tva|tip|napiw|mancia|propina|discount|rabat|sconto|descuento|promo|refund|zwrot|rimbors|payout|wyplat|netto|net |net$|delivery|dostaw|consegna|entrega|adjust|korekt|count|ilosc|quantity|\bid\b/;
  const CANCELLED = /cancel|reject|refus|declin|fail|unfulfil|anul|odrzuc|niezreal|annull|rifiut|rechaz|storn|abgelehnt|zwrot|refund|rimbors|reembols|rembours|void/;

  const num = v => {
    if (typeof v === 'number') return v;
    let s = String(v ?? '').replace(/[^\d,.\-]/g, '');
    if (!/\d/.test(s)) return NaN;
    const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
    if (c > d) s = s.replace(/\./g, '').replace(',', '.');            // 1.234,56 or 12,50
    else s = s.replace(/,/g, '');                                      // 1,234.56
    return Number(s);
  };
  function when(v, timeCell) {
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number' && v > 20000 && v < 80000) return Math.round((v - 25569) * DAY + new Date().getTimezoneOffset() * 6e4);  // Excel day number
    const s = String(v ?? '').trim() + (timeCell != null && String(timeCell).trim() ? ' ' + String(timeCell).trim() : '');
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?(\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?/);
    if (m) {
      if (m[8]) return Date.parse(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T${(m[4] || '0').padStart(2, '0')}:${m[5] || '00'}:${m[6] || '00'}${m[8] === 'Z' ? 'Z' : m[8].replace(/(\d{2})(\d{2})$/, '$1:$2')}`);
      return new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
    }
    m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4}),?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i);
    if (m) {
      let [a, b] = [+m[1], +m[2]];
      if (b > 12 && a <= 12) [a, b] = [b, a];                          // month first (US)
      let h = +(m[4] || 0); if (m[7]) h = h % 12 + (/pm/i.test(m[7]) ? 12 : 0);
      const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
      return new Date(y, b - 1, a, h, +(m[5] || 0), +(m[6] || 0)).getTime();
    }
    const t = Date.parse(s);
    return isNaN(t) ? NaN : t;
  }

  // Guess which columns hold what. Returns column indexes (or -1).
  function guess(headers, rows) {
    const h = headers.map(plain), col = i => rows.slice(0, 50).map(r => r[i]);
    const share = (i, ok) => { const v = col(i).filter(x => String(x).trim() !== ''); return v.length ? v.filter(ok).length / v.length : 0; };
    const pick = (re, ok, score = () => 0) => h.map((x, i) => [i, re.test(x) && share(i, ok) > 0.6 ? 1 + score(x) : 0]).filter(x => x[1]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
    const isDate = x => !isNaN(when(x)) && (x instanceof Date || typeof x === 'number' || /\d{1,4}[./-]\d{1,2}[./-]\d{1,4}/.test(String(x)));
    const map = {
      date: pick(WORDS.date, isDate, x => (/order|zamow|ordine|pedido|placed|creat|utworz/.test(x) ? 2 : 0) - (/deliver|dostar|consegn|entreg|accept|pickup|odbior|ready|payout|wyplat/.test(x) ? 1 : 0)),
      total: pick(WORDS.total, x => !isNaN(num(x)), x => (NOT_TOTAL.test(x) ? -10 : 0) + (/gross|brutto|lordo|bruto|total|sales|sprzedaz|vendit|value|wartosc|subtotal/.test(x) ? 2 : 0) + (/food|jedzen|items|produkt|cibo|comida|basket|koszyk/.test(x) ? 1 : 0)),
      id: pick(WORDS.id, x => String(x).trim() !== ''),
      status: h.findIndex(x => WORDS.status.test(x)),
      currency: h.findIndex(x => WORDS.currency.test(x)),
      time: -1
    };
    if (map.total >= 0 && NOT_TOTAL.test(h[map.total]) && !/total|gross|brutto|sales|value|wartosc/.test(h[map.total])) map.total = -1;
    if (map.date >= 0 && !col(map.date).some(x => x instanceof Date || /\d:\d\d/.test(String(x)))) {
      const times = h.map((x, i) => i !== map.date && WORDS.time.test(x) && share(i, v => /^\d{1,2}:\d{2}/.test(String(v).trim())) > 0.6 ? i : -1).filter(i => i >= 0);
      map.time = times.find(i => /order|zamow|ordine|pedido|placed|creat|accept|przyj/.test(h[i])) ?? times[0] ?? -1;
    }
    return map;
  }

  function platformOf(name, headers, rows) {
    const s = plain(name + ' ' + headers.join(' ') + ' ' + rows.slice(0, 5).flat().join(' '));
    if (/wolt/.test(s)) return 'wolt';
    if (/uber/.test(s)) return 'ubereats';
    if (/glovo/.test(s)) return 'glovo';
    if (/deliveroo|roo/.test(s)) return 'deliveroo';
    return '';
  }
  function currencyOf(sample) {
    const s = String(sample);
    if (/PLN|zł/i.test(s)) return 'PLN';
    if (/GBP|£/.test(s)) return 'GBP';
    if (/CHF/.test(s)) return 'CHF';
    if (/CZK|Kč/.test(s)) return 'CZK';
    if (/EUR|€/.test(s)) return 'EUR';
    return '';
  }

  async function read(file) {
    const table = (await tableOf(file)).filter(r => r.some(c => String(c).trim() !== ''));
    // The header is the first of the top rows that names a date and an amount.
    let at = table.slice(0, 20).findIndex(r => { const h = r.map(plain); return h.some(x => WORDS.date.test(x)) && h.some(x => WORDS.total.test(x)); });
    if (at < 0) at = 0;
    const headers = (table[at] || []).map(x => String(x).trim()), rows = table.slice(at + 1);
    const map = guess(headers, rows);
    const currency = currencyOf(headers.join(' ') + ' ' + rows.slice(0, 20).flat().join(' ')) || (I18N.lang === 'pl' ? 'PLN' : 'EUR');
    return { name: file.name, headers, rows, map, platform: platformOf(file.name, headers, rows), currency };
  }

  // Order numbers are kept so the same report (or overlapping ones) can be uploaded twice.
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
  function parse(src, map = src.map, platform = src.platform, currency = src.currency) {
    const orders = [], seen = new Set(); let skipped = 0, bad = 0;
    for (const r of src.rows) {
      if (map.status >= 0 && CANCELLED.test(plain(r[map.status]))) { skipped++; continue; }
      const t = when(r[map.date], map.time >= 0 ? r[map.time] : null), v = num(r[map.total]);
      if (isNaN(t) || isNaN(v) || v < 0 || v > 99999) { bad++; continue; }
      let id = map.id >= 0 ? String(r[map.id]).trim().slice(0, 80) : '';
      if (!id) id = 'h' + hash(t + '|' + v + '|' + r.join('|'));
      if (seen.has(id)) continue;   // one order on several rows (one per item)
      seen.add(id);
      const c = (map.currency >= 0 && /^[A-Z]{3}$/.test(String(r[map.currency]).trim()) ? String(r[map.currency]).trim() : currency);
      orders.push({ p: platform, id, t, v: Math.round(v * 100) / 100, c });
    }
    return { orders, skipped, bad };
  }

  // ---------- saving: the database (connected) or this browser (demo) ----------
  const KEY = id => 'timbro:online:' + id;
  const connected = () => window.Store && Store.remote && window.Remote && Remote.enabled;
  const local = id => { try { return JSON.parse(localStorage.getItem(KEY(id))) || []; } catch (e) { return []; } };
  const keep = (id, list) => { try { localStorage.setItem(KEY(id), JSON.stringify(list)); } catch (e) { /* full or blocked */ } };

  async function list(cardId) {
    if (connected()) return (await Remote.onlineOrders(cardId)) || [];
    return local(cardId);
  }
  async function save(cardId, orders) {
    if (connected()) {
      let added = 0;
      for (let i = 0; i < orders.length; i += 2000) added += (await Remote.importOrders(cardId, orders.slice(i, i + 2000))).added;
      return { added };
    }
    const all = local(cardId), have = new Map(all.map(o => [o.p + '|' + o.id, o]));
    let added = 0;
    for (const o of orders) { if (!have.has(o.p + '|' + o.id)) added++; have.set(o.p + '|' + o.id, o); }
    keep(cardId, [...have.values()]);
    return { added };
  }
  async function clear(cardId, platform) {
    if (connected()) return Remote.clearOrders(cardId, platform);
    keep(cardId, local(cardId).filter(o => o.p !== platform));
  }

  // ---------- numbers ----------
  const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function compute(all, opts = {}) {
    const now = opts.now || Date.now(), today = startOfDay(now), end = today + DAY;
    const first = all.reduce((m, o) => Math.min(m, o.t), today);
    const from = opts.days ? today - (opts.days - 1) * DAY : startOfDay(first);
    const span = Math.max(1, Math.round((today - from) / DAY) + 1), prevFrom = from - span * DAY;
    // Money in the café's main currency (the one most orders are in).
    const count = {}; all.forEach(o => { count[o.c] = (count[o.c] || 0) + 1; });
    const currency = Object.keys(count).sort((a, b) => count[b] - count[a])[0] || 'EUR';
    const r = { from, span, currency, orders: 0, revenue: 0, prevOrders: 0, prevRevenue: 0, hasBefore: all.some(o => o.t < from),
      weekday: Array(7).fill(0), hours: Array(24).fill(0), byPlatform: {}, perDay: Array(span).fill(0) };
    for (const o of all) {
      const money = o.c === currency ? o.v : 0;
      if (o.t >= from && o.t < end) {
        r.orders++; r.revenue += money;
        const d = new Date(o.t); r.weekday[(d.getDay() + 6) % 7]++; r.hours[d.getHours()]++;
        r.perDay[Math.round((startOfDay(o.t) - from) / DAY)]++;
        const p = r.byPlatform[o.p] = r.byPlatform[o.p] || { orders: 0, revenue: 0 }; p.orders++; p.revenue += money;
      } else if (o.t >= prevFrom && o.t < from) { r.prevOrders++; r.prevRevenue += money; }
    }
    r.basket = r.orders ? r.revenue / r.orders : 0;
    const size = span <= 35 ? 1 : span <= 190 ? 7 : 30;
    r.bucket = size === 1 ? 'day' : size === 7 ? 'week' : 'month';
    r.series = [];
    for (let i = 0; i < span; i += size) r.series.push({ t: from + i * DAY, v: r.perDay.slice(i, i + size).reduce((a, b) => a + b, 0) });
    return r;
  }

  // Imports per platform: how many orders and which days they cover.
  function sources(all) {
    const by = {};
    for (const o of all) { const s = by[o.p] = by[o.p] || { p: o.p, n: 0, from: o.t, to: o.t }; s.n++; s.from = Math.min(s.from, o.t); s.to = Math.max(s.to, o.t); }
    return Object.values(by).sort((a, b) => b.n - a.n);
  }

  // ---------- example orders ----------
  function sample(card, now = Date.now()) {
    let seed = 0; for (const ch of card.id || 'x') seed = seed * 31 + ch.charCodeAt(0) | 0;
    const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const pl = I18N.lang === 'pl', c = pl ? 'PLN' : 'EUR', k = pl ? 4.3 : 1;
    const mix = [['wolt', 0.5], ['ubereats', 0.25], ['glovo', 0.25]];
    const out = [], today = startOfDay(now);
    for (let d = 119; d >= 0; d--) {
      const day = new Date(today - d * DAY), wd = (day.getDay() + 6) % 7;
      const n = Math.round((wd >= 4 ? 9 : 5) * (0.75 + rnd() * 0.5) * (1 + (119 - d) / 300));
      for (let i = 0; i < n; i++) {
        const lunch = rnd() < 0.55, h = lunch ? 11 + Math.floor(rnd() * 3) : 16 + Math.floor(rnd() * 5);
        const t = day.getTime() + h * 36e5 + Math.floor(rnd() * 36e5);
        if (t > now) continue;
        let x = rnd(), p = 'wolt'; for (const [name, w] of mix) { if ((x -= w) <= 0) { p = name; break; } }
        out.push({ p, id: 's' + out.length, t, v: Math.round((9 + rnd() * 14) * k * 100) / 100, c });
      }
    }
    return out;
  }

  window.ONLINE = { PLATFORMS, read, parse, list, save, clear, compute, sources, sample, num, when, guess };
})();
