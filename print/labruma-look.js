// La Bruma (Piazza Vetra): a neighbourhood bakery and café. A plain white card with black dots.
// Used by print/example-cards.html and sales/labruma.html.
//   BRUMA_LOOK.light (= BRUMA_LOOK.dark): the card, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  const mark = (ink, bg) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><text x="50" y="62" text-anchor="middle" font-family="Liberation Sans, Arial, sans-serif" font-weight="700" font-size="40" fill="${ink}">LB</text></svg>`);
  const BASE = { id: 'labruma', business: 'LA BRUMA', tagline: 'Bakery · Piazza Vetra', title: 'Carta La Bruma', reward: 'un caffè gratis', titleEn: 'La Bruma card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'it', font: 'wide' };
  // Plain, like The Coffee's: a white card with black dots, no stamp count.
  const DOT = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#0B0B0C"/></svg>');
  const PLAIN = { ...BASE, style: 'minimal', color: '#FFFFFF', ink: '#0B0B0C', strip: '', stamp: 'punto', stampImage: DOT, hideCount: true, iconLogo: mark('#0B0B0C', '#FFFFFF') };
  window.BRUMA_LOOK = { light: PLAIN, dark: PLAIN };
})();
