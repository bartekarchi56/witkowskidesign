// Answers people who comment the keyword (TIMBRO) under our posts: one private message each
// (Instagram's "private reply" to a comment, allowed once per comment within 7 days) and a short
// public reply under the comment, so others see it works. Run by .github/workflows/instagram.yml
// after post.js. Remembers who it answered in replied.json, so nobody gets it twice.
//
//   node marketing/instagram/replies.js          answer new comments
//   node marketing/instagram/replies.js --dry    only show who would get an answer (needs the key)
//
// The texts and the keyword are in schedule.json (commentReply). Same secrets as post.js; the key
// needs the comments and messages permissions (README.md, "Answers to TIMBRO comments").
const fs = require('fs'), path = require('path');

const DIR = __dirname;
const API = (process.env.IG_API_BASE || 'https://graph.instagram.com/v21.0').replace(/\/$/, '');
const TOKEN = process.env.IG_ACCESS_TOKEN || '';
let USER = process.env.IG_USER_ID || '';
const WINDOW = 7 * 864e5;   // Instagram allows a private reply up to 7 days after the comment
const dry = process.argv.includes('--dry');

const schedule = JSON.parse(fs.readFileSync(process.env.IG_SCHEDULE || path.join(DIR, 'schedule.json'), 'utf8'));
const REPLIED = process.env.IG_REPLIED || path.join(DIR, 'replied.json');
const replied = fs.existsSync(REPLIED) ? JSON.parse(fs.readFileSync(REPLIED, 'utf8')) : {};
const cfg = schedule.commentReply || {};
// Each text in its languages, one below the other (in the order they are written in schedule.json).
const both = t => typeof t === 'string' ? t.trim() : Object.values(t || {}).filter(Boolean).join('\n\n').trim();
const DM = both(cfg.message), REPLY = both(cfg.reply);
const WORD = new RegExp(`(^|[^\\p{L}\\p{N}])${(cfg.keyword || 'TIMBRO').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu');

async function call(method, pathname, params = {}) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const r = await fetch(`${API}/${pathname}${method === 'GET' ? '?' + body : ''}`, method === 'GET' ? {} : { method, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Instagram API ${pathname}: ${(j.error && j.error.message) || r.status}`);
  return j;
}
// All pages of a list (Instagram pages by 25-50), up to `max` items.
async function list(pathname, params, max) {
  let out = [], page = await call('GET', pathname, params);
  for (;;) {
    out = out.concat(page.data || []);
    const next = page.paging && page.paging.cursors && page.paging.next && page.paging.cursors.after;
    if (!next || out.length >= max) return out.slice(0, max);
    page = await call('GET', pathname, { ...params, after: next });
  }
}

(async () => {
  if (!DM) { console.log('No commentReply.message in schedule.json: nothing to send.'); return; }
  if (!TOKEN) { console.log('Instagram is not connected yet (IG_ACCESS_TOKEN secret). Nothing sent.'); return; }
  let me = { username: '' };
  if (!/graph\.facebook\.com/.test(API)) { me = await call('GET', 'me', { fields: 'user_id,username' }); USER = String(me.user_id || me.id); }
  if (!USER) { console.log('Instagram is not connected yet (IG_USER_ID secret). Nothing sent.'); return; }

  const now = Date.now();
  const media = (await list(`${USER}/media`, { fields: 'id,timestamp', limit: 25 }, 50)).filter(m => now - Date.parse(m.timestamp) < 30 * 864e5);
  let sent = 0, failed = false;
  for (const m of media) {
    const comments = await list(`${m.id}/comments`, { fields: 'id,text,timestamp,username', limit: 50 }, 500).catch(e => { console.log(`  (comments of ${m.id}: ${e.message})`); return []; });
    for (const c of comments) {
      if (replied[c.id] || !WORD.test(c.text || '') || (me.username && c.username === me.username)) continue;
      if (now - Date.parse(c.timestamp) > WINDOW) { if (!dry) replied[c.id] = { skipped: 'older than 7 days' }; continue; }
      if (dry) { console.log(`would answer @${c.username}: "${c.text}"`); continue; }
      const done = { at: new Date().toISOString(), user: c.username };
      try {
        await call('POST', `${USER}/messages`, { recipient: JSON.stringify({ comment_id: c.id }), message: JSON.stringify({ text: DM }) });
        done.message = true; sent++;
        console.log(`answered @${c.username}`);
      } catch (e) { failed = true; console.error(`FAILED message to @${c.username}: ${e.message}`); continue; }   // tried again next run
      if (REPLY) { try { await call('POST', `${c.id}/replies`, { message: REPLY }); done.reply = true; } catch (e) { console.log(`  (public reply to @${c.username} not added: ${e.message})`); } }
      replied[c.id] = done;
      fs.writeFileSync(REPLIED, JSON.stringify(replied, null, 2) + '\n');
    }
  }
  if (!dry) fs.writeFileSync(REPLIED, JSON.stringify(replied, null, 2) + '\n');
  console.log(dry ? 'Dry run: nothing sent.' : sent ? `Answered ${sent} comment(s).` : 'No new comments to answer.');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
