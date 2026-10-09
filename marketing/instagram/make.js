// Renders the Instagram assets drawn by studio.html into it/, en/ and brand/:
//   node marketing/instagram/make.js            everything, both languages
//   node marketing/instagram/make.js reel-how   only assets whose id contains "reel-how"
// Needs Playwright with Chromium (npm i -g playwright) and ffmpeg for the reels
// (on PATH, or FFMPEG=/path/to/ffmpeg).
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..', '..');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 30;
const SIZES = { feed: [540, 675], story: [540, 960], square: [540, 540] };
const SHARED = id => id === 'profile' || id.startsWith('highlight-');   // no text: one copy for both languages
const only = process.argv[2] || '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  });
});

async function open(page, base, id, lang, slide) {
  await page.goto(`${base}marketing/instagram/studio.html?id=${id}&lang=${lang}${slide ? '&s=' + slide : ''}`);
  await page.waitForFunction(() => window.READY === true);
  await page.waitForTimeout(100);
}

function encode(out) {
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), out]);
  const done = new Promise((ok, fail) => ff.on('close', code => code ? fail(new Error('ffmpeg failed: ' + out)) : ok()));
  ff.stderr.pipe(process.stderr);
  return { write: buf => new Promise(ok => ff.stdin.write(buf) ? ok() : ff.stdin.once('drain', ok)), end: () => { ff.stdin.end(); return done; } };
}

server.listen(0, async () => {
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const errors = [];
  const list = await (async () => { const p = await browser.newPage(); await p.goto(base + 'marketing/instagram/studio.html'); const a = await p.evaluate(() => window.ASSETS); await p.close(); return a; })();
  for (const lang of ['it', 'en']) {
    for (const [id, a] of Object.entries(list)) {
      if (only && !id.includes(only)) continue;
      if (SHARED(id) && lang === 'en') continue;
      const dir = path.join(__dirname, SHARED(id) ? 'brand' : lang);
      fs.mkdirSync(dir, { recursive: true });
      const [w, h] = SIZES[a.size];
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
      page.on('pageerror', e => errors.push(`${id} ${lang}: ${e.message}`));
      const stage = page.locator('#stage');
      if (a.duration) {
        await open(page, base, id, lang);
        const out = path.join(dir, `${id}.mp4`), video = encode(out);
        const frames = Math.round(a.duration * FPS);
        for (let f = 0; f < frames; f++) {
          await page.evaluate(t => window.seek(t), f / FPS);
          await video.write(await stage.screenshot({ type: 'jpeg', quality: 94 }));
        }
        await video.end();
        await page.evaluate(t => window.seek(t), a.cover);
        await stage.screenshot({ path: path.join(dir, `${id}-cover.png`) });
        console.log('✓', path.relative(__dirname, out), `${a.duration}s`);
      } else {
        for (let s = 1; s <= (a.slides || 1); s++) {
          await open(page, base, id, lang, a.slides ? s : 0);
          const name = a.slides ? `${id}-${s}.png` : `${id}.png`;
          await stage.screenshot({ path: path.join(dir, name) });
          console.log('✓', path.relative(__dirname, path.join(dir, name)));
        }
      }
      await page.close();
    }
  }
  await browser.close(); server.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
});
