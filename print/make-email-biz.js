// Renders print/email-biz.html into assets/email/biz-<lang>.jpg (en, pl, it):  node print/make-email-biz.js
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(file, (err, data) => { if (err || !file.startsWith(ROOT)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});
server.listen(0, async () => {
  const b = await chromium.launch();
  for (const lang of ['en', 'pl', 'it']) {
    const p = await b.newPage({ viewport: { width: 1200, height: 760 } });
    await p.goto(`http://localhost:${server.address().port}/print/email-biz.html?lang=${lang}`);
    await p.waitForFunction(() => window.READY === true, null, { timeout: 15000 });
    await p.locator('#b').screenshot({ path: path.join(ROOT, 'assets', 'email', `biz-${lang}.jpg`), type: 'jpeg', quality: 86 });
    await p.close(); console.log(`✓ assets/email/biz-${lang}.jpg`);
  }
  await b.close(); server.close();
});
