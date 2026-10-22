// The Seed (Viale Monte Nero 78): café, co-working, events and art. Their colours (warm cream,
// soil brown, leaf green, terracotta) and the seedling of their logo as the stamp: a sprout with
// two leaves growing out of a round of soil. Used by print/example-cards.html and sales/theseed.html.
//   SEED_LOOK.cream, SEED_LOOK.soil: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // The sprout: a curved stem with a small root fork, and two leaves on top.
  const SPROUT = (stem, leaf) => `<g fill="none" stroke="${stem}" stroke-width="5" stroke-linecap="round"><path d="M50 82 C44 70 56 60 50 44"/><path d="M48 72 C42 76 38 80 36 84"/></g><g fill="${leaf}"><path d="M50 44 C40 44 33 38 32 28 C42 28 49 34 50 44Z"/><path d="M50 42 C52 30 60 24 70 25 C69 35 61 42 50 42Z"/></g>`;
  const stamp = (disc, stem, leaf) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="52" r="40" fill="${disc}"/>${SPROUT(stem, leaf)}</svg>`);
  const mark = (bg, stem, leaf) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><g transform="translate(5 2) scale(.9)">${SPROUT(stem, leaf)}</g></svg>`);
  const BASE = { id: 'theseed', business: 'The Seed', tagline: 'Café · Co-working · Milano', title: 'Carta The Seed', reward: 'un caffè gratis', titleEn: 'The Seed card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'it', font: 'sans' };
  window.SEED_LOOK = {
    // Cream, with their logo: soil-brown rounds with a white sprout and green leaves, like the logo.
    cream: { ...BASE, color: '#E8E5D6', ink: '#3A2C22', strip: '#DDD8C4', logo: '/sales/img/theseed-logo.png', iconLogo: mark('#E8E5D6', '#3A2C22', '#5A7A4E'), stampImage: stamp('#3A2C22', '#FFFFFF', '#6E9460') },
    // Soil brown: cream rounds with a brown sprout and green leaves.
    soil: { ...BASE, color: '#3A2C22', ink: '#E8E5D6', strip: '#30241C', iconLogo: mark('#3A2C22', '#E8E5D6', '#6E9460'), stampImage: stamp('#E8E5D6', '#3A2C22', '#5A7A4E') }
  };
})();
