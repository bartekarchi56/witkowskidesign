// Renders the example card designs in print/example-cards.html into
// print/kit-sowa/ and print/kit-orsonero/:   node print/make-example-cards.js
// Needs Playwright with Chromium (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  });
});

server.listen(0, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 3 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/print/example-cards.html`);
  await page.waitForFunction(() => window.READY === true); await page.waitForTimeout(800);
  for (const id of await page.$$eval('.shot', s => s.map(x => x.id))) {
    const dir = path.join(__dirname, id.startsWith('sowa') ? 'kit-sowa' : 'kit-orsonero');
    fs.mkdirSync(dir, { recursive: true });
    await page.locator(`#${id} .pass`).screenshot({ path: path.join(dir, `card-${id}.png`), omitBackground: true });
    console.log('✓', path.relative(__dirname, path.join(dir, `card-${id}.png`)));
  }
  await page.screenshot({ path: path.join(__dirname, 'kit-sowa', 'example-cards-overview.png'), fullPage: true });
  await browser.close(); server.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
});
