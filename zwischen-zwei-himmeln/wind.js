// Two wind turbines at dusk, side by side like the two boys.
// One turns. The other stands, a blade snapped, its warning light dead. Nobody repairs it.
import * as THREE from "three";

function turbine(mat, broken) {
  const g = new THREE.Group();
  const H = 9;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, H, 20), mat); tower.position.y = H / 2; g.add(tower);
  const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 1.3), mat); nacelle.position.set(0, H + 0.2, -0.15); g.add(nacelle);
  const rotor = new THREE.Group(); rotor.position.set(0, H + 0.2, 0.55); g.add(rotor);
  rotor.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 12), mat));

  // a blade: flat, tapering, slightly swept
  const shape = new THREE.Shape();
  shape.moveTo(-0.16, 0); shape.quadraticCurveTo(-0.24, 1.2, -0.05, 4.4); shape.lineTo(0.02, 4.4); shape.quadraticCurveTo(0.12, 1.4, 0.16, 0); shape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(bladeGeo, mat);
    b.rotation.z = (i / 3) * Math.PI * 2;
    if (broken && i === 1) { b.scale.y = 0.42; }                    // snapped off
    rotor.add(b);
  }
  if (broken) rotor.rotation.z = 0.5;

  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: broken ? 0x2a1010 : 0xff2a1a }));
  lamp.position.set(0, H + 0.5, -0.5); g.add(lamp);
  return { g, rotor, lamp };
}

export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x3a2e33, 30, 90);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xe7a27c, 0x0b0a0c, 0.5));
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1618 });

  // a low rise in the foreground, the flat land beyond
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), new THREE.MeshBasicMaterial({ color: 0x120e10, fog: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; scene.add(ground);
  const hill = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 16, 0, Math.PI * 2, 0, 0.35), new THREE.MeshBasicMaterial({ color: 0x0c0a0b, fog: false }));
  hill.position.set(0, -28.4, -6); scene.add(hill);

  const a = turbine(dark, false), b = turbine(dark, true);
  a.g.position.set(-4.2, 1.2, -18); b.g.position.set(4.6, 1.0, -21);
  a.g.rotation.y = 0.12; b.g.rotation.y = -0.08;
  scene.add(a.g, b.g);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 1.6, camera.aspect < 0.9 ? 16 : 9);
    camera.lookAt(0, 6.2, -20);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let active = false;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (!active) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    a.rotor.rotation.z -= dt * 0.9;
    b.rotor.rotation.z = 0.5 + Math.sin(t * 0.6) * 0.004;                // only the faintest shudder
    a.lamp.visible = Math.floor(t) % 2 === 0;
    renderer.render(scene, camera);
  });
  renderer.render(scene, camera);
  return { setActive(on) { active = on; if (on) clock.getDelta(); } };
}
