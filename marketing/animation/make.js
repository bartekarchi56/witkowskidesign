// Renders an animation page frame by frame and makes an MP4 (1080 x 1920, 30 fps) with its
// soundtrack from sound.js: marketing/animation/timbro-<page>-<lang>.mp4
//   node marketing/animation/make.js [due-caffe|come-funziona|due-caffe-2|tre-fatti] [it|en]   (needs ffmpeg: FFMPEG=/path/to/ffmpeg or on PATH)
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const anim = args.find(a => !['it', 'en'].includes(a)) || 'due-caffe';
const lang = args.includes('en') ? 'en' : 'it';
const FPS = 30, FFMPEG = process.env.FFMPEG || 'ffmpeg';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
}).listen(0, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${anim}-`));
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(`http://localhost:${server.address().port}/marketing/animation/${anim}.html?capture&lang=${lang}`);
  await page.waitForFunction(() => window.READY, null, { timeout: 60000 });
  const stage = await page.$('#stage');
  const total = Math.round((await page.evaluate(() => window.DURATION)) * FPS);
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => window.renderAt(t), f / FPS);
    await stage.screenshot({ path: path.join(dir, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if (f % 60 === 0) console.log(`frame ${f}/${total}`);
  }
  await browser.close(); server.close();
  const out = path.join(__dirname, `timbro-${anim}-${lang}.mp4`);
  const wav = path.join(dir, 'sound.wav');
  require('./sound.js').write(wav, anim);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.jpg'), '-i', wav,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out]);
  fs.rmSync(dir, { recursive: true });
  console.log('✓', path.relative(ROOT, out));
});
