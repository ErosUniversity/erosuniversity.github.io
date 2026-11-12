// The Walk Down. His brother flew, he could only walk: one straight stair into the underworld, three heads wide.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { InkRenderer, inkMat } from "./ink.js";
import { theStone, sun, cloud, deskSet, eroHead } from "./scenes.js";
import { sfx } from "./audio.js";

/* ---------- tuning (first number: top of the stairs, second: the bottom) ---------- */
const RUN = .5, RISE = .3, LANE = .85, W = LANE * 3;
const TOTAL = 1200;          // steps to the clerk's desk
const PUSH = 42;             // steps a head carries you back up
const BOOST = 21;            // steps a red head throws you forward
const RED = .09;             // chance a wave is one red head
const WALK = [6.6, 4.3];     // his pace, steps a second: he gets slower as he gets older
const SIDE = [15, 8];        // how quickly he changes lane
const HEAD = [5, 12.5];      // how fast the heads climb
const EVERY = [1.6, .72];    // seconds between waves
const TWO = [.1, .66];       // chance a wave is two heads
const Y = p => -p * RISE, Z = p => -p * RUN, mix = (a, t) => a[0] + (a[1] - a[0]) * t, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = t => t * t * (3 - 2 * t), seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1), A = (x, y, z) => new THREE.Vector3(x, y, z);

/* the story, told on the way down */
const STORY = [
  "Sun Wu Shi walked behind his brother down the stairs.",
  "While his brother was flying down the stairs, he had to take the steps.",
  "There were two monkeys in the stone.",
  "The first one burst out, and light shot from his eyes all the way to heaven.",
  "The second came out a little later. Someone had to check whether the stone was okay.",
  "It wasn’t. It was a broken stone. He sat on it for a while.",
  "His brother learned 72 transformations.",
  "He learned the stone by heart. It did not take long.",
  "His brother learned to ride the clouds.",
  "He watched the cloud leave. It did not wait.",
  "Down here his brother found the Book of Life and Death.",
  "He crossed out his own name, and the names of all the monkeys.",
  "The second monkey’s name was on that page too.",
  "It took years, because he could only walk.",
  "The stairs are three heads wide. Nobody told him about the heads.",
  "They are not angry. They are only going the other way.",
  "Every time one of them carries him up, he loses a morning.",
  "His brother never took the stairs. He does not know they are here.",
  "Halfway down he forgot what flying looked like.",
  "He did not forget the name. It was the only thing he had ever been given.",
  "Nobody is immortal on the stairs. That is what the stairs are for.",
  "At the bottom there is a desk, and a clerk, and a pen.",
];
const lineAt = i => 8 + i * Math.floor((TOTAL - 90) / STORY.length);
const WAITS = ["He scratched his head for a while.", "It was a broken stone. He checked again.", "A cloud went by. It did not stop.", "Nothing happened. It was nice.", "His brother was probably there by now."];

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
let lines = 0;
function line(text) { $("line").textContent = text; show("line"); lineT = 7.5; sfx.pluck(lines++); }
// words at the bottom of the picture, with things to choose
function ask(html, choices) {
  const el = $("end"); show("note", false); el.classList.toggle("dark", state === "arrive");
  el.innerHTML = html + "<div>" + choices.map((c, i) => c.href ? `<a href="${c.href}">${c.label}</a>` : `<button data-i="${i}">${c.label}</button>`).join("") + "</div>";
  el.querySelectorAll("button").forEach(b => b.onclick = () => { sfx.start(); sfx.tock(); choices[+b.dataset.i].go(); }); show("end");
}

/* ---------- load ---------- */
const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/");
const gltf = new GLTFLoader().setDRACOLoader(draco);
const [headSrc, sunSrc] = await Promise.all([
  gltf.loadAsync("head.glb").then(g => g.scene), gltf.loadAsync("sun.glb").then(g => g.scene),
  ...["italic 500 24px Cormorant Garamond", "500 10px Cinzel", "600 60px Caveat", "400 18px EB Garamond"].map(f => document.fonts.load(f).catch(() => {})),
]);

/* ---------- the mountain: two monkeys, one cloud, a choice ---------- */
const stone = theStone(aspect, 2); cams.push(stone.camera);
const wukong = sun(sunSrc, 1.9), ride = cloud(), me = sun(sunSrc, 1.0);
wukong.visible = ride.visible = me.visible = false; stone.scene.add(wukong, ride, me);
const DOOR = A(0, .7, -7.9), SPOT = A(-.35, 0, 2.75), lookAtDoor = A(-.25, 1.5, -6);
let tI = 0, tW = 0, waits = 0, clock = 0, scrT = 0;
const done = new Set(), once = (t, t0, key, fn) => { if (t >= t0 && !done.has(key)) { done.add(key); fn(); } };
function intro(t) {
  // the first one: out of the stone, onto a cloud, down the door
  const out = seg(t, .8, 1.7), hop = seg(t, 2.9, 3.4), fly = seg(t, 3.5, 4.7);
  const land = A(.35, 0, 1.3), onCloud = A(.35, .62, 1.1);
  wukong.visible = out > 0 && fly < 1; ride.visible = t > 1.9 && fly < 1;
  const cl = A(4.5, 5, -3).lerp(A(.35, .45, 1.1), smooth(seg(t, 1.9, 2.9))).lerp(DOOR, fly * fly);
  ride.position.copy(cl); ride.rotation.y = .3 + fly * 1.2; ride.scale.setScalar(1.25 * (1 - .55 * fly * fly));
  if (fly > 0) { wukong.position.copy(cl).add(A(0, .17, 0)); wukong.scale.setScalar(1 - .55 * fly * fly); }
  else if (hop > 0) { wukong.position.lerpVectors(land, onCloud, hop); wukong.position.y += Math.sin(hop * Math.PI) * .7; wukong.scale.setScalar(1); }
  else { wukong.position.lerpVectors(A(-1.2, .2, 2.1), land, out); wukong.position.y += Math.sin(out * Math.PI) * 1.5; wukong.scale.setScalar(.35 + .65 * out); }
  wukong.rotation.set(hop > 0 && hop < 1 ? -hop * Math.PI * 2 : 0, fly > 0 ? Math.PI : hop > 0 ? .3 + hop * 2.84 : .5, 0);
  if (hop > 0 && hop < 1) wukong.position.y += .6 * Math.sin(hop * Math.PI);
  wukong.pose({ t, tail:2, up:out < 1 ? 1 : fly > 0 ? .3 : 0, crouch:hop > 0 && hop < 1 ? .9 : fly > 0 ? .3 : out >= 1 ? .3 * Math.max(0, 1 - (t - 1.7) * 2.5) + (t > 2.6 ? .4 : 0) : 0,
    sway:fly > 0 ? Math.sin(t * 7) * .1 : 0, head:[t > 1.8 && t < 2.9 ? -.5 : 0, 0], lean:fly * .4 });
  // the second: out from behind the stone, a look around
  const come = smooth(seg(t, 5.2, 6.6));
  me.visible = t > 5.1; me.position.lerpVectors(A(-1.55, 0, 1.25), SPOT, come); me.rotation.set(0, .9, 0);
  { const mv = come > 0 && come < 1; me.position.y = mv ? Math.abs(Math.sin(t * 9)) * .06 : 0;
    me.pose({ t, tail:1.5, ph:t * 9, stride:mv ? .9 : 0, lean:mv ? .3 : .05, crouch:mv ? .25 : .1, armFwd:mv ? .3 : .15, sway:mv ? Math.sin(t * 9) * .1 : 0,
      head:[mv ? -.2 : 0, come >= 1 ? Math.sin((t - 6.6) * 3.6) * .8 * (1 - seg(t, 7.6, 8.1)) : 0] }); }
  stone.camera.position.set(-.6, 1.1, 7.8); stone.camera.lookAt(lookAtDoor);
  once(t, .8, "boom", sfx.boom); once(t, 1.9, "cloud", () => { sfx.whoosh(1); sfx.shimmer(); }); once(t, 2.9, "hop", () => sfx.whoosh(.4)); once(t, 3.5, "fly", () => { sfx.whoosh(1.2); sfx.shimmer(); });
  if (t > 1.0 && t < 1.1) note("The first one burst out.", false, 2);
  if (t > 3.5 && t < 3.6) note("He rode a cloud down into the underworld.", false, 2.4);
  if (t > 6.2 && t < 6.3) note("The second came out a little later.", false, 2);
  if (t > 8.2) choose();
}
function choose() {
  state = "choose"; wukong.visible = ride.visible = false; me.visible = true; me.position.copy(SPOT); me.rotation.set(0, .9, 0);
  ask(waits ? "" : "<p>He could only walk.</p>", [{ label:"Wait", go:() => { show("end", false); state = "wait"; tW = 0; note(WAITS[waits++ % WAITS.length], false, 3.2); } },
    { label:"Walk downstairs", go:() => { show("end", false); state = "walkin"; tW = 0; } }]);
}
function idle(dt) {            // waiting by the stone, or walking to the door
  tW += dt;
  if (state === "wait") { const a = smooth(seg(tW, 0, .45)) * (1 - smooth(seg(tW, 3.0, 3.5)));      // scratching his head
    me.pose({ t:clock, tail:1.6, sway:Math.sin(clock * 1.6) * .06, crouch:.08, set:me.scratch(a, clock) });
    if (a > .6 && (scrT -= dt) <= 0) { scrT = .1; sfx.scratch(); } if (tW > 3.7) choose(); }
  else if (state === "walkin") {
    const g = smooth(seg(tW, .2, 4.4)); me.position.lerpVectors(SPOT, A(.05, 0, -7.4), g); me.rotation.y = Math.PI + (1 - seg(tW, .2, 1.2)) * (.9 - Math.PI);
    me.pose({ t:clock, ph:tW * 9.5, stride:1, lean:.3, crouch:.2, armFwd:.3, sway:Math.sin(tW * 9.5) * .1, tail:1.6, head:[-.2, 0] }); me.position.y = Math.abs(Math.sin(tW * 9.5)) * .07;
    stone.camera.position.set(-.6 + .65 * g, 1.1 - .15 * g, 7.8 - 5.6 * g); stone.camera.lookAt(lookAtDoor);
    if (Math.floor(tW * 3) !== Math.floor((tW - dt) * 3)) sfx.step(Math.floor(tW * 3));
    if (tW > 3.5) show("black"); if (tW > 4.6) startClimb();
  } else me.pose({ t:clock, tail:1.4, crouch:.1 + Math.sin(clock * 2.2) * .04, sway:Math.sin(clock * 1.1) * .07, armFwd:.15, head:[Math.sin(clock * .5) * .1, Math.sin(clock * .8) * .45, 0] });
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
const FOOT = A(0, Y(TOTAL) + .002, Z(TOTAL) + RUN / 2), DESK_AT = 3.7;     // where the stairs end; how far he walks to the desk
const bottom = deskSet(); bottom.position.copy(FOOT); climb.add(bottom);
const heads = [];
for (let i = 0; i < 13; i++) { const kind = i >= 10 ? "red" : i % 2 ? "white" : "black", o = eroHead(headSrc, kind === "black", LANE * 1.02, kind === "red"); o.visible = false; climb.add(o);
  heads.push({ o, kind, on:false, s:0, lane:0, v:0, spin:0, spent:false }); }
const climbCam = new THREE.PerspectiveCamera(70, aspect, .1, 200); cams.push(climbCam);

let p = 0, maxP = 0, lane = 0, x = 0, told = 0, waveIn = 2.8, safe = 0, pushed = 0, carrier = null, hits = 0, camX = 0, tClimb = 0, az = 0, asked = false, boost = 0, reds = 0, lastStep = 0;
const depth = () => clamp(p / TOTAL, 0, 1);
function spawn() {
  const d = depth(), red = Q.has("red") || Math.random() < RED, two = !red && Math.random() < mix(TWO, d), lanes = [-1, 0, 1].sort(() => Math.random() - .5).slice(0, two ? 2 : 1), v = mix(HEAD, d) * (.9 + Math.random() * .25);
  for (const l of lanes) {
    const kind = red ? "red" : Math.random() < .5 ? "black" : "white", h = heads.find(h => !h.on && h.kind === kind) || (!red && heads.find(h => !h.on && h.kind !== "red")); if (!h) return;
    Object.assign(h, { on:true, s:p + 54 + Math.random() * 3, lane:l, v, spin:Math.random() * 6, spent:false }); h.o.visible = true;
  }
}
let rollT = 1, rollDir = 0, rollLen = .3;
function step(dir) { if (state !== "climb" || pushed) return; const to = clamp(lane + dir, -1, 1);
  if (to !== lane) { lane = to; rollT = 0; rollDir = dir; rollLen = 4.2 / mix(SIDE, depth()); sfx.roll(); } }
/* the white ones: once a head has carried him up, they come down behind him and try to take him back */
const pack = [], chase = { on:false, gap:20, lunges:0, next:0, cur:null, seen:false };
for (let i = 0; i < 6; i++) { const o = sun(sunSrc, .95, { white:true }); o.visible = false; climb.add(o);
  pack.push({ o, x0:((i % 3) - 1) * LANE * .95 + (Math.random() - .5) * .25, ds:2.3 + Math.floor(i / 3) * 1.25 + Math.random() * .5, ph:Math.random() * 6, mode:"run", ls:0, x:0, w:0, s:0, tl:0 }); }
function startChase() {
  if (state !== "climb") return; Object.assign(chase, { on:true, gap:16, lunges:0, next:2.4, cur:null });
  for (const m of pack) { m.mode = "run"; m.o.visible = true; m.x = m.x0; } sfx.chatter(6);
  if (!chase.seen) { chase.seen = true; setTimeout(() => note("The white ones want him back.", false, 2.8), 500); }
}
function endChase() { chase.on = false; }          // they fall behind
function hidePack() { chase.on = false; chase.gap = 20; chase.cur = null; for (const m of pack) if (m !== carrier) { m.o.visible = false; m.mode = "run"; } }
function packTick(dt) {
  if (chase.on) chase.gap = Math.max(0, chase.gap - 13 * dt); else if (chase.gap < 20) { chase.gap += 8 * dt; if (chase.gap >= 20 && !chase.cur) hidePack(); }
  if (!pack.some(m => m.o.visible)) return;
  if (chase.on && !chase.cur && !pushed && !boost && chase.gap < .5 && (chase.next -= dt) <= 0) {     // one of them goes for him
    const c = pack.filter(m => m.mode === "run" && m.o.visible);
    if (chase.lunges >= 4 || !c.length) endChase();
    else { const m = c[Math.floor(Math.random() * c.length)]; m.mode = "wind"; m.w = 0; m.tl = Math.random() < .7 ? lane : Math.floor(Math.random() * 3) - 1; chase.cur = m; chase.lunges++; chase.next = 1.5; sfx.screech(); }
  }
  if (chase.gap < 6 && Math.random() < dt * 1.3) sfx.chatter(2 + Math.floor(Math.random() * 3));
  for (const m of pack) if (m.o.visible) { const o = m.o;
    if (m.mode === "run") { m.s = p - m.ds - chase.gap; const ph = m.s * Math.PI + m.ph; m.x += (m.x0 - m.x) * Math.min(1, dt * 4);
      o.position.set(m.x + Math.sin(tClimb * 1.3 + m.ph) * .1, Y(m.s) + Math.abs(Math.sin(ph)) * .1, Z(m.s)); o.rotation.set(0, Math.PI, 0);
      o.pose({ t:tClimb + m.ph, tail:2, ph, stride:1.15, lean:.45, crouch:.25, armFwd:.75, sway:Math.sin(ph) * .12, head:[-.35, 0] }); }
    else if (m.mode === "wind") { m.w += dt; m.s = p - m.ds; m.x += (m.tl * LANE - m.x) * Math.min(1, dt * 9);       // rears up in the lane it will take
      o.position.set(m.x, Y(m.s) + .1, Z(m.s)); o.rotation.set(.25, Math.PI, 0); o.pose({ t:tClimb, tail:3, up:1, crouch:.6, head:[-.4, 0] });
      if (m.w > .55) { m.mode = "lunge"; m.ls = -m.ds; } }
    else if (m.mode === "lunge") { m.ls += 21 * dt; m.s = p + m.ls; const f = clamp((m.ls + m.ds) / (m.ds + 1), 0, 1);
      o.position.set(m.x, Y(m.s) + .25 + Math.sin(f * Math.PI) * .7, Z(m.s)); o.rotation.set(-.9, Math.PI, 0); o.pose({ t:tClimb, tail:3, up:1, lean:.3, crouch:.2 });
      if (state === "climb" && !pushed && !boost && !safe && Math.abs(m.ls) < .8 && Math.abs(m.x - x) < .5) {      // got him
        for (const k of pack) if (k !== m) { k.o.visible = false; k.mode = "run"; }
        carrier = m; m.mode = "carry"; m.release = () => { m.mode = "run"; m.o.visible = false; chase.gap = 20; }; pushed = PUSH; hits++; chase.cur = null; chase.on = false;
        note(`■ ${PUSH} steps back up`, true, 1.9); sfx.grab(); }
      else if (m.ls > 9) { m.mode = "run"; o.visible = false; if (chase.cur === m) chase.cur = null; } }
    else if (m.mode === "carry") { o.position.set(x, Y(p) + .1, Z(p) + .2); o.rotation.set(0, 0, 0); o.pose({ t:tClimb, tail:2, ph:tClimb * 20, stride:1.1, lean:.3, crouch:.2, up:.5 }); }
  }
}
const camPos = A(0, 0, 0), camAim = A(0, 0, 0), v1 = A(0, 0, 0), v2 = A(0, 0, 0);
function climbTick(dt) {
  tClimb += dt; const d = depth(), arriving = state === "arrive";
  if (arriving) { lane = 0; az = Math.min(DESK_AT, az + 1.5 * dt); }
  else if (pushed > 0) {       // a head has you: back up the stairs
    const back = Math.min(pushed, 34 * dt, p); p -= back; pushed -= back; carrier.s = p + .85;
    if (pushed <= .001 || p <= 0) { pushed = 0; const c = carrier; carrier = null; safe = 1.5; c.release(); }
  } else if (boost > 0) {      // a red head: thrown forward
    const f = Math.min(boost, 44 * dt); p += f; boost -= f; safe = Math.max(safe, .8);
  } else p += mix(WALK, d) * dt;
  if (!arriving && p >= TOTAL) { p = TOTAL; boost = 0; state = "arrive"; show("line", false); hidePack(); sfx.gong(); }
  { const k = Math.floor(arriving ? az * 2.2 : p); if (k !== lastStep) { lastStep = k; if (!pushed && !boost && rollT >= 1 && (!arriving || az < DESK_AT)) sfx.step(k); } }
  maxP = Math.max(maxP, p); safe = Math.max(0, safe - dt);
  x += (lane * LANE - x) * Math.min(1, dt * mix(SIDE, d));

  if (!arriving && !pushed && TOTAL - p > 62 && (waveIn -= dt) <= 0) { spawn(); waveIn = mix(EVERY, d) * (.8 + Math.random() * .4) * (chase.on ? 1.5 : 1); }
  for (const h of heads) if (h.on) {
    if (h !== carrier) h.s -= h.v * dt;
    h.spin += h.v * dt * RUN / (LANE * .5);
    h.o.position.set(h.lane * LANE, Y(h.s) + .46 + Math.abs(Math.sin(h.s * Math.PI)) * .09, Z(h.s)); h.o.rotation.set(h.spin, 0, Math.sin(h.spin * .37) * .25);
    if (!arriving && !pushed && !h.spent && Math.abs(h.s - p) < .75 && Math.abs(h.lane * LANE - x) < .5) {
      if (h.kind === "red") { if (!boost) { h.on = false; h.o.visible = false; boost = BOOST; reds++; rollT = 1; note(`■ ${BOOST} steps ahead`, true, 1.6); sfx.boost(); endChase(); } }
      else if (!safe) { hidePack(); carrier = h; h.release = () => { h.spent = true; startChase(); }; pushed = PUSH; hits++; lane = h.lane; note(`■ ${PUSH} steps back up`, true, 1.9); sfx.hit(); }
    }
    if (h.s < p - UP + 1) { h.on = false; h.o.visible = false; }
  }
  packTick(dt);

  // him
  me.visible = boost > 0 || !safe || Math.floor(safe * 12) % 2 === 0;
  const off = lane * LANE - x;
  rollT = Math.min(1, rollT + dt / rollLen);
  if (pushed) { me.position.set(x, Y(p) + .55 + Math.sin(tClimb * 9) * .08, Z(p) + .55); me.rotation.set(.95 + Math.sin(tClimb * 7) * .35, Math.PI, Math.sin(tClimb * 5) * .3);
    me.pose({ t:tClimb, tail:3, up:.6 + .4 * Math.sin(tClimb * 13), ph:tClimb * 18, stride:1, crouch:.3 }); }
  else if (arriving) { const mv = az < DESK_AT; me.position.set(x, FOOT.y + (mv ? Math.abs(Math.sin(az * 6)) * .05 : 0), FOOT.z - az); me.rotation.set(0, Math.PI, 0);
    me.pose({ t:tClimb, tail:1.5, ph:az * 6, stride:mv ? .9 : 0, lean:mv ? .25 : 0, crouch:mv ? .2 : .08, armFwd:mv ? .3 : .1, sway:mv ? Math.sin(az * 6) * .09 : 0, head:[mv ? -.15 : -.5, mv ? 0 : Math.sin(tClimb * .9) * .2] }); }
  else if (boost > 0) { const f = 1 - boost / BOOST;      // the leap off a red head
    me.position.set(x, Y(p) + .3 + Math.sin(f * Math.PI) * 1.15, Z(p)); me.rotation.set(-1.05 + f * .7, Math.PI, 0); me.pose({ t:tClimb, tail:3, up:1, lean:.25, crouch:.15 }); }
  else if (rollT < 1) {         // a roll to the side: tucked, once around his own middle
    const r = smooth(rollT), turn = -rollDir * Math.PI * 2 * r, mid = .45;
    me.position.set(x + mid * Math.sin(turn), Y(p) + mid * (1 - Math.cos(turn)) + Math.sin(rollT * Math.PI) * .22, Z(p)); me.rotation.set(0, Math.PI, -turn);
    me.pose({ t:tClimb, tail:3, crouch:.85, up:.35, lean:.5, head:[.4, 0] });
  } else {                       // the lope: hunched, long arms, a bounce on every step
    const ph = p * Math.PI, b = Math.abs(Math.sin(ph));
    me.position.set(x, Y(p) + b * .11, Z(p)); me.rotation.set(0, Math.PI - off * .5, -off * .3);
    me.pose({ t:tClimb, tail:1.8, ph, stride:1.15, lean:.4, crouch:.2 + .1 * (1 - b), armFwd:.35, sway:Math.sin(ph) * .11, head:[-.3, 0] });
  }

  const k = Math.floor(p); stairs.position.set(0, Y(k), Z(k));
  camX += (x * .28 - camX) * Math.min(1, dt * 4);
  camPos.set(camX, Y(p) + 4.3, Z(p) + 2.3); camAim.set(camX * .6, Y(p + 6), Z(p + 6));
  if (arriving) { const g = smooth(az / DESK_AT);       // come down behind his shoulder and look up at the clerk
    camPos.lerp(v1.set(.55, FOOT.y + 1.2, FOOT.z - az + 2.5), g); camAim.lerp(v2.set(0, FOOT.y + 2.0, FOOT.z - 6.4), g); }
  climbCam.position.copy(camPos); climbCam.lookAt(camAim);

  $("step").textContent = "Step " + Math.floor(p).toLocaleString("en");
  while (told < STORY.length && maxP >= lineAt(told)) line(STORY[told++]);
  if (arriving && az >= DESK_AT && !asked) { asked = true; setTimeout(atTheDesk, 700); }
}
const climbLook = () => ({ fog:.034 + .014 * depth() - .02 * (az / DESK_AT), fogInk:.93, far:30, light:[.1, .9, .5], seed:5 });

/* ---------- the last desk ---------- */
let t0 = performance.now();
const tally = () => { const mins = Math.max(1, Math.round((performance.now() - t0) / 60000));
  return `<small style="margin-top:10px">${TOTAL.toLocaleString("en")} steps · carried back up ${hits} ${hits === 1 ? "time" : "times"} · ${mins} min</small>`; };
const leave = [{ label:"Read the scroll", href:"../" }, { label:"Walk down again", href:"?skip" }];
function atTheDesk() {
  show("step", false);
  ask(`<small>Clerk of the dead</small><p>“Your brother crossed you out.”</p>`, [{ label:"Write my name back in", go:writeName }, { label:"When is lunch?", go:lunch }]);
}
// the Book is kept in Supabase: a name written here appears on the scroll page
const SB_URL = "https://csvxfyzgvhfvrmkejaqk.supabase.co", SB_KEY = "sb_publishable_8uAUu5iuA6EPY9-nWNxJig_sI5tAivl";     // publishable: meant to sit in page code
let sb = null, ate = false;
const esc = s => s.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
async function signBook(name) {
  sb ||= import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm").then(({ createClient }) => createClient(SB_URL, SB_KEY));
  const id = crypto.randomUUID(), { error } = await (await sb).from("book_names").insert({ id, name, steps:TOTAL, carried:hits, minutes:Math.max(1, Math.round((performance.now() - t0) / 60000)), lunch:ate });
  if (error) throw error; try { localStorage.setItem("walk-name-id", id); } catch {}
}
function writeName() {
  ask(`<small>Clerk of the dead</small><p>“Why would you do that?”</p>`, [{ label:"I want to know how it ends.", go:takePen }]);
}
function takePen(hint) {
  ask(`<p>${hint || "He took the pen."}</p><input id="nm" maxlength="40" placeholder="your name" autocomplete="off" autocapitalize="words" spellcheck="false" aria-label="Your name">`,
    [{ label:"Write it in the Book", go:sign }, { label:"Leave the line empty", go:() => { sfx.name(); ask(`<p>He wrote his name back in.</p><p>He kept the pen.</p>${tally()}`, leave); } }]);
  const nm = $("nm"); nm.onkeydown = e => { e.stopPropagation(); if (e.key === "Enter") sign(); }; if (!matchMedia("(pointer:coarse)").matches) nm.focus();
}
let signing = false;
async function sign() {
  const name = ($("nm")?.value || "").replace(/\s+/g, " ").trim().slice(0, 40); if (signing) return; if (!name) return takePen("The line is still empty.");
  signing = true; $("end").querySelectorAll("button").forEach(b => b.disabled = true);
  let ok = true; try { await signBook(name); } catch (e) { ok = false; }
  signing = false; sfx.name();
  ask(ok ? `<p>${esc(name)} is back in the Book.</p><p>He kept the pen.</p>${tally()}` : `<p>The Book would not open just now, so the name was not saved.</p><p>He kept the pen anyway.</p>${tally()}`,
    ok ? [{ label:"See your name on the scroll", href:"../#book" }, leave[1]] : [{ label:"Try again", go:() => takePen() }, ...leave]);
}
function lunch() {
  sfx.rice(); ate = true;
  ask(`<p>The clerk looked up. In all his years, nobody had asked.</p><p>“There is rice,” he said.</p>`, [{ label:"Eat", go:() =>
    ask(`<p>They ate. The name could wait.</p>${tally()}`, [{ label:"Write my name back in", go:writeName }, ...leave]) }]);
}

/* ---------- running it ---------- */
let state = "closed";
function startClimb() {
  if (state === "climb") return;
  climb.add(me); me.visible = true; state = "climb"; p = maxP = +Q.get("at") || 0; told = 0; while (told < STORY.length && lineAt(told) < p) told++;
  show("black", false); show("step"); show("note", false); show("end", false); t0 = performance.now();
  setTimeout(() => { if (!hits && state === "climb") note(matchMedia("(pointer:coarse)").matches ? "Swipe or tap a side to step aside" : "← → to step aside", false, 4.5); }, 2600);
}
function open() {
  if (state !== "closed") return;
  document.body.classList.add("open"); state = "opening"; sfx.start(); sfx.whoosh(1.6);
  setTimeout(() => { if (state === "opening") { state = "intro"; tI = 0; } }, 1500);
}
$("load").style.opacity = 0; $("closedHint").textContent = matchMedia("(pointer:coarse)").matches ? "Tap to open" : "Click to open";

const muteBtn = $("mute"), muteText = () => muteBtn.textContent = sfx.muted ? "Sound off" : "Sound on"; muteText();
muteBtn.onclick = () => { sfx.start(); sfx.mute(!sfx.muted); muteText(); muteBtn.blur(); };
addEventListener("keydown", e => {
  sfx.start();
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") step(-1);
  else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") step(1);
  else if ((e.key === " " || e.key === "Enter") && state === "closed") open();
});
let downX = null;
addEventListener("pointerdown", e => { sfx.start(); if (e.target.closest("a,button,input")) return; downX = e.clientX;
  if (state === "closed") open(); else if (state === "intro" && tI > .6) tI = Math.max(tI, 8.2); });
addEventListener("pointerup", e => { if (downX === null) return; const dx = e.clientX - downX; downX = null;
  if (Math.abs(dx) > 22) step(Math.sign(dx)); else { const r = view.getBoundingClientRect(); step(e.clientX < r.left + r.width / 2 ? -1 : 1); } });

if (Q.has("open")) open();
if (Q.has("skip") || Q.has("at") || Q.has("end")) { document.body.classList.add("open"); state = "opening"; setTimeout(() => { startClimb(); if (Q.has("end")) p = TOTAL - 8; if (Q.has("chase")) setTimeout(startChase, 900); }, 350); }
if (Q.has("ti")) { document.body.classList.add("open"); state = "freeze"; intro(+Q.get("ti")); }   // look at one moment of the opening

// ?pose=scratch|lope|roll|idle|carried : one pose up close, to look at the rig
function posePreview() {
  const k = Q.get("pose"), f = +(Q.get("f") ?? .5), ry = +(Q.get("ry") ?? .5); me.visible = true; me.position.set(-.35, 0, 2.75); me.rotation.set(0, ry, 0);
  if (k === "scratch") me.pose({ t:clock, tail:1.6, crouch:.08, set:me.scratch(1, clock) });
  else if (k === "lope") { const ph = f * Math.PI * 2; me.pose({ t:clock, tail:1.8, ph, stride:1.15, lean:.4, crouch:.25, armFwd:.35, sway:Math.sin(ph) * .11, head:[-.3, 0] }); }
  else if (k === "roll") { const turn = -Math.PI * 2 * f; me.position.x += .45 * Math.sin(turn); me.position.y = .45 * (1 - Math.cos(turn)); me.rotation.set(0, Math.PI, -turn); me.pose({ t:clock, tail:3, crouch:.85, up:.35, lean:.5, head:[.4, 0] }); }
  else if (k === "carried") { me.position.y = .5; me.rotation.set(.95, Math.PI, 0); me.pose({ t:clock, tail:3, up:1, ph:f * 6, stride:1, crouch:.3 }); }
  else me.pose({ t:clock, tail:1.4, crouch:.1, armFwd:.15 });
  stone.camera.position.set(-.35, .7, 4.5); stone.camera.lookAt(-.35, .55, 2.75);
}
if (Q.has("pose")) { document.body.classList.add("open"); state = "pose"; intro(0); }

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
  sfx.air(state === "climb" || state === "arrive", depth());
  if (noteT > 0 && (noteT -= dt) <= 0) show("note", false);
  if (lineT > 0 && (lineT -= dt) <= 0) show("line", false);
  if (state === "intro") intro(tI += dt);
  else if (state === "choose" || state === "wait" || state === "walkin") idle(dt);
  if (state === "climb" || state === "arrive") { climbTick(dt); ink.render(climb, climbCam, climbLook()); }
  else { if (state === "closed" || state === "opening") intro(0); if (state === "pose") posePreview(); ink.render(stone.scene, stone.camera, stone.look); }
}
requestAnimationFrame(frame);
