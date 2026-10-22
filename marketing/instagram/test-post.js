// Tests post.js against a small fake Instagram API: image, reel (processed first),
// carousel and story, posted once each, captions ending with the call to action, nothing twice, late posts skipped.
// Uses its own schedule (a temporary file), so it doesn't depend on schedule.json's dates.
//   node marketing/instagram/test-post.js
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const { execFileSync } = require('child_process');

const calls = []; let n = 0; const polls = {};
const api = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    const url = new URL(req.url, 'http://x'), p = Object.fromEntries(new URLSearchParams(req.method === 'GET' ? url.search : body));
    const send = j => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (p.access_token !== 'tok') { res.writeHead(400); return res.end('{"error":{"message":"bad token"}}'); }
    if (req.method === 'POST' && url.pathname === '/123/media') { const id = 'c' + (++n); calls.push({ kind: 'media', id, ...p }); return send({ id }); }
    if (req.method === 'POST' && url.pathname === '/123/media_publish') { calls.push({ kind: 'publish', ...p }); return send({ id: 'm' + p.creation_id }); }
    if (req.method === 'GET' && url.pathname === '/me') return send({ user_id: '123', username: 'timbro.test', account_type: 'BUSINESS' });
    if (req.method === 'GET') { const id = url.pathname.slice(1); polls[id] = (polls[id] || 0) + 1; return send({ status_code: polls[id] < 2 ? 'IN_PROGRESS' : 'FINISHED' }); }
    res.writeHead(404); res.end('{}');
  });
}).listen(0, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-')), posted = path.join(tmp, 'posted.json'), sched = path.join(tmp, 'schedule.json');
  fs.writeFileSync(sched, JSON.stringify({ timezone: 'Europe/Rome', lang: 'it', captions: ['it', 'en'],
    callToAction: { it: 'Commenta TIMBRO e ti mandiamo il design della tua carta', en: 'Comment TIMBRO and we will send you the design of your card' },
    posts: [{ at: '2026-11-02 09:30', post: 'ad-hero', type: 'image' }, { at: '2026-11-02 12:30', post: 'reel-stamps', type: 'reel' },
      { at: '2026-11-02 18:00', post: 'carousel-mistakes', type: 'carousel' }, { at: '2026-11-30 09:00', post: 'post-prices', type: 'image' },
      { at: '2026-12-02 09:00', post: 'ad-hero-story', type: 'story' }] }));
  const env = { ...process.env, IG_USER_ID: '999', IG_ACCESS_TOKEN: 'tok', IG_API_BASE: `http://localhost:${api.address().port}`, IG_POLL_MS: '5', IG_POSTED: posted, IG_SCHEDULE: sched };
  const run = now => new Promise(done => require('child_process').execFile('node', [path.join(__dirname, 'post.js'), '--now', now], { env }, (err, out) => done(out)));
  (async () => {
    // Day one: three posts due by 18:30 (image, reel, carousel).
    let out = await run('2026-11-02 18:30');
    const pub = calls.filter(c => c.kind === 'publish');
    assert.equal(pub.length, 3, out);
    const media = calls.filter(c => c.kind === 'media');
    assert.ok(media[0].image_url.endsWith('/jpg/it/ad-hero.jpg') && /Link in bio/.test(media[0].caption) && /#cartafedeltà/.test(media[0].caption));
    assert.ok(media[0].caption.trim().endsWith('#milano'), 'hashtags at the end');
    const reel = media.find(m => m.media_type === 'REELS');
    assert.ok(reel.video_url.endsWith('/it/reel-stamps.mp4') && reel.cover_url.endsWith('reel-stamps-cover.jpg'));
    const car = media.find(m => m.media_type === 'CAROUSEL');
    assert.equal(car.children.split(',').length, 7);
    const captioned = media.filter(m => m.caption);
    assert.equal(captioned.length, 3);
    assert.ok(captioned.every(m => /Commenta TIMBRO e ti mandiamo il design della tua carta\n\nComment TIMBRO and we will send you the design of your card\n\n#/.test(m.caption)), 'call to action before the hashtags');
    console.log('  ✓ 1. image, reel (after processing) and 7-slide carousel are posted with their captions, ending with the call to action');
    // Running again posts nothing twice.
    out = await run('2026-11-02 19:30');
    assert.equal(calls.filter(c => c.kind === 'publish').length, 3, out);
    console.log('  ✓ 2. nothing is posted twice');
    // A week late: everything older than 2 days is skipped, the story on 2 Dec is posted without a caption.
    out = await run('2026-12-02 10:30');
    const after = calls.filter(c => c.kind === 'publish').length;
    assert.ok(/skip/.test(out));
    const story = calls.filter(c => c.kind === 'media').find(m => m.media_type === 'STORIES');
    assert.ok(story && !story.caption && after === 4, out);   // only the story: 30 Nov is just over 2 days late
    console.log('  ✓ 3. posts more than 2 days late are skipped; the story goes out without a caption');
    console.log('\nAll 3 checks passed.');
    api.close();
  })().catch(e => { console.error(e); process.exit(1); });
});
