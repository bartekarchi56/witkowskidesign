// The Seed (Viale Monte Nero 78): café, co-working, events and art. Their colours (warm cream,
// soil brown, leaf green, terracotta) and a round rubber stamp with THE SEED · MILANO as the stamp.
// The seedling of their logo is the Google mark.
// Used by print/example-cards.html and sales/theseed.html.
//   SEED_LOOK.cream, SEED_LOOK.soil: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // The sprout: a curved stem with a small root fork, and two leaves on top.
  const SPROUT = (stem, leaf) => `<g fill="none" stroke="${stem}" stroke-width="5" stroke-linecap="round"><path d="M50 82 C44 70 56 60 50 44"/><path d="M48 72 C42 76 38 80 36 84"/></g><g fill="${leaf}"><path d="M50 44 C40 44 33 38 32 28 C42 28 49 34 50 44Z"/><path d="M50 42 C52 30 60 24 70 25 C69 35 61 42 50 42Z"/></g>`;
  // A round rubber stamp: double ring, THE SEED along the top, MILANO along the bottom, SEED across
  // the middle between stars, with worn ink (a noise mask takes out specks, like a real impression).
  const RUBBER = ink => `<defs><filter id="w" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 14 0 0 0 -8.8"/><feComposite in="SourceGraphic" operator="out"/></filter><path id="t" d="M17 50 A33 33 0 0 1 83 50"/><path id="b" d="M13 50 A37 37 0 0 0 87 50"/></defs><g filter="url(#w)" fill="${ink}" stroke="${ink}" font-family="Liberation Sans, Arial, sans-serif" font-weight="700"><circle cx="50" cy="50" r="46" fill="none" stroke-width="4.5"/><circle cx="50" cy="50" r="40.5" fill="none" stroke-width="1.8"/><circle cx="50" cy="50" r="27" fill="none" stroke-width="2.2"/><g stroke="none" font-size="10" letter-spacing="1.4"><text text-anchor="middle"><textPath href="#t" startOffset="50%">THE SEED</textPath></text><text text-anchor="middle"><textPath href="#b" startOffset="50%">MILANO</textPath></text></g><g stroke="none" transform="rotate(-12 50 50)"><rect x="12" y="40" width="76" height="20" fill="#000" opacity="0"/><text x="50" y="58.5" text-anchor="middle" font-size="25" letter-spacing=".5" transform="translate(50 0) scale(.86 1) translate(-50 0)">SEED</text><text x="50" y="36" text-anchor="middle" font-size="7">★ ★ ★</text><text x="50" y="69" text-anchor="middle" font-size="7">★ ★ ★</text></g><text x="13" y="52.5" font-size="6" stroke="none">•</text><text x="83.5" y="52.5" font-size="6" stroke="none">•</text></g>`;
  const stamp = art => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${art}</svg>`);
  const mark = (bg, stem, leaf) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><g transform="translate(5 2) scale(.9)">${SPROUT(stem, leaf)}</g></svg>`);
  const BASE = { id: 'theseed', business: 'The Seed', tagline: 'Café · Co-working · Milano', title: 'Carta The Seed', reward: 'un caffè gratis', titleEn: 'The Seed card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'it', font: 'sans' };
  window.SEED_LOOK = {
    // Cream, with their logo: terracotta rubber stamps.
    cream: { ...BASE, color: '#E8E5D6', ink: '#3A2C22', strip: '#DDD8C4', logo: '/sales/img/theseed-logo.png', iconLogo: mark('#E8E5D6', '#3A2C22', '#5A7A4E'), stampImage: stamp(RUBBER('#B4533A')) },
    // Soil brown: sand rubber stamps.
    soil: { ...BASE, color: '#3A2C22', ink: '#E8E5D6', strip: '#30241C', iconLogo: mark('#3A2C22', '#E8E5D6', '#6E9460'), stampImage: stamp(RUBBER('#D8B48F')) }
  };
})();
