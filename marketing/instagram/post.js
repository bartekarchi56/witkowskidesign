// Posts to Instagram whatever schedule.json says is due, through Instagram's official API
// (content publishing). Run every hour by .github/workflows/instagram.yml; see README.md,
// "Automatic posting". Remembers what it posted in posted.json, so nothing goes out twice.
//
//   node marketing/instagram/post.js                 post what is due now
//   node marketing/instagram/post.js --dry           only show what would be posted (no keys needed)
//   node marketing/instagram/post.js --dry --now "2026-11-02 12:45"
//
// Settings (GitHub secrets): IG_USER_ID, IG_ACCESS_TOKEN. Optional: IG_API_BASE
// (default https://graph.facebook.com/v21.0), SITE (where the files are public).
const fs = require('fs'), path = require('path');

const DIR = __dirname;
const SITE = (process.env.SITE || 'https://timbro.witkowskidesign.com').replace(/\/$/, '');
const API = (process.env.IG_API_BASE || 'https://graph.facebook.com/v21.0').replace(/\/$/, '');
const USER = process.env.IG_USER_ID || '', TOKEN = process.env.IG_ACCESS_TOKEN || '';
const LATE = 2 * 864e5;   // posts more than 2 days late are skipped
const args = process.argv.slice(2), dry = args.includes('--dry');
const nowArg = args.includes('--now') ? args[args.indexOf('--now') + 1] : '';

const schedule = JSON.parse(fs.readFileSync(path.join(DIR, 'schedule.json'), 'utf8'));
const POSTED = process.env.IG_POSTED || path.join(DIR, 'posted.json');
const posted = fs.existsSync(POSTED) ? JSON.parse(fs.readFileSync(POSTED, 'utf8')) : {};

// "2026-11-02 09:30" in the schedule's time zone, as a UTC timestamp.
function zoneOffset(ms, tz) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms));
  const g = k => +p.find(x => x.type === k).value;
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - ms;
}
function utcOf(local, tz) {
  const guess = Date.parse(local.trim().replace(' ', 'T') + ':00Z');
  if (Number.isNaN(guess)) throw new Error(`Bad date "${local}" (use "YYYY-MM-DD HH:MM")`);
  return guess - zoneOffset(guess, tz);
}

// Captions live in README.md: a "### name, name" section with **IT** and **EN** quotes.
function captions() {
  const out = {}, lines = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8').split('\n');
  let names = [], lang = '';
  for (const line of lines) {
    if (/^#{1,3} /.test(line)) { names = line.startsWith('### ') ? line.slice(4).split(',').map(s => s.trim()) : []; lang = ''; continue; }
    const m = /^\*\*(IT|EN)\*\*\s*$/.exec(line);
    if (m && names.length) { lang = m[1].toLowerCase(); continue; }
    if (lang && line.startsWith('>')) for (const n of names) ((out[n] ||= {})[lang] ||= []).push(line.replace(/^>\s?/, ''));
    else if (lang && line.trim() && !line.startsWith('>')) lang = '';
  }
  for (const n in out) for (const l in out[n]) out[n][l] = out[n][l].join('\n').trim();
  return out;
}
// The first language, the others below it, then the first language's hashtags at the end.
function captionFor(name, all) {
  const c = all[name];
  if (!c) throw new Error(`No caption for "${name}" in README.md`);
  const [first, ...rest] = schedule.captions || ['it'];
  if (!c[first]) throw new Error(`No ${first.toUpperCase()} caption for "${name}"`);
  const isTags = x => x.trim().startsWith('#');
  const words = l => c[l].split('\n').filter(x => !isTags(x)).join('\n').trim();
  const tags = c[first].split('\n').filter(isTags).join(' ').trim();
  const text = [words(first), ...rest.filter(l => c[l]).map(words), tags].filter(Boolean).join('\n\n').trim();
  if (text.length > 2200) throw new Error(`Caption for "${name}" is longer than 2200 characters`);
  return text;
}

// The public files for one post (the website serves this folder).
function filesFor(item) {
  const lang = item.lang || schedule.lang || 'it';
  const url = rel => `${SITE}/marketing/instagram/${rel}`;
  const local = rel => { const f = path.join(DIR, rel); if (!fs.existsSync(f)) throw new Error(`Missing file ${rel}`); return url(rel); };
  if (item.type === 'image' || item.type === 'story') return { image: local(`jpg/${lang}/${item.post}.jpg`) };
  if (item.type === 'reel') return { video: local(`${lang}/${item.post}.mp4`), cover: fs.existsSync(path.join(DIR, `jpg/${lang}/${item.post}-cover.jpg`)) ? url(`jpg/${lang}/${item.post}-cover.jpg`) : '' };
  if (item.type === 'carousel') {
    const slides = fs.readdirSync(path.join(DIR, 'jpg', lang)).map(f => new RegExp(`^${item.post}-(\\d+)\\.jpg$`).exec(f)).filter(Boolean)
      .sort((a, b) => a[1] - b[1]).map(m => url(`jpg/${lang}/${m[0]}`));
    if (slides.length < 2 || slides.length > 10) throw new Error(`A carousel needs 2 to 10 slides; "${item.post}" has ${slides.length}`);
    return { slides };
  }
  throw new Error(`Unknown type "${item.type}" for "${item.post}"`);
}

// ---- Instagram API ----
async function call(method, pathname, params = {}) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const r = await fetch(`${API}/${pathname}${method === 'GET' ? '?' + body : ''}`, method === 'GET' ? {} : { method, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Instagram API ${pathname}: ${(j.error && j.error.message) || r.status}`);
  return j;
}
// Videos (and sometimes images) are processed first: wait until the container is ready.
async function ready(id) {
  for (let i = 0; i < 60; i++) {
    const { status_code } = await call('GET', id, { fields: 'status_code' });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Instagram could not process the upload (${status_code})`);
    await new Promise(r => setTimeout(r, Number(process.env.IG_POLL_MS || 5000)));
  }
  throw new Error('Instagram took too long to process the upload');
}
async function publish(item, files, caption) {
  const media = p => call('POST', `${USER}/media`, p);
  let container;
  if (item.type === 'image') container = await media({ image_url: files.image, caption });
  else if (item.type === 'story') container = await media({ image_url: files.image, media_type: 'STORIES' });
  else if (item.type === 'reel') container = await media({ media_type: 'REELS', video_url: files.video, caption, share_to_feed: 'true', ...(files.cover ? { cover_url: files.cover } : {}) });
  else {
    const children = [];
    for (const image_url of files.slides) { const c = await media({ image_url, is_carousel_item: 'true' }); await ready(c.id); children.push(c.id); }
    container = await media({ media_type: 'CAROUSEL', children: children.join(','), caption });
  }
  await ready(container.id);
  return (await call('POST', `${USER}/media_publish`, { creation_id: container.id })).id;
}

(async () => {
  const tz = schedule.timezone || 'Europe/Rome';
  const now = nowArg ? utcOf(nowArg, tz) : Date.now();
  const all = captions();
  const key = p => `${p.at}|${p.post}|${p.type}`;
  const due = schedule.posts.filter(p => !posted[key(p)] && utcOf(p.at, tz) <= now);
  // Check every post's files and caption up front, so mistakes show long before their day.
  const problems = [];
  for (const p of schedule.posts) { try { filesFor(p); if (p.type !== 'story') captionFor(p.post, all); utcOf(p.at, tz); } catch (e) { problems.push(`${p.at} ${p.post}: ${e.message}`); } }
  if (problems.length) console.log('Problems in schedule.json:\n  ' + problems.join('\n  '));

  if (!due.length) { console.log('Nothing due.'); process.exit(problems.length ? 1 : 0); }
  if (!dry && (!USER || !TOKEN)) { console.log('Instagram is not connected yet (IG_USER_ID and IG_ACCESS_TOKEN secrets). Nothing posted.'); return; }
  let failed = problems.length > 0;
  for (const p of due) {
    if (now - utcOf(p.at, tz) > LATE) { console.log(`skip  ${p.at} ${p.post} (more than 2 days late)`); if (!dry) posted[key(p)] = { skipped: true }; continue; }
    try {
      const files = filesFor(p), caption = p.type === 'story' ? '' : captionFor(p.post, all);
      if (dry) { console.log(`would post  ${p.at} ${p.type} ${p.post}\n  ${Object.values(files).flat().filter(Boolean).join('\n  ')}\n  ---\n  ${caption.replace(/\n/g, '\n  ')}`); continue; }
      const id = await publish(p, files, caption);
      posted[key(p)] = { id, postedAt: new Date().toISOString() };
      fs.writeFileSync(POSTED, JSON.stringify(posted, null, 2) + '\n');
      console.log(`posted ${p.at} ${p.type} ${p.post} → ${id}`);
    } catch (e) { failed = true; console.error(`FAILED ${p.at} ${p.post}: ${e.message}`); }
  }
  if (!dry) fs.writeFileSync(POSTED, JSON.stringify(posted, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
})();
