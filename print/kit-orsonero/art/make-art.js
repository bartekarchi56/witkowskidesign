// Draws Orsonero's artwork as clean vector lines (no traced picture):
//   orsonero-logo.svg   arched ORSONERO, the walking bear, "dal 2016", C O F F E E
//   orsonero-stamp.svg  the bear in a circle, used as the card's stamp
// Run: node print/kit-orsonero/art/make-art.js
const fs = require('fs'), path = require('path');
const INK = '#141414';

// Monoline capitals and figures, drawn in a box 100 high; w = advance width.
const G = {
  O: { w: 96, d: 'M48 0A48 50 0 1 1 47.9 0Z' },
  R: { w: 62, d: 'M0 100V0H30A25 25 0 0 1 30 50H0M28 50L62 100' },
  S: { w: 62, d: 'M58 16C53 5 44 0 31 0C15 0 4 9 4 24C4 40 18 45 31 49C47 54 60 59 60 76C60 92 47 100 31 100C17 100 6 94 1 82' },
  N: { w: 72, d: 'M0 100V0L72 100V0' },
  E: { w: 54, d: 'M54 0H0V100H54M0 50H46' },
  C: { w: 88, d: 'M86 18A48 50 0 1 0 86 82' },
  F: { w: 52, d: 'M54 0H0V100M0 50H44' },
  2: { w: 62, d: 'M4 24C6 9 18 0 33 0C48 0 60 10 60 25C60 39 51 47 38 59L3 100H62' },
  0: { w: 60, d: 'M30 0A30 50 0 1 1 29.9 0Z' },
  1: { w: 40, d: 'M8 20L32 0V100' },
  6: { w: 62, d: 'M54 8C48 3 41 0 33 0C14 0 3 22 2 62M31 40A29 30 0 1 1 30.9 40Z' },
  d: { w: 66, d: 'M62 0V100M33 38A28 31 0 1 0 33.1 38Z' },
  a: { w: 66, d: 'M62 38V100M33 38A28 31 0 1 0 33.1 38Z' },
  l: { w: 10, d: 'M5 0V100' }
};
// A word laid out flat: returns paths placed at x, baseline y, scale s (cap height = 100*s).
// Strokes scale with the letters, so the group's stroke-width is divided by s.
function word(text, x, y, s, track = 0) {
  let out = '', cx = x;
  for (const ch of text) { const g = G[ch]; out += `<path transform="translate(${cx.toFixed(1)} ${(y - 100 * s).toFixed(1)}) scale(${s})" d="${g.d}"/>`; cx += (g.w + track) * s; }
  return { svg: out, width: cx - x - track * s };
}
// A word on an arc: letters centred on the circle (cx, cy, r) between two angles (degrees, 0 = up).
function arc(text, cx, cy, r, from, to, s) {
  const n = text.length; let out = '';
  [...text].forEach((ch, i) => {
    const a = from + (to - from) * (i / (n - 1)), g = G[ch], rad = a * Math.PI / 180;
    const x = cx + r * Math.sin(rad), y = cy - r * Math.cos(rad);
    out += `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(1)}) scale(${s}) translate(${-g.w / 2} -100)" d="${g.d}"/>`;
  });
  return out;
}

// The walking bear, facing right, one continuous outline plus the inner leg, ear, eye and stripes.
const BEAR = `
  <path d="M104 268C86 236 86 186 116 164C146 143 196 138 232 142C240 135 248 131 255 130C253 116 274 111 280 127C298 131 314 141 326 152L344 162C350 167 346 176 336 177C322 178 308 181 299 189C291 197 286 207 285 217L292 260C293 269 287 273 279 273H264C256 273 252 268 252 261L248 230C229 237 204 240 184 237L176 262C174 270 169 273 161 273H116C108 273 105 271 104 268Z"/>
  <path d="M262 226C266 236 268 246 268 257"/>
  <path d="M188 238C192 248 194 256 194 263"/>
  <path d="M258 152H280M255 167H278M258 182H276"/>`;
const EYE = `<circle cx="308" cy="160" r="6" fill="${INK}" stroke="none"/>`;

// ---- the logo (400 x 360, with room for the arc's ends) ----
const name = arc('ORSONERO', 200, 262, 196, -64, 64, 0.38);
const coffee = word('COFFEE', 0, 0, 0.13, 70);
const coffeeX = 200 - coffee.width / 2;
const dal = word('dal', 22, 266, 0.20, 18), year = word('2016', 0, 0, 0.20, 16);
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-28 0 456 360" width="456" height="360">
<g fill="none" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round">
  <g stroke-width="${(5.5 / 0.38).toFixed(1)}">${name}</g>
  <g stroke-width="10">${BEAR}</g>${EYE}
  <g stroke-width="${(3.6 / 0.20).toFixed(1)}">${dal.svg}${word('2016', 378 - year.width, 266, 0.20, 16).svg}</g>
  <g stroke-width="${(3.2 / 0.13).toFixed(1)}">${word('COFFEE', coffeeX, 336, 0.13, 70).svg}</g>
</g></svg>`;

// ---- the stamp: the bear in a circle (100 x 100) ----
const stamp = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<circle cx="50" cy="50" r="46" fill="#FFFFFF" stroke="${INK}" stroke-width="3.6"/>
<g transform="translate(50 52) scale(0.28) translate(-222 -200)" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">${BEAR.replace('M258 152H280M255 167H278M258 182H276', 'M260 154H280M260 174H277')}<circle cx="308" cy="160" r="7.5" fill="${INK}" stroke="none"/></g>
</svg>`;

fs.writeFileSync(path.join(__dirname, 'orsonero-logo.svg'), logo);
fs.writeFileSync(path.join(__dirname, 'orsonero-stamp.svg'), stamp);
console.log('✓ orsonero-logo.svg, orsonero-stamp.svg');
