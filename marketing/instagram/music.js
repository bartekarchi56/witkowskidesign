// Gives every reel a soundtrack: reels drawn by studio.html have no sound, and Instagram's API can't add
// music from Instagram's library, so the music goes into the file. It is the lo-fi loop of
// marketing/animation/sound.js (synthesised, nothing to license), in one of four tempos and keys picked
// from the reel's name, so the reels don't all sound the same. Reels that already have sound are left as they are.
//   node marketing/instagram/music.js                  every reel in en/ and it/
//   node marketing/instagram/music.js en/reel-how.mp4  only these
// make.js calls addMusic() after rendering each reel. Needs ffmpeg (on PATH, or FFMPEG=/path/to/ffmpeg).
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const { write } = require('../animation/sound.js');

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const VARIANTS = [{ bpm: 84, key: 0 }, { bpm: 90, key: 2 }, { bpm: 78, key: -3 }, { bpm: 96, key: 5 }];

const probe = file => spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr;

// Adds the music to `file` (an .mp4) unless it already has sound. Returns true when it added it.
function addMusic(file) {
  const info = probe(file);
  if (/Audio:/.test(info)) return false;
  const m = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!m) throw new Error('No duration: ' + file);
  const duration = +m[1] * 3600 + +m[2] * 60 + +m[3];
  const name = path.basename(file, '.mp4').replace(/-(it|en)$/, '');
  const variant = VARIANTS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % VARIANTS.length];
  const wav = file + '.music.wav', tmp = file + '.music.mp4';
  write(wav, 'bed', { duration, ...variant });
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', file, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-af', 'loudnorm=I=-17:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', tmp], { encoding: 'utf8' });
  fs.unlinkSync(wav);
  if (r.status) { fs.rmSync(tmp, { force: true }); throw new Error('ffmpeg failed: ' + file + '\n' + r.stderr); }
  fs.renameSync(tmp, file);
  return true;
}

module.exports = { addMusic };

if (require.main === module) {
  const files = process.argv.length > 2 ? process.argv.slice(2).map(f => path.resolve(__dirname, f))
    : ['en', 'it'].flatMap(d => fs.existsSync(path.join(__dirname, d)) ? fs.readdirSync(path.join(__dirname, d)).filter(f => f.endsWith('.mp4')).map(f => path.join(__dirname, d, f)) : []);
  for (const f of files) console.log(addMusic(f) ? '♪' : '·', path.relative(__dirname, f));
}
