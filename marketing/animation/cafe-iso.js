// A café drawn like an architect's isometric (tre-clienti.html): terracotta walls cut at the top in
// white, a deep navy block with a frosted glass panel, a curved counter in fluted pale wood, a long
// burgundy banquette with light wood tables and red chairs, dark red round tables with black stools,
// a terrazzo floor; flat light and fine drawn outlines. Plus the clay figures in a matching palette.
//   import { buildIsoCafe } from './cafe-iso.js';
//   const K = buildIsoCafe(THREE, renderer, { qr: ['Scan', 'for your loyalty card'] });
// K.SPOTS names where people stand or sit. Each frame: K.drift(t) moves the steam; K.dropIn(t, people)
// builds the café in the first 2.2 seconds (call it after setting every person's position: it adds
// to their height).
export function buildIsoCafe(THREE, renderer, T) {
  const BLUE = '#2B32FF', INK = '#16152b';
  const C = {
    clay: '#ad7b6b', clayDark: '#9a6a5c', cut: '#f6f2ec', line: '#4b3830', navy: '#1f2c42', frost: '#a9bdd8',
    floor: '#ddd3c6', wood: '#dcb48f', woodDark: '#c99a74', stone: '#ece6dc', banquette: '#5e2721', red: '#9a2f27',
    table: '#e6cfb4', round: '#7c2b23', stool: '#2b2523', steel: '#d3d3d6'
  };
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
  const backOut = x => { x = clamp01(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, x) => a + (b - a) * x;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
  const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
  const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  const roundedShape = (w, h, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  };
  function drawQR(g, x, y, s, seed = 0) {
    const n = 21, c = s / n; g.fillStyle = '#111';
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const fx = i < 7 ? i : i >= 14 ? i - 14 : -1, fy = j < 7 ? j : j >= 14 ? j - 14 : -1;
      const inF = fx >= 0 && fy >= 0 && !(i >= 14 && j >= 14);
      const on = inF ? (fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4)) : hash(i * 31 + j * 17 + seed) > .52;
      if (on) g.fillRect(x + i * c, y + j * c, c + .5, c + .5);
    }
  }

  // ---------------- textures ----------------
  const speckle = (base, dots, rep, size = 512) => tex(canvas(size, size, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    dots.forEach(([col, n, r]) => { g.fillStyle = col; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(hash(i * 1.3 + r) * w, hash(i * 2.7 + r * 3) * h, r * (.5 + hash(i + r) * .8), 0, 7); g.fill(); } });
  }), rep);
  const terrazzo = speckle(C.floor, [['#c7b9a8', 900, 2.2], ['#b3a08c', 260, 3], ['#efe8de', 500, 2.6], ['#a8574a', 60, 2.4]], [3, 2.4]);
  const plaster = speckle(C.clay, [['rgba(255,255,255,.05)', 1200, 1.4], ['rgba(60,30,20,.05)', 1200, 1.4]], [2, 1]);
  const ribs = (base, dark, light, n) => tex(canvas(256, 64, (g, w, h) => { for (let i = 0; i < n; i++) { const x = i * w / n, bw = w / n; const gr = g.createLinearGradient(x, 0, x + bw, 0); gr.addColorStop(0, dark); gr.addColorStop(.45, light); gr.addColorStop(1, dark); g.fillStyle = gr; g.fillRect(x, 0, bw, h); } g.fillStyle = base; g.globalAlpha = .25; g.fillRect(0, 0, w, h); }));
  const qrTex = tex(canvas(320, 440, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = BLUE; g.beginPath(); g.arc(46, 46, 16, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(46, 46, 9, 0, 7); g.fill(); g.fillStyle = BLUE; g.beginPath(); g.arc(46, 46, 6, 0, 7); g.fill();
    g.fillStyle = INK; g.font = '800 30px Archivo'; g.fillText('Timbro', 72, 57);
    drawQR(g, 50, 90, 220, 3);
    g.textAlign = 'center'; g.font = '800 34px Archivo'; g.fillText(T.qr[0], w / 2, 360); g.font = '500 22px Archivo'; g.fillStyle = '#555'; g.fillText(T.qr[1], w / 2, 396);
  }));
  const steamTex = tex(canvas(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }));

  // ---------------- scene and light: flat, soft, drawn ----------------
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfc3b4', 1.9));
  const sun = new THREE.DirectionalLight('#fff6ea', 1.5);
  sun.position.set(4, 9, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 }); sun.shadow.bias = -.0005; sun.shadow.normalBias = .02;
  if ('intensity' in sun.shadow) sun.shadow.intensity = .4;
  scene.add(sun);
  const side = new THREE.DirectionalLight('#ffffff', .45); side.position.set(-6, 4, 3); scene.add(side);

  const LINE = new THREE.LineBasicMaterial({ color: C.line, transparent: true, opacity: .55 });
  const outlined = [];
  const add = (m, parent = scene, line = true) => { m.castShadow = m.receiveShadow = true; parent.add(m); if (line) outlined.push(m); return m; };
  const box = (w, h, d, m, x, y, z, parent, line) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return add(b, parent, line); };
  const cyl = (rt, rb, h, m, x, y, z, parent, seg = 24, line) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); c.position.set(x, y, z); return add(c, parent, line); };
  const sph = (r, m, x, y, z, parent) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), m); s.position.set(x, y, z); return add(s, parent, false); };
  const lathe = (pts, m, seg = 28) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), m);
  // a box whose top is the white cut of a wall
  const wallMat = (face) => [face, face, mat(C.cut), face, face, face];

  const RW = 7, RD = 5.6, WH = 3.0, X0 = -RW / 2, Z0 = -RD / 2, X1 = RW / 2, Z1 = RD / 2;
  // slab and floor
  box(RW + .44, .32, RD + .44, mat(C.cut), 0, -.16, 0);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), mat('#ffffff', { map: terrazzo })); floor.rotation.x = -Math.PI / 2; floor.position.y = .002; floor.receiveShadow = true; scene.add(floor);
  // the two tall walls, the two cut low (with the door gap at the front right)
  const clayM = mat('#ffffff', { map: plaster });
  box(RW + .44, WH, .22, wallMat(clayM), 0, WH / 2, Z0 - .11);
  box(.22, WH, RD, wallMat(clayM), X0 - .11, WH / 2, 0);
  box(.22, .2, RD + .22, mat(C.cut), X1 + .11, .1, .11);
  box(RW - 1.3 + .22, .2, .22, mat(C.cut), X0 - .11 + (RW - 1.3 + .22) / 2, .1, Z1 + .11);
  box(.18, .2, .22, mat(C.cut), X1 + .02, .1, Z1 + .11);
  // windows in the left wall
  for (const zc of [-2.0, -.75]) {
    const fr = mat('#3b2a24');
    box(.06, 1.62, .06, fr, X0 + .02, 1.66, zc - .47); box(.06, 1.62, .06, fr, X0 + .02, 1.66, zc + .47); box(.06, 1.62, .04, fr, X0 + .02, 1.66, zc);
    box(.06, .06, 1.0, fr, X0 + .02, .86, zc); box(.06, .06, 1.0, fr, X0 + .02, 2.46, zc); box(.05, .04, .96, fr, X0 + .02, 1.95, zc);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(.94, 1.56), new THREE.MeshBasicMaterial({ color: '#e9eef2' })); gl.rotation.y = Math.PI / 2; gl.position.set(X0 + .005, 1.66, zc); scene.add(gl);
    box(.16, .03, 1.04, mat(C.cut), X0 + .07, .84, zc);
  }
  // the navy block: a back room with a frosted glass panel and a door
  const navyM = mat(C.navy);
  const NB = { x0: -1.6, x1: .25, z0: Z0, z1: -1.35 };
  box(NB.x1 - NB.x0, WH, NB.z1 - NB.z0, wallMat(navyM), (NB.x0 + NB.x1) / 2, WH / 2, (NB.z0 + NB.z1) / 2);
  { const fp = new THREE.Mesh(new THREE.PlaneGeometry(.5, 2.55), new THREE.MeshLambertMaterial({ color: C.frost, emissive: '#7f97b8', emissiveIntensity: .35 })); fp.position.set(NB.x0 + .5, 1.3, NB.z1 + .006); add(fp);
    for (let i = 1; i < 6; i++) box(.5, .006, .01, mat('#8ea4c4'), NB.x0 + .5, 1.3 - 1.275 + i * .425, NB.z1 + .01, scene, false);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(.6, 1.85), mat('#16202f')); door.position.set(NB.x1 - .45, .93, NB.z1 + .006); add(door);
    box(.04, .04, .04, mat('#c9a255'), NB.x1 - .22, .95, NB.z1 + .03, scene, false);
    // a small shelf with glasses on the block
    box(.5, .03, .14, mat(C.wood), NB.x0 + 1.1, 1.45, NB.z1 + .07);
    for (let i = 0; i < 3; i++) cyl(.03, .025, .09, mat('#dfe7ef', { transparent: true, opacity: .8 }), NB.x0 + .95 + i * .12, 1.51, NB.z1 + .08, scene, 12);
  }

  // the counter: curved at the left end, fluted pale wood, stone top
  const CT = { x0: 1.0, x1: 3.5, z0: -1.78, z1: -1.2, h: .72 };
  const R = (CT.z1 - CT.z0) / 2, zc = (CT.z0 + CT.z1) / 2;
  {
    const sh = new THREE.Shape(); // in x/z, extruded upwards
    sh.moveTo(CT.x1, CT.z0); sh.lineTo(CT.x0 + R, CT.z0); sh.absarc(CT.x0 + R, zc, R, -Math.PI / 2, -Math.PI * 1.5, true); sh.lineTo(CT.x1, CT.z1); sh.lineTo(CT.x1, CT.z0);
    const bodyGeo = new THREE.ExtrudeGeometry(sh, { depth: CT.h - .05, bevelEnabled: false, curveSegments: 24 }); bodyGeo.rotateX(Math.PI / 2); bodyGeo.translate(0, CT.h - .05, 0);
    const body = new THREE.Mesh(bodyGeo, mat(C.wood)); add(body, scene, false);
    const topGeo = new THREE.ExtrudeGeometry(sh, { depth: .05, bevelEnabled: true, bevelThickness: .01, bevelSize: .03, bevelSegments: 2, curveSegments: 24 }); topGeo.rotateX(Math.PI / 2); topGeo.translate(0, CT.h, 0);
    add(new THREE.Mesh(topGeo, mat(C.stone)), scene, false);
    // the flutes: half-round staves along the front and round the curve (their edges draw the ribs)
    const flute = new THREE.CylinderGeometry(.028, .028, CT.h - .1, 6, 1, true);
    const pts = []; for (let x = CT.x1 - .04; x > CT.x0 + R; x -= .056) pts.push([x, CT.z1 + .005, 0]);
    for (let a = 0; a <= Math.PI; a += .056 / R) pts.push([CT.x0 + R - Math.sin(a) * (R + .005), zc + Math.cos(a) * (R + .005), a]);
    const fm = mat(C.woodDark);
    pts.forEach(([x, z]) => { const f = new THREE.Mesh(flute, fm); f.position.set(x, (CT.h - .1) / 2 + .04, z); add(f, scene, true); });
    box(CT.x1 - CT.x0 - .1, .04, CT.z1 - CT.z0 - .05, mat('#8a6a52'), (CT.x0 + CT.x1) / 2 + .05, .02, zc, scene, false);
  }
  const TOP = CT.h + .05;
  // the espresso machine (its back to the room, like the drawing), grinder, glass dome with cakes, the till and QR plaque
  {
    const steel = mat(C.steel), dark = mat('#2b2b2e');
    const M = new THREE.Group(); M.position.set(2.55, TOP, -1.5); scene.add(M);
    box(.78, .34, .4, steel, 0, .17 + .04, 0, M); box(.8, .04, .42, dark, 0, .02, 0, M); box(.74, .02, .36, mat('#e2e2e4'), 0, .39, 0, M);
    for (const x of [-.2, .2]) { cyl(.045, .045, .05, steel, x, .1, -.22, M, 16); box(.03, .03, .14, dark, x, .08, -.32, M, false); }
    for (let i = 0; i < 4; i++) { const c = lathe([[0, 0], [.03, 0], [.035, .05], [0, .05]], mat('#ffffff'), 14); c.position.set(-.27 + i * .18, .4, .05); add(c, M, false); }
    const G = new THREE.Group(); G.position.set(3.15, TOP, -1.55); scene.add(G);
    box(.16, .24, .18, dark, 0, .12, 0, G); cyl(.06, .035, .14, mat('#d8d0c2', { transparent: true, opacity: .7 }), 0, .31, 0, G, 14);
    const D = new THREE.Group(); D.position.set(1.42, TOP, -1.49); scene.add(D);
    cyl(.24, .24, .025, mat('#f3efe8'), 0, .012, 0, D, 32);
    for (let i = 0; i < 3; i++) { const a = i * 2.1; cyl(.06, .06, .05, mat(['#f2dfb8', '#8a4a2c', '#e9b7a8'][i]), Math.cos(a) * .1, .05, Math.sin(a) * .1, D, 16); }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(.22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#eef4f8', transparent: true, opacity: .32, depthWrite: false })); dome.position.y = .02; dome.scale.y = .8; D.add(dome);
    sph(.02, mat('#c9a255'), 0, .2, 0, D);
    const P = new THREE.Group(); P.position.set(1.95, TOP, -1.27); scene.add(P);
    box(.14, .012, .06, mat('#e8e8ee'), 0, .006, 0, P, false);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(.13, .18), new THREE.MeshBasicMaterial({ map: qrTex })); plate.position.set(0, .1, .006); plate.rotation.x = -.12; P.add(plate);
    box(.14, .19, .008, mat('#ffffff'), 0, .1, -.002, P);
    const pad = box(.26, .18, .015, dark, 2.15 - 1.95, .16, -.12, P); pad.rotation.x = -.45;
  }
  // shelves with ceramics on the back wall and a linear pendant over the counter
  {
    for (const y of [1.75, 2.2]) { box(1.3, .035, .2, mat(C.wood), 2.65, y, Z0 + .1); }
    const cer = ['#efe9df', '#c96f4a', '#2f3e57', '#efe9df', '#a8574a', '#d9a441'];
    cer.forEach((c, i) => { const y = i < 3 ? 1.77 : 2.22, x = 2.15 + (i % 3) * .42; const v = lathe(i % 2 ? [[0, 0], [.05, 0], [.06, .08], [.03, .16], [0, .16]] : [[0, 0], [.07, 0], [.075, .06], [0, .06]], mat(c), 18); v.position.set(x, y + .018, Z0 + .1); add(v, scene, true); });
    const brass = mat('#c9a255');
    for (const x of [1.55, 3.0]) cyl(.004, .004, .9, mat('#3b2a24'), x, 2.55, -1.5, scene, 6, false);
    box(1.6, .04, .05, brass, 2.28, 2.1, -1.5);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1.5, .015, .03), new THREE.MeshBasicMaterial({ color: '#fff3d6' })); glow.position.set(2.28, 2.075, -1.5); scene.add(glow);
    // a fluted radiator on the left wall
    const rad = new THREE.Group(); rad.position.set(X0 + .08, 0, 1.75); scene.add(rad);
  }

  // the banquette: along the left wall and the front, burgundy with ribbed upholstery
  const ribTex = ribs(C.banquette, '#47201b', '#7a3830', 10);
  const bench = (x, z, w, d, along) => {
    const len = along === 'z' ? d : w;
    const seatT = ribTex.clone(); seatT.wrapS = THREE.RepeatWrapping; seatT.repeat.set(len * 3.2, 1); seatT.needsUpdate = true;
    const sm = mat('#ffffff', { map: seatT }), plain = mat(C.banquette);
    const seatMats = along === 'z' ? [sm, sm, plain, plain, plain, plain] : [plain, plain, plain, plain, sm, sm];
    const seat = new THREE.Mesh(new THREE.BoxGeometry(w, .42, d), seatMats); seat.position.set(x, .21, z); add(seat);
    const bw = along === 'z' ? .16 : w, bd = along === 'z' ? d : .16;
    const bx = along === 'z' ? x - w / 2 + .08 : x, bz = along === 'z' ? z : z + d / 2 - .08;
    const back = new THREE.Mesh(new THREE.BoxGeometry(bw, .5, bd), seatMats); back.position.set(bx, .42 + .25, bz); add(back);
  };
  bench(X0 + .29, .55, .58, 3.4, 'z');            // left wall, z -1.15 .. 2.25
  bench(-1.3, Z1 - .29, 4.4, .58, 'x');           // front, x -3.5 .. 0.9
  // light wood tables along the banquette, red chairs opposite
  function chair(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const m = mat(C.red);
    box(.34, .045, .34, m, 0, .4, 0, g);
    for (const [lx, lz] of [[-.15, -.15], [.15, -.15], [-.15, .15], [.15, .15]]) box(.035, .4, .035, m, lx, .2, lz, g);
    for (const lx of [-.15, .15]) box(.035, .42, .035, m, lx, .63, -.155, g);
    box(.34, .12, .035, m, 0, .78, -.155, g);
    return g;
  }
  function wtable(x, z, w = .6, d = .52) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    box(w, .035, d, mat(C.table), 0, .64, 0, g);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(.035, .62, .035, mat('#cdb293'), lx * (w / 2 - .05), .31, lz * (d / 2 - .05), g);
    return g;
  }
  function rtable(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    cyl(.3, .3, .035, mat(C.round), 0, .64, 0, g, 36); cyl(.025, .025, .62, mat(C.round), 0, .31, 0, g, 10); cyl(.16, .16, .02, mat(C.round), 0, .01, 0, g, 24);
    return g;
  }
  function stool(x, z) { const s = cyl(.15, .15, .42, mat(C.stool), x, .21, z, scene, 8); return s; }
  const LT = [[-2.62, -.55], [-2.62, .55], [-2.62, 1.6]], FT = [[-1.55, 1.95], [-.45, 1.95]], RT = [[1.05, .55], [2.55, .7], [1.25, 1.95]];
  LT.forEach(([x, z]) => { wtable(x, z); chair(x + .58, z, -Math.PI / 2); });
  FT.forEach(([x, z]) => { wtable(x, z, .58, .52); chair(x, z - .55, 0); });
  RT.forEach(([x, z], i) => { rtable(x, z); stool(x - .48, z + .1); if (i !== 1) chair(x + .5, z - .05, -Math.PI / 2); else stool(x + .46, z - .15); });
  // cups on some tables, with steam
  const CUP = [[0, 0], [.03, 0], [.034, .004], [.044, .05], [.047, .068], [.043, .068], [.04, .056], [.031, .008], [0, .008]];
  function makeCup(s = 1, color = '#ffffff', coffee = true, saucer = true) {
    const g = new THREE.Group(), m = mat(color);
    const c = lathe(CUP, m, 24); c.castShadow = true; g.add(c);
    const h = new THREE.Mesh(new THREE.TorusGeometry(.016, .0045, 8, 16, Math.PI * 1.25), m); h.position.set(.046, .036, 0); h.rotation.z = -Math.PI * .62; g.add(h);
    if (coffee) { const cr = new THREE.Mesh(new THREE.CircleGeometry(.041, 20), mat('#b98249')); cr.rotation.x = -Math.PI / 2; cr.position.y = .058; g.add(cr); }
    if (saucer) { const sc = lathe([[0, 0], [.07, 0], [.082, .01], [.078, .012], [0, .005]], m, 24); sc.position.y = -.004; g.add(sc); c.position.y = .003; }
    g.scale.setScalar(s); return g;
  }
  const steams = [];
  function steam(x, y, z, n = 4, size = .07) { for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 })); s.position.set(x, y, z); s.userData = { x, y, z, i, n, size }; scene.add(s); steams.push(s); } }
  [[-2.62, -.55], [-2.62, 1.6], [-.45, 1.95], [1.05, .55], [2.55, .7]].forEach(([x, z], i) => { const c = makeCup(1.1); c.position.set(x + (i % 2 ? .1 : -.08), .66, z + .05); scene.add(c); if (i % 2 === 0) steam(x + (i % 2 ? .1 : -.08), .77, z + .05); });
  // a tall plant in a pot by the windows
  {
    const g = new THREE.Group(); g.position.set(X0 + .4, 0, Z0 + .45); scene.add(g);
    const pot = lathe([[0, 0], [.17, 0], [.2, .42], [0, .42]], mat('#efe9df'), 24); add(pot, g, true);
    cyl(.02, .025, 1.0, mat('#5b4636'), 0, .9, 0, g, 6, false);
    const leaf = mat('#6f7f55'), leaf2 = mat('#5c6c47');
    for (let i = 0; i < 26; i++) { const a = i * 2.4, r = .12 + hash(i) * .26, y = .95 + hash(i + 3) * .85; const l = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), i % 2 ? leaf : leaf2); l.scale.set(1.4, .55, .8); l.position.set(Math.cos(a) * r, y, Math.sin(a) * r); l.rotation.y = -a; l.castShadow = true; g.add(l); }
  }

  // the drawn outlines
  outlined.forEach(m => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), LINE); m.add(e); });

  // everything built so far drops into place in the opening
  const BUILT = scene.children.filter(o => (o.isMesh || o.isGroup) && !o.isSprite); BUILT.forEach(o => { o.userData.y0 = o.position.y; });

  // ---------------- people ----------------
  const SHIRTS = ['#c96f4a', '#2f4a6b', '#d9a441', '#6b7f5a', '#e8dccb', '#8a3b33', '#4f6d7a', '#b7895f', '#7d5a8c'];
  const SKIN = ['#f1c9a5', '#d9a77f', '#a8774f', '#f6d7bd', '#8a5a3c'], HAIR = ['#2b1d16', '#6b4226', '#d9b26a', '#1a1a1a', '#a0522d'];
  const PANTS = ['#2d3445', '#3b3b45', '#5b4636', '#1f2a38'];
  // A clay figure: legs and shoes, a rounded body, arms with hands, a head with ears, shiny eyes,
  // cheeks, a nose and a smile, one of five hair styles; optional apron, glasses, phone or cup.
  function person(o) {
    const i = o.i, g = new THREE.Group(), m = c => new THREE.MeshStandardMaterial({ color: c, roughness: .85 });
    const shirt = o.shirt || SHIRTS[i % SHIRTS.length], skin = SKIN[i % SKIN.length], hc = HAIR[i % HAIR.length];
    const cap = (r, len, c) => { const x = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 16), m(c)); x.castShadow = true; return x; };
    const limb = (r, len, c, x, y) => { const pivot = new THREE.Group(); pivot.position.set(x, y, 0); const l = cap(r, len, c); l.position.y = -(len / 2 + r * .6); pivot.add(l); g.add(pivot); return pivot; };
    const legs = [-.075, .075].map(x => limb(.062, .2, o.pants || PANTS[i % PANTS.length], x, .3));
    legs.forEach(l => { const s = new THREE.Mesh(new THREE.SphereGeometry(.068, 14, 10), m(o.shoe || '#f4f1ec')); s.scale.set(1, .6, 1.45); s.position.set(0, -.335, .035); s.castShadow = true; l.add(s); });
    const body = cap(.158, .2, shirt); body.position.y = .52; body.scale.set(1, 1, .84); g.add(body);
    if (o.apron) { const ap = new THREE.Mesh(new THREE.CylinderGeometry(.162, .17, .34, 20, 1, true, -1.1, 2.2), new THREE.MeshStandardMaterial({ color: o.apron, roughness: .8, side: THREE.DoubleSide })); ap.scale.set(1, 1, .86); ap.position.y = .47; g.add(ap); }
    const arms = [-1, 1].map(sd => { const a = limb(.047, .2, shirt, sd * .198, .65); a.rotation.z = sd * .12; return a; });
    arms.forEach(a => { const h = new THREE.Mesh(new THREE.SphereGeometry(.047, 12, 10), m(skin)); h.position.y = -.335; a.add(h); });
    const head = new THREE.Group(); head.position.y = .885; g.add(head);
    const hs = new THREE.Mesh(new THREE.SphereGeometry(.145, 28, 20), m(skin)); hs.castShadow = true; head.add(hs);
    for (const x of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), m(skin)); ear.position.set(x * .142, -.005, 0); ear.scale.set(.6, 1, 1); head.add(ear); }
    const eyeM = new THREE.MeshStandardMaterial({ color: '#141414', roughness: .15 }), hiM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    for (const x of [-.05, .05]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.02, 12, 10), eyeM); e.position.set(x, .018, .13); e.scale.z = .6; head.add(e); const hi = new THREE.Mesh(new THREE.SphereGeometry(.0065, 6, 6), hiM); hi.position.set(x + .007, .026, .142); head.add(hi); }
    const blushM = new THREE.MeshBasicMaterial({ color: '#ff8a8a', transparent: true, opacity: .4, depthWrite: false });
    for (const x of [-1, 1]) { const b = new THREE.Mesh(new THREE.CircleGeometry(.022, 16), blushM); const d = V(x * .62, -.22, .76).normalize(); b.position.copy(d.clone().multiplyScalar(.1462)); b.lookAt(d.clone().multiplyScalar(2)); head.add(b); }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.017, 10, 8), m(skin)); nose.position.set(0, -.008, .145); head.add(nose);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(.028, .0055, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: '#5a2a1f' })); smile.position.set(0, -.045, .132); smile.rotation.set(-.25, 0, Math.PI); head.add(smile);
    const style = o.hair ?? i % 5, hairM = m(style === 2 ? (o.capColor || SHIRTS[(i + 3) % SHIRTS.length]) : hc);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.153, 28, 14, 0, Math.PI * 2, 0, Math.PI * .5), hairM); hair.position.y = .012; hair.rotation.x = -.28; hair.castShadow = true; head.add(hair);
    if (style === 1) { const bun = new THREE.Mesh(new THREE.SphereGeometry(.062, 14, 10), hairM); bun.position.set(0, .13, -.07); head.add(bun); }
    if (style === 2) { const brim = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .018, 18), hairM); brim.scale.set(1, 1, 1.3); brim.position.set(0, .06, .12); brim.rotation.x = .12; head.add(brim); }
    if (style === 3) { const back = new THREE.Mesh(new THREE.CapsuleGeometry(.125, .12, 6, 14), m(hc)); back.position.set(0, -.08, -.065); back.scale.set(1.05, 1, .62); head.add(back); }
    if (style === 4) for (let k = 0; k < 9; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), m(hc)); const a = k / 9 * Math.PI * 2; c.position.set(Math.cos(a) * .1, .09 + Math.sin(k * 1.7) * .02, Math.sin(a) * .1 - .02); head.add(c); }
    if (o.glasses) { const gm = new THREE.MeshStandardMaterial({ color: '#141414', roughness: .3 }); for (const x of [-.05, .05]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.03, .005, 6, 18), gm); r.position.set(x, .018, .14); head.add(r); } }
    if (o.phone) { arms[1].rotation.set(-1.15, 0, .25); const ph = new THREE.Mesh(new THREE.BoxGeometry(.075, .13, .012), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#4a52ff', emissiveIntensity: 1.4 })); ph.position.set(0, -.36, .02); ph.rotation.x = 1.0; arms[1].add(ph); }
    if (o.cup) { const c = makeCup(.9, '#ffffff', true, false); c.position.set(0, -.37, .04); arms[0].add(c); arms[0].rotation.x = -.9; }
    g.scale.setScalar(1.15); scene.add(g);
    return {
      g, legs, arms, head,
      walk(t, on, sp = 9) { const k = on ? Math.sin(t * sp) : 0; legs[0].rotation.x = k * .6; legs[1].rotation.x = -k * .6; if (!o.cup) arms[0].rotation.x = -k * .5; if (!o.phone) arms[1].rotation.x = k * .5; },
      sit() { legs.forEach(l => { l.rotation.x = -1.35; }); }
    };
  }
  // where people stand or sit: [x, y, z, facing]
  const SPOTS = {
    barista: [2.25, 0, -2.3, 0],
    till: [2.05, 0, -.88, Math.PI], counterEnd: [1.05, 0, -.78, Math.PI - .7], queue: [2.75, 0, -.25, Math.PI + .35], dome: [1.35, 0, -.6, Math.PI],
    benchL: LT.map(([x, z]) => [X0 + .45, .07, z, Math.PI / 2]), chairL: LT.map(([x, z]) => [x + .58, .07, z, -Math.PI / 2]),
    benchF: FT.map(([x, z]) => [x, .07, Z1 - .45, Math.PI]), chairF: FT.map(([x, z]) => [x, .07, z - .55, 0]),
    stool: RT.map(([x, z]) => [x - .48, .1, z + .1, Math.PI / 2]), roundChair: RT.map(([x, z]) => [x + .5, .07, z - .05, -Math.PI / 2]),
    door: [3.0, 0, 3.4]
  };

  function drift(t) {
    steams.forEach(s => { const { x, y, z, i, n, size } = s.userData; const u = ((t * .45 + i / n) % 1); s.position.set(x + Math.sin(u * 6 + i) * .03, y + u * .35, z); s.scale.setScalar(size * (.6 + u * 1.4)); s.material.opacity = Math.sin(u * Math.PI) * .35; });
  }
  let built = false;
  function dropIn(t, people) {
    if (t < 2.2) {
      built = false;
      BUILT.forEach((o, i) => { const d = .05 + i / BUILT.length * .85; o.position.y = o.userData.y0 + (1 - backOut((t - d) / .45)) * 3.2; o.visible = t >= d - .02; });
      people.forEach((p, i) => { const d = 1.0 + i * .1; p.g.position.y += (1 - backOut((t - d) / .4)) * 2.5; p.g.visible = t >= d - .02; });
    } else if (!built) { BUILT.forEach(o => { o.position.y = o.userData.y0; o.visible = true; }); people.forEach(p => { p.g.visible = true; }); built = true; }
  }

  return { BLUE, INK, C, clamp01, ease, easeOut, backOut, hash, lerp, V, mat, tex, canvas, rr, drawQR, roundedShape, steamTex, scene, sun, RW, RD, X0, Z0, X1, Z1, TOP, makeCup, person, SPOTS, drift, dropIn };
}
