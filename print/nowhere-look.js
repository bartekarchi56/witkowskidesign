// Nowhere Coffee & Community (Milano): the pink of their café and a takeaway cup as the stamp.
// Used by print/example-cards.html and sales/nowhere.html.
//   NOWHERE_LOOK.pink, NOWHERE_LOOK.dark: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // The cup: lid, body narrowing to the base, and a sleeve cut out in the background colour.
  const CUP = (ink, bg) => `<rect x="28" y="22" width="44" height="9" rx="3.5" fill="${ink}"/><rect x="34" y="17" width="32" height="7" rx="3" fill="${ink}"/><path d="M32 33 H68 L63 82 Q62.5 86 58.5 86 H41.5 Q37.5 86 37 82 Z" fill="${ink}"/><path d="M34.6 50 H65.4 L64.2 63 H35.8 Z" fill="${bg}"/>`;
  const stamp = (disc, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${disc}"/><g transform="translate(18 17) scale(.64)">${CUP(ink, disc)}</g></svg>`);
  const mark = (ink, bg) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><g transform="translate(12 10) scale(.76)">${CUP(ink, bg)}</g></svg>`);
  const BASE = { id: 'nowhere', business: 'NOWHERE', tagline: 'Coffee & Community', title: 'Carta Nowhere', reward: 'un caffè gratis', titleEn: 'Nowhere card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'it', font: 'wide' };
  window.NOWHERE_LOOK = {
    pink: { ...BASE, color: '#F7D3DA', ink: '#2B1B20', strip: '#F1BFCA', iconLogo: mark('#2B1B20', '#F7D3DA'), stampImage: stamp('#2B1B20', '#F7D3DA') },
    dark: { ...BASE, color: '#221A1C', ink: '#F7D3DA', strip: '#1A1415', iconLogo: mark('#F7D3DA', '#221A1C'), stampImage: stamp('#F2A7B6', '#221A1C') }
  };
})();
