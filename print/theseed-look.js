// The Seed (Viale Monte Nero 78): café, co-working, events and art. Their colours (warm cream,
// soil brown, leaf green, terracotta) and a stamp of our own in the cut-paper style of their website:
// a seed opening into a sprout. The seedling of their logo is the Google mark.
// Used by print/example-cards.html and sales/theseed.html.
//   SEED_LOOK.cream, SEED_LOOK.soil: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // The sprout: a curved stem with a small root fork, and two leaves on top.
  const SPROUT = (stem, leaf) => `<g fill="none" stroke="${stem}" stroke-width="5" stroke-linecap="round"><path d="M50 82 C44 70 56 60 50 44"/><path d="M48 72 C42 76 38 80 36 84"/></g><g fill="${leaf}"><path d="M50 44 C40 44 33 38 32 28 C42 28 49 34 50 44Z"/><path d="M50 42 C52 30 60 24 70 25 C69 35 61 42 50 42Z"/></g>`;
  // Our own symbol in their cut-paper style: a seed just opening, with a sprout and two leaves.
  const SEED = (body, leaf, bg) => `<path d="M50 90 C31 84 25 63 37 48 C42 42 58 42 63 48 C75 63 69 84 50 90Z" fill="${body}"/><path d="M50 50 C46 62 46 75 50 85" fill="none" stroke="${bg}" stroke-width="2.6" stroke-linecap="round" opacity=".7"/><path d="M50 46 C49 36 51 28 54 21" fill="none" stroke="${leaf}" stroke-width="4.5" stroke-linecap="round"/><path d="M53 24 C58 13 69 10 78 13 C75 23 64 28 53 24Z" fill="${leaf}"/><path d="M51 31 C45 23 36 21 28 25 C33 33 43 35 51 31Z" fill="${leaf}"/>`;
  const stamp = art => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${art}</svg>`);
  const mark = (bg, stem, leaf) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><g transform="translate(5 2) scale(.9)">${SPROUT(stem, leaf)}</g></svg>`);
  const BASE = { id: 'theseed', business: 'The Seed', tagline: 'Café · Co-working · Milano', title: 'Carta The Seed', reward: 'un caffè gratis', titleEn: 'The Seed card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'it', font: 'sans' };
  window.SEED_LOOK = {
    // Cream, with their logo: terracotta seeds with green sprouts.
    cream: { ...BASE, color: '#E8E5D6', ink: '#3A2C22', strip: '#DDD8C4', logo: '/sales/img/theseed-logo.png', iconLogo: mark('#E8E5D6', '#3A2C22', '#5A7A4E'), stampImage: stamp(SEED('#B4533A', '#5A7A4E', '#DDD8C4')) },
    // Soil brown: sand seeds with green sprouts.
    soil: { ...BASE, color: '#3A2C22', ink: '#E8E5D6', strip: '#30241C', iconLogo: mark('#3A2C22', '#E8E5D6', '#6E9460'), stampImage: stamp(SEED('#C09A7A', '#7FA36F', '#30241C')) }
  };
})();
