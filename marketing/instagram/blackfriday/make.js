// Black Friday 2026 for Timbro's Instagram, in Polish, English and Italian:
//   <lang>/post.png   feed 4:5 (1080 x 1350)
//   <lang>/story.png  story 9:16 (1080 x 1920)
//   <lang>/reel.mp4   reel 9:16, 8 s: the strips run, texts and prices come in, the phone floats (needs ffmpeg)
//   node marketing/instagram/blackfriday/make.js        all languages
//   node marketing/instagram/blackfriday/make.js pl     one
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = path.join(__dirname, '..', '..', '..');
const LANGS = ['pl', 'en', 'it'].filter(l => !process.argv[2] || l === process.argv[2]);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(file, (err, data) => { if (err || !file.startsWith(ROOT)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});
const FPS = 30, SECONDS = 8;
const CSS = `
@keyframes run{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes runr{from{transform:translateX(-50%)}to{transform:translateX(0)}}
@keyframes rise{0%{opacity:0;translate:0 60px}100%{opacity:1;translate:0 0}}
@keyframes pop{0%{opacity:0;scale:.4}60%{opacity:1;scale:1.08}100%{scale:1}}
@keyframes phone{0%{opacity:0;translate:0 300px}14%{opacity:1;translate:0 0}32%{translate:0 -24px}50%{translate:0 0}68%{translate:0 -24px}86%{translate:0 0}100%{translate:0 -12px}}
@keyframes tag{0%{opacity:0;scale:0;rotate:-120deg}100%{opacity:1;scale:1;rotate:0deg}}
@keyframes land{0%{opacity:0;scale:1.9}60%{opacity:1;scale:.94}100%{opacity:1;scale:1}}
.tick.t .run{animation:run 8s linear both}.tick.b .run{animation:runr 8s linear both}
.logo,.kick,.life,.lede,.pr,.cta,.fine{animation:rise .7s cubic-bezier(.2,.8,.2,1) both}
.big{animation:pop .8s cubic-bezier(.3,1.4,.5,1) both}
.phone{animation:phone 8s ease-in-out both}
.tag{animation:tag .7s cubic-bezier(.3,1.4,.5,1) both}
.wp-dot.on{animation:land .45s cubic-bezier(.3,1.4,.5,1) both}
`;
const url = (lang, f) => `http://localhost:${server.address().port}/marketing/instagram/blackfriday/bf.html?lang=${lang}&f=${f}`;
async function still(b, lang, f) {
  const p = await b.newPage({ viewport: { width: 1080, height: f === 'story' ? 1920 : 1350 } });
  await p.goto(url(lang, f)); await p.waitForFunction(() => window.READY === true, null, { timeout: 15000 });
  const out = path.join(__dirname, lang, f + '.png'); await p.locator('#post').screenshot({ path: out }); await p.close();
  console.log('✓ ' + path.relative(ROOT, out));
}
async function reel(b, lang) {
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto(url(lang, 'story')); await p.waitForFunction(() => window.READY === true, null, { timeout: 15000 });
  await p.evaluate(css => {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const d = (sel, t) => document.querySelectorAll(sel).forEach((el, i) => { el.style.animationDelay = (t + i * 0.12) + 's'; });
    d('.logo', .1); d('.kick', .25); d('.big', .45); d('.life', .9); d('.lede', 1.05); d('.pr', 1.3); d('.cta', 1.8); d('.fine', 2); d('.tag', 2.2);
    document.querySelectorAll('.wp-dot.on').forEach((el, i) => { el.style.animationDelay = (2.4 + 0.3 * i) + 's'; });
  }, CSS);
  const anims = await p.evaluateHandle(() => document.getAnimations());
  await p.evaluate(a => a.forEach(x => x.pause()), anims);
  const out = path.join(__dirname, lang, 'reel.mp4');
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', out]);
  const done = new Promise((ok, no) => ff.on('close', c => c ? no(new Error('ffmpeg ' + c)) : ok()));
  for (let f = 0; f < FPS * SECONDS; f++) {
    await p.evaluate(([a, t]) => a.forEach(x => { x.currentTime = t; }), [anims, f * 1000 / FPS]);
    const jpg = await p.locator('#post').screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await done; await p.close();
  console.log('✓ ' + path.relative(ROOT, out));
}
server.listen(0, async () => {
  const b = await chromium.launch();
  for (const lang of LANGS) {
    fs.mkdirSync(path.join(__dirname, lang), { recursive: true });
    await still(b, lang, 'post'); await still(b, lang, 'story');
    if (!process.env.NO_REEL) await reel(b, lang);
  }
  await b.close(); server.close();
});
