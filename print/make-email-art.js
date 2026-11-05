// Renders print/email-art.html into assets/email/{hero,phones}-<lang>.png (2x) for the
// proposal e-mail:   node print/make-email-art.js
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
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 700, height: 1600 }, deviceScaleFactor: 2 });
  for (const lang of ['pl', 'it', 'en']) {
    await p.goto(`http://localhost:${server.address().port}/print/email-art.html?lang=${lang}`);
    await p.waitForFunction(() => window.READY === true);
    for (const id of ['hero', 'phones']) await p.locator('#' + id).screenshot({ path: path.join(ROOT, 'assets/email', `${id}-${lang}.png`) });
    console.log('✓', lang);
  }
  await b.close(); server.close();
});
