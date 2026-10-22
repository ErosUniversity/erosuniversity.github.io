import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

// ---------------------------------------------------------------------------
// Things you might want to change
// ---------------------------------------------------------------------------

// Drop your models here as .glb (binary glTF). Missing files fall back to placeholder putti.
const MODEL_GOOD = 'models/good.glb';
const MODEL_BAD = 'models/bad.glb';

const PHRASES_GOOD = [
  'Du siehst heute gut aus.',
  'Ruf mal deine Mutter an.',
  'Trink ein Glas Wasser.',
  'Du bist genug.',
  'Sag einfach danke.',
  'Geh heute früh schlafen.',
  'Sie mögen dich wirklich.',
  'Das war mutig von dir.',
];
const PHRASES_BAD = [
  'Noch ein Glas geht.',
  'Schreib zurück. Jetzt.',
  'Die Hausarbeit kann warten.',
  'Niemand muss es wissen.',
  'Lass die anderen zahlen.',
  'Schwänz die Vorlesung.',
  'Du hattest recht. Wie immer.',
  'Nur noch eine Folge.',
];

// Placement in MediaPipe's canonical head space (roughly centimetres, +y up, +z towards camera).
// For reference: the face edge at ear height is x = ±7.7, z = -2.4; the eyes are at y = 2.7.
// These are defaults; the "Figuren justieren" panel overrides and remembers them.
const DEFAULT_TUNE = { size: 5.5, spread: 10.5, height: 1.5, depth: -3.5, turn: 35 };
const TUNE_KEY = 'eros-booth-tune-v2';

const SPEAK_MS = 3000;   // how long one whisper stays on screen
const PAUSE_MS = 700;    // gap before the other one answers

// ---------------------------------------------------------------------------

const $ = id => document.getElementById(id);
const video = $('video'), glCanvas = $('gl'), overlay = $('overlay'), octx = overlay.getContext('2d');
const status = msg => { $('status').textContent = msg; };

let tune = { ...DEFAULT_TUNE };
try { Object.assign(tune, JSON.parse(localStorage.getItem(TUNE_KEY) || '{}')); } catch {}

let W = 1280, H = 720;
let landmarker = null, lastVideoTime = -1, lastResult = null;

// --- three.js scene --------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
// MediaPipe's face geometry assumes a 63° vertical field of view.
const camera = new THREE.PerspectiveCamera(63, W / H, 1, 10000);
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a2a20, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(0.4, 1, 1);
scene.add(key);

const head = new THREE.Group();
head.visible = false;
scene.add(head);

// Invisible head so the figures disappear correctly when they go behind it.
const occluder = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ colorWrite: false }));
occluder.scale.set(7.2, 10, 9);
occluder.position.set(0, 1, -5);
occluder.renderOrder = -1;
head.add(occluder);

function makeFigure(side) {
  const seat = new THREE.Group();   // sits on the ear
  const pivot = new THREE.Group();  // animated: bobbing and leaning in to whisper
  seat.add(pivot);
  head.add(seat);
  return { side, seat, pivot, model: null, mixer: null, lean: 0, phrase: '', until: 0 };
}
const good = makeFigure(+1);  // appears on the left of the mirrored screen
const bad = makeFigure(-1);
const figures = [good, bad];
// Angel and devil are off for now: the booth only takes the four pictures and your signature.
const FIGURES = false;
if (!FIGURES) head.visible = false;

function placeFigures() {
  for (const f of figures) {
    f.seat.position.set(f.side * tune.spread, tune.height, tune.depth);
    // Face the head, turned partly toward the camera so the face stays visible.
    f.seat.rotation.y = -f.side * THREE.MathUtils.degToRad(90 - tune.turn);
    if (f.model) fitModel(f.model);
  }
}

function fitModel(model) {
  model.scale.setScalar(1);
  model.position.set(0, 0, 0);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = tune.size / (size.y || 1);
  model.scale.setScalar(s);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x * s, -box.min.y * s, -c.z * s);
}

function placeholderPutto(isBad) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: isBad ? 0xD9452B : 0xE9D2A6, roughness: 0.55, metalness: isBad ? 0.1 : 0.35 });
  const wingMat = new THREE.MeshStandardMaterial({ color: isBad ? 0x8C1C2E : 0xF7F2EF, roughness: 0.7, side: THREE.DoubleSide });
  const sphere = (r, x, y, z, sx = 1, sy = 1, sz = 1, m = skin) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); g.add(mesh); return mesh;
  };
  sphere(1.5, 0, 1.6, 0, 1, 1.15, 0.9);          // body
  sphere(1.25, 0, 3.7, 0.1);                       // head
  sphere(0.45, -0.9, 0.3, 0.5); sphere(0.45, 0.9, 0.3, 0.5);   // feet
  sphere(0.4, -1.4, 2.2, 0.5); sphere(0.4, 1.4, 2.2, 0.5);     // hands
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1D1A28 });
  sphere(0.16, -0.42, 3.85, 1.15, 1, 0.6, 0.5, eyeMat); sphere(0.16, 0.42, 3.85, 1.15, 1, 0.6, 0.5, eyeMat);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = sphere(1.4, s * 1.5, 2.8, -1.0, 1.2, 0.7, 0.12, wingMat);
    w.rotation.z = s * 0.5; wings.push(w);
  }
  if (isBad) {
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x1D1A28, roughness: 0.4 });
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 12), hornMat);
      horn.position.set(s * 0.7, 4.9, 0); horn.rotation.z = -s * 0.35; g.add(horn);
    }
    const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.8, -1.2), new THREE.Vector3(0.6, 0.2, -2.2), new THREE.Vector3(1.8, 0.6, -2.4), new THREE.Vector3(2.2, 1.6, -2),
    ]), 24, 0.12, 8), skin);
    g.add(tail);
  } else {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.1, 10, 40), new THREE.MeshStandardMaterial({ color: 0xC8A14B, metalness: 0.9, roughness: 0.25, emissive: 0x4a3510 }));
    halo.position.set(0, 5.3, 0); halo.rotation.x = Math.PI / 2; g.add(halo);
  }
  g.userData.wings = wings;
  return g;
}

async function loadFigure(f, url, isBad) {
  let model, clips = [];
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    model = gltf.scene; clips = gltf.animations;
  } catch {
    model = placeholderPutto(isBad);
  }
  f.model = model;
  f.pivot.add(model);
  fitModel(model);
  if (clips.length) {
    f.mixer = new THREE.AnimationMixer(model);
    f.mixer.clipAction(clips[0]).play();
  }
  return model.userData.wings ? 'placeholder' : 'model';
}

// --- whispering ------------------------------------------------------------

const pick = (list, prev) => { let p; do { p = list[Math.floor(Math.random() * list.length)]; } while (list.length > 1 && p === prev); return p; };
let turnOf = good, nextAt = 0;

const ownPhrase = (f) => ($(f === good ? 'p-good' : 'p-bad')?.value || '').trim();
function whisper(f, now, ms = SPEAK_MS) {
  f.phrase = ownPhrase(f) || pick(f === good ? PHRASES_GOOD : PHRASES_BAD, f.phrase);
  f.until = now + ms;
  speak(f);
}

function schedule(now) {
  if (now < nextAt) return;
  whisper(turnOf, now);
  nextAt = now + SPEAK_MS + PAUSE_MS;
  turnOf = turnOf === good ? bad : good;
}

let deVoice = null;
const pickVoice = () => { deVoice = speechSynthesis.getVoices().find(v => v.lang?.startsWith('de')) || null; };
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

function speak(f) {
  if (!$('voice').checked || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(f.phrase);
  u.lang = 'de-DE'; if (deVoice) u.voice = deVoice;
  u.rate = 0.9; u.volume = 0.7;
  u.pitch = f === good ? 1.5 : 0.4;
  speechSynthesis.speak(u);
}

// --- bubbles (drawn unmirrored on the 2D overlay) -------------------------

const tmp = new THREE.Vector3();
function screenPos(obj, local) {
  tmp.copy(local); obj.localToWorld(tmp); tmp.project(camera);
  // The video and 3D layer are shown mirrored, so flip x.
  return { x: W - (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H };
}

function wrap(ctx, text, maxW) {
  const words = text.split(' '), lines = []; let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  lines.push(line); return lines;
}

function drawBubble(ctx, f, alpha) {
  const isGood = f === good;
  const mouth = screenPos(f.pivot, new THREE.Vector3(0, tune.size * 0.72, tune.size * 0.2));
  const fs = Math.round(H * 0.034);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `italic 400 ${fs}px Spectral, Georgia, serif`;
  const lines = wrap(ctx, f.phrase, W * 0.2);
  const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
  const pad = fs * 0.7, bw = tw + pad * 2, bh = lines.length * fs * 1.25 + pad * 1.4;
  // In the mirrored view, side +1 ends up on the left of the screen.
  const out = -f.side;
  let bx = mouth.x + out * fs * 1.2 - (out < 0 ? bw : 0);
  let by = mouth.y - bh - fs * 2.2;
  bx = Math.max(8, Math.min(W - bw - 8, bx)); by = Math.max(8, by);
  ctx.fillStyle = isGood ? 'rgba(247,242,239,.95)' : 'rgba(36,32,33,.94)';
  ctx.strokeStyle = isGood ? '#C8A14B' : '#D9452B';
  ctx.lineWidth = Math.max(2, fs * 0.08);
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, fs * 0.6);
  ctx.fill(); ctx.stroke();
  // tail toward the figure's mouth
  const tx = Math.max(bx + fs, Math.min(bx + bw - fs, mouth.x));
  ctx.beginPath();
  ctx.moveTo(tx - fs * 0.4, by + bh - 1); ctx.lineTo(mouth.x, mouth.y - fs * 0.3); ctx.lineTo(tx + fs * 0.4, by + bh - 1);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = isGood ? '#1D1A28' : '#EAE2D2';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, bx + pad, by + pad * 0.7 + i * fs * 1.25));
  ctx.restore();
}

// --- main loop -------------------------------------------------------------

const targetPos = new THREE.Vector3(), targetQuat = new THREE.Quaternion(), targetScale = new THREE.Vector3(), m4 = new THREE.Matrix4();
const clock = new THREE.Clock();
let running = false;

function frame() {
  if (!running) return;
  requestAnimationFrame(frame);
  const now = performance.now(), dt = clock.getDelta(), t = clock.elapsedTime;

  if (landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    lastResult = landmarker.detectForVideo(video, now);
  }
  const mats = lastResult?.facialTransformationMatrixes;
  if (mats?.length) {
    m4.fromArray(mats[0].data).decompose(targetPos, targetQuat, targetScale);
    if (!head.visible) { head.position.copy(targetPos); head.quaternion.copy(targetQuat); head.scale.copy(targetScale); }
    head.position.lerp(targetPos, 0.55); head.quaternion.slerp(targetQuat, 0.55); head.scale.lerp(targetScale, 0.55);
    head.visible = FIGURES;
    if (FIGURES) schedule(now);
  } else {
    head.visible = false;
  }

  for (const f of figures) {
    const speaking = now < f.until;
    f.lean += ((speaking ? 1 : 0) - f.lean) * Math.min(1, dt * 6);
    const phase = f === good ? 0 : 1.7;
    f.pivot.position.y = Math.sin(t * 2.2 + phase) * 0.25;
    // lean in toward the ear: along the seat's local +z (which faces the head)
    f.pivot.position.z = f.lean * tune.size * 0.18;
    f.pivot.rotation.x = f.lean * 0.35;
    f.pivot.rotation.z = Math.sin(t * 1.3 + phase) * 0.05;
    f.mixer?.update(dt);
    const wings = f.model?.userData.wings;
    if (wings) wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.3 + Math.sin(t * 9 + phase) * 0.35); });
  }

  renderer.render(scene, camera);
  octx.clearRect(0, 0, W, H);
  if (FIGURES && head.visible) {
    for (const f of figures) {
      const left = f.until - now;
      if (left > 0) drawBubble(octx, f, Math.min(1, left / 300, (SPEAK_MS - left) / 200 + 0.2));
    }
  }
}

// --- start -----------------------------------------------------------------

const waiting = (on) => { $('start-wrap').hidden = on; $('loader').hidden = !on; };
$('start').addEventListener('click', async () => {
  $('start').disabled = true;
  const msg = $('veil-msg');
  waiting(true);
  try {
    msg.textContent = 'Darf ich deine Kamera benutzen?';
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    await video.play();
    W = video.videoWidth; H = video.videoHeight;
    $('stage').style.aspectRatio = `${W} / ${H}`;
    renderer.setSize(W, H, false);
    overlay.width = W; overlay.height = H;
    camera.aspect = W / H; camera.updateProjectionMatrix();

    msg.textContent = 'Der Automat wärmt sich auf …';
    const [vision, kindGood, kindBad] = await Promise.all([
      FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'),
      FIGURES ? loadFigure(good, MODEL_GOOD, false) : 'off',
      FIGURES ? loadFigure(bad, MODEL_BAD, true) : 'off',
    ]);
    landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: 'GPU' },
      runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: true,
    });
    placeFigures();
    $('veil').hidden = true;
    $('stage').classList.add('live');
    $('shoot').disabled = false;
    status(FIGURES ? (kindGood === 'placeholder' || kindBad === 'placeholder' ? 'Platzhalter-Figuren' : 'Eigene Figuren') : '');
    running = true;
    frame();
  } catch (err) {
    console.error(err);
    waiting(false);
    msg.textContent = err.name === 'NotAllowedError'
      ? 'Okay, keine Kamera. Wenn du es dir anders überlegst, klick nochmal.'
      : 'Kamera nicht verfügbar: ' + (err.message || err.name);
    $('start').disabled = false;
  }
});
// everything above has loaded: the button works now
$('start').disabled = false; $('start').textContent = 'Kamera starten';

// --- tuning panel ----------------------------------------------------------

const TUNE_UI = [
  ['size', 'Größe (cm)', 2, 14, 0.5],
  ['spread', 'Abstand zur Mitte', 5, 16, 0.25],
  ['height', 'Höhe', -6, 10, 0.25],
  ['depth', 'Tiefe', -14, 4, 0.25],
  ['turn', 'Zur Kamera gedreht (°)', 0, 90, 1],
];
for (const [k, label, min, max, step] of TUNE_UI) {
  const l = document.createElement('label');
  l.innerHTML = `<span>${label}: <b></b></span><input type="range" min="${min}" max="${max}" step="${step}">`;
  const input = l.querySelector('input'), out = l.querySelector('b');
  input.value = tune[k]; out.textContent = tune[k];
  input.addEventListener('input', () => {
    tune[k] = +input.value; out.textContent = input.value;
    placeFigures();
    try { localStorage.setItem(TUNE_KEY, JSON.stringify(tune)); } catch {}
  });
  $('tune').append(l);
}
{
  const reset = document.createElement('button');
  reset.className = 'ghost'; reset.textContent = 'Zurücksetzen'; reset.style.justifySelf = 'start';
  reset.addEventListener('click', () => {
    tune = { ...DEFAULT_TUNE };
    $('tune').querySelectorAll('input').forEach((inp, i) => { inp.value = tune[TUNE_UI[i][0]]; inp.dispatchEvent(new Event('input')); });
  });
  $('tune').append(reset);
}

// --- capture: four frames, like the analogue Photoautomat --------------------

let frames = [], faceBox = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function grab() {
  // one frame as you see it (video + figures + bubbles), then a 4:5 portrait crop around the face
  const full = document.createElement('canvas'); full.width = W; full.height = H;
  const p = full.getContext('2d');
  p.save(); p.translate(W, 0); p.scale(-1, 1); p.drawImage(video, 0, 0, W, H); p.drawImage(glCanvas, 0, 0, W, H); p.restore();
  p.drawImage(overlay, 0, 0);
  const lm = lastResult?.faceLandmarks?.[0];
  if (lm) {
    const xs = lm.map(q => (1 - q.x) * W), ys = lm.map(q => q.y * H);
    faceBox = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }
  const out = document.createElement('canvas'); out.width = 640; out.height = 800;
  out.getContext('2d').drawImage(full, ...cropRect(4 / 5), 0, 0, 640, 800);
  return out;
}

$('shoot').addEventListener('click', async () => {
  $('shoot').disabled = true;
  frames = [];
  const count = $('count'), flash = $('flash');
  count.hidden = false;
  for (const n of ['3', '2', '1']) { count.textContent = n; await sleep(800); }
  count.hidden = true;
  for (let i = 0; i < 4; i++) {
    if (FIGURES) {
      const now = performance.now();
      const f = i % 2 ? bad : good;                   // they take turns: angel, devil, angel, devil
      whisper(f, now, 1400); f.lean = 1; nextAt = now + 1500;
    }
    await sleep(450);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    frames.push(grab());
    flash.classList.add('on'); requestAnimationFrame(() => flash.classList.remove('on'));
    await sleep(900);
  }
  $('strip-section').classList.add('on');
  await drawStrip();
  $('strip-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('shoot').disabled = false;
});

// Portrait crop around the face, wide enough for both figures and their bubbles.
function cropRect(aspect) {
  let cw, ch, cx, cy;
  if (faceBox) {
    const fh = faceBox.y1 - faceBox.y0;
    ch = fh * 2.6; cw = ch * aspect;
    cx = (faceBox.x0 + faceBox.x1) / 2; cy = (faceBox.y0 + faceBox.y1) / 2 - fh * 0.15;
  } else { ch = H; cw = ch * aspect; cx = W / 2; cy = H / 2; }
  const k = Math.min(1, W / cw, H / ch); cw *= k; ch *= k;
  const x = Math.max(0, Math.min(W - cw, cx - cw / 2)), y = Math.max(0, Math.min(H - ch, cy - ch / 2));
  return [x, y, cw, ch];
}

// --- Campus MN, from a sheet of pre-drawn letters --------------------------------
// The font is licensed for print, not the web, so only pictures of its capitals travel with the page.
const campusSheet = new Image(); campusSheet.src = 'campus-atlas.png';
const campusMeta = fetch('campus-atlas.json').then(r => r.json());
const tinted = new Map();
async function campus(ctx, text, x, y, size, color, align = 'center', maxW = Infinity) {
  const meta = await campusMeta; await campusSheet.decode().catch(() => {});
  if (!tinted.has(color)) {                       // the sheet in the wanted colour, made once
    const t = document.createElement('canvas'); t.width = campusSheet.width; t.height = campusSheet.height;
    const g = t.getContext('2d'); g.drawImage(campusSheet, 0, 0); g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, t.width, t.height); tinted.set(color, t);
  }
  const sheet = tinted.get(color);
  const chars = [...text.toUpperCase().replace(/ß/g, 'SS')];
  const adv = ch => ch === ' ' ? meta.space : ch === '·' ? meta.space * 1.2 : (meta.glyphs[ch]?.[1] ?? meta.space);
  let k = size / meta.size;
  const width = () => chars.reduce((w, ch) => w + adv(ch), 0) * k;
  if (width() > maxW) k *= maxW / width();
  let cx = align === 'center' ? x - width() / 2 : align === 'right' ? x - width() : x;
  const top = y - meta.baseline * k, h = meta.height * k;
  for (const ch of chars) {
    const gl = meta.glyphs[ch];
    if (gl) ctx.drawImage(sheet, gl[0], 0, gl[1], meta.height, cx, top, gl[1] * k, h);
    else if (ch === '·') { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx + adv(ch) * k / 2, y - meta.size * 0.3 * k, meta.size * 0.05 * k, 0, Math.PI * 2); ctx.fill(); }
    cx += adv(ch) * k;
  }
}

// --- the strip, on a 9:16 page -------------------------------------------------

const strip = $('strip'), s9 = strip.getContext('2d');
let stripOnly = null;

function silverFrame(src, w, h) {
  // black-and-white, hard, grainy, a little uneven at the edges: chemistry, not a filter
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.filter = 'grayscale(1) contrast(1.45) brightness(1.06)';
  g.drawImage(src, 0, 0, w, h); g.filter = 'none';
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 38; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  return c;
}

async function drawStrip() {
  await Promise.all(['500 64px Caveat', 'italic 400 40px Spectral', '500 22px "IBM Plex Mono"'].map(f => document.fonts.load(f)));
  const FW = 340, FH = 425, M = 26, GAP = 16, FOOT = 120;
  const SW = FW + M * 2, SH = M + FH * 4 + GAP * 3 + FOOT;
  // the strip itself
  const st = document.createElement('canvas'); st.width = SW; st.height = SH; const g = st.getContext('2d');
  g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, SW, SH);
  frames.forEach((f, i) => g.drawImage(silverFrame(f, FW, FH), M, M + i * (FH + GAP)));
  const sig = ($('p-sig').value || '').trim();
  if (sig) await campus(g, sig, SW / 2, SH - FOOT + 64, 52, '#16151a', 'center', SW - M * 2);
  await campus(g, 'EROS UNIVERSITY · ' + new Date().toLocaleDateString('de-DE'), SW / 2, SH - 22, 20, '#6b6870', 'center', SW - M * 2);
  stripOnly = st;

  // the 9:16 page: black, the strip a little crooked, the question and its answer
  s9.fillStyle = '#070707'; s9.fillRect(0, 0, 1080, 1920);
  const scale = Math.min(1640 / SH, 1);
  s9.save(); s9.translate(540, 900); s9.rotate(-0.025);
  s9.shadowColor = 'rgba(0,0,0,.7)'; s9.shadowBlur = 40; s9.shadowOffsetY = 18;
  s9.drawImage(st, -SW * scale / 2, -SH * scale / 2, SW * scale, SH * scale);
  s9.restore();
  await campus(s9, 'Darf ich ein Foto von dir machen?  Ja.', 540, 1846, 46, '#ececea', 'center', 920);
}

$('p-sig').addEventListener('input', () => { if (frames.length) drawStrip(); });

function download(canvas, name, type = 'image/png') {
  canvas.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, type, 0.92);
}
const slug = () => (($('p-sig').value || 'fotoautomat').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '') || 'fotoautomat');
$('dl-strip').addEventListener('click', () => download(strip, `eros-fotoautomat-${slug()}.png`));

// hand the strip to the page around us, which pins it to the board
$('pin').addEventListener('click', async () => {
  if (!stripOnly) return;
  const t = document.createElement('canvas'); const w = 320; t.width = w; t.height = Math.round(stripOnly.height * w / stripOnly.width);
  t.getContext('2d').drawImage(stripOnly, 0, 0, t.width, t.height);
  const entry = { img: t.toDataURL('image/jpeg', 0.82), sig: ($('p-sig').value || '').trim(), at: Date.now() };
  $('pin').disabled = true; $('pin-status').textContent = 'Wird aufgehängt …';
  try { $('pin-status').textContent = await window.parent.erosPin(entry); }
  catch (e) { console.warn(e); $('pin-status').textContent = 'Hat nicht geklappt. Versuch es gleich nochmal.'; $('pin').disabled = false; }
});
