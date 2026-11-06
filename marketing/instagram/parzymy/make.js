// Renders the Parzymy Tutaj Instagram posts in marketing/instagram/parzymy/:
//   <name>.png        feed post 4:5 (1080 x 1350)
//   <name>-story.png  story / reel cover 9:16 (1080 x 1920): the same design, centred, background extended
//   <name>-reel.mp4   reel 9:16, 8 s, animated: texts slide in, the phone rises and floats, stamps land (needs ffmpeg; Instagram adds the music)
//   node marketing/instagram/parzymy/make.js            all
//   node marketing/instagram/parzymy/make.js post-karta one
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = path.join(__dirname, '..', '..', '..');
const NAMES = ['post', 'post-karta', 'post-dolacz', 'post-ziarna'].filter(n => !process.argv[2] || n === process.argv[2]);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(file, (err, data) => { if (err || !file.startsWith(ROOT)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});
const FPS = 30, SECONDS = 8;
// The animation, added on top of the story layout. Frames are taken by pausing every animation at
// an exact time, so the video is smooth whatever the speed of the computer.
const CSS = `
@keyframes rise{0%{opacity:0;translate:0 70px}100%{opacity:1;translate:0 0}}
@keyframes phone{0%{opacity:0;translate:0 260px}12%{opacity:1;translate:0 0}31%{translate:0 -26px}50%{translate:0 0}69%{translate:0 -26px}88%{translate:0 0}100%{translate:0 -13px}}
@keyframes land{0%{opacity:0;scale:1.9}60%{opacity:1;scale:.94}100%{opacity:1;scale:1}}
@keyframes pulse{0%,100%{scale:1}50%{scale:1.04}}
.anim-in{animation:rise .7s cubic-bezier(.2,.8,.2,1) both}
.anim-phone{animation:phone 8s ease-in-out both}
.wp-dot.on img.st-in,.wp-dot.on > img:not(.st-own){animation:land .45s cubic-bezier(.3,1.4,.5,1) both}
.anim-pulse{animation:pulse 1.6s ease-in-out 3 both}
`;
async function reel(b, name, mp4) {
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto(`http://localhost:${server.address().port}/marketing/instagram/parzymy/${name}.html`);
  await p.waitForFunction(() => window.READY === true, null, { timeout: 15000 });
  await p.evaluate(css => {
    const post = document.getElementById('post'), cs = getComputedStyle(post);
    const inner = document.createElement('div');
    inner.style.cssText = `position:absolute;left:0;top:285px;width:1080px;height:1350px;display:${cs.display};flex-direction:${cs.flexDirection};align-items:${cs.alignItems};justify-content:${cs.justifyContent}`;
    while (post.firstChild) inner.appendChild(post.firstChild);
    post.appendChild(inner); post.style.height = '1920px';
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    // Texts and boxes come in one after another; the phone rises, then floats.
    let k = 0;
    for (const el of inner.children) {
      if (el.classList.contains('phone')) { el.classList.add('anim-phone'); continue; }
      if (/blob|shade|ground/.test(el.className)) continue;
      el.classList.add('anim-in'); el.style.animationDelay = (0.15 + 0.18 * k++) + 's';
    }
    // Stamps land one by one once the phone is up; the QR code breathes.
    document.querySelectorAll('.wp-dot.on > img:not(.st-own)').forEach((img, i) => { img.style.animationDelay = (1.4 + 0.35 * i) + 's'; });
    document.querySelectorAll('.qr').forEach(q => { q.classList.add('anim-pulse'); q.style.animationDelay = '3.2s'; });
  }, CSS);
  const anims = await p.evaluateHandle(() => document.getAnimations());
  await p.evaluate(a => a.forEach(x => x.pause()), anims);
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', mp4]);
  const done = new Promise((ok, no) => { ff.on('close', c => c ? no(new Error('ffmpeg ' + c)) : ok()); });
  for (let f = 0; f < FPS * SECONDS; f++) {
    await p.evaluate(([a, t]) => a.forEach(x => { x.currentTime = t; }), [anims, f * 1000 / FPS]);
    const jpg = await p.locator('#post').screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await done; await p.close();
  console.log('✓ ' + path.relative(ROOT, mp4));
}
server.listen(0, async () => {
  const b = await chromium.launch();
  for (const name of NAMES) {
    for (const story of [false, true]) {
      const p = await b.newPage({ viewport: { width: 1080, height: story ? 1920 : 1350 } });
      await p.goto(`http://localhost:${server.address().port}/marketing/instagram/parzymy/${name}.html`);
      await p.waitForFunction(() => window.READY === true, null, { timeout: 15000 });
      if (story) await p.evaluate(() => {
        // 9:16: the post's own background fills 1920 px; its content sits in the middle (Instagram's safe zone).
        const post = document.getElementById('post'), cs = getComputedStyle(post);
        const inner = document.createElement('div');
        inner.style.cssText = `position:absolute;left:0;top:285px;width:1080px;height:1350px;display:${cs.display};flex-direction:${cs.flexDirection};align-items:${cs.alignItems};justify-content:${cs.justifyContent}`;
        while (post.firstChild) inner.appendChild(post.firstChild);
        post.appendChild(inner); post.style.height = '1920px';
      });
      const out = path.join(__dirname, name + (story ? '-story' : '') + '.png');
      await p.locator('#post').screenshot({ path: out });
      await p.close();
      console.log('✓ ' + path.relative(ROOT, out));
      if (story) await reel(b, name, path.join(__dirname, name + '-reel.mp4'));
    }
  }
  await b.close(); server.close();
});
