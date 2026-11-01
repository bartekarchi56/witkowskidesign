// Cafezal (Piazza Gae Aulenti, Milano): "la caffetteria moderna". Their night blue and cream,
// their palms large and faint behind the stamps, and their own logo: the CAFEZAL wordmark at the top and the
// double palm in a circle as the stamp (taken from their sign). Artwork in assets/demo/cafezal/.
// Used by print/example-cards.html and sales/cafezal.html; the same card is the demo
// card.html?card=cafezal (assets/js/store.js).
//   CAFEZAL_LOOK.navy, CAFEZAL_LOOK.cream: the two cards, for UI.renderPass
(function () {
  const A = '/assets/demo/cafezal/';
  const BASE = { id: 'cafezal', business: 'Cafezal', tagline: 'Piazza Gae Aulenti · Milano', title: 'Carta Cafezal', reward: 'un caffè gratis',
    titleEn: 'Cafezal card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'it', type: 'caffe', font: 'serif', style: 'minimal' };
  window.CAFEZAL_LOOK = {
    navy: { ...BASE, color: '#1C2638', ink: '#F3EDE2', strip: '#16202F', stripImage: A + 'strip-palms-navy.png', logo: A + 'word-cream.png', iconLogo: A + 'stamp-cream.png', stampImage: A + 'stamp-cream.png' },
    cream: { ...BASE, color: '#F3EDE2', ink: '#1C2638', strip: '#EAE2D3', stripImage: A + 'strip-palms-cream.png', logo: A + 'word-navy.png', iconLogo: A + 'stamp-navy.png', stampImage: A + 'stamp-navy.png' }
  };
})();
