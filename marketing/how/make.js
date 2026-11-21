// Renders steps.html (?step=1..3) into assets/video/how-<n>.mp4 and how-<n>.jpg (540 x 960, 8 s, 30 fps, no sound).
//   node marketing/how/make.js
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = path.join(__dirname, '..', '..'), OUT = path.join(ROOT, 'assets', 'video');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  for (const step of [1, 2, 3]) {
    await p.goto('file://' + path.join(__dirname, 'steps.html') + '?capture&step=' + step);
    await p.waitForFunction(() => window.READY === true);
    const FPS = 30, total = 8 * FPS, out = path.join(OUT, `how-${step}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', out]);
    const done = new Promise((ok, no) => ff.on('close', c => c ? no(new Error('ffmpeg ' + c)) : ok()));
    for (let f = 0; f < total; f++) {
      await p.evaluate(t => window.renderAt(t), f / FPS);
      const jpg = await p.screenshot({ type: 'jpeg', quality: 90 });
      if (f === Math.round(total * .75)) fs.writeFileSync(path.join(OUT, `how-${step}.jpg`), jpg);
      if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await done; console.log('✓ how-' + step);
  }
  await b.close();
})();
