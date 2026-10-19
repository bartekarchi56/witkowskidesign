// Parzymy Tutaj (Długa 61, Bydgoszcz): their light green and their mark, an arch with three
// drips, redrawn as lines. Used by print/example-cards.html and sales/parzymy.html.
//   PARZYMY_LOOK.green, PARZYMY_LOOK.dark: the two cards, for UI.renderPass
//   PARZYMY_LOOK.mark(colour): the mark alone, as an SVG data URL
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // The arch's left side runs longer than the right, which curls out a little; the middle drip is the longest.
  const MARK = '<path d="M27 74 V43 C27 14 73 14 73 43 V66 Q73 71 77 73"/><path d="M40 46 V87"/><path d="M50 46 V96"/><path d="M60 46 V80"/>';
  const mark = (ink, size = 100) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 106"><g fill="none" stroke="${ink}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round">${MARK}</g></svg>`);
  // The mark in a round stamp: filled disc for a stamp, a faint ring is drawn by the renderer for empty boxes.
  const stamp = (disc, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${disc}"/><g transform="translate(26 22) scale(.48)" fill="none" stroke="${ink}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round">${MARK}</g></svg>`);
  // Logo for the top of the card: the mark and the name.
  const logo = ink => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="120" viewBox="0 0 560 120"><g transform="translate(4 6) scale(1.02)" fill="none" stroke="${ink}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round">${MARK}</g><text x="118" y="78" font-family="Liberation Sans, Arial, sans-serif" font-weight="700" font-size="54" letter-spacing="-1" fill="${ink}">parzymy tutaj</text></svg>`);
  // Behind the stamps: a few big, faint marks, like a pattern on a cup.
  const strip = (bg, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1020 450"><rect width="1020" height="450" fill="${bg}"/><g fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".16">${[[-30, 40, 3.2], [300, -70, 2.6], [610, 60, 3.4], [880, -40, 2.4]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})">${MARK}</g>`).join('')}</g></svg>`);
  const BASE = { id: 'parzymy', business: 'Parzymy Tutaj', title: 'Karta kawowa', reward: 'kawa gratis', titleEn: 'Coffee card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'pl', font: 'sans' };
  window.PARZYMY_LOOK = {
    mark,
    green: { ...BASE, color: '#C9E3A3', ink: '#2F4A2B', strip: '#C9E3A3', logo: logo('#2F4A2B'), iconLogo: mark('#2F4A2B'), stripImage: strip('#C9E3A3', '#2F4A2B'), stampImage: stamp('#2F4A2B', '#C9E3A3') },
    dark: { ...BASE, color: '#2F4A2B', ink: '#C9E3A3', strip: '#2F4A2B', logo: logo('#C9E3A3'), iconLogo: mark('#C9E3A3'), stripImage: strip('#2F4A2B', '#C9E3A3'), stampImage: stamp('#C9E3A3', '#2F4A2B') }
  };
})();
