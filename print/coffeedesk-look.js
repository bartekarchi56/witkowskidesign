// Kawiarnia Coffeedesk (six cafés in Warsaw): their deep indigo, pink and cream, and their mark
// redrawn from the Instagram picture: a pink cup, a cream outline whose side makes a "3", and a line
// of steam that runs down into the cup. Used by print/example-cards.html and sales/coffeedesk.html.
//   COFFEEDESK_LOOK.indigo, COFFEEDESK_LOOK.pink: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  const INDIGO = '#140442', PINK = '#EE8C96', CREAM = '#FBF4E8';
  // The mark in a 100 x 100 box. The pink cup sits a little off the lines, like a print out of register.
  const CUP = 'M20.4 37 L71 37 L73 41 C74.5 45 76 47 80 49.5 C84 52 83.5 60 79 64 C76 67 71 68 67.3 69 L64.2 79 C55 80.5 42 81 33 80.8 C29 77 26.5 72 24.7 68 C22.5 58 21 47 20.4 37 Z';
  const LINES = '<path d="M16.7 40.1 L40.7 40.7 C49 41.6 50.5 52 30.2 53.3 C49.5 53.8 52 65.5 30.9 66.7 C51 68 52 76 26.5 75.9 Q20 60 16.7 40.1"/><path d="M50.6 31.5 C48 22 49.5 13 58 11.9 C67 11 68.5 18 65.4 24 C63 29 64 33 67.9 39.5 C70 44 69 50 65.4 58 L58 75.9"/>';
  const MARK = (cup, line, w = 2.6) => `<path d="${CUP}" fill="${cup}"/><g fill="none" stroke="${line}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${LINES}</g>`;
  // A stamp: the mark on an indigo disc, with a thin ring when the card itself is indigo.
  const stamp = ring => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${INDIGO}"/>${ring ? `<circle cx="50" cy="50" r="44" fill="none" stroke="${ring}" stroke-width="2.5"/>` : ''}<g transform="translate(16 15) scale(.7)">${MARK(PINK, CREAM, 3.4)}</g></svg>`);
  // The round mark Google Wallet shows next to the name.
  const mark = bg => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><g transform="translate(4 3) scale(.92)">${MARK(PINK, CREAM, 3)}</g></svg>`);
  // Logo for the top of the card: the mark and "coffeedesk" in lower case.
  const logo = (text, line) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120" viewBox="0 0 600 120"><g transform="translate(0 2) scale(1.16)">${MARK(PINK, line, 3)}</g><text x="122" y="80" font-family="Liberation Sans, Arial, sans-serif" font-weight="700" font-size="58" letter-spacing="-1.5" fill="${text}">coffeedesk</text></svg>`);
  // Behind the stamps on the indigo card: loose curls of steam, faint.
  const steam = (() => {
    let d = '';
    for (let y = -40, row = 0; y < 480; y += 120, row++) for (let x = -60 + (row % 2) * 85; x < 1080; x += 170)
      d += `<path transform="translate(${x} ${y}) rotate(${row % 2 ? 12 : -10})" d="M10 90 C0 60 6 28 34 24 C62 20 66 44 56 62 C48 76 54 88 70 104"/>`;
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1020 450"><rect width="1020" height="450" fill="#1A0950"/><g fill="none" stroke="#24135E" stroke-width="7" stroke-linecap="round">${d}</g></svg>`);
  })();
  const BASE = { id: 'coffeedesk', business: 'Kawiarnia Coffeedesk', title: 'Karta kawowa', reward: 'kawa gratis', titleEn: 'Coffee card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'pl', font: 'sans' };
  window.COFFEEDESK_LOOK = {
    indigo: { ...BASE, color: INDIGO, ink: CREAM, strip: '#1A0950', logo: logo(CREAM, CREAM), iconLogo: mark(INDIGO), stripImage: steam, stampImage: stamp(PINK) },
    pink: { ...BASE, color: '#F6C9CC', ink: INDIGO, strip: '#F2B9BE', logo: logo(INDIGO, INDIGO), iconLogo: mark(INDIGO), stampImage: stamp('') }
  };
})();
