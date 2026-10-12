// After Jordan Wolfson's (Female figure): an animatronic dancer held by a rod in front of a mirror.
// Here she wears the Eros head, black in front of the mirror, white inside it,
// and the reflection dances a beat late, a representation that never quite catches up.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const LAG = 0.3;            // seconds the reflection trails behind
const BEAT = 1.7;           // seconds per dance cycle
const UP = new THREE.Vector3(0, 1, 0);

function dancer(mats, headMat) {
  const root = new THREE.Group();
  const seg = (r, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 1, 18), mat); m.castShadow = true; root.add(m); return m; };
  const ball = (r, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat); m.castShadow = true; root.add(m); return m; };
  const place = (m, a, b) => {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
    m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
  };

  // torso: a corseted lathe from waist to chest
  const prof = [[0.001, 0], [0.12, 0], [0.135, 0.06], [0.11, 0.2], [0.15, 0.36], [0.16, 0.44], [0.07, 0.5], [0.001, 0.5]].map(([x, y]) => new THREE.Vector2(x, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), mats.dress); torso.scale.z = 0.72; torso.castShadow = true; root.add(torso);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, 0.3, 28, 1, true), mats.skirt); root.add(skirt);
  // the Eros head arrives once its model has loaded
  const head = new THREE.Group(); root.add(head);
  function setHead(model) {
    const m = model.clone(true);
    m.traverse((o) => { if (o.isMesh) { o.material = headMat; o.castShadow = true; } });
    m.scale.setScalar(0.5);                 // model is 0.48 tall -> a 24 cm head
    m.rotation.y = Math.PI;                 // model faces +z, she faces the mirror (-z)
    head.add(m);
  }
  const neck = seg(0.035, mats.skin);
  const upperArm = [seg(0.04, mats.plastic), seg(0.04, mats.plastic)];
  const foreArm = [seg(0.034, mats.plastic), seg(0.034, mats.plastic)];
  const hand = [ball(0.04, mats.plastic), ball(0.04, mats.plastic)];
  const thigh = [seg(0.07, mats.skin), seg(0.07, mats.skin)];
  const shin = [seg(0.055, mats.plastic), seg(0.055, mats.plastic)];
  const foot = [seg(0.035, mats.plastic), seg(0.035, mats.plastic)];
  const heel = [seg(0.012, mats.plastic), seg(0.012, mats.plastic)];
  const joints = Array.from({ length: 8 }, () => ball(0.05, mats.joint));   // shoulders, elbows, hips, knees

  const v = () => new THREE.Vector3();
  const q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "YXZ"));
  const rot = (qq, x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(qq);
  const L1 = 0.45, L2 = 0.46;

  // two-bone leg: knee pushed forward (toward the mirror, -z) and out
  function knee(hip, ankle, side) {
    const d = new THREE.Vector3().subVectors(ankle, hip); const dist = Math.min(d.length(), L1 + L2 - 1e-3); d.normalize();
    const along = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(L1 * L1 - along * along, 0));
    const pole = new THREE.Vector3(side * 0.5, 0, -1); pole.addScaledVector(d, -pole.dot(d)).normalize();
    return hip.clone().addScaledVector(d, along).addScaledVector(pole, h);
  }

  const chestFront = v();
  function update(t) {
    const w = (Math.PI * 2) / BEAT;
    const P = new THREE.Vector3(0.07 * Math.sin(w * t), 0.84 + 0.035 * Math.sin(2 * w * t + 0.6), 0.02 * Math.sin(2 * w * t));
    const qP = q(0.1, 0.3 * Math.sin(w * t), 0.15 * Math.sin(w * t + 0.4));
    const qC = qP.clone().multiply(q(0.14 + 0.06 * Math.sin(2 * w * t), -0.24 * Math.sin(w * t), -0.2 * Math.sin(w * t + 0.4)));
    const qH = qC.clone().multiply(q(0.12 * Math.sin(2 * w * t + 1), 0.35 * Math.sin(w * t * 0.5), 0.28 * Math.sin(w * t + 1)));
    const qS = qP.clone().slerp(qC, 0.5);

    torso.position.copy(P).add(rot(qS, 0, -0.02, 0)); torso.quaternion.copy(qS);
    skirt.position.copy(P).add(rot(qP, 0, -0.06, 0)); skirt.quaternion.copy(qP);
    const C = P.clone().add(rot(qC, 0, 0.46, 0));
    const N = C.clone().add(rot(qC, 0, 0.08, 0));
    const Hc = N.clone().add(rot(qH, 0, 0.11, 0));
    place(neck, C, Hc.clone().add(rot(qH, 0, -0.06, 0)));
    head.position.copy(Hc).add(rot(qH, 0, 0.03, 0)); head.quaternion.copy(qH);
    chestFront.copy(P).add(rot(qC, 0, 0.36, -0.1));

    [-1, 1].forEach((s, i) => {
      // arms spread wide, wrists flicking on the beat
      const ph = s * 0.8;
      const S = C.clone().add(rot(qC, s * 0.19, -0.04, 0));
      const E = S.clone().add(rot(qC, s, -0.12 + 0.25 * Math.sin(w * t + ph), -0.3).normalize().multiplyScalar(0.29));
      const Wr = E.clone().add(rot(qC, s, 0.15 + 0.35 * Math.sin(2 * w * t + ph), -0.55).normalize().multiplyScalar(0.27));
      place(upperArm[i], S, E); place(foreArm[i], E, Wr); hand[i].position.copy(Wr);
      joints[i].position.copy(S); joints[2 + i].position.copy(E);

      // legs: feet planted wide, knees bend as the hips drop
      const hip = P.clone().add(rot(qP, s * 0.1, -0.04, 0));
      const ankle = new THREE.Vector3(s * 0.31, 0.12, 0.06);
      const K = knee(hip, ankle, s);
      place(thigh[i], hip, K); place(shin[i], K, ankle);
      place(foot[i], ankle, new THREE.Vector3(s * 0.33, 0.015, -0.1));            // steep, high-heeled foot
      place(heel[i], ankle.clone().add(new THREE.Vector3(0, -0.03, 0.04)), new THREE.Vector3(s * 0.31, 0, 0.11));
      joints[4 + i].position.copy(hip); joints[6 + i].position.copy(K);
    });
  }
  return { root, update, chestFront, setHead };
}

export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#dcd9d4");
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d8a84, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(1.6, 4.5, 3.2); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
  sun.shadow.radius = 6;
  scene.add(sun);

  const mats = {
    plastic: new THREE.MeshStandardMaterial({ color: 0xf3f1ed, roughness: 0.22, metalness: 0 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd9c0ae, roughness: 0.65 }),
    dress: new THREE.MeshStandardMaterial({ color: 0xe8e8ec, roughness: 0.35 }),
    skirt: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    headBlack: new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.25, metalness: 0.2 }),
    headWhite: new THREE.MeshStandardMaterial({ color: 0xf6f5f2, roughness: 0.3 }),
    joint: new THREE.MeshStandardMaterial({ color: 0x4a4847, roughness: 0.4, metalness: 0.6 }),
    rod: new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.25, metalness: 0.9 }),
  };
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1efeb, roughness: 0.95 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0xa29f99, roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // the wall with the mirror cut out of it (mirror: x ±1.25, y 0.3..2.5, at z = 0)
  const MX = 1.25, MY0 = 0.3, MY1 = 2.5, WALL = 4.2;
  const box = (x0, x1, y0, y1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.02), wallMat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, -0.012); m.receiveShadow = true; scene.add(m); };
  box(-8, -MX, 0, WALL); box(MX, 8, 0, WALL); box(-MX, MX, MY1, WALL); box(-MX, MX, 0, MY0);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(MX * 2, MY1 - MY0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false }));
  pane.position.set(0, (MY0 + MY1) / 2, 0.001); scene.add(pane);

  // the world behind the glass is the room, flipped
  function room(parent) {
    const far = new THREE.Mesh(new THREE.PlaneGeometry(16, WALL), wallMat); far.position.set(0, WALL / 2, 6); far.rotation.y = Math.PI; parent.add(far);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(12, WALL), wallMat); side.position.set(-3.6, WALL / 2, 3); side.rotation.y = Math.PI / 2; parent.add(side);
  }
  function figureWithRod(parent, headMat) {
    const d = dancer(mats, headMat);
    d.root.position.z = 0.95; parent.add(d.root);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 10), mats.rod); rod.castShadow = true; parent.add(rod);
    const anchor = new THREE.Vector3(0.05, 1.24, 0.0);
    return {
      setHead: d.setHead,
      update(t) {
        d.update(t);
        const tip = d.chestFront.clone().add(d.root.position);
        const dir = tip.clone().sub(anchor), len = dir.length();
        rod.position.copy(anchor).addScaledVector(dir, 0.5); rod.scale.set(1, len, 1);
        rod.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
      },
    };
  }
  const real = new THREE.Group(); scene.add(real);
  const mirrored = new THREE.Group(); mirrored.scale.z = -1; scene.add(mirrored);
  room(real); room(mirrored);
  const her = figureWithRod(real, mats.headBlack), reflection = figureWithRod(mirrored, mats.headWhite);
  const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/"));
  loader.load("../models/head.glb", (g) => { her.setHead(g.scene); reflection.setHead(g.scene); renderer.render(scene, camera); });

  // the camera stands behind her right shoulder, looking past her into the mirror
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const portrait = camera.aspect < 0.9;
    camera.position.set(portrait ? 1.2 : 1.75, 1.35, portrait ? 6.6 : 4.9);
    camera.lookAt(-0.1, 1.1, 0.1);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let active = false;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (!active) return;
    const t = clock.getElapsedTime();
    her.update(t);
    reflection.update(t - LAG);
    renderer.render(scene, camera);
  });
  her.update(0); reflection.update(-LAG); renderer.render(scene, camera);
  return { setActive(on) { active = on; } };
}
