// Pomorska 15 (specialty café, Pomorska 15, Bydgoszcz): black and white like their logo, a takeaway
// cup drawn in outline with "POMORSKA 15 · CAFE" under it. The cup, redrawn from their Instagram
// picture, is the stamp. Used by print/example-cards.html.
//   POMORSKA_LOOK.white, POMORSKA_LOOK.black: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // The cup in a 100 x 100 box: a lid with a raised top, and a tapered body, in outline.
  const CUP = (ink, w = 5) => `<g fill="none" stroke="${ink}" stroke-width="${w}" stroke-linejoin="round"><path d="M37 13 H63 V19 H37 Z"/><path d="M30 19 H70 V27 H30 Z"/><path d="M33 27 H67 L62 88 H38 Z"/></g>`;
  // A stamp: the cup in outline on a round disc.
  const stamp = (disc, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${disc}"/><g transform="translate(19 18) scale(.62)">${CUP(ink, 6.5)}</g></svg>`);
  // The round mark Google Wallet shows next to the name.
  const mark = (bg, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><g transform="translate(12 10) scale(.76)">${CUP(ink, 5.5)}</g></svg>`);
  // Logo for the top of the card: the cup, then POMORSKA 15 with "- CAFE -" under it.
  const logo = ink => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="120" viewBox="0 0 560 120"><g transform="translate(0 4) scale(1.12)">${CUP(ink, 5)}</g><g fill="${ink}" font-family="Liberation Sans, Arial, sans-serif" font-weight="700"><text x="118" y="66" font-size="44" letter-spacing="4">POMORSKA 15</text><text x="118" y="100" font-size="20" letter-spacing="7">- CAFE -</text></g></svg>`);
  const BASE = { id: 'pomorska', business: 'Pomorska 15', title: 'Karta kawowa', reward: 'kawa gratis', titleEn: 'Coffee card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'pl', font: 'wide' };
  window.POMORSKA_LOOK = {
    white: { ...BASE, color: '#FFFFFF', ink: '#111111', strip: '#F4F2EE', logo: logo('#111111'), iconLogo: mark('#FFFFFF', '#111111'), stampImage: stamp('#111111', '#FFFFFF') },
    black: { ...BASE, color: '#141414', ink: '#FFFFFF', strip: '#1E1E1E', logo: logo('#FFFFFF'), iconLogo: mark('#141414', '#FFFFFF'), stampImage: stamp('#FFFFFF', '#141414') }
  };
})();
