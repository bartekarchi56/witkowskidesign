// Adds a voice-over (one ElevenLabs take, the script's sentences with pauses between them) to a
// rendered animation: finds the sentences by their pauses, places each at its moment in the video
// and lowers the music while the voice speaks.
//   node marketing/animation/voice.js tre-fatti en voice.mp3 [tempo]
//   → marketing/animation/timbro-tre-fatti-en-voice.mp4   (needs ffmpeg: FFMPEG=/path/to/ffmpeg or on PATH)
// tempo speeds the voice up a little (default 1.08; 1 for tre-clienti and barista, whose beats follow the voice).
const fs = require('fs'), path = require('path'), { execFileSync, spawnSync } = require('child_process');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

// Where each sentence starts in the video, in the script's order (the voice-over script in the
// Instagram README). A sentence that would run into the next one is pushed later.
const CUES = {
  // tre-clienti: the start of every sentence of the take, set with its beats in tre-clienti.json
  'tre-clienti': require('./tre-clienti.json').voice || [],
  barista: require('./barista.json').voice || [],
  cinque: require('./cinque.json').voice || [],
  'quanto-vale': require('./quanto-vale.json').voice || [],
  'tre-fatti': [
    .2,                         // Three facts about regulars that most cafés don't know.
    3.7, 4.5, 6.75,             // Fact one. / Two cards, both need eight stamps. / But card B starts with two already in.
    9.0, 10.9, 12.8,            // Nineteen percent finish card A. / Thirty-four percent finish card B. / Almost double, same reward.
    14.8, 15.65,                // Fact two. / The closer they get to the free coffee, the more often they come back.
    19.55,                      // That's why Timbro reminds them when they're one stamp away.
    23.1, 24.0,                 // Fact three. / Winning a new customer costs five to twenty-five times more than keeping one.
    29.2,                       // The easiest customer is the one you already have.
    32.75                       // Comment TIMBRO, and we'll send you the design of your card.
  ]
};

const [anim, lang, voice, tempoArg] = process.argv.slice(2);
if (!CUES[anim] || !['it', 'en'].includes(lang) || !voice) { console.error('usage: node marketing/animation/voice.js <' + Object.keys(CUES).join('|') + '> <it|en> <voice.mp3> [tempo]'); process.exit(1); }
const tempo = +(tempoArg || { 'tre-clienti': 1, barista: require('./barista.json').tempo || 1, cinque: require('./cinque.json').tempo || 1, 'quanto-vale': require('./quanto-vale.json').tempo || 1 }[anim] || 1.08);
const video = path.join(__dirname, `timbro-${anim}-${lang}.mp4`), out = path.join(__dirname, `timbro-${anim}-${lang}-voice.mp4`);

// The sentences: the sound between pauses of a quarter of a second or more.
const probe = spawnSync(FFMPEG, ['-hide_banner', '-i', voice, '-af', 'silencedetect=noise=-35dB:d=0.25', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const length = (() => { const m = probe.match(/Duration: (\d+):(\d+):([\d.]+)/); return +m[1] * 3600 + +m[2] * 60 + +m[3]; })();
const starts = [...probe.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]), ends = [...probe.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
const sentences = []; let from = 0;
starts.forEach((s, i) => { if (s - from > .15) sentences.push([Math.max(0, from - .03), s + .05]); from = ends[i] ?? length; });
if (length - from > .15) sentences.push([Math.max(0, from - .03), length]);
const cues = CUES[anim];
if (sentences.length !== cues.length) {
  console.error(`Found ${sentences.length} sentences in the voice, the script has ${cues.length}. Make the take again with a clear pause between sentences (or <break time="0.5s" />).`);
  sentences.forEach(([a, b], i) => console.error(`  ${i + 1}. ${a.toFixed(2)}–${b.toFixed(2)} s`));
  process.exit(1);
}
let prev = 0;
// a null cue leaves that piece out (e.g. the time stamps of a script read aloud)
const placed = sentences.map(([a, b], i) => { if (cues[i] == null) return null; const at = Math.max(cues[i], prev + .12), len = (b - a) / tempo; prev = at + len; return { a, b, at, len }; });
placed.forEach((p, i) => console.log(p ? `${String(i + 1).padStart(2)}. voice ${p.a.toFixed(2)}–${p.b.toFixed(2)} s  →  video ${p.at.toFixed(2)}–${(p.at + p.len).toFixed(2)} s${p.at > cues[i] + .01 ? `  (pushed ${(p.at - cues[i]).toFixed(2)} s later)` : ''}` : `${String(i + 1).padStart(2)}. voice ${sentences[i][0].toFixed(2)}–${sentences[i][1].toFixed(2)} s  →  left out`));

// Levels, measured: the voice (while speaking, after a gentle compressor) is set to about -15 dB,
// the film's own sound (music and effects) to about -19 dB, ducking about 9 dB under the voice.
const CLEAN = 'highpass=f=80,acompressor=threshold=0.063:ratio=4:attack=5:release=100';
const mean = (file, af) => +spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-af', af + ',volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/mean_volume: (-?[\d.]+) dB/)[1];
const voiceGain = -15 - mean(voice, CLEAN + ',silenceremove=stop_periods=-1:stop_duration=0.2:stop_threshold=-40dB');
const bedGain = -19 - mean(video, 'anull');
console.log(`levels: voice ${voiceGain >= 0 ? '+' : ''}${voiceGain.toFixed(1)} dB, music ${bedGain >= 0 ? '+' : ''}${bedGain.toFixed(1)} dB`);

// The voice track: each sentence cut out, sped up and delayed to its moment.
const kept = placed.filter(Boolean);
const parts = kept.map((p, i) => `[1:a]atrim=start=${p.a.toFixed(3)}:end=${p.b.toFixed(3)},asetpts=PTS-STARTPTS,atempo=${tempo},adelay=delays=${Math.round(p.at * 1000)}:all=1[v${i}]`);
const filter = [
  ...parts,
  `${kept.map((_, i) => `[v${i}]`).join('')}amix=inputs=${kept.length}:normalize=0,${CLEAN},volume=${voiceGain.toFixed(2)}dB,aformat=channel_layouts=stereo,asplit[vo1][vo2]`,
  `[0:a]volume=${bedGain.toFixed(2)}dB[bed0]`,
  `[bed0][vo1]sidechaincompress=threshold=0.06:ratio=3:attack=25:release=450[bed]`,
  `[bed][vo2]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89:level=false[a]`
].join(';');
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', video, '-i', voice, '-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-movflags', '+faststart', out]);
console.log('✓', path.relative(path.join(__dirname, '..', '..'), out));
