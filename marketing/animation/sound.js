// Soundtracks for the animations, synthesised (no samples, nothing to license): a soft lo-fi loop and
// effects timed to each page's timeline.
//   due-caffe:     a pop when the cafés appear, a tick for each day, a "+1" blip for every stamp at the
//                  Timbro café, a paper flutter for the lost card, a whoosh, four stamp thuds and a chime
//   come-funziona: scan beeps, the tap on "Add to Wallet", the card dropping in, the till's beep and
//                  success, a blip for every stamp, the notification, confetti and a chime, whooshes
//                  between the steps
//   require('./sound.js').write(file, name)  → writes a 44.1 kHz stereo WAV
const fs = require('fs');

const RATE = 44100;
// Same timelines as the pages
const T0 = 2.0, DAY = 1.7, DAYS = 7, T_CMP = T0 + DAYS * DAY + .4, T_END = T_CMP + 2.6;
const COUNT_A = [3, 3, 2, 2, 2, 1, 1], COUNT_B = [2, 3, 4, 5, 6, 7, 8];
const S1 = 2.8, S2 = 7.2, S3 = 11.4, S4 = 15.4, S5 = 18.6, END = 22.2;
const DURATIONS = { 'due-caffe': T_END + 4.6, 'come-funziona': 26.5 };

function render(name) {
  const DURATION = DURATIONS[name];
  const n = Math.ceil(DURATION * RATE), L = new Float32Array(n), R = new Float32Array(n);
  const add = (t0, len, fn, gain = 1, pan = 0) => {
    const s0 = Math.floor(t0 * RATE), sl = Math.floor(len * RATE);
    const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
    for (let i = 0; i < sl && s0 + i < n; i++) { if (s0 + i < 0) continue; const v = fn(i / RATE); L[s0 + i] += v * gl; R[s0 + i] += v * gr; }
  };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 * 2 - 1;
  const hash = i => { const v = Math.sin(i * 127.1) * 43758.5453; return v - Math.floor(v); };

  // Music: 84 bpm, four chords of one bar each, looping. Warm pad, soft plucked arpeggio, light kick and shaker.
  const BEAT = 60 / 84, BAR = BEAT * 4;
  const CHORDS = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 65]];   // Cmaj7 Am7 Fmaj7 G7
  const musicEnd = DURATION - .2;
  for (let b = 0; b * BAR < musicEnd; b++) {
    const t = b * BAR, ch = CHORDS[b % 4], last = t + BAR > DURATION - 2.2;
    const chord = last ? [48, 55, 64, 72] : ch;
    const len = Math.min(BAR + .4, musicEnd - t);
    // pad
    for (const m of chord) {
      const f = hz(m);
      add(t, len, x => {
        const env = Math.min(1, x / .35) * Math.min(1, (len - x) / .4);
        return env * (Math.sin(2 * Math.PI * f * x) + .3 * Math.sin(2 * Math.PI * f * 2.002 * x) + .15 * Math.sin(2 * Math.PI * f * .5 * x));
      }, .03);
    }
    // arpeggio, an octave up, eighth notes
    for (let k = 0; k < 8 && t + k * BEAT / 2 < musicEnd; k++) {
      const m = chord[[0, 2, 1, 3, 2, 1, 3, 2][k]] + 12, f = hz(m);
      add(t + k * BEAT / 2, .6, x => Math.exp(-x * 7) * (Math.sin(2 * Math.PI * f * x) + .25 * Math.sin(2 * Math.PI * 2 * f * x)), .05, k % 2 ? .35 : -.35);
    }
    // kick on 1 and 3, shaker on the off-beats (from the first day on)
    if (t >= 1.9) {
      for (const k of [0, 2]) add(t + k * BEAT, .35, x => Math.exp(-x * 12) * Math.sin(2 * Math.PI * (48 + 70 * Math.exp(-x * 30)) * x), .16);
      for (let k = 0; k < 4; k++) { let lp = 0; add(t + (k + .5) * BEAT, .09, x => { const v = rnd(); lp += .55 * (v - lp); return (v - lp) * Math.exp(-x * 60); }, .05, .2); }
    }
  }

  const whoosh = (t, len, g) => { let lp = 0; add(t, len, x => { const a = .02 + .25 * Math.sin(Math.PI * x / len); lp += a * (rnd() - lp); return lp * Math.sin(Math.PI * x / len); }, g); };
  const blip = (t, m, g = .11, pan = .25) => { const f = hz(m); add(t, .3, x => Math.exp(-x * 14) * (Math.sin(2 * Math.PI * f * x) + .4 * Math.sin(2 * Math.PI * f * 1.5 * x)) * Math.min(1, x / .004), g, pan); };
  const beep = (t, m, len, g) => { const f = hz(m); add(t, len, x => Math.sin(2 * Math.PI * f * x) * Math.min(1, x / .005) * Math.min(1, (len - x) / .02), g); };
  const thud = (t, g = .2) => { add(t, .3, x => Math.exp(-x * 22) * Math.sin(2 * Math.PI * (90 + 60 * Math.exp(-x * 40)) * x), g); add(t, .04, x => rnd() * Math.exp(-x * 120), .12); };
  const chime = (t, g = .12) => [72, 76, 79, 84].forEach((m, i) => { const f = hz(m); add(t + i * .08, 1.6, x => Math.exp(-x * 2.6) * (Math.sin(2 * Math.PI * f * x) + .3 * Math.sin(2 * Math.PI * f * 3.01 * x) * Math.exp(-x * 5)), g); });
  const click = (t, g = .25) => add(t, .03, x => rnd() * Math.exp(-x * 200), g);

  if (name === 'due-caffe') {
    // Cafés appear: two soft pops
    const pop = (t, f0, g) => add(t, .25, x => Math.exp(-x * 18) * Math.sin(2 * Math.PI * (f0 + 500 * x) * x), g);
    pop(.25, 380, .22); pop(.55, 480, .22);
    // Each day: a woodblock tick
    for (let d = 0; d < DAYS; d++) add(T0 + d * DAY, .12, x => Math.exp(-x * 45) * Math.sin(2 * Math.PI * 1250 * x), .12);
    // Timbro café: a "+1" blip for every stamp, a little higher as the week goes on
    for (let d = 0; d < DAYS; d++) for (let k = 0; k < COUNT_B[d]; k++) {
      const t = T0 + DAY * (d + k * .1 + .55), f = hz(81 + (d % 3) * 2 + (k % 2) * 3);
      add(t, .3, x => Math.exp(-x * 14) * (Math.sin(2 * Math.PI * f * x) + .4 * Math.sin(2 * Math.PI * f * 1.5 * x)) * Math.min(1, x / .004), .11, .25);
    }
    // The other café: the paper card flutters down
    for (let d = 0; d < DAYS; d++) {
      const t = T0 + DAY * (d + .55); let lp = 0;
      add(t, .45, x => { lp += .12 * (rnd() - lp); return lp * Math.sin(Math.PI * Math.min(1, x / .45)) * (1 + .6 * Math.sin(2 * Math.PI * 9 * x)); }, .35, -.3);
    }
    // Comparison: a soft whoosh
    { let lp = 0; add(T_CMP - .2, 1.1, x => { const a = .02 + .25 * Math.sin(Math.PI * x / 1.1); lp += a * (rnd() - lp); return lp * Math.sin(Math.PI * x / 1.1); }, .5); }
    // End screen: the card's last four stamps (thud and click), then a chime
    for (let i = 0; i < 4; i++) {
      const t = T_END + .6 + i * .55;
      add(t, .3, x => Math.exp(-x * 22) * Math.sin(2 * Math.PI * (90 + 60 * Math.exp(-x * 40)) * x), .2);
      add(t, .04, x => rnd() * Math.exp(-x * 120), .12);
    }
    const chimeT = T_END + .6 + 3 * .55 + .25;
    [72, 76, 79, 84].forEach((m, i) => { const f = hz(m); add(chimeT + i * .08, 1.6, x => Math.exp(-x * 2.6) * (Math.sin(2 * Math.PI * f * x) + .3 * Math.sin(2 * Math.PI * f * 3.01 * x) * Math.exp(-x * 5)), .12); });
  } else {
    // come-funziona
    const pop = (t, f0, g) => add(t, .25, x => Math.exp(-x * 18) * Math.sin(2 * Math.PI * (f0 + 500 * x) * x), g);
    pop(.35, 420, .22);
    for (const t of [S1, S2, S3, S4, S5, END]) whoosh(t - .15, .7, .28);
    beep(S1 + 1.7, 88, .07, .12); beep(S1 + 1.8, 93, .1, .12);            // QR recognised
    click(S1 + 2.7); whoosh(S1 + 3.15, .5, .3);                            // tap "Add to Wallet", the card drops in
    blip(S1 + 3.7, 84, .12, 0);
    beep(S2 + 1.4, 86, .09, .12);                                          // the till scans the card
    beep(S2 + 1.75, 84, .08, .1); beep(S2 + 1.85, 91, .14, .1);            // success
    blip(S2 + 1.9, 81, .13);                                               // +1
    for (let k = 2; k <= 8; k++) blip(S3 + .5 + (k - 2) * .42, 76 + k * 1.5, .1, k % 2 ? .3 : -.3);
    [88, 84, 91].forEach((m, i) => beep(S3 + 3.2 + i * .12, m, .1, .09));  // notification
    thud(S4 + .3, .22); chime(S4 + .45, .13);                              // the tenth stamp, the reward
    for (let i = 0; i < 40; i++) { const t = S4 + .35 + hash(i) * 1.6; blip(t, 96 + Math.floor(hash(i + 9) * 10), .025, hash(i + 3) - .5); }
    for (let i = 0; i < 12; i++) click(S5 + .8 + i * .1, .05);              // the chart's bars
    chime(END + .4, .09);
  }

  // Fade the ends, normalise to -1 dBFS
  const fade = Math.floor(.4 * RATE);
  for (let i = 0; i < fade; i++) { const g = i / fade; L[n - 1 - i] *= g; R[n - 1 - i] *= g; }
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const k = .89 / (peak || 1);
  return { L: L.map(v => v * k), R: R.map(v => v * k) };
}

function write(file, name = 'due-caffe') {
  const { L, R } = render(name), n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(L[i] * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * 32767), 46 + i * 4); }
  fs.writeFileSync(file, buf);
}
module.exports = { write };
if (require.main === module) write(process.argv[2] || 'sound.wav', process.argv[3] || 'due-caffe');
