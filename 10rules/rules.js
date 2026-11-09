// Zehn Sätze biologischer Moral: a rule set in stone. Keep it, or hold to break it,
// read the context that rises from the rubble, then leave it or restore it with gold.
// The stone was fractured and dropped in Blender (blender trial/ten_stones/stone.py);
// here every shard flies between three poses: home, burst, rest.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

// the ten rules (text, context, source); stone k's shards are in assets/stone<k>.bin/json
const STONES = (await fetch("assets/rules.json").then((r) => r.json())).map((r, i) => ({ ...r, asset: `assets/stone${i + 1}` }));

// --- renderer, scene ---------------------------------------------------------------
const canvas = $("scene");
const PARAMS = new URLSearchParams(location.search);
const SIM = PARAMS.get("sim");                 // ?sim=keep|leave|restore&t=6: play to t seconds in fixed steps, render once
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!SIM });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 5.5, 11);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);

// warm studio for reflections only: the gold mirrors it, the stone barely
const pmrem = new THREE.PMREMGenerator(renderer);
const ENV = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = ENV; scene.environmentIntensity = 0.035;      // barely on the stone; the gold gets its own below

const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x030302, roughness: 0.7, metalness: 0, envMapIntensity: 0.02 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
scene.add(floor);

// key: rakes across the face from high left so the letters cast shadows (Blender: area at -2.7,-0.42,2.3)
const KEY = 38;
const key = new THREE.SpotLight(0xffdcb3, KEY, 12, 0.36, 0.85, 1.2);
key.position.set(-2.7, 2.3, 0.42);
key.target.position.set(0, 0.8, 0);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01;
key.shadow.camera.near = 1; key.shadow.camera.far = 8;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xc6d2ff, 0.5); rim.position.set(2, 2.4, -2.4); scene.add(rim);
const fill = new THREE.HemisphereLight(0xfff0dc, 0x000000, 0.03); scene.add(fill);

// --- materials ---------------------------------------------------------------------
const tl = new THREE.TextureLoader();
const LOADS = [];
const tex = (u, srgb) => {
  let done; LOADS.push(new Promise((r) => (done = r)));
  const t = tl.load(u, done, undefined, done); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
};
const STONE_ALB = tex("assets/stone_albedo.jpg", true), STONE_NRM = tex("assets/stone_normal.jpg");
const INNER_ALB = tex("assets/inner_albedo.jpg", true), INNER_NRM = tex("assets/inner_normal.jpg");

// triplanar in slab space ("home" = where this vertex sits in the unbroken stone), so the grain
// travels with every shard. Normals: whiteout blend of the baked normal map.
function stoneMaterial(alb, nrm, { tint = 1, rough = 0.8 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(tint, tint, tint), roughness: rough, metalness: 0, envMapIntensity: 0.04 });
  m.userData.hot = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tAlb = { value: alb }; sh.uniforms.tNrm = { value: nrm }; sh.uniforms.uHot = m.userData.hot;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
        attribute vec3 home; varying vec3 vHome; varying vec3 vObjN; varying vec3 vNX; varying vec3 vNY; varying vec3 vNZ;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vHome = home; vObjN = normal;
        vNX = normalMatrix * vec3(1.0, 0.0, 0.0); vNY = normalMatrix * vec3(0.0, 1.0, 0.0); vNZ = normalMatrix * vec3(0.0, 0.0, 1.0);`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform sampler2D tAlb; uniform sampler2D tNrm; uniform float uHot;
        varying vec3 vHome; varying vec3 vObjN; varying vec3 vNX; varying vec3 vNY; varying vec3 vNZ;
        vec2 tuv(vec2 p) { return vec2((p.x + 1.0) * 0.5, (p.y + 0.2) * 0.5); }
        vec3 triW(vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z); }`)
      .replace("#include <map_fragment>", `
        vec3 W = triW(vObjN);
        vec3 alb = texture2D(tAlb, tuv(vHome.zy)).rgb * W.x + texture2D(tAlb, tuv(vHome.xz)).rgb * W.y + texture2D(tAlb, tuv(vHome.xy)).rgb * W.z;
        diffuseColor.rgb *= alb;`)
      .replace("#include <normal_fragment_maps>", `
        {
          vec3 N = normalize(vObjN);
          vec3 tx = texture2D(tNrm, tuv(vHome.zy)).xyz * 2.0 - 1.0;
          vec3 ty = texture2D(tNrm, tuv(vHome.xz)).xyz * 2.0 - 1.0;
          vec3 tz = texture2D(tNrm, tuv(vHome.xy)).xyz * 2.0 - 1.0;
          vec3 nx = vec3(tx.xy + N.zy, abs(tx.z) * N.x).zyx;
          vec3 ny = vec3(ty.xy + N.xz, abs(ty.z) * N.y).xzy;
          vec3 nz = vec3(tz.xy + N.xy, abs(tz.z) * N.z);
          vec3 o = normalize(nx * W.x + ny * W.y + nz * W.z);
          normal = normalize(o.x * vNX + o.y * vNY + o.z * vNZ);
        }`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.36, 0.07) * uHot;`);
  };
  return m;
}
const STONE = stoneMaterial(STONE_ALB, STONE_NRM);
const CUT = stoneMaterial(STONE_ALB, STONE_NRM, { tint: 0.33, rough: 0.95 });   // grime settled in the letters
const INNER = stoneMaterial(INNER_ALB, INNER_NRM, { rough: 0.92 });
const INNER_HOT = stoneMaterial(INNER_ALB, INNER_NRM, { rough: 0.92 });         // the cracks that glow while you hold
const GOLD = new THREE.MeshPhysicalMaterial({ color: 0xffc766, metalness: 1, roughness: 0.14, envMap: ENV, envMapIntensity: 1.4,
  emissive: 0xff5a10, emissiveIntensity: 0 });

// --- geometry ---------------------------------------------------------------------
// stone.bin per piece: int16 xyz (x/32767*2, Blender axes), uint16 triangles, uint8 material per triangle
const toThree = (v) => new THREE.Vector3(v[0], v[2], -v[1]);
const quatThree = (q) => new THREE.Quaternion(q[1], q[3], -q[2], q[0]);   // Blender (w,x,y,z) into Y-up
function piece(buf, d, homeOffset) {
  const pos = new Int16Array(buf, d.off, d.verts * 3);
  let off = d.off + d.verts * 6; off += off % 2;
  const tri = new Uint16Array(buf, off, d.tris * 3); off += d.tris * 6;
  const mat = new Uint8Array(buf, off, d.tris);
  const order = [...Array(d.tris).keys()].sort((a, b) => mat[a] - mat[b]);
  const P = new Float32Array(d.tris * 9), Hm = new Float32Array(d.tris * 9);
  const groups = [];
  order.forEach((t, k) => {
    if (!groups.length || groups[groups.length - 1].m !== mat[t]) groups.push({ m: mat[t], start: k * 3, count: 0 });
    groups[groups.length - 1].count += 3;
    for (let c = 0; c < 3; c++) {
      const v = tri[t * 3 + c], x = pos[v * 3] / 32767 * 2, y = pos[v * 3 + 1] / 32767 * 2, z = pos[v * 3 + 2] / 32767 * 2;
      const o = (k * 3 + c) * 3;
      P[o] = x; P[o + 1] = z; P[o + 2] = -y;
      Hm[o] = x + homeOffset.x; Hm[o + 1] = z + homeOffset.y; Hm[o + 2] = -y + homeOffset.z;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P, 3));
  g.setAttribute("home", new THREE.BufferAttribute(Hm, 3));
  g.computeVertexNormals();                       // flat: every triangle has its own corners
  for (const gr of groups) g.addGroup(gr.start, gr.count, gr.m);
  g.computeBoundingSphere();
  return g;
}

// --- one stone in the scene ---------------------------------------------------------
class Stone {
  constructor(meta, buf) {
    this.root = new THREE.Group(); this.root.visible = false; scene.add(this.root);
    this.whole = new THREE.Mesh(piece(buf, meta.whole, new THREE.Vector3()), [STONE, INNER, CUT]);
    this.whole.castShadow = this.whole.receiveShadow = true;
    this.root.add(this.whole);
    this.core = new THREE.Mesh(this.whole.geometry, GOLD);          // the gold that fills every seam
    this.core.scale.set(0.992, 0.995, 0.93); this.core.visible = false;      // sits well behind the face, shows only in the seams
    this.root.add(this.core);
    this.impact = toThree(meta.impact);
    this.shards = meta.shards.map((s) => {
      const home = toThree(s.home);
      const g = piece(buf, s, home);
      const mats = [STONE, s.near > 0.15 ? INNER_HOT : INNER, CUT];
      const mesh = new THREE.Mesh(g, mats); mesh.castShadow = mesh.receiveShadow = true;
      const pivot = new THREE.Group(); pivot.add(mesh); pivot.position.copy(home); pivot.visible = false;
      this.root.add(pivot);
      s.lost = s.lost && !s.stump;                                       // only flying shards get lost
      const gold = s.lost ? new THREE.Mesh(g, GOLD) : null;          // the lost shard, cast in gold
      if (gold) { gold.visible = false; gold.position.copy(home); this.root.add(gold); }
      const burst = toThree(s.burst); burst.z = Math.min(burst.z, 0.55);   // nothing flies into the lens
      return {
        pivot, mesh, mats, gold, stump: s.stump, lost: s.lost, near: s.near, home, burst,
        burstQ: quatThree(s.burstRot), rest: toThree(s.rest), restQ: quatThree(s.restRot),
        from: new THREE.Vector3(), fromQ: new THREE.Quaternion(), delay: Math.random() * 0.5,
      };
    });
  }
  showShards(on) { this.whole.visible = !on; for (const s of this.shards) s.pivot.visible = on; }
  dispose() {
    scene.remove(this.root);
    const seen = new Set();
    this.root.traverse((o) => { if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); } });
  }
}

// --- camera framing -------------------------------------------------------------------
// front: the whole slab with room for the buttons; low: looking down at the rubble with room for the text above
const views = {
  front: { look: new THREE.Vector3(0, 0.78, 0), dir: new THREE.Vector3(0.08, 0.02, 1).normalize(), h: 2.15, w: 1.5 },
  low: { look: new THREE.Vector3(0, 0.62, 0.35), dir: new THREE.Vector3(0.08, 0.36, 1).normalize(), h: 3.3, w: 1.9 },
};
const cam = { look: views.front.look.clone(), pos: new THREE.Vector3(), target: "front" };
function viewPos(v) {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(v.h / 2 / t, v.w / 2 / t / camera.aspect);
  return v.look.clone().addScaledVector(v.dir, dist);
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();
cam.pos.copy(viewPos(views.front));

// --- state -----------------------------------------------------------------------------
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
let stone = null, nextStone = null, phase = "intro", t0 = 0, now = 0, hold = 0, holding = false, idx = 0;
const verdicts = [];                        // per stone: "intact" | "broken" | "gold"
const tally = { intact: 0, broken: 0, gold: 0 };
const clock = new THREE.Clock();
const show = (id, on) => $(id).classList.toggle("on", on);

async function loadStone(def) {
  const [meta, buf] = await Promise.all([fetch(def.asset + ".json").then((r) => r.json()), fetch(def.asset + ".bin").then((r) => r.arrayBuffer())]);
  return new Stone(meta, buf);
}

function setPhase(p) { phase = p; t0 = now; }

function marks() {
  $("marks").innerHTML = STONES.map((_, i) => `<i class="${verdicts[i] || (i === idx ? "now" : "")}"></i>`).join("");
}

function arrive() {
  show("bar-next", false); show("note", false);
  stone.root.position.set(3.2, 0, 0); stone.root.visible = true; stone.showShards(false);
  marks();
  // fetch the next stone while this one is read
  nextStone = idx + 1 < STONES.length ? loadStone(STONES[idx + 1]) : null;
  GOLD.emissiveIntensity = 0; GOLD.roughness = 0.18; $("context").classList.remove("on", "out");
  cam.target = "front"; setPhase("arrive");
}

function writeContext(def) {
  const box = $("context-inner"); box.innerHTML = "";
  let k = 0;
  const words = (text, cls) => {
    const p = document.createElement("p"); if (cls) p.className = cls;
    for (const w of text.split(" ")) {
      const s = document.createElement("span"); s.className = "w"; s.textContent = w;
      s.style.transitionDelay = `${0.35 + k++ * 0.028}s`;
      p.append(s, " ");
    }
    box.append(p);
  };
  def.context.forEach((t) => words(t));
  words(def.source, "src");
}

// --- input ------------------------------------------------------------------------------
$("begin").addEventListener("click", () => { show("intro", false); arrive(); });
$("keep").addEventListener("click", () => {
  if (phase !== "idle") return;
  show("bar-stone", false); tally.intact++; verdicts[idx] = "intact"; marks(); setPhase("out");
});
const startHold = (e) => { if (phase !== "idle") return; e.preventDefault(); holding = true; };
const endHold = () => { holding = false; };
$("break").addEventListener("pointerdown", startHold);
canvas.addEventListener("pointerdown", startHold);
addEventListener("pointerup", endHold); addEventListener("pointercancel", endHold);
$("break").addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); holding = true; } });
$("break").addEventListener("keyup", endHold);
$("break").addEventListener("contextmenu", (e) => e.preventDefault());

$("leave").addEventListener("click", () => {
  if (phase !== "rubble") return;
  show("bar-rubble", false); $("context").classList.add("out"); tally.broken++; verdicts[idx] = "broken"; marks(); setPhase("leave");
});
$("restore").addEventListener("click", () => {
  if (phase !== "rubble") return;
  show("bar-rubble", false); $("context").classList.add("out"); tally.gold++; verdicts[idx] = "gold"; marks();
  for (const s of stone.shards) { s.from.copy(s.pivot.position); s.fromQ.copy(s.pivot.quaternion); }
  cam.target = "front"; setPhase("restore");
});
$("next").addEventListener("click", () => { show("bar-next", false); show("note", false); setPhase("out"); });
$("again").addEventListener("click", async () => {
  tally.intact = tally.broken = tally.gold = 0; verdicts.length = 0; idx = 0; show("end", false);
  stone.dispose(); stone = await loadStone(STONES[0]); arrive();
});

// the stone leaves to the left, the next one comes in from the right
async function nextOne() {
  setPhase("wait");
  stone.dispose();
  idx++;
  if (idx >= STONES.length) { stone = null; marks(); finish(); return; }
  stone = await nextStone; arrive();
}

function finish() {
  show("end", true);
  for (const k of ["intact", "broken", "gold"]) {
    $("n-" + k).textContent = tally[k];
    $("s-" + k).innerHTML = '<i class="st"></i>'.repeat(tally[k]);
  }
  $("spent").textContent = tally.gold ? `Du hast ${tally.gold} Gold ausgegeben.` : "Du hast kein Gold ausgegeben.";
}

// --- per frame ------------------------------------------------------------------------------
const tmpQ = new THREE.Quaternion(), ID = new THREE.Quaternion();
function advance(dt) {
  now += dt;
  if (stone) step(dt, now - t0);
  // camera glides between framings
  const v = views[cam.target];
  cam.pos.lerp(viewPos(v), 1 - Math.pow(0.04, dt)); cam.look.lerp(v.look, 1 - Math.pow(0.04, dt));
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
}
function frame() {
  advance(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function step(dt, T) {
  const S = stone;
  if (phase === "arrive") {
    const u = reducedMotion ? 1 : clamp01(T / 1.4);
    S.root.position.x = 3.2 * (1 - easeOut(u));
    key.intensity = KEY * (0.35 + 0.65 * u);
    key.position.x = -2.7 + 1.6 * (1 - u);                   // the light sweeps in with it
    if (u >= 1) { setPhase("idle"); show("bar-stone", true); }
  }
  if (phase === "idle" || phase === "arrive") {
    hold = clamp01(hold + (holding ? dt / 1.2 : -dt / 0.5));
    $("hold-fill").style.transform = `scaleX(${hold})`;
    if (hold > 0 && !S.shards[0].pivot.visible) S.showShards(true);
    if (hold === 0 && S.shards[0].pivot.visible) S.showShards(false);
    INNER_HOT.userData.hot.value = 3.2 * hold * hold;
    const shake = hold * hold * 0.004;
    for (const s of S.shards) {
      const w = s.near > 0.15 ? s.near : 0;
      s.pivot.scale.setScalar(1 - 0.035 * w * hold);
      s.pivot.position.copy(s.home).addScaledVector(s.home.clone().sub(S.impact).normalize(), 0.006 * w * hold);
      s.pivot.position.z += 0.012 * w * hold;
      if (shake) s.pivot.position.add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
    }
    if (hold >= 1 && phase === "idle") {
      holding = false; hold = 0; $("hold-fill").style.transform = "scaleX(0)";
      show("bar-stone", false); writeContext(STONES[idx]); $("context").classList.remove("out");
      for (const s of S.shards) { s.from.copy(s.pivot.position); s.pivot.scale.setScalar(1); }
      cam.target = "low"; setPhase("break");
    }
  }
  if (phase === "break") {
    INNER_HOT.userData.hot.value = 1.6 * Math.max(0, 1 - T / 0.25);
    let done = true;
    for (const s of S.shards) {
      if (s.stump) { s.pivot.position.copy(s.home); continue; }
      const a = 0.16, fall = 0.75 + 0.35 * s.delay;               // out to the burst pose, then gravity takes over
      if (T < a) {
        const u = easeOut(T / a);
        s.pivot.position.lerpVectors(s.from, s.burst, u); s.pivot.quaternion.slerpQuaternions(ID, s.burstQ, u);
      } else {
        const u = clamp01((T - a) / fall);
        s.pivot.position.x = THREE.MathUtils.lerp(s.burst.x, s.rest.x, u);
        s.pivot.position.z = THREE.MathUtils.lerp(s.burst.z, s.rest.z, u);
        s.pivot.position.y = THREE.MathUtils.lerp(s.burst.y, s.rest.y, u * u);
        s.pivot.quaternion.slerpQuaternions(s.burstQ, s.restQ, easeOut(u));
        if (u < 1) done = false;
      }
    }
    if (done && T > 1.4) { setPhase("rubble"); $("context").classList.add("on"); }
  }
  if (phase === "rubble" && T > 1.8 && !$("bar-rubble").classList.contains("on")) show("bar-rubble", true);
  if (phase === "leave" && T > 1.0) setPhase("out");
  if (phase === "restore") {
    let home = true;
    for (const s of S.shards) {
      if (s.stump) continue;
      const u = clamp01((T - s.delay) / 1.25), e = ease(u);
      s.pivot.position.lerpVectors(s.from, s.home, e); s.pivot.position.y += Math.sin(Math.PI * e) * 0.22;
      s.pivot.quaternion.slerpQuaternions(s.fromQ, ID, e);
      if (s.lost) s.pivot.scale.setScalar(Math.max(0, 1 - clamp01((u - 0.35) / 0.25)));   // crumbles to dust on the way
      if (u < 1) home = false;
    }
    if (home) {
      for (const s of S.shards) { s.mesh.material = [STONE, GOLD, CUT]; if (s.gold) { s.gold.visible = true; s.gold.scale.setScalar(0.001); } }
      S.core.visible = true; setPhase("gold");
    }
  }
  if (phase === "gold") {
    // the seams open a hair, liquid gold wells into them and into the holes, then it cools and sets
    const open = easeOut(clamp01(T / 0.6));
    for (const s of S.shards) {
      if (s.lost) { s.pivot.visible = false; s.gold.scale.setScalar(0.001 + 1.003 * easeOut(clamp01((T - 0.3 - s.delay * 0.6) / 0.9))); }
      else s.pivot.scale.setScalar(1 - 0.012 * open);
    }
    GOLD.emissiveIntensity = 1.6 * clamp01(T / 0.4) * (1 - clamp01((T - 1.6) / 1.4));
    GOLD.roughness = 0.08 + 0.1 * clamp01((T - 1.6) / 1.4);
    if (T > 2.2 && !$("note").classList.contains("on")) show("note", true);
    if (T > 3.6) { setPhase("done"); show("bar-next", true); }
  }
  if (phase === "leave" || phase === "rubble") key.intensity = KEY;
  if (phase === "out") {
    cam.target = "front";
    const u = clamp01(T / 1.1);
    S.root.position.x = -3.6 * ease(u);
    if (u >= 1) nextOne();
  }
}

// --- go ---------------------------------------------------------------------------------------
stone = await loadStone(STONES[0]);
$("loading").classList.add("done");

function autoTick(mode) {
  if (phase === "idle") { if (mode === "keep") $("keep").click(); else holding = true; }
  if (phase === "rubble" && $("bar-rubble").classList.contains("on")) $(mode === "restore" ? "restore" : "leave").click();
  if (phase === "done") $("next").click();
}
if (SIM) {
  const st = document.createElement("style"); st.textContent = "*{transition:none!important}"; document.head.append(st);
  await Promise.all(LOADS);
  $("begin").click();
  const n = Math.round(parseFloat(PARAMS.get("t") || "3") * 60);
  for (let k = 0; k < n; k++) {
    autoTick(SIM); advance(1 / 60);
    if (phase === "wait") await new Promise((r) => setTimeout(r, 300));   // let the next stone load
  }
  const still = () => { renderer.render(scene, camera); requestAnimationFrame(still); };   // hold the frame for the screenshot
  still(); document.title = "ready";
  if (PARAMS.get("dbg")) {                       // DEBUG: anything close to the lens
    const near = [];
    scene.updateMatrixWorld(true);
    scene.traverseVisible((o) => { if (o.isMesh) { const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); const d = p.distanceTo(camera.position); if (d < 2.2) near.push([o.parent && o.parent.parent === stone?.root ? "shard" : o.parent === stone?.root ? "root-child" : "other", p.toArray().map((v) => +v.toFixed(2)), +d.toFixed(2)]); } });
    document.body.dataset.dbg = JSON.stringify({ idx, phase, cam: camera.position.toArray().map((v) => +v.toFixed(2)), roots: scene.children.filter((c) => c.isGroup).map((g) => [g.visible, g.position.x.toFixed(2), g.children.length]), near });
  }
} else requestAnimationFrame(frame);
