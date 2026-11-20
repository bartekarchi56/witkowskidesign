// Renders reel.html into reel.mp4 (1080 x 1920, 30 fps, 25 s, no sound: add music in Instagram).
//   node marketing/instagram/wizytowki/make.js
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(file, (err, data) => { if (err || !file.startsWith(ROOT)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});
server.listen(0, async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.error('page error:', e.message));
  await p.goto(`http://localhost:${server.address().port}/marketing/instagram/stop-printing/reel.html?capture`);
  await p.waitForFunction(() => window.READY === true, null, { timeout: 20000 });
  const FPS = 30, total = Math.round(await p.evaluate(() => window.DURATION) * FPS);
  const out = path.join(__dirname, 'reel.mp4');
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', out]);
  const done = new Promise((ok, no) => ff.on('close', c => c ? no(new Error('ffmpeg ' + c)) : ok()));
  for (let f = 0; f < total; f++) {
    await p.evaluate(t => window.renderAt(t), f / FPS);
    const jpg = await p.locator('#post').screenshot({ type: 'jpeg', quality: 90 });
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await done; await b.close(); server.close();
  console.log('✓ ' + path.relative(ROOT, out));
});
