// Tests replies.js against a small fake Instagram API: a TIMBRO comment gets one private message
// (to the comment) and a public reply; other comments, our own and old ones are left alone;
// nobody is answered twice.
//   node marketing/instagram/test-replies.js
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');

const calls = [], ago = d => new Date(Date.now() - d * 864e5).toISOString();
const COMMENTS = { m1: [{ id: 'c1', text: 'TIMBRO', username: 'bar.luna', timestamp: ago(1) }, { id: 'c2', text: 'bello!', username: 'anna', timestamp: ago(1) },
  { id: 'c3', text: 'timbro please 🙏', username: 'caffe.sole', timestamp: ago(2) }, { id: 'c4', text: 'Comment TIMBRO', username: 'timbro.test', timestamp: ago(1) },
  { id: 'c5', text: 'TIMBRO', username: 'late.bar', timestamp: ago(9) }, { id: 'c6', text: 'timbrosa', username: 'x', timestamp: ago(1) }] };
const api = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    const url = new URL(req.url, 'http://x'), p = Object.fromEntries(new URLSearchParams(req.method === 'GET' ? url.search : body));
    const send = j => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (p.access_token !== 'tok') { res.writeHead(400); return res.end('{"error":{"message":"bad token"}}'); }
    if (req.method === 'GET' && url.pathname === '/me') return send({ user_id: '123', username: 'timbro.test' });
    if (req.method === 'GET' && url.pathname === '/123/media') return send({ data: [{ id: 'm1', timestamp: ago(3) }] });
    const cm = /^\/(m\d)\/comments$/.exec(url.pathname);
    if (req.method === 'GET' && cm) return send({ data: COMMENTS[cm[1]] || [] });
    if (req.method === 'POST' && url.pathname === '/123/messages') { calls.push({ kind: 'dm', recipient: JSON.parse(p.recipient), message: JSON.parse(p.message) }); return send({ message_id: 'x' }); }
    const rp = /^\/(c\d)\/replies$/.exec(url.pathname);
    if (req.method === 'POST' && rp) { calls.push({ kind: 'reply', on: rp[1], message: p.message }); return send({ id: 'r' }); }
    res.writeHead(404); res.end('{}');
  });
}).listen(0, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'igr-')), replied = path.join(tmp, 'replied.json'), sched = path.join(tmp, 'schedule.json');
  fs.writeFileSync(sched, JSON.stringify({ commentReply: { keyword: 'TIMBRO', message: { it: 'Ciao! Ti preparo la carta.', en: 'Hi! I will design your card.' }, reply: { it: 'Ti ho scritto in DM!', en: 'Sent you a DM!' } } }));
  const env = { ...process.env, IG_ACCESS_TOKEN: 'tok', IG_API_BASE: `http://localhost:${api.address().port}`, IG_REPLIED: replied, IG_SCHEDULE: sched };
  const run = () => new Promise(done => require('child_process').execFile('node', [path.join(__dirname, 'replies.js')], { env }, (err, out, errOut) => done(out + errOut)));
  (async () => {
    let out = await run();
    const dms = calls.filter(c => c.kind === 'dm');
    assert.deepEqual(dms.map(d => d.recipient.comment_id).sort(), ['c1', 'c3'], out);
    assert.equal(dms[0].message.text, 'Ciao! Ti preparo la carta.\n\nHi! I will design your card.');
    console.log('  ✓ 1. only real TIMBRO comments get the private message (not other words, our own, or older than 7 days)');
    assert.deepEqual(calls.filter(c => c.kind === 'reply').map(r => r.on).sort(), ['c1', 'c3']);
    assert.equal(calls.find(c => c.kind === 'reply').message, 'Ti ho scritto in DM!\n\nSent you a DM!');
    console.log('  ✓ 2. each gets a public reply under the comment');
    out = await run();
    assert.equal(calls.filter(c => c.kind === 'dm').length, 2, out);
    assert.equal(JSON.parse(fs.readFileSync(replied, 'utf8')).c5.skipped, 'older than 7 days');
    console.log('  ✓ 3. nobody is answered twice');
    console.log('\nAll 3 checks passed.');
    api.close();
  })().catch(e => { console.error(e); process.exit(1); });
});
