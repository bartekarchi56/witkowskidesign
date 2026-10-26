// Five cafés on Via Paolo Sarpi (Chinatown, Milano), two cards each. Their real logos and colours
// are not known yet: the colours come from what they sell, the stamps are drawn here.
//   QQTEA (n. 47): milk tea and taro, a bubble tea cup with pearls
//   S'Lab (n. 1): black sesame and azuki, a canelé
//   Coraçao do Brasil (n. 6): Brazil green and kraft, a heart (coração) with a coffee bean in it
//   O:ops Cafè (n. 1): pink and dalgona, a surprised face
//   oTTo (n. 8): plant green and cream, an 8 (otto), eight stamps
// Used by print/example-cards.html and sales/sarpi.html.
//   SARPI_LOOK.<id>.<variant>: the cards, for UI.renderPass
(function () {
  const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // A small seeded random, so the patterns come out the same every time.
  const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // The drawings, in a 100 x 100 box: `ink` is the drawing, `bg` the colour cut out of it.
  const ART = {
    cup: (ink, bg) => `<path d="M53 31 L62 9" stroke="${ink}" stroke-width="5.5" stroke-linecap="round"/><rect x="27" y="29" width="46" height="8" rx="4" fill="${ink}"/><path d="M31 40 H69 L64.5 85 Q50 90 35.5 85 Z" fill="${ink}"/><g fill="${bg}"><circle cx="42" cy="79" r="3.6"/><circle cx="50.5" cy="81" r="3.6"/><circle cx="58.5" cy="78.5" r="3.6"/><circle cx="46" cy="71.5" r="3.6"/><circle cx="55" cy="71" r="3.6"/></g>`,
    canele: (ink, bg) => `<path d="M31 85 C29 67 30 49 34 37 Q50 27 66 37 C70 49 71 67 69 85 Q50 89 31 85 Z" fill="${ink}"/><ellipse cx="50" cy="36" rx="9" ry="3.4" fill="${bg}" opacity=".45"/><g fill="none" stroke="${bg}" stroke-width="2.4" stroke-linecap="round" opacity=".8"><path d="M41 42 C39 56 39 70 40 83"/><path d="M50 42 V85"/><path d="M59 42 C61 56 61 70 60 83"/></g>`,
    bean: (ink, bg) => `<path d="M50 85 C21 66 14 46 23 33 C32 21 46 24 50 36 C54 24 68 21 77 33 C86 46 79 66 50 85 Z" fill="${ink}"/><g transform="rotate(-28 50 52)"><ellipse cx="50" cy="52" rx="10.5" ry="15" fill="${bg}"/><path d="M50 39 C45 47 55 57 50 65" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/></g>`,
    face: (ink) => `<circle cx="38" cy="42" r="5.5" fill="${ink}"/><circle cx="62" cy="42" r="5.5" fill="${ink}"/><circle cx="50" cy="65" r="8.5" fill="none" stroke="${ink}" stroke-width="5.5"/>`,
    eight: (ink) => `<g fill="none" stroke="${ink}" stroke-width="8"><circle cx="50" cy="34" r="12"/><circle cx="50" cy="64.5" r="15.5"/></g>`
  };
  // A stamp: the drawing on a round disc (for the face and the 8, the disc is the drawing's background).
  const stamp = (art, disc, ink, scale = .7) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${disc}"/><g transform="translate(${50 - 50 * scale} ${50 - 50 * scale}) scale(${scale})">${ART[art](ink, disc)}</g></svg>`);
  // The round mark Google Wallet shows next to the name.
  const mark = (art, bg, ink) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><g transform="translate(9 9) scale(.82)">${ART[art](ink, bg)}</g></svg>`);

  // Strips behind the stamps (1020 x 450, the Apple Wallet strip).
  const strip = inner => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1020 450">${inner}</svg>`);
  // Tapioca pearls, scattered.
  const pearls = (bg, dot, seed) => { const r = rnd(seed); let d = ''; for (let i = 0; i < 70; i++) d += `<circle cx="${(r() * 1020).toFixed(0)}" cy="${(r() * 450).toFixed(0)}" r="${(7 + r() * 9).toFixed(1)}"/>`; return strip(`<rect width="1020" height="450" fill="${bg}"/><g fill="${dot}">${d}</g>`); };
  // Sesame seeds: small teardrops at every angle, a few of them light.
  const sesame = (bg, seedA, seedB, seed) => {
    const r = rnd(seed); let a = '', b = '';
    for (let i = 0; i < 260; i++) {
      const s = `<path transform="translate(${(r() * 1020).toFixed(0)} ${(r() * 450).toFixed(0)}) rotate(${(r() * 360).toFixed(0)})" d="M0 -9 C5 -5 5 5 0 9 C-5 5 -5 -5 0 -9Z"/>`;
      if (r() < .12) b += s; else a += s;
    }
    return strip(`<rect width="1020" height="450" fill="${bg}"/><g fill="${seedA}">${a}</g><g fill="${seedB}">${b}</g>`);
  };
  // Leaves, for oTTo's wall of plants: pointed leaves on short stems, in loose rows.
  const leaves = (bg, leaf, seed) => {
    const r = rnd(seed); let d = '';
    for (let y = -20; y < 490; y += 62) for (let x = -30 + (y / 62 % 2) * 40; x < 1060; x += 82) {
      const s = 26 + r() * 14;
      d += `<path transform="translate(${(x + r() * 20).toFixed(0)} ${(y + r() * 16).toFixed(0)}) rotate(${(-50 + r() * 100).toFixed(0)}) scale(${(s / 40).toFixed(2)})" d="M0 0 C14 -10 28 -10 40 0 C28 10 14 10 0 0Z"/>`;
    }
    return strip(`<rect width="1020" height="450" fill="${bg}"/><g fill="${leaf}">${d}</g>`);
  };

  const QQ = { id: 'qqtea', business: 'QQTEA', tagline: 'Taiwan bubble tea', title: 'Carta QQTEA', reward: 'un bubble tea gratis', titleEn: 'QQTEA card', rewardEn: 'a free bubble tea', stampsNeeded: 10, lang: 'it', font: 'wide' };
  const SL = { id: 'slab', business: "S'Lab", tagline: 'Pasticceria · Paolo Sarpi', title: "Carta S'Lab", reward: 'un dolce a scelta', titleEn: "S'Lab card", rewardEn: 'any pastry, on us', stampsNeeded: 10, lang: 'it', font: 'serif' };
  const CB = { id: 'coracao', business: 'Coraçao do Brasil', tagline: 'Torrefazione · Paolo Sarpi 6', title: 'Carta caffè', reward: 'un caffè gratis', titleEn: 'Coffee card', rewardEn: 'a free coffee', stampsNeeded: 10, lang: 'it', font: 'serif' };
  const OO = { id: 'oops', business: 'O:ops Cafè', tagline: 'Brunch · bubble tea', title: 'Carta O:ops', reward: 'un drink a scelta', titleEn: 'O:ops card', rewardEn: 'any drink, on us', stampsNeeded: 8, lang: 'it', font: 'sans' };
  const OT = { id: 'otto', business: 'oTTo', tagline: 'Bar · Paolo Sarpi 8', title: 'Carta oTTo', reward: 'un caffè gratis', titleEn: 'oTTo card', rewardEn: 'a free coffee', stampsNeeded: 8, lang: 'it', font: 'sans' };

  window.SARPI_LOOK = {
    qqtea: {
      latte: { ...QQ, color: '#EFE3CF', ink: '#4A2E1F', strip: '#E8D9C1', stripImage: pearls('#E8D9C1', '#DFCCAE', 3), iconLogo: mark('cup', '#EFE3CF', '#4A2E1F'), stampImage: stamp('cup', '#5E3A24', '#EFE3CF') },
      taro: { ...QQ, color: '#4B3768', ink: '#F1EAF7', strip: '#43305E', stripImage: pearls('#43305E', '#4E3A6C', 5), iconLogo: mark('cup', '#4B3768', '#F1EAF7'), stampImage: stamp('cup', '#D9C8EE', '#4B3768') }
    },
    slab: {
      sesame: { ...SL, color: '#262422', ink: '#F1EBE1', strip: '#2B2826', stripImage: sesame('#2B2826', '#353130', '#6A625A', 11), iconLogo: mark('canele', '#262422', '#E9DFCF'), stampImage: stamp('canele', '#E9DFCF', '#8A4B2A') },
      azuki: { ...SL, color: '#F4EEE6', ink: '#6E2B2A', strip: '#EDE4D8', iconLogo: mark('canele', '#F4EEE6', '#7A2E2C'), stampImage: stamp('canele', '#7A2E2C', '#F4EEE6') }
    },
    coracao: {
      green: { ...CB, color: '#17473A', ink: '#F4ECD8', strip: '#133E32', iconLogo: mark('bean', '#17473A', '#F2C230'), stampImage: stamp('bean', '#F2C230', '#17473A') },
      kraft: { ...CB, color: '#DCC7A3', ink: '#3A2416', strip: '#D3BB93', iconLogo: mark('bean', '#DCC7A3', '#3A2416'), stampImage: stamp('bean', '#3A2416', '#DCC7A3') }
    },
    oops: {
      pink: { ...OO, color: '#F7DCD6', ink: '#3B2626', strip: '#F2CEC6', iconLogo: mark('face', '#F7DCD6', '#3B2626'), stampImage: stamp('face', '#E2604A', '#FBEDE8', .8) },
      dalgona: { ...OO, color: '#B5763F', ink: '#FFF4E6', strip: '#AA6C38', iconLogo: mark('face', '#B5763F', '#FFF4E6'), stampImage: stamp('face', '#FFF1DD', '#8B5530', .8) }
    },
    otto: {
      green: { ...OT, color: '#2D4A3B', ink: '#F1EDE3', strip: '#284234', stripImage: leaves('#284234', '#30503F', 8), iconLogo: mark('eight', '#2D4A3B', '#F1EDE3'), stampImage: stamp('eight', '#CFE3B4', '#2D4A3B', .82) },
      cream: { ...OT, color: '#F1ECE1', ink: '#22302A', strip: '#E9E2D3', stripImage: leaves('#E9E2D3', '#E0D8C6', 8), iconLogo: mark('eight', '#F1ECE1', '#2D4A3B'), stampImage: stamp('eight', '#2D4A3B', '#F1ECE1', .82) }
    }
  };
})();
