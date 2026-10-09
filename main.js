import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// --- tuning -------------------------------------------------------------------
const OFF_GOLD = 0xc9b47e;
const PARTS = [
  { name: "head",  side: -1 },   // slides left
  { name: "torso", side:  1 },   // slides right
  { name: "legs",  side: -1 },
];
const SPIN = Math.PI * 2;        // one full turn on the way out
const REST_ANGLE = 0.45;         // final turn toward the revealed text
const TEXT_MARGIN_PX = 36;       // air between text and the moved part

const GATE_Z = 10;               // the gate stands between the visitor and the figure
const GATE_OPEN = 1.75;          // radians each leaf swings inward
const PW_HASH = "cc93d853083ac590d76f47c42fa1214a1f9ba0c0f1564cf0d3e2c29474553f0c";
const STORE_KEY = "eros.entered";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- renderer / scene ---------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

const key = new THREE.DirectionalLight(0xffe2b0, 2.2);
key.position.set(-2.5, 4, 3);
const rim = new THREE.DirectionalLight(0xff6a4a, 1.4);   // ember rim from behind
rim.position.set(3, 1.5, -3);
scene.add(key, rim, new THREE.AmbientLight(0x30262a, 0.6));

const material = new THREE.MeshPhysicalMaterial({
  color: OFF_GOLD, metalness: 1, roughness: 0.32, clearcoat: 0.25, clearcoatRoughness: 0.4,
});

const figure = new THREE.Group();
scene.add(figure);

// --- load -----------------------------------------------------------------------
const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/");
const loader = new GLTFLoader().setDRACOLoader(draco);

const layout = await (await fetch("models/layout.json")).json();
const totalHeight = layout.head.y + layout.head.height / 2 - (layout.legs.y - layout.legs.height / 2);

const [parts, gateGltf] = await Promise.all([
  Promise.all(PARTS.map(async (def) => {
    const gltf = await loader.loadAsync(`models/${def.name}.glb`);
    const mesh = gltf.scene;
    const mat = material.clone();               // own copy so it can fade on its own
    mat.transparent = true;
    mesh.traverse((o) => { if (o.isMesh) o.material = mat; });

    const pivot = new THREE.Group();            // moves sideways
    pivot.position.y = layout[def.name].y;
    pivot.add(mesh);                            // mesh spins on its own axis
    figure.add(pivot);

    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    // invisible hit slot at the part's resting place, padded into the gaps
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y + 0.08, size.z),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    slot.position.y = pivot.position.y;
    figure.add(slot);

    return {
      ...def, mesh, pivot, slot, size, mat,
      text: document.querySelector(`.reveal[data-part="${def.name}"]`),
      p: 0, target: 0, phase: Math.random() * 10, offset: 1,
    };
  })),
  loader.loadAsync("models/gate.glb"),
]);

// --- the gate -------------------------------------------------------------------
const gate = gateGltf.scene;
gate.position.set(0, -totalHeight / 2 + 0.28, GATE_Z);     // base sits on the figure's floor line
scene.add(gate);
gate.traverse((o) => {
  if (!o.isMesh) return;
  o.material.color.multiplyScalar(0.55);       // darker, older bronze
  o.material.roughness = 0.42;
});
const leafL = gate.getObjectByName("LeafL");
const leafR = gate.getObjectByName("LeafR");
const gateBox = new THREE.Box3().setFromObject(gate);
const gateCentreY = (gateBox.min.y + gateBox.max.y) / 2;
const gateHeight = gateBox.max.y - gateBox.min.y;

// a warm top light just for the gate
// raking from high left so the reliefs catch the light
const gateLight = new THREE.SpotLight(0xffd6a0, 45, 16, 0.5, 0.7, 1.4);
gateLight.position.set(-2.2, gateBox.max.y + 2.5, GATE_Z + 2.6);
gateLight.target.position.set(0, gateCentreY, GATE_Z);
scene.add(gateLight, gateLight.target);

// light pouring through once the leaves part
const glowTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,226,170,1)"); grd.addColorStop(0.35, "rgba(255,190,120,.35)"); grd.addColorStop(1, "rgba(255,160,90,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
})();
const glow = new THREE.Mesh(
  new THREE.PlaneGeometry(gateHeight * 0.9, gateHeight * 1.1),
  new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
);
glow.position.set(0, gateCentreY, GATE_Z - 0.6);
scene.add(glow);

document.querySelector(".loading").classList.add("done");

// --- camera poses -----------------------------------------------------------------
const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
const pose = { gate: { pos: new THREE.Vector3(), look: new THREE.Vector3() },
               figure: { pos: new THREE.Vector3(), look: new THREE.Vector3() } };

function computePoses() {
  // figure: fit the whole body with room for the mark and caption
  const fitF = totalHeight * 1.34, lift = totalHeight * 0.05;
  pose.figure.pos.set(0, -lift, fitF / 2 / tanHalf());
  pose.figure.look.set(0, -lift, 0);
  // gate: whole gate in frame, pushed up to leave room for the voice and choices
  const fitByH = gateHeight * 1.55;
  const fitByW = (gateBox.max.x - gateBox.min.x) * 1.25 / camera.aspect;
  const fitG = Math.max(fitByH, fitByW);
  const down = fitG * 0.12;
  pose.gate.pos.set(0, gateCentreY - down, GATE_Z + fitG / 2 / tanHalf());
  pose.gate.look.set(0, gateCentreY - down, GATE_Z);
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  computePoses();

  // slide distances are measured at the figure's framing
  const wpp = (2 * pose.figure.pos.z * tanHalf()) / innerHeight;
  for (const part of parts) {
    const textW = part.text.offsetWidth;
    const beside = (textW / 2 + TEXT_MARGIN_PX) * wpp + part.size.x / 2;
    const room = (innerWidth / 2) * wpp - part.size.x / 2;
    // phones: no room beside the text, so the part spins out of frame instead
    part.offset = beside <= room ? beside : (innerWidth / 2) * wpp + part.size.x * 0.7;
  }
}
addEventListener("resize", resize);
resize();

// --- story ------------------------------------------------------------------------
const $voice = document.getElementById("voice");
const $choices = document.getElementById("choices");
const $pw = document.getElementById("pw");
const $pwInput = document.getElementById("pw-input");
const $veil = document.getElementById("veil");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let sayToken = 0;
async function say(text) {
  const token = ++sayToken;
  $voice.textContent = "";
  if (!text) return;
  const cursor = document.createElement("span");
  cursor.className = "cursor"; cursor.textContent = "▍";
  const words = document.createTextNode("");
  $voice.append(words, cursor);
  for (const ch of text) {
    if (token !== sayToken) return;
    words.textContent += ch;
    await sleep(reducedMotion ? 0 : /[.,?!…]/.test(ch) ? 260 : 42);
  }
  await sleep(500);
  if (token === sayToken) cursor.remove();
}

function choices(list) {
  $choices.replaceChildren();
  list.forEach(([label, fn, quiet], i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    if (quiet) b.className = "quiet";
    b.addEventListener("click", () => { clearChoices(); fn(); });
    $choices.append(b);
    setTimeout(() => b.classList.add("in"), 80 + i * 140);
  });
}
const clearChoices = () => $choices.replaceChildren();

function showPassword(on) {
  $pw.classList.toggle("on", on);
  if (on) { requestAnimationFrame(() => $pw.classList.add("in")); $pwInput.value = ""; $pwInput.focus(); }
  else $pw.classList.remove("in");
}

let shake = 0;                    // gate rattle, decays every frame
const rattle = (amount) => { shake = Math.max(shake, amount); };

async function arrival(again = false) {
  await say(again ? "…and yet, here you are again." : "");
  const list = [["Knock", knock], ["Turn back", turnBack]];
  if (localStorage.getItem(STORE_KEY)) list.push(["Intra", () => intra(), true]);
  choices(list);
}

async function turnBack() {
  await say("Wise. Most never return.");
  await sleep(900);
  $veil.classList.add("on");
  await sleep(2200);
  $veil.classList.remove("on");
  await sleep(700);
  arrival(true);
}

async function knock() {
  $voice.textContent = "";
  for (let i = 0; i < 3; i++) { rattle(1); await sleep(420); }
  await sleep(500);
  await say("Quis pulsat? Do you know the password?");
  choices([["Yes", askPassword], ["No", refuse]]);
}

async function refuse() {
  await say("Then the gates remain closed.");
  choices([["Try anyway", askPassword], ["Turn back", turnBack]]);
}

let tries = 0;
async function askPassword() {
  await say("Speak the words.");
  showPassword(true);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const normalise = (s) => s.toUpperCase().replace(/[^A-Z]+/g, " ").trim();

$pw.addEventListener("submit", async (e) => {
  e.preventDefault();
  const attempt = normalise($pwInput.value);
  if (!attempt) return;
  if (crypto.subtle && (await sha256("eros:" + attempt)) === PW_HASH) {
    showPassword(false);
    intra();
    return;
  }
  tries++;
  rattle(0.6);
  $pw.classList.remove("wrong"); void $pw.offsetWidth; $pw.classList.add("wrong");
  $pwInput.select();
  say(tries >= 3 ? "Non. The words are written on those who already belong." : "Non.");
});

// --- entering ---------------------------------------------------------------------
let state = "gate";               // gate -> opening -> inside
let openStart = 0;                // clock time the gate began to open (real time, so slow frames don't stall it)
const OPEN_DUR = 2.6, FLY_START = 1.4, FLY_DUR = 3.6;

async function intra() {
  clearChoices();
  try { localStorage.setItem(STORE_KEY, "1"); } catch {}
  await say("Intra.");
  await sleep(400);
  document.body.classList.add("entered");
  if (reducedMotion) {
    $veil.classList.add("on"); await sleep(1400);
    state = "inside"; finishEntering();
    $veil.classList.remove("on");
    return;
  }
  state = "opening"; openStart = clock.elapsedTime;
}

function finishEntering() {
  gate.visible = glow.visible = gateLight.visible = false;
  document.body.classList.remove("at-gate");
}

// --- hover (inside only) ------------------------------------------------------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2(9, 9);
const mouse = new THREE.Vector2();
let active = null;
let touchMode = false;

function pick() {
  if (state !== "inside") return null;
  ray.setFromCamera(ndc, camera);
  // a part counts as hovered on its resting slot, on its moved self, or on its open text
  for (const part of parts) {
    if (ray.intersectObjects([part.slot, part.mesh], true).length) return part;
  }
  if (active) {
    const r = active.text.getBoundingClientRect();
    const x = (ndc.x + 1) / 2 * innerWidth, y = (1 - ndc.y) / 2 * innerHeight;
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return active;
  }
  return null;
}

function setActive(part) {
  if (part === active) return;
  active = part;
  for (const p of parts) {
    p.target = p === part ? 1 : 0;
    p.text.classList.toggle("on", p === part);
  }
  renderer.domElement.style.cursor = part ? "pointer" : "";
  document.body.classList.toggle("reading", !!part);
}

addEventListener("pointermove", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  mouse.copy(ndc);
  if (e.pointerType === "mouse") { touchMode = false; setActive(pick()); }
});
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  touchMode = true;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const hit = pick();
  setActive(hit === active ? null : hit);       // tap toggles
});
document.addEventListener("mouseleave", () => { if (!touchMode) setActive(null); });

// --- animate --------------------------------------------------------------------
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
const clock = new THREE.Clock();
const v = new THREE.Vector3();
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const sway = reducedMotion ? 0 : 1;

  // --- gate & camera
  let fly = state === "inside" ? 1 : 0;
  if (state === "opening") {
    const openT = clock.elapsedTime - openStart;
    const o = ease(clamp01(openT / OPEN_DUR));
    leafL.rotation.y = o * GATE_OPEN;
    leafR.rotation.y = -o * GATE_OPEN;
    fly = ease(clamp01((openT - FLY_START) / FLY_DUR));
    glow.material.opacity = o * 0.55 * (1 - clamp01((fly - 0.45) / 0.3));
    if (fly >= 1) { state = "inside"; finishEntering(); }
  }
  shake *= Math.pow(0.02, dt);
  if (state === "gate") {
    const j = shake * Math.sin(t * 70) * 0.006;
    leafL.rotation.y = j; leafR.rotation.y = -j;
    gate.position.x = shake * Math.sin(t * 53) * 0.01;
  }
  camPos.lerpVectors(pose.gate.pos, pose.figure.pos, fly);
  camLook.lerpVectors(pose.gate.look, pose.figure.look, fly);
  // the visitor's gaze drifts with the cursor while standing at the gate
  camPos.x += mouse.x * 0.35 * (1 - fly) * sway;
  camPos.y += mouse.y * 0.15 * (1 - fly) * sway;
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  // --- figure: leans gently toward the cursor once inside
  const lean = state === "inside" ? sway : 0;
  figure.rotation.y += (mouse.x * 0.12 * lean - figure.rotation.y) * 0.04;
  figure.rotation.x += (-mouse.y * 0.04 * lean - figure.rotation.x) * 0.04;

  for (const part of parts) {
    // linear progress, eased on output: interruptible both ways
    const speed = reducedMotion ? 10 : 0.85;
    part.p += Math.sign(part.target - part.p) * Math.min(Math.abs(part.target - part.p), dt * speed);
    const e = ease(part.p);

    part.pivot.position.x = part.side * part.offset * e;
    const idle = reducedMotion ? 0 : Math.sin(t * 0.5 + part.phase) * 0.06 * (1 - e);
    part.mesh.rotation.y = part.side * e * (SPIN + REST_ANGLE) * -1 + idle;

    // others step back so the text reads cleanly
    const narrow = innerWidth < 700;
    const dim = active && active !== part ? (narrow ? 0.12 : 0.55) : 1;
    part.mat.opacity += (dim - part.mat.opacity) * 0.08;
    part.mat.depthWrite = part.mat.opacity > 0.98;

    part.mesh.position.y = reducedMotion ? 0 : Math.sin(t * 0.7 + part.phase) * 0.008;

    // pin the text to the part's resting place on screen
    v.set(0, part.slot.position.y, 0).applyMatrix4(figure.matrixWorld).project(camera);
    part.text.style.left = `${(v.x + 1) / 2 * innerWidth}px`;
    part.text.style.top = `${(1 - v.y) / 2 * innerHeight}px`;
  }

  renderer.render(scene, camera);
});

arrival();
