// Rebuilds the Orsonero outreach kit in print/kit-orsonero/ (images, proposal
// PDF and copies of their brochures and poster):   node print/make-kit-orsonero.js
// Run node print/make-pdfs.js first if the brochures or poster changed.
// Needs Playwright with Chromium (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'kit-orsonero');
const COPIES = ['brochure-orsonero-en.pdf', 'brochure-orsonero-it.pdf', 'poster-orsonero-a5.pdf'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  });
});

server.listen(0, async () => {
  const base = `http://localhost:${server.address().port}/`, out = name => path.join(OUT, name);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = async (url, opts = {}) => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, locale: 'en-GB', ...opts });
    await p.goto(base + url); await p.waitForTimeout(1500); await p.evaluate(() => document.fonts.ready);
    return p;
  };

  // The card on an iPhone and on Android, with 6 of 8 bears stamped (the page starts at 4).
  const p = await page('examples/orsonero/?lang=en');
  for (let i = 0; i < 2; i++) await p.click('#stamp-btn');
  await p.waitForTimeout(1200);
  await p.locator('.demo .phone').screenshot({ path: out('orsonero-card-iphone.png') });
  await p.click('#plat button:nth-child(2)'); await p.waitForTimeout(300);
  await p.locator('.demo .phone').screenshot({ path: out('orsonero-card-android.png') });
  // The Instagram launch post, as the page draws it.
  const png = await p.$eval('#insta', i => i.src);
  fs.writeFileSync(out('orsonero-instagram-post.png'), Buffer.from(png.split(',')[1], 'base64'));

  // What the café sees after a few weeks (example data) and the notifications.
  const q = await page('app/dashboard.html?card=orsonero&lang=en#results');
  await q.waitForTimeout(1000);
  await q.locator('.res-top').screenshot({ path: out('orsonero-results.png') });
  await q.goto(base + 'app/dashboard.html?card=orsonero&lang=en#notify'); await q.waitForTimeout(1500);
  await q.locator('#nt-lock').screenshot({ path: out('orsonero-notifications.png') });

  // The proposal page as one long PDF page.
  const r = await page('examples/orsonero/?lang=en', { deviceScaleFactor: 1 });
  await r.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(s => setTimeout(s, 120)); } scrollTo(0, 0); });
  await r.waitForTimeout(800); await r.emulateMedia({ media: 'screen' });
  const height = await r.evaluate(() => document.body.scrollHeight);
  await r.pdf({ path: out('proposal-orsonero-en.pdf'), width: '1280px', height: height + 'px', printBackground: true, pageRanges: '1' });

  for (const name of COPIES) fs.copyFileSync(path.join(__dirname, name), out(name));
  await browser.close(); server.close();
  console.log('✓', fs.readdirSync(OUT).join('\n✓ '));
});
