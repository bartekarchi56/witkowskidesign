// Cafezal (Piazza Gae Aulenti, Milano): "la caffetteria moderna". Their night blue and cream,
// coffee beans behind the stamps, the name in wide serif capitals like their sign, and a palm
// in a circle as the stamp (our own drawing, not Cafezal's logo). Artwork in assets/demo/cafezal/.
// Used by print/example-cards.html and sales/cafezal.html; the same card is the demo
// card.html?card=cafezal (assets/js/store.js).
//   CAFEZAL_LOOK.navy, CAFEZAL_LOOK.cream: the two cards, for UI.renderPass
(function () {
  const A = '/assets/demo/cafezal/';
  const BASE = { id: 'cafezal', business: 'Cafezal', tagline: 'Piazza Gae Aulenti · Milano', title: 'Carta Cafezal', reward: 'un caffè gratis',
    titleEn: 'Cafezal card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'it', type: 'caffe', font: 'serif', style: 'minimal' };
  window.CAFEZAL_LOOK = {
    navy: { ...BASE, color: '#1C2638', ink: '#F3EDE2', strip: '#16202F', stripImage: A + 'strip-navy.svg', logo: A + 'logo-cream.svg', iconLogo: A + 'stamp-cream.svg', stampImage: A + 'stamp-cream.svg' },
    cream: { ...BASE, color: '#F3EDE2', ink: '#1C2638', strip: '#EAE2D3', logo: A + 'logo-navy.svg', iconLogo: A + 'stamp-navy.svg', stampImage: A + 'stamp-navy.svg' }
  };
})();
