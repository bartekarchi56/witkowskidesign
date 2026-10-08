/*
 * Results for a café, computed from its customers' visit history (the join,
 * stamp and reward events the till records), in demo and connected mode.
 * Charts are plain inline SVG: one series each, in the site's accent colour,
 * with a hover/focus tooltip and a table of the same numbers.
 *
 *   ANALYTICS.compute(card, customers, { days })  → numbers and series
 *   ANALYTICS.sample(card)                         → example customers for demos
 *   ANALYTICS.line(el, points, opts) / .columns(el, bars, opts) / .countUp(el, n, fmt)
 */
(function () {
  const DAY = 864e5;
  const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const dayIndex = (t, from) => Math.round((startOfDay(t) - from) / DAY);

  // A visit is one stamp event (two stamps given at once are still one visit).
  function compute(card, customers, opts = {}) {
    const now = opts.now || Date.now();
    const today = startOfDay(now), end = today + DAY;
    const first = customers.reduce((m, c) => Math.min(m, c.joinedAt || now), now);
    const from = opts.days ? today - (opts.days - 1) * DAY : startOfDay(first);
    const span = Math.max(1, dayIndex(today, from) + 1);
    const prevFrom = from - span * DAY;
    const within = (t, a, b) => t >= a && t < b;
    const need = card.stampsNeeded || 10;

    const r = {
      from, span, members: customers.length, newMembers: 0, prevNewMembers: 0,
      visits: 0, prevVisits: 0, rewards: 0, prevRewards: 0, visitors: 0, returning: 0, everVisited: 0,
      weekday: Array(7).fill(0), hours: Array(24).fill(0), close: [], lapsed: []
    };
    const visitsPerDay = Array(span).fill(0), joinsPerDay = Array(span).fill(0);
    let before = 0;
    for (const c of customers) {
      const joined = c.joinedAt || now;
      if (joined < from) before++;
      if (within(joined, from, end)) { r.newMembers++; joinsPerDay[dayIndex(joined, from)]++; }
      else if (within(joined, prevFrom, from)) r.prevNewMembers++;
      let total = 0, inPeriod = 0;
      for (const h of c.history || []) {
        if (h.type === 'stamp') {
          total++;
          if (within(h.t, from, end)) {
            inPeriod++; r.visits++; visitsPerDay[dayIndex(h.t, from)]++;
            const d = new Date(h.t); r.weekday[(d.getDay() + 6) % 7]++; r.hours[d.getHours()]++;
          } else if (within(h.t, prevFrom, from)) r.prevVisits++;
        } else if (h.type === 'redeem') {
          if (within(h.t, from, end)) r.rewards++; else if (within(h.t, prevFrom, from)) r.prevRewards++;
        }
      }
      if (inPeriod) r.visitors++;
      if (total) r.everVisited++;
      if (total >= 2) r.returning++;
      if (c.stamps > 0 && c.stamps < need && c.stamps >= need - 2) r.close.push(c);
      if (now - (c.lastVisit || joined) > 30 * DAY) r.lapsed.push(c);
    }
    r.close.sort((a, b) => b.stamps - a.stamps);
    r.lapsed.sort((a, b) => (b.lastVisit || b.joinedAt) - (a.lastVisit || a.joinedAt));
    r.returningRate = r.everVisited ? r.returning / r.everVisited : 0;
    r.perVisitor = r.visitors ? r.visits / r.visitors : 0;
    let acc = before;
    r.growth = joinsPerDay.map((n, i) => ({ t: from + i * DAY, v: acc += n }));
    // Visits by day for a month or less, by week up to half a year, then by month.
    const size = span <= 35 ? 1 : span <= 190 ? 7 : 30;
    r.bucket = size === 1 ? 'day' : size === 7 ? 'week' : 'month';
    r.visitSeries = [];
    for (let i = 0; i < span; i += size) {
      r.visitSeries.push({ t: from + i * DAY, v: visitsPerDay.slice(i, i + size).reduce((a, b) => a + b, 0) });
    }
    return r;
  }

  // ---------- example data, for demos and for cafés that have just started ----------
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const NAMES = ['Giulia', 'Marco', 'Sara', 'Luca', 'Chiara', 'Matteo', 'Francesca', 'Andrea', 'Elena', 'Davide', 'Anna', 'Paolo', 'Marta', 'Simone', 'Laura', 'Tom', 'Emma', 'Lucas', 'Sofia', 'Leo'];
  const WEEKDAY = [0.8, 0.9, 0.95, 1, 1.1, 1.5, 1.2];   // Monday … Sunday
  const HOURS = [[7, 2.2], [8, 3], [9, 2.6], [10, 1.6], [11, 1.1], [12, 1.4], [13, 1.8], [14, 1.2], [15, 0.9], [16, 1.2], [17, 1.3], [18, 0.8]];
  function sample(card, now = Date.now()) {
    const rand = rng(7), need = card.stampsNeeded || 10, days = 120, out = [];
    const pickHour = () => { const total = HOURS.reduce((a, h) => a + h[1], 0); let x = rand() * total; for (const [h, w] of HOURS) { if ((x -= w) <= 0) return h; } return 9; };
    for (let i = 0; i < 190; i++) {
      // More people join as word spreads: join dates lean towards recent weeks.
      const joined = now - Math.pow(rand(), 0.75) * days * DAY;
      const perWeek = 0.25 + Math.pow(rand(), 2) * 3;   // most come now and then, a few every day
      const history = [{ t: joined, type: 'joined' }];
      let t = joined, stamps = 0, redeemed = 0;
      while (true) {
        if (history.length > 1) t += (-Math.log(1 - rand()) * 7 / perWeek) * DAY;
        if (t > now) break;
        const d = new Date(t);
        if (rand() > WEEKDAY[(d.getDay() + 6) % 7] / 1.5) continue;
        d.setHours(pickHour(), Math.floor(rand() * 60));
        if (d.getTime() < joined) d.setTime(joined);
        if (d.getTime() > now) break;
        history.push({ t: d.getTime(), type: 'stamp', n: 1 });
        if (++stamps >= need) { history.push({ t: d.getTime() + 60000, type: 'redeem' }); stamps = 0; redeemed++; }
      }
      const visits = history.filter(h => h.type === 'stamp');
      out.push({ id: 'EX' + i, cardId: card.id, name: NAMES[i % NAMES.length] + (i >= NAMES.length ? ' ' + String.fromCharCode(65 + (i % 26)) + '.' : ''),
        stamps, redeemed, joinedAt: joined, lastVisit: visits.length ? visits[visits.length - 1].t : null, history });
    }
    return out;
  }

  // ---------- charts ----------
  const NS = 'http://www.w3.org/2000/svg';
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function niceStep(max, ticks = 4) {
    const raw = Math.max(1, max) / ticks, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
    return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p);
  }
  const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const txt = (parent, x, y, s, attrs = {}) => { const t = el('text', { x, y, 'font-size': 12, fill: css('--muted') || '#6B6B70', ...attrs }, parent); t.textContent = s; return t; };

  // Shared frame: SVG, y grid with clean ticks, and one tooltip element.
  function frame(host, max, opts) {
    host.innerHTML = ''; host.classList.add('chart');
    const W = Math.max(280, host.clientWidth || 600), H = opts.height || 220, m = { l: 34, r: opts.right || 16, t: 18, b: 26 };
    const step = niceStep(max), top = Math.max(step, Math.ceil(max / step) * step);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': opts.label || '' }, host);
    const y = v => m.t + (H - m.t - m.b) * (1 - v / top);
    for (let v = 0; v <= top; v += step) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: v ? '#ECECEA' : '#D6D6D3', 'stroke-width': 1 }, svg);
      txt(svg, m.l - 8, y(v) + 4, (opts.fmt || String)(v), { 'text-anchor': 'end' });
    }
    const tip = document.createElement('div'); tip.className = 'chart-tip'; tip.hidden = true; host.appendChild(tip);
    const show = (x, yPx, value, label) => {
      tip.replaceChildren(); const b = document.createElement('b'); b.textContent = value; const s = document.createElement('span'); s.textContent = label;
      tip.append(b, s); tip.hidden = false;
      const left = Math.min(Math.max(x / W * host.clientWidth, 60), host.clientWidth - 60);
      tip.style.left = left + 'px'; tip.style.top = Math.max(0, yPx / H * H - 52) + 'px';
    };
    return { svg, W, H, m, y, top, tip, show, hide: () => { tip.hidden = true; } };
  }

  // A line that grows over time (one series), with a crosshair that snaps to the nearest day.
  function line(host, points, opts = {}) {
    if (!points.length) return;
    const max = Math.max(...points.map(p => p.v));
    const f = frame(host, max, { ...opts, right: 44 });
    const { svg, W, H, m, y } = f, accent = css('--pop') || '#2B32FF';
    const x = i => m.l + (W - m.l - m.r) * (points.length === 1 ? 0.5 : i / (points.length - 1));
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    el('path', { d: `${d}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`, fill: accent, 'fill-opacity': 0.1 }, svg);
    el('path', { d, fill: 'none', stroke: accent, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    const last = points.length - 1;
    el('circle', { cx: x(last), cy: y(points[last].v), r: 4, fill: accent, stroke: '#fff', 'stroke-width': 2 }, svg);
    txt(svg, x(last) + 8, y(points[last].v) + 4, (opts.fmt || String)(points[last].v), { fill: css('--ink') || '#0B0B0C', 'font-weight': 700 });
    [0, Math.floor(last / 2), last].filter((v, i, a) => a.indexOf(v) === i).forEach((i, k, arr) =>
      txt(svg, x(i), H - 6, opts.date(points[i].t), { 'text-anchor': k === 0 ? 'start' : k === arr.length - 1 ? 'end' : 'middle' }));
    const cross = el('line', { y1: m.t, y2: y(0), stroke: '#B5B5B8', 'stroke-width': 1, visibility: 'hidden' }, svg);
    const dot = el('circle', { r: 4, fill: accent, stroke: '#fff', 'stroke-width': 2, visibility: 'hidden' }, svg);
    let at = last;
    const pointAt = i => {
      at = Math.max(0, Math.min(last, i));
      cross.setAttribute('x1', x(at)); cross.setAttribute('x2', x(at)); dot.setAttribute('cx', x(at)); dot.setAttribute('cy', y(points[at].v));
      cross.setAttribute('visibility', 'visible'); dot.setAttribute('visibility', 'visible');
      f.show(x(at), y(points[at].v), (opts.fmt || String)(points[at].v), opts.date(points[at].t, true));
    };
    const off = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); f.hide(); };
    const hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: y(0) - m.t, fill: 'transparent' }, svg);
    hit.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W; pointAt(Math.round((px - m.l) / (W - m.l - m.r) * last)); });
    hit.addEventListener('pointerleave', off);
    host.tabIndex = 0;
    host.onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); pointAt(at + (e.key === 'ArrowRight' ? 1 : -1)); } };
    host.onfocus = () => pointAt(at); host.onblur = off;
  }

  // Columns from one baseline, at most 24px wide, rounded at the top; each column is its own hover target.
  function columns(host, bars, opts = {}) {
    const max = Math.max(1, ...bars.map(b => b.v));
    const f = frame(host, max, opts);
    const { svg, W, H, m, y } = f, accent = css('--pop') || '#2B32FF';
    const band = (W - m.l - m.r) / bars.length, bw = Math.max(3, Math.min(24, band - 2));
    const peak = bars.reduce((a, b, i) => (b.v > bars[a].v ? i : a), 0);
    const every = Math.ceil(bars.length / Math.max(1, Math.floor((W - m.l - m.r) / 64)));
    bars.forEach((b, i) => {
      const cx = m.l + band * i + band / 2, x0 = cx - bw / 2, y0 = y(0), y1 = y(b.v), r = Math.min(4, bw / 2, y0 - y1);
      const g = el('g', { tabindex: 0, role: 'img', 'aria-label': `${b.title || b.label}: ${(opts.fmt || String)(b.v)}` }, svg);
      if (b.v > 0) el('path', { d: `M${x0},${y0}V${y1 + r}Q${x0},${y1} ${x0 + r},${y1}H${x0 + bw - r}Q${x0 + bw},${y1} ${x0 + bw},${y1 + r}V${y0}Z`, fill: accent, class: 'col' }, g);
      el('rect', { x: m.l + band * i, y: m.t, width: band, height: y0 - m.t, fill: 'transparent' }, g);
      const on = () => { g.classList.add('on'); f.show(cx, y1, (opts.fmt || String)(b.v), b.title || b.label); };
      const off = () => { g.classList.remove('on'); f.hide(); };
      g.addEventListener('pointerenter', on); g.addEventListener('pointerleave', off); g.addEventListener('focus', on); g.addEventListener('blur', off);
      if (i % every === 0 || i === bars.length - 1 && bars.length <= 12) txt(svg, cx, H - 6, b.label, { 'text-anchor': 'middle' });
      if (i === peak && b.v > 0) txt(svg, cx, y1 - 6, (opts.fmt || String)(b.v), { 'text-anchor': 'middle', fill: css('--ink') || '#0B0B0C', 'font-weight': 700 });
    });
  }

  // Numbers that count up once, when they come into view (instant with reduced motion).
  function countUp(node, to, fmt = n => Math.round(n).toLocaleString()) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { node.textContent = fmt(to); return; }
    const from = Number(node.dataset.n || 0); node.dataset.n = to;
    if (!node.dataset.seen) node.textContent = fmt(from);
    const run = () => {
      const t0 = performance.now(), dur = 900;
      const tick = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); node.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    };
    if (node.dataset.seen) return run();
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); node.dataset.seen = 1; run(); } }, { threshold: 0.3 });
    io.observe(node);
  }

  window.ANALYTICS = { compute, sample, line, columns, countUp, DAY };
})();
