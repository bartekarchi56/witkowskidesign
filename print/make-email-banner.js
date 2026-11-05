// Renders print/email-banner.html into assets/email/banner-<lang>.png (1200x600, shown at 600x300
// in the leads e-mail):   node print/make-email-banner.js
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(file, (err, data) => { if (err || !file.startsWith(ROOT)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});
server.listen(0, async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 700, height: 400 }, deviceScaleFactor: 2 });
  for (const lang of ['pl', 'it', 'en']) {
    await p.goto(`http://localhost:${server.address().port}/print/email-banner.html?lang=${lang}`);
    await p.waitForFunction(() => window.READY === true);
    await p.locator('#b').screenshot({ path: path.join(ROOT, 'assets/email', `banner-${lang}.png`) });
    console.log('✓ assets/email/banner-' + lang + '.png');
  }
  await b.close(); server.close();
});
