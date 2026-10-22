// Pan Milano (Via Cicognara 19): a Japanese bakery and café. Quiet off-white and charcoal, and
// their curry pan as the stamp: an oval bun with panko crumbs. Used by print/example-cards.html and sales/pan.html.
//   PAN_LOOK.light, PAN_LOOK.dark: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  const CRUMBS = [[38, 44], [48, 40], [58, 42], [66, 48], [34, 54], [44, 52], [54, 50], [62, 56], [40, 62], [50, 60], [58, 64], [30, 47], [70, 57]];
  const BUN = (ink, bg) => `<ellipse cx="50" cy="52" rx="30" ry="21" transform="rotate(-12 50 52)" fill="${ink}"/><g fill="${bg}">${CRUMBS.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.6 : 2.2}"/>`).join('')}</g>`;
  const stamp = (disc, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${disc}"/><g transform="translate(9 8) scale(.82)">${BUN(ink, disc)}</g></svg>`);
  const mark = (ink, bg) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><text x="50" y="62" text-anchor="middle" font-family="Liberation Sans, Arial, sans-serif" font-weight="700" font-size="34" letter-spacing="2" fill="${ink}">PAN</text></svg>`);
  const BASE = { id: 'pan', business: 'PAN', tagline: 'Bakery · Café · Milano', title: 'Carta PAN', reward: 'un curry pan gratis', titleEn: 'PAN card', rewardEn: 'a free curry pan', stampsNeeded: 10, lang: 'it', font: 'wide' };
  window.PAN_LOOK = {
    light: { ...BASE, color: '#F4F0E8', ink: '#1E1E1C', strip: '#EAE3D6', iconLogo: mark('#1E1E1C', '#F4F0E8'), stampImage: stamp('#1E1E1C', '#D9A441') },
    dark: { ...BASE, color: '#1E1E1C', ink: '#F4F0E8', strip: '#161615', iconLogo: mark('#F4F0E8', '#1E1E1C'), stampImage: stamp('#D9A441', '#1E1E1C') }
  };
})();
