// The four places of the walk, built from plain shapes. Each returns { scene, camera, look }.
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { inkMat } from "./ink.js";

/* ---------- small helpers ---------- */
const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function n3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = t => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi), L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
           L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}
const fb3 = (x, y, z) => n3(x, y, z) * .5 + n3(x * 2.1, y * 2.1, z * 2.1) * .3 + n3(x * 4.3, y * 4.3, z * 4.3) * .2;
function rough(geo, amp, freq, seed = 0) {
  geo.deleteAttribute("uv"); geo = mergeVertices(geo); geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = (fb3(x * freq + seed, y * freq, z * freq) - .5) * 2 * amp;
    p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
  }
  geo.computeVertexNormals(); return geo;
}
function put(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function cam(aspect, fov, from, to) {
  const c = new THREE.PerspectiveCamera(fov, aspect, .1, 600); c.position.set(...from); c.lookAt(...to); return c;
}
function tex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  g.lineCap = "round"; g.lineJoin = "round"; draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}
let rs = 7; const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };

/* ---------- people ---------- */
function robe(tone) {
  const pts = [[.56, 0], [.5, .25], [.38, 1.15], [.33, 1.5], [.13, 1.62], [0, 1.62]].map(p => new THREE.Vector2(p[0], p[1]));
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 20), inkMat({ tone, side:THREE.DoubleSide }));
}
// a clerk of the dead: black robe, pale face, the winged hat of an official, a ledger
export function clerk(h = 2.3) {
  const g = new THREE.Group(), dark = inkMat({ tone:.95 }), pale = inkMat({ tone:.1 });
  g.add(robe(.9));
  put(g, box(.82, .3, .3), dark, 0, 1.12, .22);
  put(g, new THREE.SphereGeometry(.17, 16, 12), pale, 0, 1.78, 0);
  put(g, box(.32, .13, .32), dark, 0, 1.94, 0);
  put(g, box(.26, .2, .13), dark, 0, 2.04, -.09);
  put(g, box(.56, .05, .02), dark, -.42, 1.95, -.13); put(g, box(.56, .05, .02), dark, .42, 1.95, -.13);
  put(g, box(.34, .44, .03), pale, 0, 1.18, .42, -.5);
  g.scale.setScalar(h / 2.14); return g;
}
function ghost(h = 1.6) {
  const g = new THREE.Group(); g.add(robe(.32));
  put(g, new THREE.SphereGeometry(.17, 12, 10), inkMat({ tone:.26 }), 0, 1.78, 0);
  g.scale.setScalar(h / 1.95); return g;
}

/* ---------- 1. the stone ---------- */
export function theStone(aspect, phase = 0) {
  const s = new THREE.Scene();
  put(s, new THREE.PlaneGeometry(400, 400), inkMat({ tone:.1 }), 0, 0, 0, -Math.PI / 2);
  // far mountains, layer behind layer
  [[-26, -60, 16, 44, 1], [18, -75, 20, 58, 2], [-6, -110, 26, 80, 3], [40, -50, 12, 30, 4], [-48, -85, 18, 50, 5]].forEach(([x, z, r, h, sd]) =>
    put(s, rough(new THREE.ConeGeometry(r, h, 28, 14), r * .22, .09, sd * 9), inkMat({ tone:.75 }), x, h / 2 - 2, z));
  // the cliff and the way down
  put(s, rough(new THREE.BoxGeometry(22, 7, 6, 24, 10, 4), .9, .35, 3), inkMat({ tone:.7 }), 0, 2.8, -11);
  const arch = new THREE.Shape(); arch.moveTo(-1.25, 0); arch.lineTo(-1.25, 1.9); arch.absarc(0, 1.9, 1.25, Math.PI, 0, true); arch.lineTo(1.25, 0);
  put(s, new THREE.ShapeGeometry(arch, 24), inkMat({ tone:1, flat:true }), 0, 0, -7.6);
  for (let i = 0; i < 4; i++) put(s, box(2.3 - i * .12, .05, .4), inkMat({ tone:.35, flat:true }), 0, .03 + i * .0, -7.2 + i * .5 - 1.6);
  // the gate
  const wood = inkMat({ tone:.88 });
  put(s, new THREE.CylinderGeometry(.16, .19, 4.2, 12), wood, -1.75, 2.1, -6); put(s, new THREE.CylinderGeometry(.16, .19, 4.2, 12), wood, 1.75, 2.1, -6);
  put(s, box(4.2, .22, .3), wood, 0, 3.55, -6); put(s, box(5.2, .26, .42), wood, 0, 4.2, -6);
  put(s, box(.24, .2, .5), wood, -2.6, 4.38, -6, 0, 0, .35); put(s, box(.24, .2, .5), wood, 2.6, 4.38, -6, 0, 0, -.35);
  put(s, box(.7, .42, .06), inkMat({ tone:.08 }), 0, 3.88, -5.8); put(s, box(.14, .14, .02), inkMat({ seal:1, flat:true }), 0, 3.88, -5.74);
  // the broken stone, in two halves
  const half = (ry, x, z, tilt) => put(s, rough(new THREE.SphereGeometry(.62, 26, 18, 0, Math.PI), .1, 2, 5), inkMat({ tone:.85, side:THREE.DoubleSide }), x, .38, z, tilt, ry, 0);
  half(1.2, -1.7, 2.0, .3); half(1.2 + Math.PI, -.8, 2.25, -.45);
  for (let i = 0; i < 9; i++) put(s, rough(new THREE.IcosahedronGeometry(.08 + rnd() * .16, 1), .04, 4, i), inkMat({ tone:.7 }), -2.3 + rnd() * 2.2, .06, 1.4 + rnd() * 1.6);
  if (phase === 0) {   // the first one is already running; the second looks out from behind the stone
    const big = monkey({ h:1.25, run:true, horns:false }); big.position.set(1.5, .5, 1.2); big.rotation.set(.1, 1.9, -.25); s.add(big);
    for (let i = 0; i < 5; i++) put(s, new THREE.SphereGeometry(.1 + i * .05, 10, 8), inkMat({ tone:.16 }), .7 - i * .32, .1 + i * .03, 1.5 + i * .12);
    const me = monkey({ h:.62 }); me.position.set(-.5, 0, 2.6); me.rotation.y = .9; s.add(me);
  } else if (phase === 1) {   // the little one, at the door
    const me = monkey({ h:.62 }); me.position.set(.1, 0, -3.2); me.rotation.y = Math.PI; s.add(me);
  }
  return { scene:s, camera:cam(aspect, 62, [.35, .95, 5.2], [.05, 1.7, -6]), look:{ fog:.013, far:140, sky:.07, mist:[3, .45], light:[-.5, .8, .4], seed:1 } };
}

/* ---------- 2. the halls of the dead ---------- */
export function theHalls(aspect) {
  const s = new THREE.Scene(), RUN = .62, RISE = .26, N = 26, stepY = i => -i * RISE, stepZ = i => -i * RUN;
  const stone = inkMat({ tone:.3 });
  for (let i = 0; i < N; i++) { put(s, box(4.4, RISE + 3, RUN), stone, 0, stepY(i) - 1.5 - RISE / 2, stepZ(i)); put(s, box(4.4, .03, .05), inkMat({ tone:.95, flat:true }), 0, stepY(i) + .005, stepZ(i) + RUN / 2 - .03); }
  // walls of shelved scrolls, stepping down with the stairs
  const wall = inkMat({ tone:.8 }), ROWS = 9, COLS = 4, segs = Math.floor(N / 3);
  const ends = new THREE.InstancedMesh(new THREE.CylinderGeometry(.11, .11, .14, 12), inkMat({ tone:.07 }), segs * 2 * ROWS * COLS * 2);
  const boards = new THREE.InstancedMesh(box(.2, .035, RUN * 3), inkMat({ tone:.95 }), segs * 2 * (ROWS + 1));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), one = new THREE.Vector3(1, 1, 1);
  let ne = 0, nb = 0;
  for (let k = 0; k < segs; k++) for (const sx of [-1, 1]) {
    const y0 = stepY(k * 3) + .1, zc = stepZ(k * 3 + 1);
    put(s, box(.5, 7.4, RUN * 3), wall, sx * 2.45, y0 + 3.4, zc);
    for (let r = 0; r <= ROWS; r++) { m.compose(new THREE.Vector3(sx * 2.16, y0 + .12 + r * .62, zc), new THREE.Quaternion(), one); boards.setMatrixAt(nb++, m); }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS * 2; c++) {
      if (rnd() < .16) continue;
      const row2 = c >= COLS, cc = c % COLS;
      m.compose(new THREE.Vector3(sx * 2.16, y0 + .26 + r * .62 + (row2 ? .22 : 0), zc - RUN * 1.5 + (cc + (row2 ? 1 : .5)) * (RUN * 3 / (COLS + .5))), q, one);
      ends.setMatrixAt(ne++, m);
    }
  }
  ends.count = ne; boards.count = nb; s.add(ends, boards);
  // paper banners hanging out of the dark
  [[-1.2, 13, .46, 3], [1.05, 16, .42, 2.6], [-.3, 20, .5, 3.4]].forEach(([x, i, w, h], k) => {
    put(s, box(w, h, .02), inkMat({ tone:.1 }), x, stepY(i) + 3 + h / 2, stepZ(i));
    for (let j = 0; j < 9; j++) put(s, box(w * .3, .12 + rnd() * .12, .01), inkMat({ tone:.75, flat:true }), x, stepY(i) + 3 + h - .35 - j * .32, stepZ(i) + .02);
    if (k === 1) put(s, box(.14, .14, .01), inkMat({ seal:1, flat:true }), x, stepY(i) + 3.25, stepZ(i) + .03);
  });
  // the queue, and the clerk on the stairs
  [[1.25, 4, 1.5], [1.4, 5, 1.7], [1.2, 6, 1.45], [1.45, 7, 1.62], [1.15, 8, 1.55], [1.35, 9, 1.5]].forEach(([x, i, h]) => { const g = ghost(h); g.position.set(x, stepY(i), stepZ(i)); s.add(g); });
  const c = clerk(2.6); c.position.set(-.2, stepY(9), stepZ(9)); s.add(c);
  // a stamp someone left on a shelf board
  put(s, box(.13, .13, .13), inkMat({ seal:1, flat:true }), -2.05, stepY(3) + .82, stepZ(3) - .2);
  return { scene:s, camera:cam(aspect, 68, [-.45, stepY(0) + 1.05, stepZ(0) + .8], [-.15, stepY(9) + 1.5, stepZ(9)]), look:{ fog:.055, far:26, light:[.2, .9, .6], seed:2 } };
}

/* ---------- 3. the book ---------- */
function pageTex(left) {
  return tex(640, 820, (g, w, h) => {
    g.strokeStyle = g.fillStyle = "#000";
    const rows = 13, y0 = 70, dy = (h - 120) / rows;
    for (let r = 0; r < rows; r++) {
      const y = y0 + r * dy, mine = !left && r === 6, bro = !left && r === 5;
      let x1;
      if (mine || bro) { g.font = "600 66px Caveat, cursive"; const t = bro ? "Sun Wukong" : "Sun Wu Shi"; g.fillText(t, 90, y + 16); x1 = 90 + g.measureText(t).width; }
      else { // someone's name, in a hand nobody reads any more
        let x = 90; g.lineWidth = 4; const n = 2 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) { g.beginPath(); g.moveTo(x, y); const len = 40 + rnd() * 70;
          for (let t = 0; t < len; t += 7) g.lineTo(x + t, y + (rnd() - .5) * 26); g.stroke(); x += len + 22; }
        x1 = x - 22;
      }
      g.lineWidth = mine || bro ? 3 : 6; g.beginPath(); g.moveTo(mine || bro ? 84 : 70, y + 4 + (rnd() - .5) * 8); g.lineTo(x1 + (mine || bro ? 8 : 24), y + (mine || bro ? -6 : (rnd() - .5) * 10)); g.stroke();
    }
  });
}
export function theBook(aspect) {
  const s = new THREE.Scene();
  put(s, new THREE.PlaneGeometry(80, 80), inkMat({ tone:.25 }), 0, 0, 0, -Math.PI / 2);
  // the desk
  put(s, box(4.6, 1.0, 1.7), inkMat({ tone:.88 }), 0, .5, -2.2); put(s, box(4.9, .08, 1.9), inkMat({ tone:.95 }), 0, 1.04, -2.2);
  // the Book of Life and Death, open
  const paper = inkMat({ tone:.05 }), PW = .78, PH = 1.0;
  for (const sx of [-1, 1]) {
    put(s, box(PW, .09, PH), inkMat({ tone:.12 }), sx * (PW / 2 + .01), 1.125, -2.05, 0, 0, sx * .06);
    put(s, new THREE.PlaneGeometry(PW, PH), paper, sx * (PW / 2 + .01), 1.185, -2.05, -Math.PI / 2, sx * .06, 0);
    put(s, new THREE.PlaneGeometry(PW, PH), inkMat({ tone:.95, map:pageTex(sx < 0) }), sx * (PW / 2 + .01), 1.19, -2.05, -Math.PI / 2, sx * .06, 0);
  }
  put(s, box(.045, .045, .01), inkMat({ seal:1, flat:true }), .06, 1.2, -2.07, -Math.PI / 2, .06, 0);   // the mark by his line
  // the pen, the ink stone, the seal pad
  const pen = new THREE.Group(); put(pen, new THREE.CylinderGeometry(.014, .014, .5, 8), inkMat({ tone:.3 }), 0, 0, 0, 0, 0, Math.PI / 2);
  put(pen, new THREE.ConeGeometry(.024, .11, 8), inkMat({ tone:1, flat:true }), -.3, 0, 0, 0, 0, Math.PI / 2);
  pen.position.set(1.25, 1.1, -1.72); pen.rotation.y = .5; s.add(pen);
  put(s, new THREE.CylinderGeometry(.17, .19, .06, 20), inkMat({ tone:.96 }), 1.45, 1.11, -2.3);
  put(s, box(.2, .05, .2), inkMat({ seal:1, flat:true }), -1.35, 1.1, -1.8, 0, .3, 0);
  // paper, in towers
  [[-1.9, -2.5, .9], [1.95, -2.55, .55], [-3.3, -4.2, 3.2], [3.1, -4.6, 3.9], [-1.6, -5.6, 4.6], [2, -6.4, 5.2], [-4.6, -6.8, 5.6], [4.8, -7.4, 6]].forEach(([x, z, h], i) => {
    const on = i < 2 ? 1.08 : 0;
    for (let y = 0; y < h; y += .22) put(s, box(.5 + rnd() * .08, .2, .66 + rnd() * .08), inkMat({ tone:.07 }), x + (rnd() - .5) * .07, on + y + .1, z, 0, (rnd() - .5) * .3, 0);
  });
  const c = clerk(2.9); c.position.set(.1, 0, -3.9); s.add(c);
  return { scene:s, camera:cam(aspect, 72, [.3, 2.15, -.35], [.3, 1.5, -2.6]), look:{ fog:.085, far:20, light:[-.3, .9, .5], seed:3 } };
}

/* ---------- 4. the five pillars ---------- */
export function thePillars(aspect) {
  const s = new THREE.Scene();
  // the ground is a palm
  const palm = tex(1024, 1024, (g, w, h) => {
    g.strokeStyle = "#000"; g.lineWidth = 5;
    const crease = (x0, y0, cx, cy, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke(); };
    crease(40, 640, 420, 480, 990, 560); crease(120, 900, 480, 640, 940, 760); crease(300, 1010, 380, 700, 640, 420); crease(700, 1000, 620, 800, 760, 600);
    g.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = rnd() * w, y = 380 + rnd() * 640; crease(x, y, x + 30, y - 20, x + 70 + rnd() * 60, y - 8 + rnd() * 30); }
  });
  put(s, new THREE.PlaneGeometry(600, 600), inkMat({ tone:.07 }), 0, 0, 0, -Math.PI / 2);
  put(s, new THREE.PlaneGeometry(26, 26), inkMat({ tone:.34, map:palm }), 0, .01, -1, -Math.PI / 2);
  // five fingers
  const skin = inkMat({ tone:.66 }), R = 3.1;
  [[.4, -7.2, R, 120, 0], [-9.5, -17, 2.9, 104, .02], [10.5, -15.5, 2.9, 108, -.02], [20, -27, 2.4, 82, -.05], [-23, -9, 3.3, 54, .2]].forEach(([x, z, r, h, tilt], i) =>
    put(s, rough(new THREE.CapsuleGeometry(r, h, 10, 28, 40), .1, .5, i * 5), skin, x, h / 2 - 2, z, 0, 0, tilt));
  // what his brother wrote, the stain, and the line underneath
  const band = (y, hh, t0, tl, map, o = {}) => put(s, new THREE.CylinderGeometry(R + .06, R + .06, hh, 24, 1, true, t0, tl), inkMat({ tone:.95, map, ...o }), .4, y, -7.2);
  band(2.75, 1.25, -.46, .92, tex(900, 400, (g, w, h) => { g.fillStyle = "#000"; g.textAlign = "center"; g.font = "600 120px Caveat, cursive";
    g.save(); g.translate(w / 2, h / 2); g.rotate(-.05); g.fillText("The Great Sage", 0, -20); g.fillText("was here", 20, 110); g.restore(); }));
  band(1.48, .6, -.2, .44, tex(480, 220, (g, w, h) => { g.fillStyle = "#000"; g.textAlign = "center"; g.font = "600 130px Caveat, cursive"; g.fillText("me too.", w / 2, 150); }));
  const stain = tex(256, 256, (g, w, h) => { for (let i = 0; i < 26; i++) { const x = 128 + (rnd() - .5) * 90, y = 128 + (rnd() - .5) * 90, r = 30 + rnd() * 50;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(0,0,0,.2)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
  band(.5, 1.0, .28, .34, stain, { tone:.6 });
  const fold = tex(512, 128, (g, w, h) => { g.strokeStyle = "#000"; g.lineWidth = 7; g.beginPath(); g.moveTo(20, 30); g.quadraticCurveTo(w / 2, 120, w - 20, 30); g.stroke(); });
  band(7.2, 1.2, -.75, 1.5, fold, { tone:.8 }); band(8.5, 1.1, -.6, 1.2, fold, { tone:.7 });
  put(s, new THREE.PlaneGeometry(1.5, 1.2), inkMat({ tone:.6, map:stain }), 1.75, .02, -3.9, -Math.PI / 2);
  put(s, box(.1, .1, .01), inkMat({ seal:1, flat:true }), 1.3, 1.32, -4.02);   // where the pen is
  return { scene:s, camera:cam(aspect, 66, [-.5, .95, 2.6], [.6, 4.0, -7.2]), look:{ fog:.011, far:170, sky:.08, mist:[3.5, .5], light:[.6, .5, .6], seed:4 } };
}

/* ---------- the two monkeys ---------- */
export function monkey(o = {}) {
  const g = new THREE.Group(), fur = inkMat({ tone:o.tone ?? .92 }), pale = inkMat({ tone:.1 });
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
  put(g, new THREE.SphereGeometry(.2, 16, 12), fur, 0, .36, 0).scale.set(1, 1.25, .9);
  put(g, new THREE.SphereGeometry(.15, 16, 12), fur, 0, .7, 0);
  put(g, new THREE.SphereGeometry(.1, 12, 10), pale, 0, .68, .085);
  put(g, new THREE.SphereGeometry(.055, 10, 8), pale, -.155, .72, 0); put(g, new THREE.SphereGeometry(.055, 10, 8), pale, .155, .72, 0);
  if (o.horns !== false) { put(g, new THREE.ConeGeometry(.026, .1, 8), fur, -.07, .86, .02, 0, 0, .2); put(g, new THREE.ConeGeometry(.026, .1, 8), fur, .07, .86, .02, 0, 0, -.2); }
  const sw = o.run ? .9 : 0;
  put(g, cap(.05, .16), fur, -.09, .12, sw * .12, -sw, 0, 0); put(g, cap(.05, .16), fur, .09, .12, -sw * .12, sw, 0, 0);
  const up = o.arms ? 2.5 : .45;
  put(g, cap(.04, .22), fur, -.24, o.arms ? .62 : .42, -sw * .1, sw, 0, -up); put(g, cap(.04, .22), fur, .24, o.arms ? .62 : .42, sw * .1, -sw, 0, up);
  const tail = new THREE.CatmullRomCurve3([[0, .24, -.14], [0, .2, -.4], [0, .4, -.6], [0, .68, -.52], [0, .76, -.32], [0, .63, -.22], [0, .53, -.31]].map(p => new THREE.Vector3(...p)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(tail, 40, .028, 8), fur));
  g.scale.setScalar((o.h ?? .9) / .9); return g;
}

/* ---------- the heads that come up out of the underworld ---------- */
export function eroHead(src, black, size = .8) {
  const g = src.clone(true), m = inkMat({ tone:black ? 1.3 : .015, form:black ? -.55 : .7 });
  g.traverse(o => { if (o.isMesh) o.material = m; });
  const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
  g.position.sub(c); const w = new THREE.Group(); w.add(g); w.scale.setScalar(size / Math.max(sz.x, sz.y, sz.z));
  const out = new THREE.Group(); out.add(w); return out;
}

/* ---------- the climb: one straight stair, three heads wide ---------- */
export function theClimb(aspect, headSrc, o = {}) {
  const s = new THREE.Scene(), RUN = .5, RISE = .3, N = 70, LANE = .85, W = LANE * 3, Y = i => -i * RISE, Z = i => -i * RUN, M = 8;
  const tread = inkMat({ tone:.1 }), nose = inkMat({ tone:.95, flat:true }), rock = inkMat({ tone:.93 });
  const gs = box(W, RISE + 2, RUN), gn = box(W, .035, .05);
  for (let i = 0; i < N; i++) { put(s, gs, tread, 0, Y(i) - 1 - RISE / 2, Z(i)); put(s, gn, nose, 0, Y(i) + .005, Z(i) - RUN / 2 + .03); }
  for (let k = 0; k < N / 2; k++) for (const sx of [-1, 1])
    put(s, box(1.2, 7, RUN * 2), rock, sx * (W / 2 + .6 - rnd() * .08), Y(k * 2) + 2.6, Z(k * 2) - RUN / 2);
  (o.heads || []).forEach(h => { const e = eroHead(headSrc, h.black, LANE * 1.02); e.position.set(h.lane * LANE, Y(h.step) + .46, Z(h.step)); e.rotation.set(h.rx ?? -.8, h.ry ?? 0, h.rz ?? 0); s.add(e); });
  const me = monkey({ h:.82, arms:o.hit }); me.rotation.y = Math.PI;
  me.position.set((o.lane ?? 0) * LANE + (o.lean ?? 0), Y(M), Z(M));
  if (o.hit) { me.position.y += .5; me.position.z += .55; me.rotation.x = .95; }
  s.add(me);
  return { scene:s, camera:cam(aspect, 70, [0, Y(M) + 4.3, Z(M) + 2.3], [0, Y(M + 6), Z(M + 6)]),
    look:{ fog:o.fog ?? .034, fogInk:.93, far:30, light:[.1, .9, .5], seed:o.seed ?? 5 } };
}
