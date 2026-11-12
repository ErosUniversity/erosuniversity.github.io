// The Walk Down. His brother flew, he could only walk: one straight stair into the underworld, three heads wide.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { InkRenderer, inkMat } from "./ink.js";
import { theStone, theBook, monkey, eroHead } from "./scenes.js";

/* ---------- tuning ---------- */
const RUN = .5, RISE = .3, LANE = .85, W = LANE * 3;
const TOTAL = 1500;          // steps to the bottom
const PUSH = 40;             // steps a head carries you back up
const WALK = [4.6, 7.4];     // your pace, steps a second, top of the stairs to bottom
const HEAD = [5, 10.5];      // how fast the heads climb
const EVERY = [1.55, .8];    // seconds between waves
const TWO = [.12, .62];      // chance a wave is two heads
const Y = p => -p * RISE, Z = p => -p * RUN, mix = (a, t) => a[0] + (a[1] - a[0]) * t, clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* the story, told on the way down (draft: yours to rewrite) */
const STORY = [
  "There were two monkeys in the stone.",
  "The first one burst out, and light shot from his eyes all the way to heaven.",
  "The second came out a little later. Someone had to check whether the stone was okay.",
  "It wasn’t. It was a broken stone. He sat on it for a while.",
  "His brother learned 72 transformations.",
  "He learned the stone by heart. It did not take long.",
  "His brother learned to ride the clouds.",
  "He watched the cloud leave. It did not wait.",
  "Then his brother went down to the underworld and found the Book of Life and Death.",
  "He crossed out his own name, and the names of all the monkeys.",
  "The second monkey’s name was on that page too.",
  "So he walked down after him.",
  "It took years, because he could only walk.",
  "The stairs are three heads wide. Nobody told him about the heads.",
  "They are not angry. They are only going the other way.",
  "Every time one of them carries him up, he loses a morning.",
  "His brother never took the stairs. He does not know they are here.",
  "Halfway down he forgot what flying looked like.",
  "He did not forget the name. It was the only thing he had ever been given.",
  "Nobody is immortal on the stairs. That is what the stairs are for.",
  "At the bottom there is a desk, and a clerk, and a pen.",
  "He is going to ask for the pen.",
];
const lineAt = i => 16 + i * Math.floor((TOTAL - 110) / STORY.length);

/* ---------- page ---------- */
const $ = id => document.getElementById(id), Q = new URLSearchParams(location.search);
const view = $("view"), ink = new InkRenderer();
view.prepend(ink.canvas);
let aspect = .5; const cams = [];
function fit() {
  const r = view.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  let w = Math.max(2, r.width * dpr), h = Math.max(2, r.height * dpr); const k = Math.min(1, Math.sqrt(1.25e6 / (w * h)));
  ink.setSize(Math.round(w * k), Math.round(h * k)); aspect = r.width / r.height;
  for (const c of cams) { c.aspect = aspect; c.updateProjectionMatrix(); }
}
addEventListener("resize", fit); fit();
const show = (id, on = true) => $(id).classList.toggle("on", on);
let noteT = 0, lineT = 0;
function note(text, red = false, secs = 2.6) { const n = $("note"); n.textContent = text; n.classList.toggle("red", red); show("note"); noteT = secs; }
function line(text) { $("line").textContent = text; show("line"); lineT = 7.5; }

/* ---------- load ---------- */
const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/");
const [headSrc] = await Promise.all([
  new GLTFLoader().setDRACOLoader(draco).loadAsync("head.glb").then(g => g.scene),
  ...["italic 500 24px Cormorant Garamond", "500 10px Cinzel", "600 60px Caveat", "400 18px EB Garamond"].map(f => document.fonts.load(f).catch(() => {})),
]);

/* ---------- the stone: two monkeys ---------- */
const stone = theStone(aspect, 2); cams.push(stone.camera);
const big = monkey({ h:1.25, run:true, horns:false }), little = monkey({ h:.62 });
big.visible = little.visible = false; stone.scene.add(big, little);
const A = (x, y, z) => new THREE.Vector3(x, y, z), lookAtDoor = A(-.25, 1.5, -6), smooth = t => t * t * (3 - 2 * t), seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
function intro(t) {
  // the first one: out of the stone and gone
  const u = seg(t, 1.1, 3.3); big.visible = u > 0 && u < 1;
  big.position.lerpVectors(A(-1.2, 0, 2.1), A(3.4, 0, -1.5), u); big.position.y = Math.abs(Math.sin(u * Math.PI * 5)) * .55;
  big.rotation.set(.25, 2.1, 0);
  // the second: out from behind the stone, a look around, then to the door
  little.visible = t > 4.3;
  const out = smooth(seg(t, 4.4, 5.7)), go = smooth(seg(t, 7.0, 11.2));
  little.position.lerpVectors(A(-1.55, 0, 1.25), A(-.35, 0, 2.75), out).lerp(A(.08, 0, -7.2), go);
  const walking = (out > 0 && out < 1) || (go > 0 && go < 1);
  little.position.y = walking ? Math.abs(Math.sin(t * 9)) * .06 : 0;
  little.rotation.y = go > 0 ? Math.PI - .12 * Math.sin(t * 9) : out < 1 ? .9 : .9 + Math.sin((t - 5.7) * 4.2) * 1.1 * (1 - seg(t, 6.6, 7));
  { const g = smooth(seg(t, 6.8, 11.2)); stone.camera.position.set(-.6 + .65 * g, 1.1 - .15 * g, 7.8 - 5.6 * g); } stone.camera.lookAt(lookAtDoor);
  if (t > 1.2 && t < 1.3) note("The first one burst out.", false, 2.6);
  if (t > 4.6 && t < 4.7) note("The second came out a little later.", false, 2.4);
  if (t > 7.6 && t < 7.7) note("He could only walk.", false, 3);
  if (t > 10.3) show("black");
  if (t > 11.4) startClimb();
}

/* ---------- the stairs ---------- */
const NS = 74, UP = 14, climb = new THREE.Scene(), stairs = new THREE.Group(); climb.add(stairs);
{
  const treads = new THREE.InstancedMesh(new THREE.BoxGeometry(W, RISE + 2, RUN), inkMat({ tone:.1 }), NS);
  const noses = new THREE.InstancedMesh(new THREE.BoxGeometry(W, .035, .05), inkMat({ tone:.95, flat:true }), NS);
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 7, RUN), inkMat({ tone:.93 }), NS * 2);
  const m = new THREE.Matrix4();
  for (let j = 0; j < NS; j++) { const i = j - UP;
    treads.setMatrixAt(j, m.makeTranslation(0, Y(i) - 1 - RISE / 2, Z(i))); noses.setMatrixAt(j, m.makeTranslation(0, Y(i) + .005, Z(i) - RUN / 2 + .03));
    walls.setMatrixAt(j * 2, m.makeTranslation(-(W / 2 + .6), Y(i) + 2.6, Z(i))); walls.setMatrixAt(j * 2 + 1, m.makeTranslation(W / 2 + .6, Y(i) + 2.6, Z(i))); }
  for (const im of [treads, noses, walls]) { im.frustumCulled = false; stairs.add(im); }
}
const me = monkey({ h:.82 }), meHit = monkey({ h:.82, arms:true }); meHit.visible = false; climb.add(me, meHit);
const heads = [];
for (let i = 0; i < 12; i++) { const o = eroHead(headSrc, i % 2 === 0, LANE * 1.02); o.visible = false; climb.add(o); heads.push({ o, black:i % 2 === 0, on:false, s:0, lane:0, v:0, spin:0, spent:false }); }
const climbCam = new THREE.PerspectiveCamera(70, aspect, .1, 200); cams.push(climbCam);

let p = 0, maxP = 0, lane = 0, x = 0, told = 0, waveIn = 2.6, safe = 0, pushed = 0, carrier = null, hits = 0, camX = 0;
const depth = () => clamp(p / TOTAL, 0, 1);
function spawn() {
  const d = depth(), two = Math.random() < mix(TWO, d), lanes = [-1, 0, 1].sort(() => Math.random() - .5).slice(0, two ? 2 : 1), v = mix(HEAD, d) * (.9 + Math.random() * .25);
  for (const l of lanes) {
    const black = Math.random() < .5, h = heads.find(h => !h.on && h.black === black) || heads.find(h => !h.on); if (!h) return;
    Object.assign(h, { on:true, s:p + 54 + Math.random() * 3, lane:l, v, spin:Math.random() * 6, spent:false }); h.o.visible = true;
  }
}
function step(dir) { if (state === "climb" && !pushed) lane = clamp(lane + dir, -1, 1); }
function climbTick(dt) {
  const d = depth();
  if (pushed > 0) {            // a head has you: back up the stairs
    const back = Math.min(pushed, 34 * dt, p); p -= back; pushed -= back; carrier.s = p + .85;
    if (pushed <= .001 || p <= 0) { pushed = 0; carrier.spent = true; carrier = null; safe = 1.5; }
  } else p += mix(WALK, d) * dt;
  maxP = Math.max(maxP, p); safe = Math.max(0, safe - dt);
  x += (lane * LANE - x) * Math.min(1, dt * 15);

  if (!pushed && TOTAL - p > 70 && (waveIn -= dt) <= 0) { spawn(); waveIn = mix(EVERY, d) * (.8 + Math.random() * .4); }
  for (const h of heads) if (h.on) {
    if (h !== carrier) h.s -= h.v * dt;
    h.spin += h.v * dt * RUN / (LANE * .5);
    h.o.position.set(h.lane * LANE, Y(h.s) + .46 + Math.abs(Math.sin(h.s * Math.PI)) * .09, Z(h.s)); h.o.rotation.set(h.spin, 0, Math.sin(h.spin * .37) * .25);
    if (!pushed && !safe && !h.spent && Math.abs(h.s - p) < .75 && Math.abs(h.lane * LANE - x) < .5) {
      carrier = h; pushed = PUSH; hits++; lane = h.lane; note(`■ ${PUSH} steps back up`, true, 1.9);
    }
    if (h.s < p - UP + 1) { h.on = false; h.o.visible = false; }
  }

  // him
  const a = pushed ? meHit : me, b = pushed ? me : meHit; b.visible = false; a.visible = !safe || Math.floor(safe * 12) % 2 === 0;
  const hop = Math.abs(Math.sin(p * Math.PI)) * .07;
  if (pushed) { a.position.set(x, Y(p) + .5, Z(p) + .55); a.rotation.set(.95, Math.PI, 0); }
  else { a.position.set(x, Y(p) + hop, Z(p)); a.rotation.set(0, Math.PI + (lane * LANE - x) * -.5, (lane * LANE - x) * -.35 + Math.sin(p * Math.PI) * .07); }

  const k = Math.floor(p); stairs.position.set(0, Y(k), Z(k));
  camX += (x * .28 - camX) * Math.min(1, dt * 4);
  climbCam.position.set(camX, Y(p) + 4.3, Z(p) + 2.3); climbCam.lookAt(camX * .6, Y(p + 6), Z(p + 6));

  $("step").textContent = "Step " + Math.floor(p).toLocaleString("en");
  while (told < STORY.length && maxP >= lineAt(told)) line(STORY[told++]);
  if (p >= TOTAL) finish();
}
const climbLook = () => ({ fog:.034 + .014 * depth(), fogInk:.93, far:30, light:[.1, .9, .5], seed:5 });

/* ---------- the bottom ---------- */
let book = null;
function finish() {
  state = "fade"; show("black"); show("line", false); show("step", false);
  setTimeout(() => {
    book = theBook(aspect); cams.push(book.camera); state = "end"; show("black", false);
    const mins = Math.max(1, Math.round((performance.now() - t0) / 60000));
    $("end").innerHTML = `<small>Clerk of the dead</small><p>“Why would you do that?”</p><div><button id="ans">I want to know how it ends.</button></div>`;
    show("end");
    $("ans").onclick = () => {
      $("end").innerHTML = `<p>He wrote his name back in.</p><p>He kept the pen.</p><small style="margin-top:10px">${TOTAL.toLocaleString("en")} steps · carried back up ${hits} ${hits === 1 ? "time" : "times"} · ${mins} min</small>
        <div><a href="../">Read the scroll</a><a href="?skip">Walk down again</a></div>`;
    };
  }, 1300);
}

/* ---------- running it ---------- */
let state = "closed", tIntro = 0, t0 = performance.now();
function startClimb() {
  if (state === "climb") return;
  state = "climb"; p = maxP = +Q.get("at") || 0; told = 0; while (told < STORY.length && lineAt(told) < p) told++;
  show("black", false); show("step"); show("note", false); t0 = performance.now();
  setTimeout(() => { if (!hits && state === "climb") note(matchMedia("(pointer:coarse)").matches ? "Swipe or tap a side to step aside" : "← → to step aside", false, 4.5); }, 900);
}
function open() {
  if (state !== "closed") return;
  document.body.classList.add("open"); state = "opening";
  setTimeout(() => { if (state === "opening") { state = "intro"; tIntro = 0; } }, Q.has("skip") ? 300 : 1500);
}
$("load").style.opacity = 0; $("closedHint").textContent = matchMedia("(pointer:coarse)").matches ? "Tap to open" : "Click to open";

addEventListener("keydown", e => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") step(-1);
  else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") step(1);
  else if ((e.key === " " || e.key === "Enter") && state === "closed") open();
});
let downX = null;
addEventListener("pointerdown", e => { if (e.target.closest("a,button")) return; downX = e.clientX;
  if (state === "closed") open(); else if (state === "intro" && tIntro > .6) { tIntro = Math.max(tIntro, 10.3); } });
addEventListener("pointerup", e => { if (downX === null) return; const dx = e.clientX - downX; downX = null;
  if (Math.abs(dx) > 22) step(Math.sign(dx)); else { const r = view.getBoundingClientRect(); step(e.clientX < r.left + r.width / 2 ? -1 : 1); } });

if (Q.has("open")) open();
if (Q.has("skip") || Q.has("at") || Q.has("end")) { open(); state = "opening"; setTimeout(() => { startClimb(); if (Q.has("end")) p = TOTAL - 4; }, 350); }

let last = performance.now(), played = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (noteT > 0 && (noteT -= dt) <= 0) show("note", false);
  if (lineT > 0 && (lineT -= dt) <= 0) show("line", false);
  if (state === "intro") intro(tIntro += dt);
  if (state === "climb") { climbTick(dt); played += dt; }
  if (state === "climb" || state === "fade") ink.render(climb, climbCam, climbLook());
  else if (state === "end") ink.render(book.scene, book.camera, book.look);
  else { if (state !== "intro") intro(0); ink.render(stone.scene, stone.camera, stone.look); }
  if (Q.has("test") && (played >= +Q.get("test") || (state === "end" && Q.has("end")) || (Q.get("test") === "intro" && tIntro >= +Q.get("t")))) document.title = "ready";
}
requestAnimationFrame(frame);
