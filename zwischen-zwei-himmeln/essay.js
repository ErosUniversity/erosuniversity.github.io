import * as THREE from "three";
import { drawKid } from "./kid.js";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

// --- cut to black: dusk until the title card, night after ---------------------------
const titlecard = $("titlecard");
function updateTheme() {
  const r = titlecard.getBoundingClientRect();
  const dark = r.top < innerHeight * 0.3;          // only once the reader has passed "Schnitt auf Schwarz"
  document.body.classList.toggle("dark", dark);
  titlecard.querySelector("p").classList.toggle("in", dark && r.bottom > innerHeight * 0.2);
}
addEventListener("scroll", updateTheme, { passive: true });
updateTheme();

// =====================================================================================
// the swarm: one flock for the whole page
// =====================================================================================
const N = innerWidth < 700 ? 2600 : 5200;
const canvas = $("swarm");
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

const pos = new Float32Array(N * 2), vel = new Float32Array(N * 2);
const base = new Float32Array(N * 2);      // each bird's place inside the flock, unit-ish disc
const kid = new Float32Array(N * 2);       // each bird's place inside the boy, normalised
const geo = new THREE.BufferGeometry();
const posAttr = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
const seed = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.6);
  base[i * 2] = Math.cos(a) * r; base[i * 2 + 1] = Math.sin(a) * r;
  seed[i] = Math.random();
  pos[i * 2] = (Math.random() - 0.5) * 3000; pos[i * 2 + 1] = (Math.random() - 0.5) * 600 - 900;
}
geo.setAttribute("position", posAttr);
geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));

// birds for the boy come from the same drawing as section IV, sampled once
(() => {
  const c = document.createElement("canvas"); c.width = 400; c.height = 600;
  const ctx = c.getContext("2d"); ctx.fillStyle = ctx.strokeStyle = "#fff";
  drawKid(ctx, true);
  const data = ctx.getImageData(0, 0, 400, 600).data;
  const filled = [];
  for (let y = 0; y < 600; y += 2) for (let x = 0; x < 400; x += 2) if (data[(y * 400 + x) * 4 + 3] > 128) filled.push(x, y);
  for (let i = 0; i < N; i++) {
    const k = (Math.random() * filled.length / 2 | 0) * 2;
    kid[i * 2] = (filled[k] + Math.random() * 2 - 200) / 600;
    kid[i * 2 + 1] = (filled[k + 1] + Math.random() * 2 - 330) / 600;
  }
})();

const material = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uColor: { value: new THREE.Color("#1d191a") }, uSize: { value: 2.4 * renderer.getPixelRatio() }, uOpacity: { value: 1 } },
  vertexShader: `
    attribute float seed; uniform float uSize;
    void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * (0.6 + seed * 0.9); }`,
  fragmentShader: `
    uniform vec3 uColor; uniform float uOpacity;
    void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor, uOpacity * smoothstep(0.5, 0.2, d)); }`,
});
scene.add(new THREE.Points(geo, material));

let W = innerWidth, H = innerHeight;
function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  Object.assign(camera, { left: -W / 2, right: W / 2, top: H / 2, bottom: -H / 2 });
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// cheap smooth flow field so the flock churns instead of sliding
const flow = (x, y, t) => [
  Math.sin(y * 0.0061 + t * 0.9) + Math.sin(y * 0.013 - t * 0.4 + x * 0.004) * 0.6,
  Math.cos(x * 0.0057 - t * 0.7) + Math.cos(x * 0.011 + t * 0.5 - y * 0.003) * 0.6,
];

// where is the reader?
const hero = $("hero"), s1 = $("s1"), ending = $("ending");
const inView = (el, margin = 0) => { const r = el.getBoundingClientRect(); return r.bottom > -margin && r.top < innerHeight + margin; };

let holding = false, autoKid = 0;   // autoKid: seconds left of the one-time demonstration
let endingSeen = false;
const colorDusk = new THREE.Color("#1d191a"), colorNight = new THREE.Color("#C9B47E");

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  const atEnd = inView(ending, -innerHeight * 0.35);
  const atStart = inView(hero) || inView(s1, -innerHeight * 0.2);

  let mode = "away";
  if (atEnd) mode = holding || autoKid > 0 ? "kid" : "flock";
  else if (inView(hero)) mode = "flock";
  else if (atStart) mode = "pass";

  if (atEnd && !endingSeen) { endingSeen = true; autoKid = reducedMotion ? 0 : 4.5; setTimeout(() => ending.classList.add("hinted"), 6500); }
  autoKid = Math.max(0, autoKid - dt);

  // flock centre and size per mode
  let cx = 0, cy = 0, R = Math.min(W, H) * 0.3, k = 1.5, noise = 70, damp = 1.6;
  if (mode === "flock") {
    cx = Math.sin(t * 0.13) * W * 0.22;
    cy = Math.cos(t * 0.17) * H * 0.12 + (atEnd ? -H * 0.08 : H * 0.12);
  } else if (mode === "pass") {
    // the flock crosses the page over the text, turns somewhere off-screen, crosses back
    const ph = (t * 0.045) % 2, s = ph < 1 ? ph : 2 - ph;
    cx = (s * 2.6 - 1.3) * W * 0.5;
    cy = Math.sin(t * 0.21) * H * 0.18;
    R = Math.min(W, H) * 0.2;
  } else if (mode === "away") {
    cx = -W * 1.4; cy = H * 0.3; k = 0.8;
  } else if (mode === "kid") {
    k = 7; noise = 12; damp = 4.5;
  }

  // breathing, folding shape of the murmuration
  const rot = t * 0.11 + Math.sin(t * 0.07) * 2.2;
  const sx = 1 + 0.55 * Math.sin(t * 0.23), sy = 0.42 + 0.22 * Math.cos(t * 0.31);
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const kidH = H * 0.66, kidY = -H * 0.1;

  const out = posAttr.array;
  for (let i = 0; i < N; i++) {
    const j = i * 2;
    let tx, ty;
    if (mode === "kid") {
      tx = kid[j] * kidH; ty = -kid[j + 1] * kidH + kidY;
    } else {
      let bx = base[j] * sx, by = base[j + 1] * sy;
      bx += Math.sin(base[j + 1] * 3 + t * 0.5) * 0.22;
      tx = cx + R * (bx * cr - by * sr);
      ty = cy + R * (bx * sr + by * cr);
    }
    const [fx, fy] = flow(pos[j], pos[j + 1], t);
    vel[j]     += ((tx - pos[j]) * k + fx * noise) * dt;
    vel[j + 1] += ((ty - pos[j + 1]) * k + fy * noise) * dt;
    const d = Math.exp(-damp * dt);
    vel[j] *= d; vel[j + 1] *= d;
    pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt;
    out[i * 3] = pos[j]; out[i * 3 + 1] = pos[j + 1];
  }
  posAttr.needsUpdate = true;

  material.uniforms.uColor.value.lerp(document.body.classList.contains("dark") ? colorNight : colorDusk, 0.05);
  const targetOpacity = mode === "away" ? 0 : 1;
  material.uniforms.uOpacity.value += (targetOpacity - material.uniforms.uOpacity.value) * 0.03;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// hold anywhere at the end to see the boy
const holdOn = () => { if (inView(ending, -innerHeight * 0.35)) holding = true; };
const holdOff = () => { holding = false; };
ending.addEventListener("pointerdown", holdOn);
addEventListener("pointerup", holdOff);
addEventListener("pointercancel", holdOff);
addEventListener("keydown", (e) => { if (e.code === "Space" && inView(ending, -innerHeight * 0.35)) { holding = true; e.preventDefault(); } });
addEventListener("keyup", (e) => { if (e.code === "Space") holding = false; });
ending.addEventListener("contextmenu", (e) => e.preventDefault());

// =====================================================================================
// II. read between the lines: the gaps open and what isn't said shows up in them
// =====================================================================================
const between = $("between");
const FRAGMENTS = ["keine Eltern", "keine Aufsicht", "keine Erwachsenen", "keine ordnende Instanz", "sich selbst überlassen", "sich selbst sein dürfen", "keine Eltern im Bild"];
(() => {
  // wrap words so we can find where the lines break
  const words = between.textContent.trim().split(/\s+/);
  between.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(" ");
  let frags = [];
  function place() {
    frags.forEach((f) => f.remove()); frags = [];
    const tops = [];
    for (const w of between.querySelectorAll(".w")) {
      const top = w.offsetTop, last = tops[tops.length - 1];
      if (!last || top > last.top + 4) tops.push({ top, h: w.offsetHeight });
    }
    for (let i = 0; i < tops.length - 1; i++) {
      const f = document.createElement("span");
      f.className = "frag"; f.textContent = FRAGMENTS[i % FRAGMENTS.length];
      const gapMid = (tops[i].top + tops[i].h + tops[i + 1].top) / 2;
      f.style.top = `${gapMid - 7}px`;
      f.style.left = `${8 + ((i * 37) % 55)}%`;
      between.append(f); frags.push(f);
      setTimeout(() => f.classList.add("in"), 200 + i * 260);
    }
  }
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || between.classList.contains("open")) return;
    between.classList.add("open");
    setTimeout(place, reducedMotion ? 0 : 1700);
    addEventListener("resize", () => { clearTimeout(place.t); place.t = setTimeout(place, 200); });
  }, { threshold: 0.7 }).observe(between);
})();

// =====================================================================================
// III. the boa: from outside a hat; read on (or tap) and you see the two boys inside
// =====================================================================================
const prince = $("prince");
let princeTapped = null;
addEventListener("scroll", () => {
  if (princeTapped !== null) return;
  const r = prince.getBoundingClientRect();
  const p = 1 - (r.top + r.height / 2) / innerHeight;    // 0 entering bottom .. 1 leaving top
  prince.classList.toggle("inside", p > 0.5);
}, { passive: true });
prince.addEventListener("click", () => { princeTapped = !prince.classList.contains("inside"); prince.classList.toggle("inside", princeTapped); });

// =====================================================================================
// IV. two heads, mirrored, one label too many
// =====================================================================================
const twins = $("twins");
const kids = [...twins.querySelectorAll(".kid")];
const prompt = $("twins-prompt");
let slots = [0, 1], shuffling = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the head looks left; whoever stands on the left is mirrored, so the two always face each other
function layout() {
  kids.forEach((k, i) => {
    const onLeft = (slots[i] === i ? i : 1 - i) === 0;
    k.style.transform = `translateX(${slots[i] === i ? 0 : (i === 0 ? 117 : -117)}%)`;
    k.querySelector(".face").style.transform = onLeft ? "scaleX(-1)" : "none";
  });
}
layout();
async function playTwins() {
  if (shuffling) return; shuffling = true;
  twins.classList.remove("answered", "ask", "hide-labels");
  kids.forEach((k) => { k.querySelector("span").textContent = k.dataset.label; });
  prompt.textContent = "";
  await sleep(2200);
  twins.classList.add("hide-labels");
  await sleep(700);
  for (let n = 0; n < (reducedMotion ? 1 : 7); n++) { slots.reverse(); layout(); await sleep(reducedMotion ? 0 : 470); }
  prompt.textContent = "Welches ist welches?";
  twins.classList.add("ask");
  shuffling = false;
}
kids.forEach((k) => k.addEventListener("click", () => {
  if (!twins.classList.contains("ask")) return;
  twins.classList.remove("ask", "hide-labels");
  twins.classList.add("answered");
  kids.forEach((kk) => { kk.querySelector("span").textContent = "Kind"; });
  prompt.textContent = "Beide sehen gleich aus.";
}));
$("twins-again").addEventListener("click", playTwins);
new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { obs.disconnect(); playTwins(); } }, { threshold: 0.6 }).observe(twins);

// =====================================================================================
// stages load their own scenes when they get close, and only draw while visible
// =====================================================================================
function lazyStage(stageId, load) {
  const el = $(stageId);
  let api = null;
  new IntersectionObserver(async ([e]) => {
    if (e.isIntersecting && !api) api = await load();
    if (api) api.setActive(e.isIntersecting);
  }, { rootMargin: "60% 0px" }).observe(el);
}
lazyStage("mirror-stage", async () => (await import("./mirror.js")).mount($("mirror")));
lazyStage("wind-stage", async () => (await import("./wind.js")).mount($("wind")));

// =====================================================================================
// counters: visitors at the top, and the rating that never stops counting.
// GitHub Pages can't store anything, so the numbers live in a free public counter (Abacus).
// =====================================================================================
const COUNTER = "https://abacus.jasoncameron.dev";
const NS = "erosuniversity";
const FIRST = 7;                                   // the first rating: 7 of 10
const call = (verb, key) => fetch(`${COUNTER}/${verb}/${NS}/${key}`).then((r) => r.json()).then((j) => Math.max(j.value ?? 0, 0)).catch(() => null);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

// visitors: each browser is counted once
(async () => {
  const seen = store.get("eros.zzh.visited");
  const n = await call(seen ? "get" : "hit", "zwei-himmeln-visitors");
  if (n === null) return;
  if (!seen) store.set("eros.zzh.visited", "1");
  const box = $("visits"), digits = $("visits-digits");
  box.hidden = false;
  const show = (v) => { digits.replaceChildren(...String(v).padStart(6, "0").split("").map((d) => Object.assign(document.createElement("span"), { textContent: d }))); };
  if (reducedMotion) return show(n);
  const t0 = performance.now(), dur = 1600;
  (function roll(now) { const p = Math.min((now - t0) / dur, 1); show(Math.round(n * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(roll); })(t0);
})();

// rating in Eros heads
const headSvg = (on) => `<svg viewBox="0 0 675 675" class="${on ? "" : "off"}" aria-hidden="true"><use href="#eros-head" style="--hw:#ffffff;--hl:#cfcdcc;--hd:#5a5758"/></svg>`;
$("heads-first").innerHTML = Array.from({ length: 10 }, (_, i) => headSvg(i < FIRST)).join("");

const vote = $("heads-vote"), tally = $("tally");
const voted = Number(store.get("eros.zzh.vote")) || 0;
vote.innerHTML = Array.from({ length: 10 }, (_, i) =>
  `<button type="button" role="radio" aria-checked="false" aria-label="${i + 1} von 10">${headSvg(false)}</button>`).join("");
const buttons = [...vote.querySelectorAll("button")];
const paint = (n) => buttons.forEach((b, i) => { b.firstElementChild.classList.toggle("off", i >= n); b.setAttribute("aria-checked", String(i + 1 === n)); });
paint(voted);
if (voted) vote.classList.add("voted");

const fmt = (x) => x.toFixed(1).replace(".", ",");
async function refreshTally() {
  const counts = await Promise.all(Array.from({ length: 10 }, (_, i) => call("get", `zwei-himmeln-rate-${i + 1}`)));
  if (counts.some((c) => c === null)) return;
  let n = 1, sum = FIRST;                          // the first rating counts too
  counts.forEach((c, i) => { n += c; sum += c * (i + 1); });
  tally.textContent = `Ø ${fmt(sum / n)} von 10 · ${n.toLocaleString("de-DE")} ${n === 1 ? "Bewertung" : "Bewertungen"}`;
}
refreshTally();

buttons.forEach((b, i) => {
  b.addEventListener("mouseenter", () => { if (!vote.classList.contains("voted")) paint(i + 1); });
  b.addEventListener("focus", () => { if (!vote.classList.contains("voted")) paint(i + 1); });
  b.addEventListener("click", async () => {
    if (vote.classList.contains("voted")) return;
    vote.classList.add("voted"); paint(i + 1);
    store.set("eros.zzh.vote", String(i + 1));
    await call("hit", `zwei-himmeln-rate-${i + 1}`);
    refreshTally();
  });
});
vote.addEventListener("mouseleave", () => { if (!vote.classList.contains("voted")) paint(0); });
