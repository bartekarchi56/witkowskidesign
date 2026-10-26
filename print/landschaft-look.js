// Landschaft (ul. Gimnazjalna 6, Bydgoszcz): quiet and Scandinavian like their café, the name in
// lower case with "Cøffee is life!" under it, and the spindle-back chair from their Instagram picture
// as the stamp. Used by print/example-cards.html.
//   LANDSCHAFT_LOOK.white, LANDSCHAFT_LOOK.dark: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // The chair from the front, in a 100 x 100 box: a back of thin spindles between two posts, the seat,
  // and four splayed legs.
  const CHAIR = (ink, w = 3.4) => `<g fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="M33 16 Q50 12 67 16"/><path d="M35 16 V53"/><path d="M65 16 V53"/><path d="M42 15 V53"/><path d="M50 14 V53"/><path d="M58 15 V53"/><path d="M27 55 H73"/><path d="M31 58 L25 88"/><path d="M69 58 L75 88"/><path d="M41 58 L39 84"/><path d="M59 58 L61 84"/><path d="M28 74 H72"/></g>`;
  // A stamp: the chair on a round disc.
  const stamp = (disc, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${disc}"/><g transform="translate(19 18) scale(.62)">${CHAIR(ink, 5.2)}</g></svg>`);
  // The round mark Google Wallet shows next to the name.
  const mark = (bg, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><g transform="translate(11 9) scale(.78)">${CHAIR(ink, 4.4)}</g></svg>`);
  const BASE = { id: 'landschaft', business: 'landschaft', tagline: 'Cøffee is life!', title: 'Karta kawowa', reward: 'kawa gratis', titleEn: 'Coffee card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'pl', font: 'serif' };
  window.LANDSCHAFT_LOOK = {
    white: { ...BASE, color: '#F7F5F0', ink: '#1A1A1A', strip: '#ECE9E2', iconLogo: mark('#F7F5F0', '#1A1A1A'), stampImage: stamp('#1A1A1A', '#F7F5F0') },
    dark: { ...BASE, color: '#232323', ink: '#F4F1EA', strip: '#2C2C2C', iconLogo: mark('#232323', '#F4F1EA'), stampImage: stamp('#F4F1EA', '#232323') }
  };
})();
