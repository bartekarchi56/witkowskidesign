// Renders print/plakat-parzymy.html as A4 and A3 PDFs into print/kit-parzymy/:
//   node print/make-plakat-parzymy.js
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
  const b = await chromium.launch();
  for (const [size, bg] of [['A4', 'tlo'], ['A5', 'tlo']]) {
    const p = await b.newPage({ viewport: { width: 1000, height: 1400 } });
    await p.goto(`http://localhost:${server.address().port}/print/plakat-parzymy.html?size=${size}${bg ? '&bg=' + bg : ''}`);
    await p.waitForFunction(() => window.READY === true, null, { timeout: 15000 });
    await p.pdf({ path: path.join(__dirname, 'kit-parzymy', `plakat-parzymy-${size}${bg ? '-' + bg : ''}.pdf`), width: { A3: '297mm', A4: '210mm', A5: '148mm' }[size], height: { A3: '420mm', A4: '297mm', A5: '210mm' }[size], printBackground: true, pageRanges: '1' });
    console.log(`✓ print/kit-parzymy/plakat-parzymy-${size}${bg ? '-' + bg : ''}.pdf`);
    await p.close();
  }
  await b.close(); server.close();
});
