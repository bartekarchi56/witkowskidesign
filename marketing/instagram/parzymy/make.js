// Renders marketing/instagram/parzymy/post.html and post-karta.html into PNGs (1080 x 1350):
//   node marketing/instagram/parzymy/make.js
const http = require('http'), fs = require('fs'), path = require('path');
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
  for (const name of ['post', 'post-karta', 'post-dolacz']) {
    const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
    await p.goto(`http://localhost:${server.address().port}/marketing/instagram/parzymy/${name}.html`);
    await p.waitForFunction(() => window.READY === true, null, { timeout: 15000 });
    await p.locator('#post').screenshot({ path: path.join(__dirname, name + '.png') });
    await p.close();
  }
  await b.close(); server.close();
  console.log('✓ marketing/instagram/parzymy/post.png, post-karta.png, post-dolacz.png');
});
