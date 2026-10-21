// Panfuwa (soufflé pancakes, 8+ sedi in Italia): their deep brown and cream, and a stack of
// soufflé pancakes as the stamp. Used by print/example-cards.html and sales/panfuwa.html.
//   PANFUWA_LOOK.cream, PANFUWA_LOOK.brown: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // Three tall, soft pancakes with a pat of butter on top, in one colour (a rubber-stamp look).
  const STACK = (c, bg) => `<g fill="${c}"><rect x="30" y="58" width="40" height="13" rx="6.5"/><rect x="31" y="45" width="38" height="13" rx="6.5"/><rect x="32" y="32" width="36" height="13" rx="6.5"/><rect x="45" y="26" width="10" height="7" rx="2"/></g><g stroke="${bg}" stroke-width="1.6" fill="none" opacity=".9"><path d="M33 58h34"/><path d="M34 45h32"/></g>`;
  const stamp = (disc, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${disc}"/>${STACK(ink, disc)}</svg>`);
  const mark = (ink, bg) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/>${STACK(ink, bg)}</svg>`);
  const BASE = { id: 'panfuwa', business: 'PANFUWA', tagline: 'Soufflé pancakes', title: 'Carta Panfuwa', reward: 'un pancake gratis', titleEn: 'Panfuwa card', rewardEn: 'a free pancake', stampsNeeded: 10, lang: 'it', font: 'wide' };
  window.PANFUWA_LOOK = {
    cream: { ...BASE, color: '#FBF3DC', ink: '#4A2F20', strip: '#F1E3BF', iconLogo: mark('#4A2F20', '#FBF3DC'), stampImage: stamp('#4A2F20', '#F2C14E') },
    brown: { ...BASE, color: '#4A2F20', ink: '#FBF3DC', strip: '#3E271B', iconLogo: mark('#FBF3DC', '#4A2F20'), stampImage: stamp('#FBF3DC', '#4A2F20') }
  };
})();
