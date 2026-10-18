import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
const dpr = Math.min(devicePixelRatio, 2);

// run a canvas loop only while its element is on screen
function whileVisible(el, fn) {
  let on = false, last = performance.now();
  new IntersectionObserver(([e]) => { on = e.isIntersecting; }, { rootMargin: "20% 0px" }).observe(el);
  (function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (on) fn(dt, now / 1000);
    requestAnimationFrame(loop);
  })(last);
}
function fit(canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  return [canvas.width, canvas.height];
}

// =====================================================================================
// hero: "WHO THE FUCK ARE YOU?", hard black and white flashes.
// As hard and fast as is safe: about 2.8 flashes a second, just under the 3-per-second limit
// beyond which flashing can trigger seizures. The type jumps on every flash.
// "Blitze aus" stops it, and with reduced motion it never starts.
// =====================================================================================
const hero = $("hero");
let strobeOn = !reducedMotion, white = false, nextSwitch = 0.4;
const strobeBtn = $("strobe");
strobeBtn.addEventListener("click", () => {
  strobeOn = !strobeOn; strobeBtn.textContent = strobeOn ? "Blitze aus" : "Blitze an";
  strobeBtn.setAttribute("aria-pressed", String(!strobeOn));
  if (!strobeOn) { white = false; hero.classList.remove("white"); }
});
if (reducedMotion) { strobeBtn.textContent = "Blitze an"; strobeBtn.setAttribute("aria-pressed", "true"); }
whileVisible(hero, (dt) => {
  if (!strobeOn) return;
  nextSwitch -= dt;
  if (nextSwitch > 0) return;
  white = !white;
  hero.classList.toggle("white", white);
  jolt(hero.querySelector("h1"), white);
  nextSwitch = white ? 0.08 : 0.28 + Math.random() * 0.04;      // flash + dark >= 0.36 s, i.e. < 3 per second
});
function jolt(el, on) {
  el.style.transform = on ? `translate(${(Math.random() - 0.5) * 26}px, ${(Math.random() - 0.5) * 18}px) skewX(${(Math.random() - 0.5) * 12}deg) scale(${1 + Math.random() * 0.06})` : "";
}
// a burst of the same strobe, for a moment, anywhere on the page
async function strobeBurst(textEl, n = 7) {
  if (!strobeOn) return;
  const w = $("whiteout");
  for (let i = 0; i < n; i++) {
    w.classList.add("hard"); jolt(textEl, true);
    await new Promise((r) => setTimeout(r, 80));
    w.classList.remove("hard"); jolt(textEl, false);
    await new Promise((r) => setTimeout(r, 280 + Math.random() * 40));
  }
}
setTimeout(() => $("answer").classList.add("in"), reducedMotion ? 0 : 2400);

// =====================================================================================
// I. three swarms that are one; when one dot dances out of line, the swarm follows it
// =====================================================================================
const sc = $("swarm3"), sx = sc.getContext("2d");
const COLORS = ["#ffffff", "#8c8c8a", "#C9B47E"];
const RGB = [[255, 255, 255], [140, 140, 138], [201, 180, 126]];
const PER = innerWidth < 700 ? 110 : 170;
const dots = [];
for (let g = 0; g < 3; g++) for (let i = 0; i < PER; i++) {
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
  dots.push({ g, c: [...RGB[g]], ox: Math.cos(a) * r, oy: Math.sin(a) * r, x: 0, y: 0, vx: 0, vy: 0 });
}
let anchor = { x: 0, y: 0 }, contrarian = null, nextEvent = 3;
whileVisible(sc, (dt, t) => {
  const [w, h] = fit(sc);
  const R = Math.min(w, h) * 0.17, r = Math.min(w, h) * 0.11;
  // every few seconds someone dances out of line
  nextEvent -= dt;
  if (nextEvent <= 0 && !contrarian) {
    const d = dots[(Math.random() * dots.length) | 0];
    const a = Math.random() * Math.PI * 2;
    contrarian = { d, vx: Math.cos(a) * w * 0.22, vy: Math.sin(a) * h * 0.22, life: 3.2 };
  }
  if (contrarian) {
    const c = contrarian; c.life -= dt;
    c.d.x += c.vx * dt; c.d.y += c.vy * dt;
    if (Math.abs(c.d.x) > w * 0.38) c.vx *= -1;
    if (Math.abs(c.d.y) > h * 0.36) c.vy *= -1;
    anchor.x += (c.d.x - anchor.x) * dt * 1.4; anchor.y += (c.d.y - anchor.y) * dt * 1.4;    // the swarm adapts
    if (c.life <= 0) { contrarian = null; nextEvent = 4 + Math.random() * 3; }
  } else { anchor.x *= Math.exp(-dt * 0.4); anchor.y *= Math.exp(-dt * 0.4); }

  sx.setTransform(1, 0, 0, 1, 0, 0); sx.fillStyle = "#050505"; sx.fillRect(0, 0, w, h);
  sx.setTransform(1, 0, 0, 1, w / 2, h / 2);
  for (const d of dots) {
    // exchange: now and then a dot leaves its swarm for another, and slowly takes on its colour
    if (Math.random() < dt / 6) d.g = (d.g + 1 + (Math.random() * 2 | 0)) % 3;
    for (let k = 0; k < 3; k++) d.c[k] += (RGB[d.g][k] - d.c[k]) * Math.min(1, dt * 1.5);
    if (contrarian && d === contrarian.d) continue;
    const ga = t * 0.28 + d.g * (Math.PI * 2 / 3), cx = anchor.x + Math.cos(ga) * R, cy = anchor.y + Math.sin(ga) * R * 0.7;
    const sp = t * 0.6 + d.g, ox = d.ox * Math.cos(sp) - d.oy * Math.sin(sp), oy = d.ox * Math.sin(sp) + d.oy * Math.cos(sp);
    const tx = cx + ox * r, ty = cy + oy * r * 0.8;
    d.vx += ((tx - d.x) * 3.2 + Math.sin(d.y * 0.02 + t) * 30) * dt;     // softer pull: the trip between swarms shows
    d.vy += ((ty - d.y) * 3.2 + Math.cos(d.x * 0.02 - t) * 30) * dt;
    d.vx *= Math.exp(-dt * 3); d.vy *= Math.exp(-dt * 3);
    d.x += d.vx * dt; d.y += d.vy * dt;
  }
  for (const d of dots) {
    sx.fillStyle = `rgb(${d.c[0] | 0},${d.c[1] | 0},${d.c[2] | 0})`;
    const big = contrarian && d === contrarian.d;
    sx.beginPath(); sx.arc(d.x, d.y, (big ? 4.5 : 1.8) * dpr, 0, Math.PI * 2); sx.fill();
  }
});

// =====================================================================================
// II. the shooting gallery: ducks on rails. Whatever you hit turns out to be an Eros head.
// =====================================================================================
const gc = $("gallery"), gx = gc.getContext("2d");
const headImg = new Image(); headImg.src = "assets/eros-head.png";
const ducks = [];
for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) ducks.push({ row, u: i / 6 + row * 0.07, hit: 0, flip: 0 });
let aim = { x: -100, y: -100 }, gFlash = 0, shots = 0, hits = 0;
const score = $("score");
const duckBox = (d, w, h) => {
  const s = Math.min(w / 10, h / 6.5), dir = d.row % 2 ? -1 : 1;
  const x = ((d.u % 1) + 1) % 1 * (w + s * 2) - s, y = h * (0.26 + d.row * 0.25);
  return { x: dir > 0 ? x : w - x, y, s, dir };
};
function drawDuck(b) {
  const { x, y, s, dir } = b;
  gx.save(); gx.translate(x, y); gx.scale(dir, 1);
  gx.fillStyle = "#ececea";
  gx.beginPath(); gx.ellipse(0, 0, s * 0.62, s * 0.34, 0, 0, Math.PI * 2); gx.fill();                // body
  gx.beginPath(); gx.moveTo(-s * 0.55, -s * 0.05); gx.lineTo(-s * 0.85, -s * 0.28); gx.lineTo(-s * 0.6, s * 0.12); gx.fill();   // tail
  gx.beginPath(); gx.arc(s * 0.42, -s * 0.38, s * 0.24, 0, Math.PI * 2); gx.fill();                  // head
  gx.beginPath(); gx.moveTo(s * 0.6, -s * 0.42); gx.lineTo(s * 0.86, -s * 0.33); gx.lineTo(s * 0.6, -s * 0.28); gx.fill();      // beak
  gx.fillStyle = "#050505"; gx.beginPath(); gx.arc(s * 0.48, -s * 0.44, s * 0.04, 0, Math.PI * 2); gx.fill();                   // eye
  gx.restore();
}
gc.addEventListener("pointermove", (e) => { const r = gc.getBoundingClientRect(); aim = { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; });
gc.addEventListener("pointerleave", () => { aim = { x: -100, y: -100 }; });
gc.addEventListener("pointerdown", (e) => {
  const r = gc.getBoundingClientRect(); aim = { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
  shots++; gFlash = reducedMotion ? 0.3 : 1;
  const [w, h] = [gc.width, gc.height];
  for (const d of ducks) {
    if (d.hit) continue;
    const b = duckBox(d, w, h);
    if (Math.abs(aim.x - b.x) < b.s * 0.7 && Math.abs(aim.y - (b.y - b.s * 0.1)) < b.s * 0.55) { d.hit = 1; hits++; break; }
  }
  score.textContent = hits ? `Abgeschossen: ${hits}` + (hits === 1 ? " · Das war keine Ente." : "") : `Schüsse: ${shots}`;
});
whileVisible(gc, (dt, t) => {
  const [w, h] = fit(gc);
  gx.fillStyle = "#050505"; gx.fillRect(0, 0, w, h);
  gx.strokeStyle = "rgba(236,236,234,.18)"; gx.lineWidth = 2 * dpr;
  for (let row = 0; row < 3; row++) { const y = h * (0.26 + row * 0.25) + Math.min(w / 10, h / 6.5) * 0.45; gx.beginPath(); gx.moveTo(0, y); gx.lineTo(w, y); gx.stroke(); }
  for (const d of ducks) {
    d.u += dt * (0.05 + d.row * 0.012);
    const b = duckBox(d, w, h);
    if (d.hit) d.flip = Math.min(1, d.flip + dt * 2.2);
    gx.save(); gx.translate(b.x, b.y);
    const sy = d.hit ? Math.abs(Math.cos(d.flip * Math.PI)) : 1;     // turns over on its axis...
    gx.scale(1, Math.max(sy, 0.02)); gx.translate(-b.x, -b.y);
    if (d.hit && d.flip > 0.5) {                                      // ...and it was a head all along
      const s = b.s * 1.7, ar = headImg.naturalWidth / headImg.naturalHeight || 0.85;
      if (headImg.complete) { gx.save(); gx.translate(b.x, b.y); gx.scale(b.dir, 1); gx.drawImage(headImg, -s * ar / 2, -s * 0.72, s * ar, s); gx.restore(); }
    } else drawDuck(b);
    gx.restore();
  }
  // viewfinder / crosshair
  if (aim.x > 0) {
    gx.strokeStyle = "#ececea"; gx.lineWidth = 1.5 * dpr; const R = 22 * dpr;
    gx.beginPath(); gx.arc(aim.x, aim.y, R, 0, Math.PI * 2); gx.stroke();
    gx.beginPath(); gx.moveTo(aim.x - R * 1.6, aim.y); gx.lineTo(aim.x - R * 0.4, aim.y); gx.moveTo(aim.x + R * 0.4, aim.y); gx.lineTo(aim.x + R * 1.6, aim.y);
    gx.moveTo(aim.x, aim.y - R * 1.6); gx.lineTo(aim.x, aim.y - R * 0.4); gx.moveTo(aim.x, aim.y + R * 0.4); gx.lineTo(aim.x, aim.y + R * 1.6); gx.stroke();
  }
  if (gFlash > 0.01) { gx.fillStyle = `rgba(255,255,255,${gFlash * 0.85})`; gx.fillRect(0, 0, w, h); gFlash *= Math.exp(-dt * 7); }
});

// =====================================================================================
// III. WHO THE FUCK ARE YOU? (one flash, once)
// =====================================================================================
new IntersectionObserver(([e], obs) => {
  if (!e.isIntersecting) return; obs.disconnect();
  if (reducedMotion) return;
  strobeBurst($("wtf"));
}, { threshold: 0.9 }).observe($("wtf"));

// V. the questions arrive one by one
for (const q of $("questions").children) new IntersectionObserver(([e]) => q.classList.toggle("in", e.isIntersecting), { rootMargin: "-25% 0px -25% 0px" }).observe(q);

// =====================================================================================
// IV. a hand holds a credit card; tilt it as you like, the name never becomes readable
// =====================================================================================
(() => {
  const canvas = $("card3d");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(dpr); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#050505");
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 10);
  camera.position.set(0, 0.058, 0.25); camera.lookAt(0, 0.058, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-0.3, 0.4, 0.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.2); rim.position.set(0.4, 0.2, -0.4); scene.add(rim);

  const rig = new THREE.Group(); scene.add(rig);
  new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/"))
    .load("assets/hand.glb", (g) => {
      const hand = g.scene;
      hand.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: 0xd9d5cd, roughness: 0.62 }); });
      hand.rotation.y = Math.PI;                       // palm towards us
      rig.add(hand);
    });

  // the card: black, chip, a number ending in 208, and a name in print too small and too soft to read
  const cardCanvas = document.createElement("canvas"); cardCanvas.width = 1024; cardCanvas.height = 646;
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ";
  const randomName = () => { let s = ""; const n1 = 4 + (Math.random() * 4 | 0), n2 = 5 + (Math.random() * 5 | 0); for (let i = 0; i < n1 + n2 + 1; i++) s += i === n1 ? " " : LETTERS[Math.random() * LETTERS.length | 0]; return s; };
  function paintCard(name) {
    const c = cardCanvas, g = c.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 1024, 646); grd.addColorStop(0, "#1b1b1c"); grd.addColorStop(1, "#060606");
    g.fillStyle = grd; g.fillRect(0, 0, 1024, 646);
    g.fillStyle = "#b9b6ae"; g.beginPath(); g.roundRect(90, 230, 130, 100, 14); g.fill();                       // chip
    g.strokeStyle = "#7d7a73"; g.lineWidth = 3; for (const y of [262, 298]) { g.beginPath(); g.moveTo(90, y); g.lineTo(220, y); g.stroke(); }
    g.fillStyle = "#d9d6cf"; g.font = "500 54px Jost, sans-serif"; g.fillText("••••  ••••  ••••  0208", 90, 430);
    g.font = "500 30px Jost, sans-serif"; g.fillStyle = "#8f8c86"; g.fillText("12/29", 640, 500);
    g.fillStyle = "#c9c6bf"; g.font = "500 34px Jost, sans-serif"; g.letterSpacing = "3px";
    g.fillText(name, 92, 560); g.letterSpacing = "0px";                                                       // the name, never the same twice
    g.font = "italic 800 40px Jost, sans-serif"; g.fillStyle = "#3a3a3b"; g.fillText("DEBIT", 820, 600);
  }
  paintCard(randomName());
  const tex = new THREE.CanvasTexture(cardCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  let lastLetters = { x: 0, y: 0 };
  const card = new THREE.Mesh(new RoundedBoxGeometry(0.0856, 0.054, 0.0009, 3, 0.003), [
    new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.2 }), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.4 }),
  ]);
  card.position.set(0.004, 0.058, 0.03); card.rotation.z = -0.12;     // clear of the fingertips, whichever way it tilts
  rig.add(card);

  let target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  const point = (e) => { const r = canvas.getBoundingClientRect(); target = { x: ((e.clientY - r.top) / r.height - 0.5) * 1.1, y: ((e.clientX - r.left) / r.width - 0.5) * 1.6 }; };
  canvas.addEventListener("pointermove", point); canvas.addEventListener("pointerdown", point);
  whileVisible(canvas, (dt, t) => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const idle = reducedMotion ? 0 : 1;
    cur.x += (target.x + Math.sin(t * 0.5) * 0.08 * idle - cur.x) * 0.06;
    cur.y += (target.y + Math.sin(t * 0.37) * 0.12 * idle - cur.y) * 0.06;
    rig.rotation.set(cur.x, cur.y, 0);
    if (Math.hypot(cur.x - lastLetters.x, cur.y - lastLetters.y) > 0.045) {      // every bit of tilt: a different name
      lastLetters = { ...cur }; paintCard(randomName()); tex.needsUpdate = true;
    }
    renderer.render(scene, camera);
  });
})();

// =====================================================================================
// VI. may I take a picture of you? "No" is the end of it.
// =====================================================================================
$("no").addEventListener("click", () => {
  $("reply").textContent = "Okay. Danke, dass du Nein sagst. Dann kein Foto.";
  $("booth").classList.remove("on");
});
$("yes").addEventListener("click", () => {
  $("reply").textContent = "Danke. Dann setz dich hin.";
  const booth = $("booth");
  if (!booth.querySelector("iframe")) {
    const f = document.createElement("iframe");
    f.src = "booth/index.html"; f.allow = "camera"; f.title = "Eros Photobooth";
    booth.prepend(f);
  }
  booth.classList.add("on");
  booth.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
});

// =====================================================================================
// the pinboard: strips from the Fotoautomat, with a line for the angel, one for the devil and a signature.
// For now it lives in this browser only; a shared wall needs storage (and someone approving what goes up).
// =====================================================================================
const PIN_KEY = "eros.foto.pins";
const loadPins = () => { try { return JSON.parse(localStorage.getItem(PIN_KEY) || "[]"); } catch { return []; } };
function renderPins() {
  const pins = loadPins(), box = $("pins");
  box.replaceChildren(...pins.map((p, i) => {
    const fig = document.createElement("figure"); fig.className = "pin";
    fig.style.transform = `rotate(${((i * 37) % 9) - 4}deg)`;
    const img = document.createElement("img"); img.src = p.img; img.alt = "Fotoautomat-Streifen" + (p.sig ? " von " + p.sig : "");
    const cap = document.createElement("figcaption");
    for (const [label, text] of [["Engel", p.good], ["Teufel", p.bad]]) {
      if (!text) continue;
      const b = document.createElement("b"); b.textContent = label; cap.append(b, document.createTextNode(text));
    }
    if (p.sig) { const sg = document.createElement("span"); sg.className = "sig"; sg.textContent = p.sig; cap.append(sg); }
    fig.append(img, cap); return fig;
  }));
  $("board-empty").hidden = pins.length > 0;
}
window.erosPin = (entry) => {
  const pins = [entry, ...loadPins()].slice(0, 24);
  try { localStorage.setItem(PIN_KEY, JSON.stringify(pins)); } catch { pins.pop(); try { localStorage.setItem(PIN_KEY, JSON.stringify(pins)); } catch {} }
  renderPins();
  $("board").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
};
renderPins();

// =====================================================================================
// visitors (each browser counted once), kept by a free public counter
// =====================================================================================
(async () => {
  const KEY = "eros.foto.visited", COUNTER = "https://abacus.jasoncameron.dev";
  let seen = null; try { seen = localStorage.getItem(KEY); } catch {}
  const n = await fetch(`${COUNTER}/${seen ? "get" : "hit"}/erosuniversity/warum-ein-foto-visitors`).then((r) => r.json()).then((j) => Math.max(j.value ?? 0, 0)).catch(() => null);
  if (n === null) return;
  try { if (!seen) localStorage.setItem(KEY, "1"); } catch {}
  const digits = $("visits-digits"); $("visits").hidden = false;
  digits.replaceChildren(...String(n).padStart(6, "0").split("").map((d) => Object.assign(document.createElement("span"), { textContent: d })));
})();
