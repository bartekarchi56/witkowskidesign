// SISU. (Via Meravigli, Milano): their serif "SISU." in sage on cream, and soft wavy
// two-tone bands behind the stamps. Used by print/example-cards.html and sales/sisu.html.
//   SISU_LOOK.cream, SISU_LOOK.sage: the two cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  const waves = (a, b) => {
    // Liquid stripes: curves whose bend depends on where they are (domain warping),
    // spaced unevenly; every other gap is filled, so bands swell and thin.
    const W = 1020, H = 450, pts = 90, bases = [];
    for (let y = -330, k = 0; y < H + 330; k++) { bases.push(y); y += 13 + 15 * Math.abs(Math.sin(k * .83)); }
    const curve = bse => Array.from({ length: pts + 1 }, (_, i) => {
      const x = i / pts * W;
      return [x, bse + 95 * Math.sin(x * .0052 + bse * .005) + 42 * Math.sin(x * .0125 - bse * .007) + .18 * x];
    });
    let d = '';
    for (let k = 0; k + 1 < bases.length; k += 2) {
      const top = curve(bases[k]), bot = curve(bases[k + 1]).reverse();
      d += 'M' + top.concat(bot).map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + 'Z';
    }
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1020 450"><rect width="1020" height="450" fill="${a}"/><path d="${d}" fill="${b}"/></svg>`);
  };
  const sisuDot = (fill, ring) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="31" fill="${fill}"/>${ring ? `<circle cx="50" cy="50" r="36" fill="none" stroke="${ring}" stroke-width="2.5"/>` : ''}</svg>`);
  const sisuLogo = fill => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="96" viewBox="0 0 320 96"><text x="0" y="80" font-family="Liberation Serif, Times New Roman, serif" font-weight="700" font-size="100" letter-spacing="-3" fill="${fill}">SISU.</text></svg>`);
  const sisuMark = (fill, bg) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><text x="50" y="72" text-anchor="middle" font-family="Liberation Serif, Times New Roman, serif" font-weight="700" font-size="64" fill="${fill}">S.</text></svg>`);
  const SISU = { id: 'sisu', business: 'SISU.', title: 'Carta Sisu', reward: 'un caffè gratis', titleEn: 'Sisu card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'it', font: 'sans' };

  window.SISU_LOOK = {
    cream: { ...SISU, color: '#EEE5D8', ink: '#6B7262', strip: '#EEE5D8', logo: sisuLogo('#6B7262'), iconLogo: sisuMark('#6B7262', '#EEE5D8'), stripImage: waves('#DCD6C4', '#8E977F'), stampImage: sisuDot('#F4EDE2', '#6B7262') },
    sage: { ...SISU, color: '#6B7262', ink: '#F1E9DD', strip: '#6B7262', logo: sisuLogo('#EEE5D8'), iconLogo: sisuMark('#EEE5D8', '#6B7262'), stripImage: waves('#6B7262', '#7E866F'), stampImage: sisuDot('#F1E9DD') }
  };
})();
