/*
 * Timbro's standard stamps: six rubber-stamp designs, printed in one ink.
 *   STAMPS.list                   → [{ id, it, en }]
 *   STAMPS.stampOf(card)          → the stamp a card uses (its own, its style's, its type's)
 *   STAMPS.svg(id, ink, attrs, empty)  → SVG markup; attrs go on the root (e.g. x/y/width/height)
 *   STAMPS.dataUrl(id, ink, empty)     → data: URL for <img>
 *   STAMPS.hasEmpty(id)           → true when an empty box has its own drawing (the dot's
 *                                   circle); otherwise it shows a faint print of the stamp
 * Every stamp is drawn in a 100×100 box. A filter gives it the look of a
 * real impression: wobbly edges, missing specks of ink, uneven density.
 * Used by the website and, as a copy (wallet/stamps.cjs), by the Wallet server.
 */
(function (root) {
  let uid = 0;

  // The impression: edges pushed around a little, small specks without ink,
  // and patches where the stamp pressed lighter.
  const inkFilter = (id, seed) => `<filter id="${id}" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="${seed}" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale="2" xChannelSelector="R" yChannelSelector="G" result="r"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="1" seed="${seed + 5}" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -18 13.4" result="h"/>
    <feComposite in="r" in2="h" operator="in" result="s"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="${seed + 9}" result="p"/>
    <feColorMatrix in="p" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 .55" result="q"/>
    <feComposite in="s" in2="q" operator="in"/>
  </filter>`;
  // A dotted halftone patch, like a worn area of a print.
  const dotsFilter = (id, seed) => `<filter id="${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="${seed}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 24 -15.2" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in"/>
  </filter>`;

  const leaf = (x, y, a, s = 1) => `<path transform="translate(${x} ${y}) rotate(${a}) scale(${s})" d="M0 0C4.6-6 4.6-16 0-22C-4.6-16-4.6-6 0 0Z"/>`;
  function perforations(x, y, w, h, r, step) {   // the bitten edge of a postage stamp
    let c = '';
    for (let i = x + step / 2; i < x + w; i += step) c += `<circle cx="${i.toFixed(1)}" cy="${y}" r="${r}"/><circle cx="${i.toFixed(1)}" cy="${y + h}" r="${r}"/>`;
    for (let j = y + step / 2; j < y + h; j += step) c += `<circle cx="${x}" cy="${j.toFixed(1)}" r="${r}"/><circle cx="${x + w}" cy="${j.toFixed(1)}" r="${r}"/>`;
    return c;
  }

  // Each design: (ids) → inner SVG, drawn with currentColor.
  const DESIGNS = {
    // The classic: a full dot of ink.
    punto: () => `<circle cx="50" cy="50" r="34" fill="currentColor"/>`,
    // A sun on the horizon, in a square frame.
    sole: () => `
      <rect x="13" y="13" width="74" height="74" rx="5" fill="none" stroke="currentColor" stroke-width="6"/>
      <path d="M28 72a22 22 0 0 1 44 0z" fill="currentColor"/>
      <path d="M23 79h54" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
      <g stroke="currentColor" stroke-width="4.6" stroke-linecap="round">
        <path d="M24.5 58l-6-3.5"/><path d="M35 44.5l-3.5-6"/><path d="M50 40v-7"/><path d="M65 44.5l3.5-6"/><path d="M75.5 58l6-3.5"/>
      </g>`,
    // An olive branch on a postage stamp.
    ramo: ({ mask }) => `
      <mask id="${mask}"><rect width="100" height="100" fill="#fff"/><g fill="#000">${perforations(14, 5, 72, 90, 2.7, 7.2)}<rect x="22" y="13" width="56" height="74" rx="1"/></g></mask>
      <rect x="14" y="5" width="72" height="90" fill="currentColor" mask="url(#${mask})"/>
      <path d="M31 82C39 68 50 50 66 23" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>
      <g fill="currentColor">${leaf(37, 71, -62, .82)}${leaf(42, 63, 38, .82)}${leaf(48, 54, -58, .9)}${leaf(54, 46, 40, .86)}${leaf(60, 36, -50, .8)}${leaf(66, 24, 14, .7)}
        <circle cx="47" cy="72" r="4.2"/><circle cx="59" cy="53" r="3.8"/></g>`,
    // A flower in a capsule.
    fiore: ({ mask }) => `
      <rect x="27" y="8" width="46" height="84" rx="23" fill="none" stroke="currentColor" stroke-width="5"/>
      <mask id="${mask}"><rect width="100" height="100" fill="#fff"/><circle cx="50" cy="35" r="3.4" fill="#000"/></mask>
      <g fill="currentColor" mask="url(#${mask})">${[0, 72, 144, 216, 288].map(a => `<circle cx="${(50 + 7.4 * Math.sin(a * Math.PI / 180)).toFixed(2)}" cy="${(35 - 7.4 * Math.cos(a * Math.PI / 180)).toFixed(2)}" r="6"/>`).join('')}<circle cx="50" cy="35" r="5"/></g>
      <path d="M50 44C50 56 47 66 49.5 80" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>
      <g fill="currentColor">${leaf(49, 66, 52, .78)}${leaf(49.5, 74, -48, .62)}</g>`,
    // A four-point star in a diamond, in a square.
    stella: ({ mask }) => `
      <rect x="13" y="13" width="74" height="74" rx="4" fill="none" stroke="currentColor" stroke-width="5"/>
      <path d="M50 21L79 50L50 79L21 50Z" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round"/>
      <mask id="${mask}"><rect width="100" height="100" fill="#fff"/><circle cx="50" cy="50" r="2.6" fill="#000"/></mask>
      <path d="M50 31Q53 47 69 50Q53 53 50 69Q47 53 31 50Q47 47 50 31Z" fill="currentColor" mask="url(#${mask})"/>
      <g fill="currentColor"><circle cx="21" cy="21" r="2.6"/><circle cx="79" cy="21" r="2.6"/><circle cx="21" cy="79" r="2.6"/><circle cx="79" cy="79" r="2.6"/></g>`,
    // Waves cut into a solid block, like a linocut.
    onda: ({ mask }) => `
      <mask id="${mask}"><rect width="100" height="100" fill="#fff"/>
        <g fill="none" stroke="#000" stroke-width="4.6" stroke-linecap="round">
          <path d="M18 37c6-6 11 6 17 0s11-6 17 0 11 6 17 0 9-5 14-1"/><path d="M18 51c6-6 11 6 17 0s11-6 17 0 11 6 17 0 9-5 14-1"/><path d="M18 65c6-6 11 6 17 0s11-6 17 0 11 6 17 0 9-5 14-1"/></g>
        <circle cx="72" cy="25.5" r="3.6" fill="#000"/></mask>
      <rect x="12" y="16" width="76" height="68" rx="6" fill="currentColor" mask="url(#${mask})"/>`,
    // A bare tree and the moon, over a dotted patch.
    albero: ({ dots }) => `
      <rect x="19" y="22" width="32" height="70" fill="currentColor" filter="url(#${dots})"/>
      <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <path d="M54 94C54 72 53 50 54.5 22" stroke-width="4.2"/>
        <path d="M54 68Q44 61 35 52M54 57Q64 51 73 42M54 45Q47 40 42 32M54.3 35Q59 31 63 24" stroke-width="2.9"/>
        <path d="M42 58Q39 53 40 47M66 47Q71 44 76 46M46 39Q43 36 37 36M60 29Q63 26 68 27" stroke-width="2.2"/></g>
      <circle cx="76" cy="17" r="6.5" fill="currentColor"/>`
  };

  // Empty boxes that are drawn, not a faint print: the dot's empty circle.
  const EMPTY = {
    punto: () => `<circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" stroke-width="4.5"/>`
  };

  const NAMES = {
    punto: ['Punto', 'Dot'],
    sole: ['Sole', 'Sun'], ramo: ['Ramo d\'ulivo', 'Olive branch'], fiore: ['Fiore', 'Flower'],
    stella: ['Stella', 'Star'], onda: ['Onda', 'Wave'], albero: ['Albero e luna', 'Tree and moon']
  };

  // Defaults for cards that never picked a stamp: their style's, else their kind of business's.
  const BY_STYLE = { timbro: 'sole', minimal: 'fiore', giappone: 'onda', milano: 'stella', bottega: 'ramo' };
  const BY_TYPE = { caffe: 'ramo', pasticceria: 'fiore', aperitivo: 'stella', gelateria: 'sole', pizzeria: 'onda', parrucchiere: 'albero', estetica: 'fiore' };
  function stampOf(card = {}) {
    if (DESIGNS[card.stamp]) return card.stamp;
    const style = root.CONFIG && root.CONFIG.styles && root.CONFIG.styles.find(s => s.id === card.style);
    if (style && DESIGNS[style.look.stamp]) return style.look.stamp;
    return BY_STYLE[card.style] || BY_TYPE[card.type] || 'sole';
  }

  const safeInk = ink => /^#[0-9a-f]{6}$/i.test(ink || '') ? ink : '#2B32FF';
  function svg(id, ink, attrs = '', empty = false) {
    const draw = (empty && EMPTY[id]) || DESIGNS[id] || DESIGNS.sole;
    const n = ++uid, ids = { ink: `tb-ink${n}`, dots: `tb-dots${n}`, mask: `tb-mask${n}` };
    const seed = Object.keys(DESIGNS).indexOf(id) * 7 + 3;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" color="${safeInk(ink)}" aria-hidden="true" ${attrs}>
      <defs>${inkFilter(ids.ink, seed)}${dotsFilter(ids.dots, seed + 2)}</defs>
      <g filter="url(#${ids.ink})">${draw(ids)}</g></svg>`;
  }
  const urls = {};
  const dataUrl = (id, ink, empty = false) => {
    const k = id + ink + (empty ? '-' : '');
    return urls[k] || (urls[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(id, ink, '', empty)));
  };
  const hasEmpty = id => !!EMPTY[id];
  const list = Object.keys(DESIGNS).map(id => ({ id, it: NAMES[id][0], en: NAMES[id][1] }));

  const STAMPS = { list, stampOf, svg, dataUrl, hasEmpty };
  if (typeof module === 'object' && module.exports) module.exports = STAMPS;
  else root.STAMPS = STAMPS;
})(typeof window !== 'undefined' ? window : globalThis);
