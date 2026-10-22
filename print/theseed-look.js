// The Seed (Viale Monte Nero 78): café, co-working, events and art. Their colours (warm cream,
// soil brown, leaf green, terracotta) and the cut-paper symbols of their website as stamps: the café
// cups in terracotta and the art-and-crafts flower in sand. The seedling of their logo is the Google mark.
// Used by print/example-cards.html and sales/theseed.html.
//   SEED_LOOK.cream, SEED_LOOK.soil: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // The sprout: a curved stem with a small root fork, and two leaves on top.
  const SPROUT = (stem, leaf) => `<g fill="none" stroke="${stem}" stroke-width="5" stroke-linecap="round"><path d="M50 82 C44 70 56 60 50 44"/><path d="M48 72 C42 76 38 80 36 84"/></g><g fill="${leaf}"><path d="M50 44 C40 44 33 38 32 28 C42 28 49 34 50 44Z"/><path d="M50 42 C52 30 60 24 70 25 C69 35 61 42 50 42Z"/></g>`;
  // Their website's symbols, redrawn: the café's two cups on a bowl, and the art-and-crafts flower.
  const CUPS = c => `<g fill="${c}"><path d="M25 17 L47 16 L45 57 L30 58 Z"/><path d="M52 37 L73 36 L70 56 L56 57 Z"/><path d="M20 63 L80 62 C78 78 66 86 50 86 C34 86 22 79 20 63 Z"/></g>`;
  // The flower: six rounded arms of different lengths around a centre, like a paper cut-out.
  const ARMS = [[-84, 33], [-28, 30], [22, 34], [80, 27], [138, 32], [196, 29]];
  const flower = c => `<g stroke="${c}" stroke-width="17" stroke-linecap="round">${ARMS.map(([a, l]) => {
    const r = a * Math.PI / 180;
    return `<line x1="50" y1="50" x2="${(50 + l * Math.cos(r)).toFixed(1)}" y2="${(50 + l * Math.sin(r)).toFixed(1)}"/>`;
  }).join('')}</g><circle cx="50" cy="50" r="15" fill="${c}"/>`;
  const FLOWER = flower;
  const stamp = art => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${art}</svg>`);
  const mark = (bg, stem, leaf) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><g transform="translate(5 2) scale(.9)">${SPROUT(stem, leaf)}</g></svg>`);
  const BASE = { id: 'theseed', business: 'The Seed', tagline: 'Café · Co-working · Milano', title: 'Carta The Seed', reward: 'un caffè gratis', titleEn: 'The Seed card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'it', font: 'sans' };
  window.SEED_LOOK = {
    // Cream, with their logo: terracotta café cups.
    cream: { ...BASE, color: '#E8E5D6', ink: '#3A2C22', strip: '#DDD8C4', logo: '/sales/img/theseed-logo.png', iconLogo: mark('#E8E5D6', '#3A2C22', '#5A7A4E'), stampImage: stamp(CUPS('#B4533A')) },
    // Soil brown: sand flowers.
    soil: { ...BASE, color: '#3A2C22', ink: '#E8E5D6', strip: '#30241C', iconLogo: mark('#3A2C22', '#E8E5D6', '#6E9460'), stampImage: stamp(FLOWER('#C09A7A')) }
  };
})();
