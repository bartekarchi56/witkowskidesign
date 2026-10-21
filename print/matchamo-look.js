// MatchaMo (viale Pasubio 16, Milano): their pale sage green and a matcha whisk (chasen),
// as in their logo. Used by print/example-cards.html and sales/matchamo.html.
//   MATCHAMO_LOOK.sage, MATCHAMO_LOOK.matcha: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // The whisk: a short handle and the round bundle of tines, with fine lines for the tines.
  const WHISK = (ink, bg) => `<rect x="45" y="12" width="10" height="30" rx="3" fill="${ink}"/><path d="M42 40 C28 52 27 76 50 88 C73 76 72 52 58 40 Z" fill="${ink}"/><g fill="none" stroke="${bg}" stroke-width="2" stroke-linecap="round" opacity=".85"><path d="M50 44 V84"/><path d="M45 45 C38 56 38 72 44 82"/><path d="M55 45 C62 56 62 72 56 82"/></g>`;
  const stamp = (disc, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${disc}"/><g transform="translate(15 15) scale(.7)">${WHISK(ink, disc)}</g></svg>`);
  const mark = (ink, bg) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><g transform="translate(9 9) scale(.82)">${WHISK(ink, bg)}</g></svg>`);
  const BASE = { id: 'matchamo', business: 'MATCHAMO', tagline: 'Matcha · Milano', title: 'Carta MatchaMo', reward: 'un matcha latte gratis', titleEn: 'MatchaMo card', rewardEn: 'a free matcha latte', stampsNeeded: 10, lang: 'it', font: 'wide' };
  window.MATCHAMO_LOOK = {
    sage: { ...BASE, color: '#E3ECD3', ink: '#3F4A37', strip: '#D3E0BE', iconLogo: mark('#3F4A37', '#E3ECD3'), stampImage: stamp('#55703F', '#E3ECD3') },
    matcha: { ...BASE, color: '#4E6B3A', ink: '#EEF3E2', strip: '#435C32', iconLogo: mark('#EEF3E2', '#4E6B3A'), stampImage: stamp('#E3ECD3', '#4E6B3A') }
  };
})();
