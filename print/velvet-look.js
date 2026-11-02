// Velvet (Gdańska 25, Bydgoszcz): "speciality coffee | art gallery". Black and white like their
// pencil drawing of the café, with the violet of its lamp: the drawing (with the lamp) behind the
// stamps, their V with the steam as the stamp, from their Instagram. Artwork in assets/demo/velvet/.
// Used by print/example-cards.html and sales/velvet.html; the dark card is the demo
// card.html?card=velvet (assets/js/store.js).
//   VELVET_LOOK.dark, VELVET_LOOK.light: the two cards, for UI.renderPass
(function () {
  const A = '/assets/demo/velvet/';
  const BASE = { id: 'velvet', business: 'VELVET', tagline: 'speciality coffee · art gallery', title: 'Karta Velvet', reward: 'kawa gratis',
    titleEn: 'Velvet card', rewardEn: 'a free coffee', stampsNeeded: 8, lang: 'pl', type: 'caffe', font: 'wide', style: 'minimal' };
  window.VELVET_LOOK = {
    dark: { ...BASE, color: '#0E0E10', ink: '#9B1FE8', strip: '#0E0E10', stripImage: A + 'strip-dark.jpg', iconLogo: A + 'stamp-violet.png', stampImage: A + 'stamp-violet.png' },
    light: { ...BASE, color: '#FFFFFF', ink: '#0E0E10', strip: '#F2F2F2', stripImage: A + 'strip-soft.jpg', iconLogo: A + 'stamp-black.png', stampImage: A + 'stamp-black.png' }
  };
})();
