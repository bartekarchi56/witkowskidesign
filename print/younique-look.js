// Younique Café Golden Goose (Via Cusani, Milano): the listening room. Near-black and warm
// wood, gold details, and a vinyl record as the stamp. Used by print/example-cards.html.
//   YOUNIQUE_LOOK.black, YOUNIQUE_LOOK.wood: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // A record: black disc, fine grooves, a gold label with its hole.
  const vinyl = (disc, groove, label) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="${disc}"/>${[38, 34, 30, 26, 22].map(r => `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${groove}" stroke-width=".9" opacity=".55"/>`).join('')}<path d="M24 34 A32 32 0 0 1 40 20" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity=".18"/><circle cx="50" cy="50" r="14" fill="${label}"/><circle cx="50" cy="50" r="2.4" fill="${disc}"/></svg>`);
  // Behind the stamps: faint grooves of one big record, off to the side.
  const grooves = (bg, line) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1020 450"><rect width="1020" height="450" fill="${bg}"/><g fill="none" stroke="${line}" stroke-width="1.4" opacity=".14">${Array.from({ length: 34 }, (_, i) => `<circle cx="1020" cy="225" r="${60 + i * 16}"/>`).join('')}</g></svg>`);
  const BASE = { id: 'younique', business: 'Younique Café', tagline: 'GOLDEN GOOSE', title: 'Carta Younique', reward: 'un caffè gratis', titleEn: 'Younique card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'it', font: 'wide' };
  window.YOUNIQUE_LOOK = {
    black: { ...BASE, color: '#141312', ink: '#C9A24A', strip: '#141312', stripImage: grooves('#141312', '#C9A24A'), stampImage: vinyl('#0A0A0A', '#3A3A3A', '#C9A24A') },
    wood: { ...BASE, color: '#4A3426', ink: '#E9D9B8', strip: '#3B291E', stripImage: grooves('#3B291E', '#E9D9B8'), stampImage: vinyl('#0E0D0C', '#3A3A3A', '#E9D9B8') }
  };
})();
