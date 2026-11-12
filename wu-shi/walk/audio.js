// Sound for The Walk Down. Everything is synthesised here, there are no audio files:
// a wooden tock for his steps, plucked notes for the story, a gong when a head takes him, chattering for the white ones.
let ac = null, master, send, noiseBuf, windF, windG, droneG, muted = false;
try { muted = localStorage.getItem("walk-mute") === "1"; } catch {}
const PENTA = [0, 2, 4, 7, 9];            // the five notes everything is tuned to
const hz = n => 146.83 * Math.pow(2, (PENTA[((n % 5) + 5) % 5] + 12 * Math.floor(n / 5)) / 12);

function start() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : .85;
  const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
  // a little echo, as in a stairwell
  send = ac.createGain(); const delay = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain(), damp = ac.createBiquadFilter();
  delay.delayTime.value = .31; fb.gain.value = .36; wet.gain.value = .3; damp.type = "lowpass"; damp.frequency.value = 1800;
  send.connect(delay); delay.connect(damp); damp.connect(fb); fb.connect(delay); damp.connect(wet); wet.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // air: wind on the mountain, a low hum in the stairs
  const wind = ac.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true; windF = ac.createBiquadFilter(); windF.type = "bandpass"; windF.frequency.value = 500; windF.Q.value = .6;
  windG = ac.createGain(); windG.gain.value = .05; wind.connect(windF); windF.connect(windG); windG.connect(master); wind.start();
  droneG = ac.createGain(); droneG.gain.value = 0; droneG.connect(master);
  for (const [f, v] of [[55, .5], [55.6, .4], [82.4, .22], [110.3, .1]]) { const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.value = v; o.connect(g); g.connect(droneG); o.start(); }
}
function out(g, echo) { g.connect(master); if (echo) { const s = ac.createGain(); s.gain.value = echo; g.connect(s); s.connect(send); } }
// one note: freq (and where it slides to), attack, decay, loudness
function tone(f, o = {}) {
  if (!ac) return; const t = ac.currentTime + (o.at || 0), a = o.a ?? .004, d = o.d ?? .3, osc = ac.createOscillator(), g = ac.createGain();
  osc.type = o.type || "sine"; osc.frequency.setValueAtTime(f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide ?? a + d));
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(o.v ?? .2, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
  let last = osc; if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = o.lp; osc.connect(fl); last = fl; }
  last.connect(g); out(g, o.echo); osc.start(t); osc.stop(t + a + d + .05);
}
// a breath of noise through a filter
function hiss(f, o = {}) {
  if (!ac) return; const t = ac.currentTime + (o.at || 0), a = o.a ?? .005, d = o.d ?? .2, src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; src.loop = true; fl.type = o.type || "bandpass"; fl.Q.value = o.q ?? 1; fl.frequency.setValueAtTime(f, t); if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + a + d);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(o.v ?? .2, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
  src.connect(fl); fl.connect(g); out(g, o.echo); src.start(t, Math.random()); src.stop(t + a + d + .05);
}
const bell = (f, v, d, at = 0) => [[1, 1], [2.76, .5], [5.4, .25], [8.9, .12]].forEach(([m, k]) => { if (f * m < 9000) tone(f * m, { v:v * k, d:d / Math.sqrt(m), echo:.5, at }); });

export const sfx = {
  start, get muted() { return muted; },
  mute(m) { muted = m; try { localStorage.setItem("walk-mute", m ? "1" : "0"); } catch {} if (ac) master.gain.setTargetAtTime(m ? 0 : .85, ac.currentTime, .05); },
  // 0 = on the mountain (wind), 0..1 = how deep in the stairs (hum, darker)
  air(inside, depth) { if (!ac) return; const t = ac.currentTime;
    windG.gain.setTargetAtTime(inside ? .022 : .06, t, .6); windF.frequency.setTargetAtTime(inside ? 220 - 90 * depth : 520, t, .6); droneG.gain.setTargetAtTime(inside ? .03 + .05 * depth : 0, t, 1.2); },
  step(n) { const f = n % 2 ? 520 : 610; tone(f, { to:f * .72, d:.07, v:.075, type:"triangle", echo:.35 }); hiss(1900, { d:.03, v:.03, q:2 }); },
  roll() { hiss(500, { to:2400, a:.05, d:.22, v:.11, q:1.4, echo:.3 }); tone(300, { to:520, d:.18, v:.04, type:"triangle" }); },
  hit() { tone(82, { to:50, d:1.5, v:.5, echo:.5 }); tone(123, { to:118, d:1.2, v:.2, echo:.5 }); tone(207, { d:.9, v:.1, echo:.5 }); tone(331, { d:.6, v:.06, echo:.5 });
    hiss(700, { to:150, d:.45, v:.3, q:.7, echo:.4 }); tone(240, { to:760, a:.05, d:1.0, v:.05, type:"sawtooth", lp:1400, at:.1 }); },
  boost() { bell(hz(12), .2, 1.3); bell(hz(14), .16, 1.3, .09); bell(hz(17), .14, 1.6, .18); hiss(900, { to:5000, a:.08, d:.4, v:.1, q:1.2, echo:.4 }); },
  pluck(i) { const f = hz(5 + [0, 2, 1, 4, 3, 5, 2, 6][i % 8]); tone(f, { type:"triangle", d:1.7, v:.17, echo:.7, lp:2600 }); tone(f * 2.01, { d:.5, v:.04, echo:.5 }); hiss(f * 3, { d:.03, v:.05, q:3 }); },
  chatter(n = 3) { for (let i = 0; i < n; i++) { const f = 650 + Math.random() * 600, at = i * (.07 + Math.random() * .05);
    tone(f, { to:f * (1.25 + Math.random() * .4), d:.07, v:.05, type:"sawtooth", lp:2600, at, echo:.4 }); } },
  screech() { tone(900, { to:2100, a:.03, d:.3, v:.1, type:"sawtooth", lp:3600, echo:.5 }); tone(1350, { to:2500, a:.03, d:.24, v:.05, type:"square", lp:3600, at:.03 }); },
  grab() { sfx.screech(); tone(110, { to:60, d:.7, v:.35, echo:.4 }); hiss(500, { to:200, d:.3, v:.2, q:.8 }); },
  boom() { tone(70, { to:34, d:1.1, v:.6, echo:.4 }); hiss(300, { to:80, d:.7, v:.35, q:.6, echo:.3 }); hiss(2600, { d:.12, v:.1, q:1 }); },
  whoosh(len = .7) { hiss(350, { to:2600, a:len * .5, d:len * .5, v:.14, q:1.2, echo:.3 }); },
  shimmer() { for (let i = 0; i < 5; i++) tone(hz(15 + i), { d:.7, v:.035, at:i * .07, echo:.6 }); },
  scratch() { hiss(3200 + Math.random() * 900, { d:.035, v:.05, q:4 }); },
  tock() { tone(430, { to:330, d:.06, v:.12, type:"triangle", echo:.3 }); },
  gong() { bell(98, .3, 3.2); tone(49, { d:3, v:.3, echo:.4 }); },
  rice() { [5, 7, 9, 10].forEach((n, i) => tone(hz(n), { type:"triangle", d:1.2, v:.14, at:i * .16, echo:.6, lp:2600 })); },
  name() { [10, 9, 7, 5].forEach((n, i) => tone(hz(n), { type:"triangle", d:2.2, v:.14, at:i * .28, echo:.7, lp:2600 })); bell(hz(5), .12, 3, 1.2); },
};
