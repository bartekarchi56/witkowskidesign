// Pass images drawn as SVG and rasterised with sharp, so the Wallet card
// looks like the card on the website: same stamps, colours and faint empty prints.
import sharp from 'sharp';
import { createRequire } from 'node:module';

// The standard stamps, shared with the website (a copy of assets/js/stamps.js;
// npm test checks they match).
const STAMPS = createRequire(import.meta.url)('./stamps.cjs');

const hex = h => /^#[0-9a-f]{6}$/i.test(h || '') ? h : null;
export const textOn = bg => {
  const n = parseInt(bg.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0B0B0C' : '#FFFFFF';
};
export const rgb = h => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;

export function colours(card) {
  const bg = hex(card.color) || '#FFFFFF';
  return { bg, fg: textOn(bg), ink: hex(card.ink) || '#2B32FF' };
}

const ANGLES = [-8, 5, -3, 9, -6, 3, -10, 7, -2, 6, -7, 4, -4, 8, -9, 2, -5, 10, -1, 5];
const pngData = (v, max = 200000) => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v || '') && v.length < max ? v : '';

// The picture one stamp prints at x,y (size d): the café's own artwork, or its standard stamp.
function stampAt(card, ink, x, y, d) {
  const art = pngData(card.stampImage, 400000);
  return art
    ? `<image href="${art}" x="${x}" y="${y}" width="${d}" height="${d}" preserveAspectRatio="xMidYMid meet"/>`
    : STAMPS.svg(STAMPS.stampOf(card), ink, `x="${x}" y="${y}" width="${d}" height="${d}"`);
}

/**
 * The stamp grid: stamps already collected, each at its own angle, and a faint
 * print of the same stamp in every empty box. `w`×`h` in points; `scale` gives
 * @2x/@3x versions. Apple: strip.png (375×123 pt). Google: hero image (1032×336 px).
 */
export async function strip(card, have, { w = 375, h = 123, scale = 1 } = {}) {
  const { bg, ink } = colours(card);
  const stripBg = hex(card.strip) || bg;
  const need = Math.max(1, Math.min(20, +card.stampsNeeded || 10));
  const rows = Math.ceil(need / 5);
  const cols = Math.ceil(need / rows);
  const padX = w * 0.08, padY = h * 0.12;
  const d = Math.min((w - padX * 2) / (cols + (cols - 1) * 0.45), (h - padY * 2) / (rows + (rows - 1) * 0.3));
  const gapX = cols > 1 ? (w - padX * 2 - cols * d) / (cols - 1) : 0;
  const gapY = rows > 1 ? Math.min(d * 0.3, (h - padY * 2 - rows * d) / (rows - 1)) : 0;
  const top = (h - (rows * d + (rows - 1) * gapY)) / 2;

  let out = '';
  for (let i = 0; i < need; i++) {
    const x = padX + (i % cols) * (d + gapX), y = top + Math.floor(i / cols) * (d + gapY);
    out += i < have
      ? `<g transform="rotate(${ANGLES[i]} ${x + d / 2} ${y + d / 2})">${stampAt(card, ink, x, y, d)}</g>`
      : `<g opacity="0.15">${stampAt(card, ink, x, y, d)}</g>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${stripBg}"/>${pngData(card.stripImage, 900000) ? `<image href="${card.stripImage}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>` : ''}${out}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Square icon: Apple shows it on the lock screen and in notifications. It's the card's stamp.
export async function icon(card, px = 58) {
  const { bg, ink } = colours(card);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${bg}"/>${stampAt(card, ink, 8, 8, 84)}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
// Logo: the café's uploaded logo, or the name drawn in the card's font
// by the website (logoAuto), fitted into Apple's 160×50 pt box.
export async function logo(card, scale = 2) {
  const m = /^data:image\/(png|jpeg|webp|svg\+xml);base64,(.+)$/.exec(card.logo || card.logoAuto || '');
  if (!m) return null;
  const input = Buffer.from(m[2], 'base64');
  if (input.length > 600 * 1024) return null;
  return sharp(input).resize({ width: 160 * scale, height: 50 * scale, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
}
