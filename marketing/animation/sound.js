// Soundtracks for the animations, synthesised (no samples, nothing to license): a soft lo-fi loop and
// effects timed to each page's timeline.
//   due-caffe:     a pop when the cafés appear, a tick for each day, a "+1" blip for every stamp at the
//                  Timbro café, a paper flutter for the lost card, a whoosh, four stamp thuds and a chime
//   come-funziona: scan beeps, the tap on "Add to Wallet", the card dropping in, the till's beep and
//                  success, a blip for every stamp, the notification, confetti and a chime, typing and
//                  sending a message to all customers, whooshes between the steps
//   tre-fatti:     the café dropping into place, caption ticks, whooshes between the facts, two stamp
//                  thuds, coffee pouring into the glasses, a blip for every stepping stone, the reminder,
//                  a chime and confetti, coins clinking on the balance, the Wallet card filling up
//   tre-clienti:   the café dropping in, a sweep and a ping for each group, a shimmer for the ghosts,
//                  the phone with the dashboard, the message and the reminder, footsteps of the ones
//                  coming back (timed from tre-clienti.json)
//   barista:       the café dropping in, the turn behind the counter, the order, the phones, the scan
//                  beep, a tap and a stamp for each stamp, the reward chime and confetti, the queue's
//                  stamps (timed from barista.json)
//   cinque:        the five numbers popping up, a sweep to each customer, pocket pats, the reward
//                  notification, paper cards fanning out, the cup sliding, running feet, the line-up
//                  (timed from cinque.json)
//   require('./sound.js').write(file, name)  → writes a 44.1 kHz stereo WAV
const fs = require('fs');

const RATE = 44100;
// Same timelines as the pages
const T0 = 2.0, DAY = 1.7, DAYS = 7, T_CMP = T0 + DAYS * DAY + .4, T_END = T_CMP + 2.6;
const COUNT_A = [3, 3, 2, 2, 2, 1, 1], COUNT_B = [2, 3, 4, 5, 6, 7, 8];
const S1 = 2.8, S2 = 7.2, S3 = 11.4, S4 = 15.4, S5 = 18.6, S6 = 22.0, END = 26.4;
const TC = require('./tre-clienti.json'), BA = require('./barista.json'), CQ = require('./cinque.json');
const DURATIONS = { 'due-caffe': T_END + 4.6, 'come-funziona': 30.7, 'due-caffe-2': 38.5, 'tre-fatti': 37.0, 'tre-clienti': TC.duration, barista: BA.duration, cinque: CQ.duration };

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
  } else if (name === 'due-caffe-2') {
    // due-caffe-2: a soft tick for each caption, whooshes into the café and the phone, the stamps,
    // the reminder, the tenth stamp with confetti, the year filling up, a chime for Timbro
    for (const t of [.3, 1.9, 3.4, 5.0, 8.3, 11.0, 14.6, 16.6, 18.4, 20.4, 22.6, 24.4, 33.0]) add(t, .1, x => Math.exp(-x * 40) * Math.sin(2 * Math.PI * 1100 * x), .1);
    for (const t of [8.0, 10.25, 19.85, 25.45, 32.7]) whoosh(t, .7, .3);
    [11.0, 11.5, 12.0, 12.45, 12.9, 13.3, 13.7, 14.05, 14.4].forEach((t, i) => blip(t, 76 + i * 1.5, .1, i % 2 ? .3 : -.3));
    [88, 84, 91].forEach((m, i) => beep(14.6 + i * .12, m, .1, .09));
    thud(16.6, .22); chime(16.75, .12);
    for (let i = 0; i < 36; i++) blip(16.65 + hash(i) * 1.5, 96 + Math.floor(hash(i + 9) * 10), .022, hash(i + 3) - .5);
    for (let i = 0; i < 26; i++) click(26.2 + i * (3.2 / 26), .045);
    chime(30.6, .1);
    blip(34.4, 84, .12, 0);
  } else if (name === 'tre-fatti') {
    const F1 = 3.6, F2 = 13.6, F3 = 23.0, END = 29.0;
    const pop = (t, f0, g, pan = 0) => add(t, .22, x => Math.exp(-x * 20) * Math.sin(2 * Math.PI * (f0 + 600 * x) * x), g, pan);
    for (let i = 0; i < 16; i++) pop(.12 + i * .055 + hash(i) * .02, 260 + i * 22, .13, hash(i + 4) - .5);   // the café drops in
    for (let i = 0; i < 5; i++) pop(1.05 + i * .1, 520 + i * 60, .12, (i - 2) * .2);                          // its people
    for (const t of [.3, 1.9, F1 + .2, 6.4, 8.6, 11.0, F2 + .2, 16.4, 19.6, F3 + .2, 25.2, END + .2, 32.6]) add(t, .1, x => Math.exp(-x * 40) * Math.sin(2 * Math.PI * 1100 * x), .08);
    for (const t of [F1 - .1, F2 - .1, F3 - .1, END - .1]) whoosh(t, .75, .3);
    whoosh(29.95, .6, .25);
    pop(F1 + .2, 420, .16, -.3); pop(F1 + .32, 500, .16, .3);                 // the two cards
    thud(6.97, .22); thud(7.57, .22);                                         // card B's two stamps
    pop(8.32, 380, .14, -.3); pop(8.44, 440, .14, .3);                         // the glasses
    for (const [pan, g] of [[-.35, .1], [.35, .13]]) { let lp = 0; add(8.9, 1.9, x => { lp += (.05 + x * .05) * (rnd() - lp); return lp * Math.min(1, x / .1) * Math.min(1, (1.9 - x) / .5) * (1 + .5 * Math.sin(2 * Math.PI * (7 + x * 4) * x)); }, g, pan); }
    chime(11.05, .07);
    for (let i = 0; i < 10; i++) pop(F2 + .1 + i * .05, 600 + i * 30, .06, (i / 10 - .5));                  // stepping stones appear
    [14.6, 15.55, 16.37, 17.09, 17.71, 18.25, 18.72, 19.14, 19.51, 21.0].forEach((t, i) => blip(t, 72 + i * 1.6, .11, i % 2 ? .3 : -.3));
    [88, 84, 91].forEach((m, i) => beep(19.5 + i * .12, m, .1, .09));         // the reminder
    chime(21.05, .12); for (let i = 0; i < 30; i++) blip(21.1 + hash(i) * 1.4, 96 + Math.floor(hash(i + 9) * 10), .02, hash(i + 3) - .5);
    const clink = (t, g, pan) => { const k = .9 + hash(t * 100) * .25; add(t, .35, x => Math.exp(-x * 14) * (Math.sin(2 * Math.PI * 2350 * k * x) + .7 * Math.sin(2 * Math.PI * 3720 * k * x) * Math.exp(-x * 10) + .4 * Math.sin(2 * Math.PI * 5210 * k * x) * Math.exp(-x * 20)), g, pan); add(t, .02, x => rnd() * Math.exp(-x * 300), g * .6, pan); };
    clink(F3 + 1.02, .05, .3);
    for (let k = 0; k < 25; k++) clink(F3 + 1.12 + k * .085, .045, -.3);
    [30.5, 30.8, 31.1, 31.35, 31.6, 31.82, 32.04].forEach((t, i) => blip(t, 78 + i * 1.5, .1, i % 2 ? .3 : -.3));
    thud(32.3, .22); chime(32.42, .12);
    for (let i = 0; i < 30; i++) blip(32.35 + hash(i + 40) * 1.5, 96 + Math.floor(hash(i + 19) * 10), .02, hash(i + 13) - .5);
    blip(33.4, 84, .12, 0);
  } else if (name === 'tre-clienti') {
    const [B0, B1, B2, B3, B4, B5, B6, B7, B8] = TC.beats;
    const pop = (t, f0, g, pan = 0) => add(t, .22, x => Math.exp(-x * 20) * Math.sin(2 * Math.PI * (f0 + 600 * x) * x), g, pan);
    for (let i = 0; i < 16; i++) pop(.12 + i * .055 + hash(i) * .02, 260 + i * 22, .13, hash(i + 4) - .5);   // the café drops in
    for (let i = 0; i < 6; i++) pop(1.05 + i * .1, 520 + i * 50, .12, (i - 2.5) * .15);                       // its people
    for (const t of TC.beats.slice(1)) add(t, .1, x => Math.exp(-x * 40) * Math.sin(2 * Math.PI * 1100 * x), .07);
    whoosh(B1 - .05, .9, .22);
    [[B2, 76, 3], [B3, 81, 2], [B4, 69, 3]].forEach(([t, m, n]) => { whoosh(t - .05, 1.1, .28); for (let k = 0; k < n; k++) blip(t + .45 + k * .15, m + k * 2, .1, (k - 1) * .3); });
    pop(B2 + 1.6, 700, .1);                                                       // "The usual, Marco?"
    for (let k = 0; k < 3; k++) { const f0 = 660 - k * 70; add(B4 + .35 + k * .15, 1.4, x => Math.sin(2 * Math.PI * (f0 - 60 * x) * x) * Math.sin(Math.PI * x / 1.4) * (.6 + .4 * Math.sin(2 * Math.PI * 6 * x)), .035, (k - 1) * .4); }   // ghosts
    whoosh(B5 - .05, .7, .3); for (let k = 0; k < 3; k++) pop(B5 + .25 + k * .45, 520 + k * 80, .09);   // the dashboard
    whoosh(B6 - .25, .6, .22);
    [88, 84, 91].forEach((m, i) => beep(B6 + .35 + i * .12, m, .1, .09));        // "1 stamp to go"
    for (let k = 0; k < 3; k++) blip(B6 + .75 + k * .2, 84 + k * 3, .06, .2);
    whoosh(B7 - .3, .6, .22);
    [88, 84, 91].forEach((m, i) => beep(B7 + .05 + i * .12, m, .1, .09));        // the reminder
    for (let i = 0; i < 3; i++) { const s0 = B7 + 1.0 + i * .35; for (let k = 0; k < 14; k++) add(s0 + k * .17, .05, x => rnd() * Math.exp(-x * 90), .05, .5 - i * .3); blip(s0 + 2.4, 79 + i * 3, .09, -.2); }
    chime(B8 + .1, .1); blip(B8 + .9, 84, .1, 0);
  } else if (name === 'barista') {
    const [B0, B1, B2, B3, B4, B5, B6, B7] = BA.beats, M = BA.marks || {};
    const FOUND = M.found ?? B2 + 1.7, TAP1 = M.tap1 ?? B3 + .55, TAPR = M.tapR ?? B5 + .5, R5 = TAPR - .5;
    const pop = (t, f0, g, pan = 0) => add(t, .22, x => Math.exp(-x * 20) * Math.sin(2 * Math.PI * (f0 + 600 * x) * x), g, pan);
    for (let i = 0; i < 16; i++) pop(.12 + i * .055 + hash(i) * .02, 260 + i * 22, .13, hash(i + 4) - .5);   // the café drops in
    for (let i = 0; i < 8; i++) pop(1.05 + i * .1, 520 + i * 40, .1, (i - 3.5) * .12);                        // its people
    for (const t of BA.beats.slice(1)) add(t, .1, x => Math.exp(-x * 40) * Math.sin(2 * Math.PI * 1100 * x), .07);
    whoosh(2.3, 1.4, .26);                                                         // turning round behind the counter
    pop(B1 + .4, 700, .1);                                                         // "A cappuccino, please!"
    whoosh(B1 + 1.25, .5, .25); whoosh(B2 + .1, .5, .25);                           // the two phones
    beep(FOUND - .35, 88, .07, .12); beep(FOUND - .25, 93, .1, .12);               // QR recognised
    const TAPS = [TAP1, B4 + .45, B4 + .95];
    TAPS.forEach((t, i) => { click(t, .22); blip(t + .62, 79 + i * 2, .12, .3); });  // tap, the stamp lands
    [88, 84, 91].forEach((m, i) => beep(B4 + 1.05 + i * .12, m, .1, .08));         // card full
    click(TAPR, .22); thud(TAPR + .1, .18); chime(TAPR + .2, .1);                  // the reward
    whoosh(R5 + 2.0, .6, .22);
    add(R5 + 2.3, .6, x => { let v = 0; v = Math.sin(2 * Math.PI * 180 * x) * .2; return v * Math.exp(-x * 4) * (hash(Math.floor(x * 400)) - .5); }, .2);   // the cup slides
    for (let i = 0; i < 26; i++) blip(R5 + 2.95 + hash(i + 70) * 1.3, 96 + Math.floor(hash(i + 29) * 10), .02, hash(i + 33) - .5);
    whoosh(B6 - .05, 1.0, .24);
    for (let i = 0; i < 3; i++) { const t = B6 + .6 + i * 1.15 + .5; beep(t - .1, 88, .06, .08); blip(t, 81 + i * 2, .11, 0); }
    chime(B7 + .1, .1); blip(B7 + .9, 84, .1, 0);
  } else if (name === 'cinque') {
    const [B0, B1, B2, B3, B4, B5, B6, B7] = CQ.beats;
    const pop = (t, f0, g, pan = 0) => add(t, .22, x => Math.exp(-x * 20) * Math.sin(2 * Math.PI * (f0 + 600 * x) * x), g, pan);
    for (let i = 0; i < 5; i++) pop(.2 + i * .1, 520 + i * 70, .14, (i - 2) * .2);                          // the numbers
    for (const t of CQ.beats.slice(1)) add(t, .1, x => Math.exp(-x * 40) * Math.sin(2 * Math.PI * 1100 * x), .07);
    [B1, B2, B3, B4, B5].forEach((t, i) => { whoosh(t - .2, .6, .22); pop(t + .05, 620 + i * 60, .12); });
    for (let k = 0; k < 10; k++) add(B1 + .4 + k * .13, .06, x => rnd() * Math.exp(-x * 70), .06, k % 2 ? .3 : -.3);   // patting pockets
    blip(B2 + 1.0, 84, .1, 0); [88, 84, 91].forEach((m, i) => beep(B2 + 1.6 + i * .12, m, .1, .08));              // reward ready, the notification
    for (let k = 0; k < 12; k++) { let lp = 0; add(B3 + .3 + k * .07, .12, x => { lp += .3 * (rnd() - lp); return lp * Math.exp(-x * 30); }, .12, (k - 6) * .05); }   // paper cards fanning out
    pop(B4 + .35, 700, .1); add(B4 + 1.2, .5, x => Math.sin(2 * Math.PI * 180 * x) * .2 * Math.exp(-x * 4) * (hash(Math.floor(x * 400)) - .5), .2);   // "the usual", the cup slides
    [B5 + .1, B5 + 1.2, B5 + 2.1, B5 + 2.85].forEach((s0, i) => { for (let k = 0; k < 5; k++) add(s0 + k * .14, .04, x => rnd() * Math.exp(-x * 120), .07, .3); blip(s0 + .5, 76 + i * 3, .08, .2); });   // running in, day after day
    [88, 84, 91].forEach((m, i) => beep(B5 + 1.0 + i * .12, m, .1, .08));
    whoosh(B6 - .4, 1.0, .25); for (let i = 0; i < 5; i++) pop(B6 + .7 + i * .09, 520 + i * 70, .12, (i - 2) * .2);   // the line-up
    chime(B7 + .1, .1); blip(B7 + .7, 84, .1, 0);
  } else {
    // come-funziona
    const pop = (t, f0, g) => add(t, .25, x => Math.exp(-x * 18) * Math.sin(2 * Math.PI * (f0 + 500 * x) * x), g);
    pop(.35, 420, .22);
    for (const t of [S1, S2, S3, S4, S5, S6, END]) whoosh(t - .15, .7, .28);
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
    for (let i = 0; i < 14; i++) click(S6 + .6 + i * .078 + hash(i + 70) * .03, .06);   // typing the message
    click(S6 + 1.8, .22); whoosh(S6 + 1.9, .6, .3);                        // send
    for (const d of [2.6, 2.75, 2.9]) [88, 84, 91].forEach((m, i) => beep(S6 + d + i * .1, m, .09, .07));   // every phone gets it
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
