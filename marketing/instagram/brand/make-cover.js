// Renders brand/cover.html into brand/cover-facebook.png (1640 x 624, the Facebook Page cover).
//   node marketing/instagram/brand/make-cover.js
const http = require('http'), fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = path.join(__dirname, '../../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
}).listen(0, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1640, height: 624 }, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${server.address().port}/marketing/instagram/brand/cover.html`);
  await page.waitForFunction(() => window.READY === true); await page.waitForTimeout(500);
  await page.locator('#stage').screenshot({ path: path.join(__dirname, 'cover-facebook.png') });
  console.log('✓ cover-facebook.png');
  await browser.close(); server.close();
});
