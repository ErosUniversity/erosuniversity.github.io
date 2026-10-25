// unc-Branding für alle Versionen. Seiten binden brand.css und brand.js ein und markieren:
//   [data-unc]       das unc-Logo: "wordmark" (u n c) oder "mark" (das U), in der Textfarbe der Seite
//   [data-om-sound]  den Klang-Schalter, Beschriftung aus data-on und data-off
//   [data-om-chime]  die Chat-Liste, Wert ist der Selektor für Agent-Nachrichten
// Klang: Netzbrummen (50 Hz) geht in ein Om (136,1 Hz) über. Browser erlauben Ton erst nach einem Klick.
(() => {
  // Offizielles unc-Logo, wie workspace/assets/unc-wordmark-black.svg: drei Bögen mit flachen Füßen,
  // als Linie gezeichnet. Das U allein ist das Icon.
  const LINE = '<g fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round">';
  const LETTERS = {
    u: '<path d="M-22 -12 L-26.2 -12 A14 14 0 1 1 -45.8 -12 L-50 -12"/>',
    n: '<path d="M-12 12 L-7.8 12 A14 14 0 1 1 11.8 12 L16 12"/>',
    c: '<path d="M50 14 L50 9.8 A14 14 0 1 1 50 -9.8 L50 -14"/>'
  };
  const LOGOS = {
    mark: { box: [-52.5, -14.5, 33, 29], body: LINE + LETTERS.u + "</g>" },
    wordmark: { box: [-56, -20, 112, 40], body: LINE + LETTERS.u + LETTERS.n + LETTERS.c + "</g>" }
  };
  const TOP = document.body.hasAttribute("data-versions") && window.top === window.self;
  const CALM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("unc-js");

  // Versionsleiste oben auf Seiten mit <body data-versions>: die Auswahl öffnet eine andere Aufmachung
  // und behält den offenen Bereich (#finance usw.). In versionen.html (iframe) bleibt sie weg.
  const SITE = new URL(".", document.currentScript.src);
  const VERSIONS = [["index.html", "1 Newspaper"], ["b/", "2 Trade Republic"], ["c/", "3 Gen Z"], ["workspace/", "4 Workspace"], ["welcome/", "5 Workerbee"]];
  if (TOP) {
    const here = location.pathname.replace(/index\.html$/, "");
    const options = VERSIONS.map(([path, name]) => {
      const url = new URL(path, SITE);
      const current = url.pathname.replace(/index\.html$/, "") === here;
      return '<option value="' + url.href + '"' + (current ? " selected" : "") + ">" + name + "</option>";
    });
    const known = options.some((option) => option.includes(" selected"));
    const bar = document.createElement("div");
    bar.className = "unc-versions";
    bar.innerHTML = '<span class="unc-logo" data-unc="mark" style="--unc-h: 16px"></span>' +
      '<label for="unc-version">Version</label>' +
      '<select id="unc-version">' + (known ? "" : '<option value="" selected disabled>Original</option>') + options.join("") + "</select>";
    document.body.prepend(bar);
    document.documentElement.style.setProperty("--unc-bar", bar.offsetHeight + "px");
    bar.querySelector("select").addEventListener("change", (event) => {
      if (event.target.value) switchTo(event.target.value + location.hash);
    });
  }

  document.querySelectorAll("[data-unc]").forEach((el) => {
    const logo = LOGOS[el.dataset.unc];
    if (!logo) return;
    const [x, y, w, h] = logo.box;
    el.innerHTML = '<svg viewBox="' + logo.box.join(" ") + '" width="' + w + '" height="' + h + '" fill="currentColor" aria-hidden="true">' + logo.body + "</svg>";
    if (!el.hasAttribute("aria-label")) {
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", "unc");
    }
  });

  // --- Klang ---
  const OM = 136.1;
  const buttons = document.querySelectorAll("[data-om-sound]");
  let audio = null;
  let master = null;
  let on = false;
  let lastChime = -1;

  function ensureAudio() {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      master = audio.createGain();
      master.gain.value = on ? 1 : 0;
      master.connect(audio.destination);
    }
    audio.resume();
  }

  function voice(type, freq, level, start, stop, into) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = level;
    osc.connect(gain).connect(into);
    osc.start(start);
    osc.stop(stop);
  }

  function envelope(peak, start, top, end) {
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, audio.currentTime);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, top);
    gain.gain.linearRampToValueAtTime(0, end);
    gain.connect(master);
    return gain;
  }

  function playOm() {
    const now = audio.currentTime;

    const hum = audio.createBiquadFilter();
    hum.type = "lowpass";
    hum.frequency.value = 320;
    hum.connect(envelope(0.06, now, now + 0.5, now + 2.4));
    voice("sawtooth", 50, 1, now, now + 2.5, hum);

    const mouth = audio.createBiquadFilter();
    mouth.type = "lowpass";
    mouth.Q.value = 4;
    mouth.frequency.setValueAtTime(1100, now);
    mouth.frequency.setValueAtTime(1100, now + 2.6);
    mouth.frequency.linearRampToValueAtTime(600, now + 4.2);
    mouth.frequency.linearRampToValueAtTime(250, now + 5.8);
    mouth.connect(envelope(0.22, now + 0.8, now + 2.6, now + 7.5));
    voice("sawtooth", OM, 0.5, now + 0.8, now + 7.6, mouth);
    voice("sawtooth", OM * 1.004, 0.4, now + 0.8, now + 7.6, mouth);
    voice("sine", OM / 2, 0.6, now + 0.8, now + 7.6, mouth);
  }

  // kurzer Ton: Glocke, schnell an, klingt aus
  function bell(freq, at) {
    [[freq, 0.08], [freq * 2.76, 0.022]].forEach(([f, level]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(level, at + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.38);
      osc.connect(gain).connect(master);
      osc.start(at);
      osc.stop(at + 0.4);
    });
  }

  // langer Ton: ein Om, Mund geht von A über U zu M zu
  function om(at, dur) {
    const mouth = audio.createBiquadFilter();
    mouth.type = "lowpass";
    mouth.Q.value = 3;
    mouth.frequency.setValueAtTime(900, at);
    mouth.frequency.linearRampToValueAtTime(320, at + dur);
    mouth.connect(envelope(0.16, at, at + 0.06, at + dur));
    voice("sawtooth", OM, 0.5, at, at + dur + 0.05, mouth);
    voice("sawtooth", OM * 1.004, 0.4, at, at + dur + 0.05, mouth);
    voice("sine", OM / 2, 0.6, at, at + dur + 0.05, mouth);
  }

  function playChime() {
    if (!on || !audio) return;
    const now = audio.currentTime;
    if (lastChime >= 0 && now - lastChime < 0.25) return;
    lastChime = now;
    [[OM * 4, 0.08], [OM * 4 * 2.76, 0.025]].forEach(([freq, level]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(level, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      osc.connect(gain).connect(master);
      osc.start(now);
      osc.stop(now + 1.5);
    });
  }

  function showSound() {
    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", String(on));
      button.textContent = on ? button.dataset.on : button.dataset.off;
    });
  }

  function setSound(next) {
    on = next;
    try { localStorage.setItem("unc-sound", on ? "on" : "off"); } catch (error) {}
    showSound();
    ensureAudio();
    master.gain.setTargetAtTime(on ? 1 : 0, audio.currentTime, 0.08);
    if (!on) return;
    playOm();
    document.querySelectorAll("[data-unc]").forEach((mark) => {
      mark.classList.remove("unc-breathe");
      void mark.offsetWidth;
      mark.classList.add("unc-breathe");
    });
  }

  // "Klang an" gilt über alle Versionen; der Ton selbst startet beim ersten Klick auf der neuen Seite.
  try { on = localStorage.getItem("unc-sound") === "on"; } catch (error) {}
  showSound();
  if (on) {
    const wake = () => ensureAudio();
    addEventListener("pointerdown", wake, { once: true, capture: true });
    addEventListener("keydown", wake, { once: true, capture: true });
  }
  buttons.forEach((button) => button.addEventListener("click", () => setSound(!on)));

  document.querySelectorAll("[data-om-chime]").forEach((list) => {
    const selector = list.dataset.omChime;
    // Chats zeichnen oft den ganzen Verlauf neu; geklingelt wird nur, wenn eine Agent-Nachricht dazukommt.
    let seen = list.querySelectorAll(selector).length;
    new MutationObserver(() => {
      const count = list.querySelectorAll(selector).length;
      if (count > seen) playChime();
      seen = count;
    }).observe(list, { childList: true });
  });

  // --- Ladeanimation ---
  // Drei kurz, drei lang, drei kurz, Bild und Ton auf demselben Takt (ms ab Start):
  //   kurz 1–3  das u klopft dreimal (Glocke)
  //   lang 1–2  das Horn rollt nach rechts, wird zum n und zum c und lässt Tiffany-Schatten stehen (Om)
  //   lang 3    die Schatten werden schwarz (Om)
  //   kurz 4–6  u, n, c springen nacheinander auf (Glocken als Dur-Dreiklang)
  const BEATS = [[0, "short"], [220, "short"], [440, "short"], [810, "long"], [1410, "long"], [2010, "long"], [2750, "short"], [2970, "short"], [3190, "short"]];
  const LONG = 480;
  const END = 3450;
  // Mitte jedes Buchstabens im Logo und Drehung des u dort; das Horn ist das u um seine eigene Mitte.
  const SPOTS = [[-36, -2, 0], [2, 2, 180], [40, 0, 450]];
  const HORN = '<path d="M14 -10 L9.8 -10 A14 14 0 1 1 -9.8 -10 L-14 -10"/>';
  let current = null;

  function runLoader(withSound, keep) {
    if (current) current.cut();
    const loader = document.createElement("div");
    loader.className = "unc-loader";
    loader.setAttribute("aria-hidden", "true");
    const shadow = (letter) => '<g class="unc-shadow">' + LETTERS[letter] + "</g>";
    loader.innerHTML = '<svg viewBox="-56 -20 112 40">' + LINE +
      shadow("u") + shadow("n") + shadow("c") + '<g class="unc-hop"><g class="unc-horn">' + HORN + "</g></g></g></svg>";
    document.body.append(loader);
    const shadows = loader.querySelectorAll(".unc-shadow");
    const hop = loader.querySelector(".unc-hop");
    const horn = loader.querySelector(".unc-horn");
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const place = ([x, y, angle]) => horn.setAttribute("transform", "translate(" + x + " " + y + ") rotate(" + angle + ")");
    const between = (a, b, k) => a.map((v, i) => v + (b[i] - v) * ease(k));

    let done = false;
    let fired = 0;
    let start = performance.now() + 50;
    let resolve;
    const finished = new Promise((r) => { resolve = r; });

    if (withSound && on && audio) {
      const base = audio.currentTime + 0.05;
      const chord = [OM * 4, OM * 5, OM * 6];
      BEATS.forEach(([ms, kind], i) => {
        const at = base + ms / 1000;
        if (kind === "long") om(at, LONG / 1000);
        else bell(i < 3 ? OM * 4 : chord[i - 6], at);
      });
    }

    function ink() {
      shadows.forEach((s) => {
        s.style.transition = "opacity 0.25s ease, color " + LONG + "ms ease";
        s.classList.add("unc-left", "unc-ink");
      });
    }

    function beat(i) {
      if (i < 3) hop.animate([{ transform: "none" }, { transform: "translateY(-4px)" }, { transform: "none" }], { duration: 160, easing: "ease-out" });
      else if (i === 5) ink();
      else if (i > 5) shadows[i - 6].animate([{ transform: "none" }, { transform: "scale(1.18)" }, { transform: "none" }], { duration: 200, easing: "ease-out" });
    }

    function stop() {
      if (done) return;
      done = true;
      ink();
      horn.style.opacity = 0;
      resolve();
      if (!keep) {
        loader.classList.add("unc-out");
        setTimeout(() => loader.remove(), 350);
      }
    }

    function frame(now) {
      if (done) return;
      const t = now - start;
      // Kommt ein Bild zu spät (Tab im Hintergrund), werden verpasste Klopfer ausgelassen statt gebündelt.
      while (fired < BEATS.length && t >= BEATS[fired][0]) {
        if (fired >= 3 || t - BEATS[fired][0] < 150) beat(fired);
        fired += 1;
      }
      const [r1, r2] = [BEATS[3][0], BEATS[4][0]];
      if (t < r1) place(SPOTS[0]);
      else if (t < r1 + LONG) place(between(SPOTS[0], SPOTS[1], (t - r1) / LONG));
      else if (t < r2) place(SPOTS[1]);
      else if (t < r2 + LONG) place(between(SPOTS[1], SPOTS[2], (t - r2) / LONG));
      else place(SPOTS[2]);
      if (t >= r1) shadows[0].classList.add("unc-left");
      if (t >= r2) shadows[1].classList.add("unc-left");
      if (t >= BEATS[5][0] + LONG) horn.style.opacity = 0;
      if (t >= END) return stop();
      requestAnimationFrame(frame);
    }

    place(SPOTS[0]);
    if (CALM) {
      ink();
      horn.style.opacity = 0;
      setTimeout(stop, 500);
    } else {
      requestAnimationFrame(frame);
    }
    loader.addEventListener("click", stop);
    addEventListener("keydown", stop, { once: true });
    current = { cut: () => { done = true; loader.remove(); } };
    return finished;
  }

  // Beim Wechsel spielt die Animation noch auf der alten Seite: die Auswahl ist der Klick, der Ton erlaubt.
  // Die neue Seite zeigt sich dann ohne zweite Animation.
  function switchTo(url) {
    if (CALM) {
      location.href = url;
      return;
    }
    if (on) ensureAudio();
    runLoader(true, true).then(() => {
      try { sessionStorage.setItem("unc-skip-loader", "1"); } catch (error) {}
      location.href = url;
    });
  }

  if (TOP) {
    let skip = false;
    try {
      skip = sessionStorage.getItem("unc-skip-loader") === "1";
      sessionStorage.removeItem("unc-skip-loader");
    } catch (error) {}
    if (!skip) runLoader(false, false);
  }

  window.omBrand = { playOm, playChime, setSound, runLoader, get on() { return on; } };
})();
