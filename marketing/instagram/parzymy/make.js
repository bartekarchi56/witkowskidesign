// Renders the Parzymy Tutaj Instagram posts in marketing/instagram/parzymy/:
//   <name>.png        feed post 4:5 (1080 x 1350)
//   <name>-story.png  story / reel cover 9:16 (1080 x 1920): the same design, centred, background extended
//   <name>-reel.mp4   reel 9:16, 8 s, a slow zoom on the story image (needs ffmpeg; Instagram adds the music)
//   node marketing/instagram/parzymy/make.js            all
//   node marketing/instagram/parzymy/make.js post-karta one
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = path.join(__dirname, '..', '..', '..');
const NAMES = ['post', 'post-karta', 'post-dolacz', 'post-ziarna'].filter(n => !process.argv[2] || n === process.argv[2]);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(file, (err, data) => { if (err || !file.startsWith(ROOT)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});
server.listen(0, async () => {
  const b = await chromium.launch();
  for (const name of NAMES) {
    for (const story of [false, true]) {
      const p = await b.newPage({ viewport: { width: 1080, height: story ? 1920 : 1350 } });
      await p.goto(`http://localhost:${server.address().port}/marketing/instagram/parzymy/${name}.html`);
      await p.waitForFunction(() => window.READY === true, null, { timeout: 15000 });
      if (story) await p.evaluate(() => {
        // 9:16: the post's own background fills 1920 px; its content sits in the middle (Instagram's safe zone).
        const post = document.getElementById('post'), cs = getComputedStyle(post);
        const inner = document.createElement('div');
        inner.style.cssText = `position:absolute;left:0;top:285px;width:1080px;height:1350px;display:${cs.display};flex-direction:${cs.flexDirection};align-items:${cs.alignItems};justify-content:${cs.justifyContent}`;
        while (post.firstChild) inner.appendChild(post.firstChild);
        post.appendChild(inner); post.style.height = '1920px';
      });
      const out = path.join(__dirname, name + (story ? '-story' : '') + '.png');
      await p.locator('#post').screenshot({ path: out });
      await p.close();
      console.log('✓ ' + path.relative(ROOT, out));
      if (story) {
        const mp4 = path.join(__dirname, name + '-reel.mp4');
        execFileSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', out, '-vf',
          "scale=2160:3840,zoompan=z='1+0.06*on/240':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=240:s=1080x1920:fps=30,format=yuv420p",
          '-t', '8', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', mp4]);
        console.log('✓ ' + path.relative(ROOT, mp4));
      }
    }
  }
  await b.close(); server.close();
});
