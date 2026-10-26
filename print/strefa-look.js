// STREFA Cafe&Food&Cocktails (Bydgoszcz): their peach and green, and their mark redrawn from the
// Instagram picture: a cup with a lotus inside, on a saucer line, over "strefa" in a bold serif.
// The cup is the stamp. Used by print/example-cards.html.
//   STREFA_LOOK.peach, STREFA_LOOK.green: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  const PEACH = '#E99A78', GREEN = '#43704A';
  // The cup in a 100 x 100 box: rim, handle, bowl, saucer line, and the lotus (a tall middle petal,
  // two side petals and two small outer ones).
  const CUP = (ink, w = 3.6) => `<g transform="translate(-1 9)" fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="M14 22 H76"/><path d="M76 22 H81 C89 22 89 36 81 36 H73.5"/><path d="M14 22 C16 44 30 58 46 58 C62 58 74 44 76 22"/><path d="M24 68 H68"/><path d="M46 58 C38 46 40 34 46 25 C52 34 54 46 46 58 Z"/><path d="M45 57 C33 53 26 44 27 33 C35 35 41 41 44 48"/><path d="M47 57 C59 53 66 44 65 33 C57 35 51 41 48 48"/><path d="M21 31 C25 29 29 31 30 35"/><path d="M71 31 C67 29 63 31 62 35"/></g>`;
  // A stamp: the cup on a round disc.
  const stamp = (disc, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${disc}"/><g transform="translate(17 17) scale(.66)">${CUP(ink, 5)}</g></svg>`);
  // The round mark Google Wallet shows next to the name.
  const mark = (bg, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><g transform="translate(9 8) scale(.84)">${CUP(ink, 4.4)}</g></svg>`);
  // Logo for the top of the card: the cup, "strefa" and CAFE & FOOD & COCKTAILS under it.
  const logo = ink => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="120" viewBox="0 0 560 120"><g transform="translate(-4 0) scale(1.16)">${CUP(ink, 3.6)}</g><g fill="${ink}"><text x="112" y="74" font-family="Liberation Serif, Times New Roman, serif" font-weight="700" font-size="70" letter-spacing="-1">strefa</text><text x="116" y="104" font-family="Liberation Sans, Arial, sans-serif" font-size="15.5" letter-spacing="4.2">CAFE &amp; FOOD &amp; COCKTAILS</text></g></svg>`);
  const BASE = { id: 'strefa', business: 'Strefa', title: 'Karta kawowa', reward: 'kawa gratis', titleEn: 'Coffee card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'pl', font: 'sans' };
  window.STREFA_LOOK = {
    peach: { ...BASE, color: PEACH, ink: '#2F5236', strip: '#E28E6B', logo: logo(GREEN), iconLogo: mark(PEACH, GREEN), stampImage: stamp(GREEN, PEACH) },
    green: { ...BASE, color: GREEN, ink: '#FBE3D6', strip: '#3B6442', logo: logo('#F2B596'), iconLogo: mark(GREEN, '#F2B596'), stampImage: stamp(PEACH, GREEN) }
  };
})();
