// The cut-away 3D café the animation reels are set in (tre-fatti.html, tre-clienti.html): a plinth
// with a wooden floor, a sage wall with a steel window and the street outside, a plaster wall with
// tiles, shelves, a neon sign, a clock and a chalkboard menu; the counter with a blue espresso
// machine, a grinder, the till with the Timbro QR plaque and a pastry case; pendant lamps, bistro
// tables, plants, steam and dust in the sunlight. Plus the clay figures (person) and small helpers.
//   import { buildCafe } from './cafe3d.js';
//   const K = buildCafe(THREE, renderer, { menu: [5 names and prices], qr: ['Scan', 'for your loyalty card'] });
// Each frame: K.drift(t) moves steam and dust; K.dropIn(t, people) builds the café in the first
// 2.2 seconds (call it after setting every person's position for the frame: it adds to their height).
export function buildCafe(THREE, renderer, T) {
  const BLUE = '#2B32FF', INK = '#16152b';
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
  const backOut = x => { x = clamp01(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, x) => a + (b - a) * x;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const mat = (color, rough = .7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
  const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
  const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  const CHROME = new THREE.MeshStandardMaterial({ color: '#e8e8ec', roughness: .18, metalness: 1 });
  const BRASS = new THREE.MeshStandardMaterial({ color: '#c9a255', roughness: .3, metalness: 1 });
  const BLACK = mat('#1c1b20', .5);
  const GLASS = new THREE.MeshStandardMaterial({ color: '#dff0ff', roughness: .04, metalness: 0, transparent: true, opacity: .2, depthWrite: false, side: THREE.DoubleSide });

  // ---------------- textures, drawn once ----------------
  function woodTex(planks, tones, len = 1024) {
    return tex(canvas(len, len, (g, w, h) => {
      const ph = h / planks;
      for (let p = 0; p < planks; p++) {
        let x = -hash(p * 7.3) * w;
        while (x < w) {
          const pl = w * (.35 + hash(p * 13 + x) * .4), tone = tones[Math.floor(hash(p * 3.1 + x * .01) * tones.length)];
          g.fillStyle = tone; g.fillRect(x, p * ph, pl, ph);
          // grain
          g.globalAlpha = .13; g.strokeStyle = '#3b2414'; g.lineWidth = 1.2;
          for (let k = 0; k < 7; k++) { g.beginPath(); const y0 = p * ph + ph * (k + .5) / 7; for (let s = 0; s <= 24; s++) { const xx = x + pl * s / 24; g.lineTo(xx, y0 + Math.sin(s * .9 + k * 2 + p) * 1.6 + Math.sin(s * 2.7 + k) * .7); } g.stroke(); }
          g.globalAlpha = 1; g.fillStyle = 'rgba(40,22,10,.55)'; g.fillRect(x, p * ph, 2, ph);
          x += pl;
        }
        g.fillStyle = 'rgba(40,22,10,.5)'; g.fillRect(0, p * ph, w, 2);
      }
    }));
  }
  const noisy = (base, amt, rep, size = 512) => tex(canvas(size, size, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) { const n = (hash(i * .37) - .5) * amt; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
    g.putImageData(d, 0, 0);
  }), rep);
  const marbleTex = tex(canvas(1024, 512, (g, w, h) => {
    g.fillStyle = '#f4f1ec'; g.fillRect(0, 0, w, h);
    g.filter = 'blur(1.5px)';
    for (let k = 0; k < 16; k++) {
      g.strokeStyle = `rgba(120,115,110,${.12 + hash(k) * .2})`; g.lineWidth = 1 + hash(k + 4) * 2.5;
      g.beginPath(); let x = hash(k * 3) * w, y = 0; g.moveTo(x, y);
      while (y < h) { x += (hash(x + y + k) - .5) * 90; y += 30 + hash(y + k) * 40; g.lineTo(x, y); }
      g.stroke();
    }
    g.filter = 'none';
  }));
  const tileTex = tex(canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#d8d2c8'; g.fillRect(0, 0, w, h);
    const tw = 64, th = 32;
    for (let r = 0; r < h / th; r++) for (let c = -1; c < w / tw + 1; c++) {
      const x = c * tw + (r % 2) * tw / 2, y = r * th;
      const gr = g.createLinearGradient(0, y, 0, y + th); gr.addColorStop(0, '#fbfaf6'); gr.addColorStop(1, '#ebe7df');
      g.fillStyle = gr; rr(g, x + 2, y + 2, tw - 4, th - 4, 4); g.fill();
    }
  }), [4, 2]);
  const slatTex = woodTex(1, ['#b8875a'], 256);
  const floorTex = woodTex(10, ['#b98552', '#a8743f', '#c4925e', '#9c6a3a', '#b07b47']); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(2.2, 2.6);
  const shelfTex = woodTex(3, ['#8a5a33', '#7a4c2a']);
  const menuTex = tex(canvas(640, 500, (g, w, h) => {
    g.fillStyle = '#1e2420'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,255,255,${hash(i) * .05})`; g.fillRect(hash(i + 1) * w, hash(i + 2) * h, 3, 3); }
    g.fillStyle = 'rgba(245,240,230,.92)'; g.textAlign = 'center'; g.font = 'italic 600 84px "EB Garamond"'; g.fillText('Menu', w / 2, 96);
    g.strokeStyle = 'rgba(245,240,230,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(200, 120); g.lineTo(440, 120); g.stroke();
    g.font = '500 32px Archivo';
    for (let i = 0; i < 5; i++) {
      const y = 180 + i * 62; g.textAlign = 'left'; g.fillText(T.menu[i * 2], 60, y); g.textAlign = 'right'; g.fillText(T.menu[i * 2 + 1], w - 60, y);
      g.fillStyle = 'rgba(245,240,230,.35)'; for (let x = 60 + g.measureText(T.menu[i * 2]).width + 30; x < w - 140; x += 14) g.fillRect(x, y - 6, 4, 4); g.fillStyle = 'rgba(245,240,230,.92)';
    }
  }));
  const neonTex = tex(canvas(800, 300, (g, w, h) => {
    g.font = 'italic 600 190px "EB Garamond"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [blur, col, a] of [[40, '#ff4f8b', .9], [18, '#ff6f9f', 1], [6, '#ffc2d6', 1]]) { g.shadowColor = col; g.shadowBlur = blur; g.globalAlpha = a; g.fillStyle = col; g.fillText('caffè', w / 2, h / 2); }
    g.shadowBlur = 0; g.globalAlpha = 1; g.fillStyle = '#fff3f7'; g.font = 'italic 600 186px "EB Garamond"'; g.fillText('caffè', w / 2, h / 2);
  }));
  const clockTex = tex(canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#fbfaf7'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
    g.fillStyle = INK; for (let i = 0; i < 12; i++) { g.save(); g.translate(128, 128); g.rotate(i * Math.PI / 6); g.fillRect(-3, -112, 6, i % 3 ? 14 : 24); g.restore(); }
    const hand = (a, l, wd, c) => { g.save(); g.translate(128, 128); g.rotate(a); g.fillStyle = c; rr(g, -wd / 2, -l, wd, l + 14, wd / 2); g.fill(); g.restore(); };
    hand((9 + 41 / 60) / 12 * Math.PI * 2, 62, 9, INK); hand(41 / 60 * Math.PI * 2, 92, 6, INK); g.fillStyle = BLUE; g.beginPath(); g.arc(128, 128, 9, 0, 7); g.fill();
  }));
  const gaugeTex = tex(canvas(128, 128, (g) => {
    g.fillStyle = '#f7f7f2'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
    g.strokeStyle = '#333'; g.lineWidth = 3; for (let i = 0; i <= 8; i++) { const a = Math.PI * (.75 + i * 1.5 / 8); g.beginPath(); g.moveTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46); g.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56); g.stroke(); }
    g.strokeStyle = '#e03a2f'; g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(-.5) * 44, 64 + Math.sin(-.5) * 44); g.stroke();
  }));
  function drawQR(g, x, y, s, seed = 0) {
    const n = 21, c = s / n; g.fillStyle = '#111';
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const fx = i < 7 ? i : i >= 14 ? i - 14 : -1, fy = j < 7 ? j : j >= 14 ? j - 14 : -1;
      const inF = fx >= 0 && fy >= 0 && !(i >= 14 && j >= 14);
      const on = inF ? (fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4)) : hash(i * 31 + j * 17 + seed) > .52;
      if (on) g.fillRect(x + i * c, y + j * c, c + .5, c + .5);
    }
  }
  const qrTex = tex(canvas(320, 440, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = BLUE; g.beginPath(); g.arc(46, 46, 16, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(46, 46, 9, 0, 7); g.fill(); g.fillStyle = BLUE; g.beginPath(); g.arc(46, 46, 6, 0, 7); g.fill();
    g.fillStyle = INK; g.font = '800 30px Archivo'; g.fillText('Timbro', 72, 57);
    drawQR(g, 50, 90, 220, 3);
    g.textAlign = 'center'; g.font = '800 34px Archivo'; g.fillText(T.qr[0], w / 2, 360); g.font = '500 22px Archivo'; g.fillStyle = '#555'; g.fillText(T.qr[1], w / 2, 396);
  }));
  const bagTex = (band, word) => tex(canvas(160, 240, (g, w, h) => {
    g.fillStyle = '#c9a37a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(80,50,20,${hash(i) * .12})`; g.fillRect(hash(i + 1) * w, hash(i + 2) * h, 2, 2); }
    g.fillStyle = band; g.fillRect(0, 96, w, 70);
    g.fillStyle = '#fff'; g.font = '800 26px Archivo'; g.textAlign = 'center'; g.fillText(word, w / 2, 141);
    g.fillStyle = 'rgba(60,35,15,.7)'; g.font = '500 15px Archivo'; g.fillText('250 g', w / 2, 200);
  }));
  const artTex = tex(canvas(256, 320, (g, w, h) => {
    g.fillStyle = '#f2e6d3'; g.fillRect(0, 0, w, h);
    g.fillStyle = BLUE; g.beginPath(); g.arc(128, 140, 70, 0, 7); g.fill();
    g.fillStyle = '#FFC24B'; g.beginPath(); g.arc(170, 205, 38, 0, 7); g.fill();
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(40, 270); g.bezierCurveTo(100, 240, 150, 300, 216, 262); g.stroke();
  }));
  const outsideTex = tex(canvas(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#bfe0ff'); gr.addColorStop(.6, '#fff1d6'); gr.addColorStop(1, '#f7e2c0'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9d8c0'; g.fillRect(0, 300, w, 212);   // the building across the street
    for (let i = 0; i < 4; i++) { g.fillStyle = '#cdb898'; g.fillRect(30 + i * 125, 330, 70, 100); }
    for (let i = 0; i < 14; i++) { g.fillStyle = ['#7fa36a', '#6b9058', '#8db577'][i % 3]; g.beginPath(); g.arc(hash(i) * w, 330 + hash(i + 5) * 60, 40 + hash(i + 9) * 40, 0, 7); g.fill(); }
  }));

  // ---------------- the café ----------------
  const scene = new THREE.Scene();
  {
    // a soft studio environment for reflections (chrome, glass, the machine's paint)
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(.55, .45, .38), side: THREE.BackSide })));
    const panel = (w, h, c, p, r) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.copy(p); m.rotation.set(...r); env.add(m); };
    panel(10, 6, new THREE.Color(6, 5.4, 4.6), V(-9, 5, 2), [0, Math.PI / 2, 0]);
    panel(14, 4, new THREE.Color(3, 3, 3.2), V(0, 7.9, 0), [Math.PI / 2, 0, 0]);
    panel(8, 5, new THREE.Color(2.2, 2.4, 3), V(8, 4, 6), [0, -Math.PI / 3, 0]);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, .04).texture;
    scene.environmentIntensity = .55;
  }
  scene.add(new THREE.HemisphereLight('#fff3e2', '#9a7a5a', .9));
  const sun = new THREE.DirectionalLight('#ffe0b0', 3.4);
  sun.position.set(-8, 9.5, 3.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#dfe7ff', .7); fill.position.set(7, 5, 9); scene.add(fill);

  const RW = 7, RD = 5.6, WH = 3.3, X0 = -RW / 2, Z0 = -RD / 2;
  const add = (m, parent = scene) => { m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return add(b, parent); };
  const cyl = (rt, rb, h, m, x, y, z, parent, seg = 28) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); c.position.set(x, y, z); return add(c, parent); };
  const sph = (r, m, x, y, z, parent) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); s.position.set(x, y, z); return add(s, parent); };
  const lathe = (pts, m, seg = 32) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), m);
  const roundedShape = (w, h, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  };
  // a box with rounded edges, centred (w x h, depth d along z)
  const rbox = (w, h, d, r, m) => { const geo = new THREE.ExtrudeGeometry(roundedShape(w - 2 * r * .5, h - 2 * r * .5, r), { depth: d - r, bevelEnabled: true, bevelThickness: r * .5, bevelSize: r * .5, bevelSegments: 4, curveSegments: 8 }); geo.translate(0, 0, -(d - r) / 2); return new THREE.Mesh(geo, m); };
  // a flat face with a texture filling it, rounded corners
  const face = (w, h, r, map, extra = {}) => {
    const geo = new THREE.ShapeGeometry(roundedShape(w, h, r), 8);
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + .5, pos.getY(i) / h + .5);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughness: .6, ...extra }));
  };

  // plinth and floor
  box(RW + .36, .42, RD + .36, mat('#4a3426', .8), 0, -.21, 0);
  box(RW + .38, .06, RD + .38, mat(BLUE, .5), 0, -.45, 0);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), mat('#ffffff', .55, { map: floorTex })); floor.rotation.x = -Math.PI / 2; floor.position.y = .002; floor.receiveShadow = true; scene.add(floor);
  // a round rug under the tables
  { const rug = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), mat('#d9c3a3', .95, { map: noisy('#cdb28c', 40, [3, 3], 256) })); rug.rotation.x = -Math.PI / 2; rug.position.set(-2.15, .006, .7); rug.receiveShadow = true; scene.add(rug);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.13, 48), mat('#b4553b', .95)); ring.rotation.x = -Math.PI / 2; ring.position.set(-2.15, .008, .7); ring.receiveShadow = true; scene.add(ring); }

  // back wall: plaster, subway tiles behind the counter, a skirting board
  const plaster = mat('#ffffff', .95, { map: noisy('#f2e5d2', 10, [3, 2]) });
  box(RW + .2, WH, .2, plaster, 0, WH / 2, Z0 - .1);
  { const tiles = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.45), mat('#ffffff', .35, { map: tileTex })); tiles.position.set(1.15, .725, Z0 + .006); tiles.receiveShadow = true; scene.add(tiles); }
  box(RW, .1, .03, mat('#8a5a33', .6), 0, .05, Z0 + .015);
  // left wall, sage green, with a big window (opening z -1.5..1.3, y .85..2.55)
  const sage = mat('#ffffff', .95, { map: noisy('#a7b79c', 10, [3, 2]) });
  const OZ0 = -1.5, OZ1 = 1.3, OY0 = .85, OY1 = 2.55, WX = X0 - .1;
  box(.2, OY0, RD, sage, WX, OY0 / 2, 0);
  box(.2, WH - OY1, RD, sage, WX, (OY1 + WH) / 2, 0);
  box(.2, OY1 - OY0, OZ0 - Z0, sage, WX, (OY0 + OY1) / 2, (Z0 + OZ0) / 2);
  box(.2, OY1 - OY0, RD / 2 - OZ1, sage, WX, (OY0 + OY1) / 2, (OZ1 + RD / 2) / 2);
  box(.03, .1, RD, mat('#8a5a33', .6), X0 + .015, .05, 0);
  // window: black steel frame and glazing bars, glass, a wooden sill, the street outside
  {
    const steel = mat('#1f1f24', .45, { metalness: .4 });
    const zc = (OZ0 + OZ1) / 2, yc = (OY0 + OY1) / 2;
    box(.08, .06, OZ1 - OZ0, steel, X0 + .01, OY1 - .03, zc); box(.08, .06, OZ1 - OZ0, steel, X0 + .01, OY0 + .03, zc);
    for (const z of [OZ0 + .03, OZ0 + (OZ1 - OZ0) / 3, OZ0 + 2 * (OZ1 - OZ0) / 3, OZ1 - .03]) box(.08, OY1 - OY0, .05, steel, X0 + .01, yc, z);
    box(.06, .035, OZ1 - OZ0, steel, X0 + .01, OY0 + (OY1 - OY0) * .68, zc);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(OZ1 - OZ0, OY1 - OY0), GLASS); glass.rotation.y = Math.PI / 2; glass.position.set(X0, yc, zc); scene.add(glass);
    box(.32, .045, OZ1 - OZ0 + .2, mat('#ffffff', .6, { map: shelfTex }), X0 + .12, OY0, zc);
    const out = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.4), new THREE.MeshBasicMaterial({ map: outsideTex })); out.rotation.y = Math.PI / 2; out.position.set(X0 - 2.2, 1.7, zc); scene.add(out);
  }

  // the counter: slatted oak front, marble top
  const CZ = -2.0, CH = .7, CX0 = -.75, CX1 = 3.15, CW = CX1 - CX0, CXM = (CX0 + CX1) / 2, TOP = CH + .03;
  box(CW, CH - .06, .58, mat('#7a5232', .7), CXM, (CH - .06) / 2 + .06, CZ);
  box(CW - .06, .06, .5, mat('#2a2522', .6), CXM, .03, CZ + .02);
  for (let i = 0; i < 26; i++) { const sw = CW / 26; const s = box(sw - .018, CH - .1, .03, mat(hash(i) > .5 ? '#c18f5e' : '#b68352', .55, { map: slatTex }), CX0 + sw * (i + .5), (CH - .1) / 2 + .07, CZ + .3); s.castShadow = false; }
  box(CW + .12, .05, .7, mat('#ffffff', .25, { map: marbleTex }), CXM, CH + .005, CZ + .02);

  // cups and saucers
  const CUP = [[0, 0], [.03, 0], [.034, .004], [.044, .05], [.047, .068], [.043, .068], [.04, .056], [.031, .008], [0, .008]];
  function makeCup(s = 1, color = '#ffffff', coffee = true, saucer = true) {
    const g = new THREE.Group(), m = mat(color, .25);
    const c = lathe(CUP, m, 28); c.castShadow = true; g.add(c);
    const h = new THREE.Mesh(new THREE.TorusGeometry(.016, .0045, 8, 16, Math.PI * 1.25), m); h.position.set(.046, .036, 0); h.rotation.z = -Math.PI * .62; g.add(h);
    if (coffee) { const cr = new THREE.Mesh(new THREE.CircleGeometry(.041, 24), mat('#b98249', .4)); cr.rotation.x = -Math.PI / 2; cr.position.y = .058; g.add(cr); }
    if (saucer) { const sc = lathe([[0, 0], [.07, 0], [.082, .01], [.078, .012], [0, .005]], m, 28); sc.position.y = -.004; sc.receiveShadow = true; g.add(sc); c.position.y = .003; }
    g.scale.setScalar(s); return g;
  }
  // steam: soft puffs rising from hot cups
  const steamTex = tex(canvas(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }));
  const steams = [];
  function steam(x, y, z, n = 5, size = .09) {
    for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 })); s.position.set(x, y, z); s.userData = { x, y, z, i, n, size }; scene.add(s); steams.push(s); }
  }

  // the espresso machine, in the brand blue, with chrome
  {
    const M = new THREE.Group(); M.position.set(.45, TOP, CZ - .02); scene.add(M);
    const paint = new THREE.MeshStandardMaterial({ color: BLUE, roughness: .28, metalness: .25 });
    const body = rbox(1.0, .36, .5, .06, paint); body.position.set(0, .36, 0); add(body, M);
    box(.98, .06, .44, CHROME, 0, .03, .02, M);           // base
    box(.92, .03, .2, CHROME, 0, .075, .2, M);            // drip tray
    for (let i = 0; i < 9; i++) box(.006, .004, .18, BLACK, -.4 + i * .1, .092, .2, M);
    box(.96, .02, .46, CHROME, 0, .55, 0, M);             // cup warmer on top
    for (const x of [-.47, .47]) cyl(.008, .008, .46, CHROME, x, .6, 0, M, 8).rotation.x = Math.PI / 2;
    box(.95, .01, .01, CHROME, 0, .6, .23, M);
    box(.86, .07, .01, CHROME, 0, .44, .252, M);          // chrome band
    for (const x of [-.24, .24]) {
      cyl(.06, .055, .07, CHROME, x, .15, .2, M);         // group head
      const pf = cyl(.05, .045, .035, CHROME, x, .1, .22, M);
      const handle = cyl(.014, .016, .16, BLACK, x, .095, .32, M, 10); handle.rotation.x = Math.PI / 2 - .25;
      const cup = makeCup(.75, '#ffffff', true, false); cup.position.set(x, .09, .21); M.add(cup);
      cyl(.012, .012, .03, BLACK, x + .1, .565, .2, M, 10);   // knobs
    }
    const wand = cyl(.007, .007, .24, CHROME, .44, .2, .2, M, 8); wand.rotation.z = .25;
    const gauge = new THREE.Mesh(new THREE.CircleGeometry(.045, 32), new THREE.MeshStandardMaterial({ map: gaugeTex, roughness: .2 })); gauge.position.set(0, .33, .253); M.add(gauge);
    const gring = new THREE.Mesh(new THREE.TorusGeometry(.047, .007, 8, 32), CHROME); gring.position.copy(gauge.position); M.add(gring);
    for (let i = 0; i < 6; i++) { const c = makeCup(.62, i % 2 ? '#f2efe9' : '#ffffff', false, false); c.position.set(-.33 + i * .13, .562, -.05 + (i % 2) * .1); c.rotation.x = Math.PI; c.position.y += .042; M.add(c); }
    steam(.45 - .24, TOP + .2, CZ + .2, 4, .06); steam(.45 + .24, TOP + .2, CZ + .2, 4, .06);
  }
  // grinder
  {
    const G = new THREE.Group(); G.position.set(-.38, TOP, CZ - .05); scene.add(G);
    box(.2, .26, .24, mat('#2a2a30', .35, { metalness: .3 }), 0, .13, 0, G);
    cyl(.05, .06, .08, CHROME, 0, .3, 0, G);
    const hop = cyl(.075, .045, .2, GLASS, 0, .44, 0, G); hop.castShadow = false;
    cyl(.068, .042, .14, mat('#3a2112', .9), 0, .41, 0, G);
    cyl(.08, .08, .02, BLACK, 0, .55, 0, G);
    box(.08, .02, .1, CHROME, 0, .1, .15, G);
  }
  // a stack of cups
  for (let i = 0; i < 4; i++) { const c = makeCup(1.05, '#ffffff', false, i === 0); c.position.set(-.64, TOP + i * .045, CZ + .1); scene.add(c); }
  // the till: a tablet on a stand, the Timbro QR plaque facing the customers
  {
    const tb = new THREE.Group(); tb.position.set(1.32, TOP, CZ - .02); scene.add(tb);
    cyl(.05, .07, .02, mat('#d8d8dc', .3, { metalness: .6 }), 0, .01, 0, tb);
    const arm = box(.03, .2, .03, mat('#d8d8dc', .3, { metalness: .6 }), 0, .11, 0, tb);
    const pad = rbox(.32, .23, .02, .02, BLACK); pad.position.set(0, .25, .02); pad.rotation.x = -.5; add(pad, tb);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(.29, .2), new THREE.MeshBasicMaterial({ color: '#eef0ff' })); scr.position.set(0, .253, .033); scr.rotation.x = -.5; tb.add(scr);
    const qr = new THREE.Group(); qr.position.set(1.72, TOP, CZ + .22); scene.add(qr);
    box(.16, .015, .07, mat('#e8e8ee', .2), 0, .008, 0, qr);
    const plate = face(.15, .205, .012, qrTex); plate.position.set(0, .115, 0); plate.rotation.x = -.12; qr.add(plate);
    const back = rbox(.16, .215, .01, .01, mat('#ffffff', .3)); back.position.set(0, .115, -.008); back.rotation.x = -.12; add(back, qr);
  }
  // the pastry case: glass over croissants, cakes and muffins
  function croissant() {
    const g = new THREE.Group(), m = mat('#d38f3d', .55);
    [[-.9, .02], [-.45, .028], [0, .034], [.45, .028], [.9, .02]].forEach(([a, r]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); s.position.set(Math.sin(a) * .045, r * .7, Math.cos(a) * .045 - .045); s.scale.set(1.3, .78, 1); s.rotation.y = a; s.castShadow = true; g.add(s); });
    return g;
  }
  {
    const P = new THREE.Group(); P.position.set(2.55, TOP, CZ + .03); scene.add(P);
    box(1.0, .05, .5, mat('#2a2522', .5), 0, .025, 0, P);
    const glassBox = new THREE.Mesh(new THREE.BoxGeometry(.98, .38, .48), GLASS); glassBox.position.set(0, .24, 0); P.add(glassBox);
    for (const [x, z] of [[-.49, -.24], [.49, -.24], [-.49, .24], [.49, .24]]) box(.012, .38, .012, BRASS, x, .24, z, P);
    box(.99, .012, .49, BRASS, 0, .43, 0, P);
    box(.94, .008, .44, GLASS, 0, .23, 0, P).castShadow = false;
    for (let i = 0; i < 4; i++) { const c = croissant(); c.position.set(-.33 + i * .22, .05, .02 + (i % 2) * .08); c.rotation.y = hash(i) * 2; c.scale.setScalar(1.15); P.add(c); }
    for (let i = 0; i < 3; i++) {   // cake slices and muffins on the glass shelf
      const x = -.3 + i * .3;
      if (i === 1) { const cake = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .08, 24, 1, false, 0, 4.9), mat('#f5e6c8', .7)); cake.position.set(x, .275, 0); add(cake, P); const top = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .02, 24, 1, false, 0, 4.9), mat('#e86a8a', .5)); top.position.set(x, .325, 0); add(top, P); for (let k = 0; k < 5; k++) sph(.013, mat('#b3123a', .3), x + Math.cos(k * 1.1) * .06, .342, Math.sin(k * 1.1) * .06, P); }
      else for (const dz of [-.08, .08]) { cyl(.04, .03, .05, mat('#efe3cc', .9), x + dz * .5, .262, dz, P, 14); const tp = sph(.048, mat('#7a4520', .8), x + dz * .5, .295, dz, P); tp.scale.y = .7; for (let k = 0; k < 3; k++) sph(.01, mat('#2b2a6a', .4), x + dz * .5 + Math.cos(k * 2) * .025, .318, dz + Math.sin(k * 2) * .025, P); }
    }
  }

  // shelves on the back wall with coffee bags, jars, mugs and small plants
  const leafShape = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(.09, .06, .08, .22, 0, .3); s.bezierCurveTo(-.08, .22, -.09, .06, 0, 0); return s; })();
  const leafGeo = new THREE.ShapeGeometry(leafShape, 6);
  const LEAF = [mat('#4f8a4a', .6, { side: THREE.DoubleSide }), mat('#3f7a3f', .6, { side: THREE.DoubleSide }), mat('#66a05a', .6, { side: THREE.DoubleSide })];
  function plant(n, size, potColor, potH = .2, potR = .12, spread = .5, tall = 1) {
    const g = new THREE.Group();
    const pot = lathe([[0, 0], [potR * .8, 0], [potR, potH * .9], [potR * 1.08, potH], [potR * .95, potH], [0, potH * .92]], mat(potColor, .8), 24); add(pot, g);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(potR * .95, 20), mat('#3a2616', 1)); soil.rotation.x = -Math.PI / 2; soil.position.y = potH * .9; g.add(soil);
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, up = .4 + hash(i + n) * .5 * tall, out = spread * (.4 + hash(i * 3) * .6);
      const stemLen = Math.hypot(up, out * .4);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.006 * size * 4, .008 * size * 4, stemLen * size, 6), mat('#3d6b35', .7)); stem.position.set(Math.cos(a) * out * .2 * size, potH + stemLen * size / 2, Math.sin(a) * out * .2 * size); stem.lookAt(Math.cos(a) * out * .4 * size, potH + up * size * 2, Math.sin(a) * out * .4 * size); stem.rotateX(Math.PI / 2); g.add(stem);
      const leaf = new THREE.Mesh(leafGeo, LEAF[i % 3]); leaf.castShadow = true;
      leaf.position.set(Math.cos(a) * out * .4 * size, potH + up * size, Math.sin(a) * out * .4 * size);
      leaf.rotation.set(0, -a + Math.PI / 2, 0); leaf.rotateX(-(.5 + hash(i) * .6)); leaf.scale.setScalar(size * (1.2 + hash(i + 2) * .5));
      g.add(leaf);
    }
    return g;
  }
  {
    const S = new THREE.Group(); scene.add(S);
    const sm = mat('#ffffff', .6, { map: shelfTex });
    for (const y of [1.55, 2.05]) { box(3.3, .045, .26, sm, 1.2, y, Z0 + .13, S); for (const x of [-.3, 2.7]) box(.03, .1, .2, BLACK, x, y - .07, Z0 + .1, S); }
    const bags = [['#2B32FF', 'ESPRESSO'], ['#b4553b', 'BLEND'], ['#2f5a3a', 'DECA'], ['#16152b', 'ARABICA']];
    bags.forEach(([c, w], i) => { const mats = [mat('#c9a37a', .9), mat('#c9a37a', .9), mat('#b8916a', .9), mat('#c9a37a', .9), new THREE.MeshStandardMaterial({ map: bagTex(c, w), roughness: .85 }), mat('#c9a37a', .9)]; const b = new THREE.Mesh(new THREE.BoxGeometry(.16, .24, .08), mats); b.position.set(-.05 + i * .2, 1.55 + .145, Z0 + .14); b.rotation.y = (hash(i) - .5) * .25; add(b, S); box(.15, .03, .03, mat('#b8916a', .9), b.position.x, 1.55 + .275, Z0 + .14, S); });
    for (let i = 0; i < 3; i++) { const x = .95 + i * .18; const j = cyl(.06, .06, .18, GLASS, x, 1.665, Z0 + .14, S); j.castShadow = false; cyl(.055, .055, .13, mat(['#3a2112', '#5a3418', '#2a180c'][i], .9), x, 1.64, Z0 + .14, S); cyl(.063, .063, .03, mat('#7a5232', .6), x, 1.77, Z0 + .14, S); }
    const p1 = plant(7, .45, '#e9e2d6', .12, .07, .6, .6); p1.position.set(1.65, 1.575, Z0 + .14); S.add(p1);
    for (let i = 0; i < 5; i++) { const m = makeCup(1.5, ['#2B32FF', '#ffffff', '#FFC24B', '#ffffff', '#b4553b'][i], false, false); m.position.set(-.1 + i * .16, 2.075, Z0 + .14); S.add(m); }
    const p2 = plant(9, .4, '#b4553b', .12, .075, .9, .4); p2.position.set(1.2, 2.075, Z0 + .14); S.add(p2);
    for (let i = 0; i < 6; i++) box(.05, .2 + hash(i) * .06, .16, mat(['#2B32FF', '#e9e2d6', '#b4553b', '#2f5a3a', '#FFC24B', '#16152b'][i], .8), 1.75 + i * .055, 2.075 + .11, Z0 + .14, S);
    const p3 = plant(6, .5, '#16152b', .14, .08, .5, .8); p3.position.set(2.45, 2.075, Z0 + .14); S.add(p3);
    // the neon sign and the clock
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .49), new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, depthWrite: false, toneMapped: false })); neon.position.set(1.2, 2.72, Z0 + .02); scene.add(neon);
    const clock = cyl(.2, .2, .04, mat('#ffffff', .4), -1.15, 2.6, Z0 + .03, S, 40); clock.rotation.x = Math.PI / 2;
    const cf = new THREE.Mesh(new THREE.CircleGeometry(.185, 40), new THREE.MeshStandardMaterial({ map: clockTex, roughness: .3 })); cf.position.set(-1.15, 2.6, Z0 + .052); S.add(cf);
    const crim = new THREE.Mesh(new THREE.TorusGeometry(.2, .018, 10, 40), BLACK); crim.position.set(-1.15, 2.6, Z0 + .05); S.add(crim);
    // the chalkboard menu over the tables, a print on the left wall
    box(1.36, 1.06, .05, mat('#7a5232', .6), -2.35, 1.85, Z0 + .03, S);
    const mb = new THREE.Mesh(new THREE.PlaneGeometry(1.24, .94), new THREE.MeshStandardMaterial({ map: menuTex, roughness: .9 })); mb.position.set(-2.35, 1.85, Z0 + .058); S.add(mb);
    box(.04, .72, .58, mat('#16152b', .5), X0 + .02, 1.75, 2.05, S);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(.5, .64), new THREE.MeshStandardMaterial({ map: artTex, roughness: .8 })); art.rotation.y = Math.PI / 2; art.position.set(X0 + .045, 1.75, 2.05); S.add(art);
  }
  // pendant lamps on arms from the back wall
  const lampLights = [];
  for (const x of [.1, 1.3, 2.5]) {
    box(.03, .03, .9, BLACK, x, 3.05, Z0 + .45);
    cyl(.004, .004, .8, BLACK, x, 2.65, CZ + .1, scene, 6);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.17, .17, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#1e1d22', roughness: .4, metalness: .2, side: THREE.DoubleSide })); shade.position.set(x, 2.2, CZ + .1); add(shade);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(.165, .165, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd9a0', side: THREE.BackSide })); inner.position.set(x, 2.197, CZ + .1); scene.add(inner);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff1d0', toneMapped: false })); bulb.position.set(x, 2.12, CZ + .1); scene.add(bulb);
    const l = new THREE.PointLight('#ffc274', 2.2, 3.2, 2); l.position.set(x, 2.0, CZ + .1); scene.add(l); lampLights.push(l);
  }
  // bistro tables and bentwood chairs
  function chair(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const wood = mat('#3b2a20', .5);
    cyl(.16, .15, .035, mat('#c49a6c', .6), 0, .4, 0, g);
    for (const [lx, lz] of [[-.1, -.1], [.1, -.1], [-.1, .1], [.1, .1]]) { const l = cyl(.012, .01, .4, wood, lx * 1.1, .2, lz * 1.1, g, 8); l.rotation.set(lz * .5, 0, -lx * .5); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.13, .01, 8, 24), wood); ring.rotation.x = Math.PI / 2; ring.position.y = .2; add(ring, g);
    const back = new THREE.Mesh(new THREE.TorusGeometry(.15, .013, 8, 24, Math.PI), wood); back.position.set(0, .62, -.13); add(back, g);
    for (const sx of [-.15, .15]) cyl(.012, .012, .24, wood, sx, .5, -.13, g, 8);
    for (const sx of [-.05, .05]) cyl(.008, .008, .2, wood, sx, .58, -.13, g, 6);
    return g;
  }
  function table(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    cyl(.34, .34, .03, mat('#ffffff', .25, { map: marbleTex }), 0, .64, 0, g, 40);
    cyl(.345, .345, .012, BRASS, 0, .622, 0, g, 40);
    cyl(.022, .022, .6, BLACK, 0, .32, 0, g, 12);
    cyl(.18, .2, .025, BLACK, 0, .013, 0, g, 32);
    return g;
  }
  const TABLES = [[-2.35, -.2], [-2.05, 1.6]];
  TABLES.forEach(([x, z], i) => {
    table(x, z);
    chair(x + .55, z + .05, -Math.PI / 2); chair(x - .55, z - .05, Math.PI / 2);
    const c1 = makeCup(1.1); c1.position.set(x + .16, .655, z + .05); scene.add(c1); steam(x + .16, .76, z + .05, 4, .07);
    const c2 = makeCup(1.1); c2.position.set(x - .18, .655, z - .06); c2.rotation.y = 2.4; scene.add(c2);
    if (i === 0) { const pl = new THREE.Group(); const sc = lathe([[0, 0], [.1, 0], [.11, .012], [0, .006]], mat('#ffffff', .3)); pl.add(sc); const cr = croissant(); cr.position.y = .008; pl.add(cr); pl.position.set(x, .655, z + .14); scene.add(pl); }
    else { const v = cyl(.03, .04, .14, GLASS, x, .725, z - .02); v.castShadow = false; const fl = plant(4, .25, '#ffffff', .0, .0, .3, .5); fl.position.set(x, .7, z - .02); scene.add(fl); }
  });
  // plants: a big one in the back corner, one at the front, small ones on the sill
  { const p = plant(13, 1.15, '#b4553b', .42, .2, .9, 1.4); p.position.set(X0 + .38, 0, Z0 + .4); scene.add(p); }
  { const p = plant(10, .9, '#e9e2d6', .36, .17, .7, 1.6); p.position.set(3.05, 0, 2.3); scene.add(p); }
  for (let i = 0; i < 3; i++) { const p = plant(5, .32, ['#e9e2d6', '#b4553b', '#16152b'][i], .1, .06, .6, .6); p.position.set(X0 + .14, OY0 + .02, -1.1 + i * .9); scene.add(p); }

  // dust in the window light
  const dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#fff6e0', size: .025, transparent: true, opacity: .7, depthWrite: false }));
  { const p = []; for (let i = 0; i < 140; i++) p.push(X0 + .3 + hash(i) * 2.8, .3 + hash(i + 40) * 2.4, OZ0 + hash(i + 80) * (OZ1 - OZ0 + .5)); dust.geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); dust.userData.base = p; }
  scene.add(dust);

  // everything built so far drops into place in the first second and a half
  const BUILT = scene.children.filter(o => (o.isMesh || o.isGroup) && !o.isSprite); BUILT.forEach(o => { o.userData.y0 = o.position.y; });

  // ---------------- people ----------------
  const SHIRTS = ['#E4572E', '#2B9EB3', '#F3A712', '#6C4AB6', '#29BF12', '#E84A8A', '#3D5A80', '#FF8C42', '#1B998B'];
  const SKIN = ['#f1c9a5', '#d9a77f', '#a8774f', '#f6d7bd', '#8a5a3c'], HAIR = ['#2b1d16', '#6b4226', '#d9b26a', '#1a1a1a', '#a0522d'];
  const PANTS = ['#2d3a5c', '#3b3b45', '#5b4636', '#1f2a38'];
  // A clay figure: legs and shoes, a rounded body, arms with hands, a head with ears, shiny eyes,
  // cheeks, a nose and a smile, one of five hair styles; optional apron, glasses, phone or cup.
  function person(o) {
    const i = o.i, g = new THREE.Group(), m = c => mat(c, .85);
    const shirt = o.shirt || SHIRTS[i % SHIRTS.length], skin = SKIN[i % SKIN.length], hc = HAIR[i % HAIR.length];
    const cap = (r, len, c) => { const x = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 16), m(c)); x.castShadow = true; return x; };
    const limb = (r, len, c, x, y) => { const pivot = new THREE.Group(); pivot.position.set(x, y, 0); const l = cap(r, len, c); l.position.y = -(len / 2 + r * .6); pivot.add(l); g.add(pivot); return pivot; };
    const legs = [-.075, .075].map(x => limb(.062, .2, o.pants || PANTS[i % PANTS.length], x, .3));
    legs.forEach(l => { const s = new THREE.Mesh(new THREE.SphereGeometry(.068, 14, 10), m(o.shoe || '#f4f4f4')); s.scale.set(1, .6, 1.45); s.position.set(0, -.335, .035); s.castShadow = true; l.add(s); const sole = new THREE.Mesh(new THREE.CylinderGeometry(.062, .062, .012, 14), m('#2a2a2a')); sole.scale.set(1, 1, 1.45); sole.position.set(0, -.365, .035); l.add(sole); });
    const body = cap(.158, .2, shirt); body.position.y = .52; body.scale.set(1, 1, .84); g.add(body);
    if (o.apron) { const ap = new THREE.Mesh(new THREE.CylinderGeometry(.162, .17, .34, 20, 1, true, -1.1, 2.2), mat(o.apron, .8, { side: THREE.DoubleSide })); ap.scale.set(1, 1, .86); ap.position.y = .47; g.add(ap); const strap = new THREE.Mesh(new THREE.TorusGeometry(.09, .012, 6, 16, Math.PI), m(o.apron)); strap.position.set(0, .66, .07); strap.rotation.x = -.5; g.add(strap); }
    const arms = [-1, 1].map(sd => { const a = limb(.047, .2, shirt, sd * .198, .65); a.rotation.z = sd * .12; return a; });
    arms.forEach(a => { const h = new THREE.Mesh(new THREE.SphereGeometry(.047, 12, 10), m(skin)); h.position.y = -.335; a.add(h); });
    const head = new THREE.Group(); head.position.y = .885; g.add(head);
    const hs = new THREE.Mesh(new THREE.SphereGeometry(.145, 28, 20), m(skin)); hs.castShadow = true; head.add(hs);
    for (const x of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), m(skin)); ear.position.set(x * .142, -.005, 0); ear.scale.set(.6, 1, 1); head.add(ear); }
    const eyeM = new THREE.MeshStandardMaterial({ color: '#141414', roughness: .15 }), hiM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    for (const x of [-.05, .05]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.02, 12, 10), eyeM); e.position.set(x, .018, .13); e.scale.z = .6; head.add(e); const hi = new THREE.Mesh(new THREE.SphereGeometry(.0065, 6, 6), hiM); hi.position.set(x + .007, .026, .142); head.add(hi); }
    const blushM = new THREE.MeshBasicMaterial({ color: '#ff8a8a', transparent: true, opacity: .45, depthWrite: false });
    for (const x of [-1, 1]) { const b = new THREE.Mesh(new THREE.CircleGeometry(.022, 16), blushM); const d = V(x * .62, -.22, .76).normalize(); b.position.copy(d.clone().multiplyScalar(.1462)); b.lookAt(d.clone().multiplyScalar(2)); head.add(b); }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.017, 10, 8), m(skin)); nose.position.set(0, -.008, .145); head.add(nose);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(.028, .0055, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: '#5a2a1f' })); smile.position.set(0, -.045, .132); smile.rotation.set(-.25, 0, Math.PI); head.add(smile);
    const style = o.hair ?? i % 5, hairM = m(style === 2 ? (o.capColor || SHIRTS[(i + 3) % SHIRTS.length]) : hc);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.153, 28, 14, 0, Math.PI * 2, 0, Math.PI * .5), hairM); hair.position.y = .012; hair.rotation.x = -.28; hair.castShadow = true; head.add(hair);
    if (style === 1) { const bun = new THREE.Mesh(new THREE.SphereGeometry(.062, 14, 10), hairM); bun.position.set(0, .13, -.07); head.add(bun); }
    if (style === 2) { const brim = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .018, 18), hairM); brim.scale.set(1, 1, 1.3); brim.position.set(0, .06, .12); brim.rotation.x = .12; head.add(brim); }
    if (style === 3) { const back = new THREE.Mesh(new THREE.CapsuleGeometry(.125, .12, 6, 14), m(hc)); back.position.set(0, -.08, -.065); back.scale.set(1.05, 1, .62); head.add(back); }
    if (style === 4) for (let k = 0; k < 9; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), m(hc)); const a = k / 9 * Math.PI * 2; c.position.set(Math.cos(a) * .1, .09 + Math.sin(k * 1.7) * .02, Math.sin(a) * .1 - .02); head.add(c); }
    if (o.glasses) { const gm = new THREE.MeshStandardMaterial({ color: '#141414', roughness: .3 }); for (const x of [-.05, .05]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.03, .005, 6, 18), gm); r.position.set(x, .018, .14); head.add(r); } const br = new THREE.Mesh(new THREE.BoxGeometry(.04, .006, .006), gm); br.position.set(0, .022, .145); head.add(br); }
    let phone = null;
    if (o.phone) {
      arms[1].rotation.set(-1.15, 0, .25);
      phone = new THREE.Mesh(new THREE.BoxGeometry(.075, .13, .012), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#4a52ff', emissiveIntensity: 1.4 }));
      phone.position.set(0, -.36, .02); phone.rotation.x = 1.0; arms[1].add(phone);
    }
    if (o.cup) { const c = makeCup(.9, '#ffffff', true, false); c.position.set(0, -.37, .04); arms[0].add(c); arms[0].rotation.x = -.9; }
    g.scale.setScalar(1.15); scene.add(g);
    return {
      g, legs, arms, head, phone,
      walk(t, on, sp = 9) { const k = on ? Math.sin(t * sp) : 0; legs[0].rotation.x = k * .6; legs[1].rotation.x = -k * .6; if (!o.cup) arms[0].rotation.x = -k * .5; if (!o.phone) arms[1].rotation.x = k * .5; },
      sit() { legs.forEach(l => { l.rotation.x = -1.35; }); }
    };
  }

  // steam and dust drifting
  function drift(t) {
    steams.forEach(s => { const { x, y, z, i, n, size } = s.userData; const u = ((t * .45 + i / n) % 1); s.position.set(x + Math.sin(u * 6 + i) * .03, y + u * .35, z); s.scale.setScalar(size * (.6 + u * 1.4)); s.material.opacity = Math.sin(u * Math.PI) * .32; });
    const p = dust.geometry.attributes.position, b = dust.userData.base;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, b[i * 3] + Math.sin(t * .3 + i) * .08, b[i * 3 + 1] + Math.sin(t * .2 + i * 1.7) * .1, b[i * 3 + 2] + Math.cos(t * .25 + i) * .08);
    p.needsUpdate = true;
  }
  // the opening: the café drops into place, then its people
  let built = false;
  function dropIn(t, people) {
    if (t < 2.2) {
      built = false;
      BUILT.forEach((o, i) => { const d = .05 + i / BUILT.length * .85; o.position.y = o.userData.y0 + (1 - backOut((t - d) / .45)) * 3.2; o.visible = t >= d - .02; });
      people.forEach((p, i) => { const d = 1.0 + i * .1; p.g.position.y += (1 - backOut((t - d) / .4)) * 2.5; p.g.visible = t >= d - .02; });
    } else if (!built) { BUILT.forEach(o => { o.position.y = o.userData.y0; o.visible = true; }); people.forEach(p => { p.g.visible = true; }); built = true; }
  }

  return {
    BLUE, INK, clamp01, ease, easeOut, backOut, hash, lerp, V, mat, tex, canvas, rr, CHROME, BRASS, BLACK, GLASS, drawQR,
    scene, sun, RW, RD, WH, X0, Z0, OZ0, OZ1, OY0, OY1, CZ, CH, TOP, TABLES,
    add, box, cyl, sph, lathe, roundedShape, rbox, face, makeCup, steamTex, steams, steam, croissant, plant, chair, table, dust, BUILT,
    SHIRTS, SKIN, HAIR, PANTS, person, drift, dropIn
  };
}
