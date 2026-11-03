// Renders print/parzymy-options.html into print/kit-parzymy/propozycje-kart.png:
//   node print/make-parzymy-options.js
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(file, (err, data) => { if (err || !file.startsWith(ROOT)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});
server.listen(0, async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1290, height: 1200 }, deviceScaleFactor: 2.5 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${server.address().port}/print/parzymy-options.html`);
  await p.waitForFunction(() => window.READY === true, null, { timeout: 15000 });
  await p.locator('#board').screenshot({ path: path.join(__dirname, 'kit-parzymy', 'propozycje-kart.png') });
  await b.close(); server.close();
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log('✓ print/kit-parzymy/propozycje-kart.png');
});
