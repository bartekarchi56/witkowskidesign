// Landschaft (ul. Gimnazjalna 6, Bydgoszcz): quiet and Scandinavian like their café. At the top, their
// name as it is on the sign over the door (thin, round, geometric letters in bronze; the first "l"
// hooks left at the foot), redrawn as lines; the spindle-back chair from their Instagram picture is
// the stamp. Used by print/example-cards.html.
//   LANDSCHAFT_LOOK.white, LANDSCHAFT_LOOK.dark: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // The chair from the front, in a 100 x 100 box: a back of thin spindles between two posts, the seat,
  // and four splayed legs.
  const CHAIR = (ink, w = 3.4) => `<g fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="M33 16 Q50 12 67 16"/><path d="M35 16 V53"/><path d="M65 16 V53"/><path d="M42 15 V53"/><path d="M50 14 V53"/><path d="M58 15 V53"/><path d="M27 55 H73"/><path d="M31 58 L25 88"/><path d="M69 58 L75 88"/><path d="M41 58 L39 84"/><path d="M59 58 L61 84"/><path d="M28 74 H72"/></g>`;
  // The sign's letters: x-height 41 to 80, ascenders from 10, round bowls of radius 19.5.
  // Each letter is [width, path(x)]; they are set one after another with a small gap.
  const bowl = x => `M${x + 39} 60.5 A19.5 19.5 0 1 1 ${x} 60.5 A19.5 19.5 0 1 1 ${x + 39} 60.5`;
  const arch = x => `M${x} 57 A16 16 0 0 1 ${x + 32} 57 V80`;
  const GLYPHS = {
    l: [16, x => `M${x + 14} 10 V72 Q${x + 14} 80 ${x + 6} 80 H${x}`],
    a: [39, x => `${bowl(x)} M${x + 39} 41 V80`],
    n: [32, x => `M${x} 41 V80 ${arch(x)}`],
    d: [39, x => `${bowl(x)} M${x + 39} 10 V80`],
    s: [27, x => `M${x + 25} 47 C${x + 21} 40 ${x + 3} 39 ${x + 3} 50 C${x + 3} 61 ${x + 26} 59 ${x + 26} 70 C${x + 26} 82 ${x + 5} 83 ${x + 1} 74`],
    c: [36, x => `M${x + 33.3} 46.7 A19.5 19.5 0 1 0 ${x + 33.3} 74.3`],
    h: [32, x => `M${x} 10 V80 ${arch(x)}`],
    f: [24, x => `M${x + 6} 80 V24 C${x + 6} 14 ${x + 12} 10 ${x + 20} 10 H${x + 24} M${x} 43 H${x + 22}`],
    t: [26, x => `M${x + 8} 14 V80 M${x} 43 H${x + 26}`]
  };
  const wordmark = (ink, word = 'landschaft', gap = 8, w = 4.2) => {
    let x = 4, d = '';
    for (const ch of word) { const [width, path] = GLYPHS[ch]; d += path(x) + ' '; x += width + gap; }
    return { w: x - gap + 4, svg: `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` };
  };
  // Logo for the top of the card: the name alone, as on the sign.
  const logo = ink => { const m = wordmark(ink); return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.w * 1.25}" height="112" viewBox="0 0 ${m.w} 90">${m.svg}</svg>`); };
  // A stamp: the chair on a round disc.
  const stamp = (disc, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${disc}"/><g transform="translate(19 18) scale(.62)">${CHAIR(ink, 5.2)}</g></svg>`);
  // The round mark Google Wallet shows next to the name.
  const mark = (bg, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><g transform="translate(11 9) scale(.78)">${CHAIR(ink, 4.4)}</g></svg>`);
  const BRONZE = '#5E3D2A';
  const BASE = { id: 'landschaft', business: 'landschaft', title: 'Karta kawowa', reward: 'kawa gratis', titleEn: 'Coffee card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'pl', font: 'sans' };
  window.LANDSCHAFT_LOOK = {
    // The white facade with the bronze letters.
    white: { ...BASE, color: '#F5F4F0', ink: '#2A2420', strip: '#EAE8E2', logo: logo(BRONZE), iconLogo: mark('#F5F4F0', BRONZE), stampImage: stamp(BRONZE, '#F5F4F0') },
    dark: { ...BASE, color: '#232323', ink: '#F4F1EA', strip: '#2C2C2C', logo: logo('#D9B99B'), iconLogo: mark('#232323', '#D9B99B'), stampImage: stamp('#D9B99B', '#232323') }
  };
})();
