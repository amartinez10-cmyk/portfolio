/*
 * Pantalla de carga "hacker": lluvia de código, un terminal que escribe el arranque (en el
 * idioma de la web) y una barra de progreso. Los pasos esperan de verdad a lo que cargan:
 * el de los módulos 3D no termina hasta que la escena está lista. Al acabar aparece
 * "ACCESO CONCEDIDO", la pantalla se apaga como un tubo catódico y se avisa a la página
 * (evento portfolio:boot-done) para que empiece su entrada y el 3D vuele hasta su sitio.
 *
 * Se salta con el botón, Esc, Enter, Espacio o un clic. No se muestra con "reducir movimiento"
 * ni con ?boot=off (lo decide el <head>). Para revisarla a cámara lenta: ?bootslow=4
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var boot = document.getElementById("boot");
  if (boot && !root.classList.contains("booting")) boot.remove();   // sin pantalla de carga: fuera del DOM
  if (!boot || !root.classList.contains("booting")) return;
  root.dataset.boot = "running";

  var slow = Math.max(0.1, parseFloat(new URLSearchParams(location.search).get("bootslow")) || 1);
  var LANGS = ["ca", "en", "es"];

  function pickLang() {
    var stored = null;
    try { stored = localStorage.getItem("portfolio-lang"); } catch (e) { /* sin almacenamiento */ }
    if (LANGS.indexOf(stored) !== -1) return stored;
    var browser = (navigator.language || "").slice(0, 2).toLowerCase();
    return LANGS.indexOf(browser) !== -1 ? browser : "es";
  }

  var all = window.TRANSLATIONS || {};
  var dict = all[pickLang()] || all.es || {};
  function t(key, fallback) { return dict[key] || fallback; }

  function q(sel) { return boot.querySelector(sel); }
  var els = {
    rain: q(".boot__rain"), log: q(".boot__log"), blocks: q(".boot__blocks"), pct: q(".boot__pct"),
    hex: q(".boot__hex"), granted: q(".boot__granted span"), line: q(".boot__line"), skip: q(".boot__skip"),
    cpu: q(".boot__cpu"), mem: q(".boot__mem"), net: q(".boot__net")
  };
  els.granted.textContent = els.granted.dataset.text = t("boot.granted", "ACCESS GRANTED");

  var state = { skipped: false, finished: false };
  var pending = [];

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Pausa que se puede cortar de golpe al saltar la pantalla
  function sleep(ms) {
    if (state.skipped) return Promise.resolve();
    return new Promise(function (resolve) {
      var entry = { id: 0, resolve: null };
      entry.resolve = function () {
        clearTimeout(entry.id);
        pending.splice(pending.indexOf(entry), 1);
        resolve();
      };
      entry.id = setTimeout(entry.resolve, ms * slow);
      pending.push(entry);
    });
  }

  function timeout(ms, value) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(value); }, ms); });
  }

  /* ---------- Lluvia de código ---------- */

  var rain = (function () {
    var canvas = els.rain;
    var ctx = canvas.getContext("2d");
    var glyphs = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEF<>{}[]$#%&*+=/";
    var size = 16;
    var drops = [];
    var speeds = [];
    var gates = [];      // cada columna se activa cuando la intensidad supera su umbral
    var parked = [];
    var api = { intensity: 0.5, speed: 1, hot: false };
    var w = 0;
    var h = 0;
    var raf = 0;
    var last = 0;

    function resize() {
      var px = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * px);
      canvas.height = Math.floor(h * px);
      ctx.setTransform(px, 0, 0, px, 0, 0);
      ctx.font = size + "px ui-monospace, Consolas, monospace";
      var cols = Math.ceil(w / size);
      while (drops.length < cols) {
        drops.push(-Math.random() * 40);
        speeds.push(rand(0.5, 1.4));
        gates.push(Math.random());
        parked.push(true);
      }
    }

    function glyph() { return glyphs.charAt(Math.floor(Math.random() * glyphs.length)); }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (now - last < 42) return;   // ~24 fps: el aspecto de un terminal
      last = now;
      ctx.fillStyle = "rgba(0, 0, 0, 0.065)";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < drops.length; i++) {
        if (parked[i]) {
          if (gates[i] >= api.intensity) continue;
          parked[i] = false;
          drops[i] = -Math.random() * 20;
        }
        var y = drops[i] * size;
        if (y > 0) {
          var x = i * size;
          ctx.fillStyle = api.hot ? "#ffffff" : "#d8fbff";
          ctx.fillText(glyph(), x, y);
          ctx.fillStyle = gates[i] > 0.85 ? "rgba(181,124,255,0.9)" : gates[i] > 0.4 ? "rgba(51,225,255,0.85)" : "rgba(108,134,255,0.85)";
          ctx.fillText(glyph(), x, y - size);
        }
        drops[i] += speeds[i] * api.speed;
        if (drops[i] * size > h && Math.random() > 0.975) {
          if (gates[i] < api.intensity) drops[i] = 0;
          else parked[i] = true;
        }
      }
    }

    api.start = function () {
      resize();
      window.addEventListener("resize", resize);
      raf = requestAnimationFrame(tick);
    };
    api.stop = function () {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
    return api;
  })();

  /* ---------- Datos que corren: volcado hexadecimal y contadores ---------- */

  function hex(n, digits) {
    var s = Math.floor(n).toString(16).toUpperCase();
    while (s.length < digits) s = "0" + s;
    return s;
  }

  var hexLines = [];
  for (var i = 0; i < 44; i++) hexLines.push("");
  var progress = { shown: 0, target: 0 };
  var BAR = 30;

  function tickData() {
    var bytes = [];
    for (var b = 0; b < 6; b++) bytes.push(hex(rand(0, 256), 2));
    hexLines.push("0x" + hex(rand(0, 65536), 4) + "  " + bytes.join(" "));
    hexLines.shift();
    els.hex.textContent = hexLines.join("\n");
    els.cpu.textContent = Math.floor(rand(12, 99));
    els.mem.textContent = rand(2, 15.9).toFixed(1);
    els.net.textContent = Math.floor(rand(120, 999));

    progress.shown += (progress.target - progress.shown) * 0.22;
    var p = Math.min(1, progress.shown);
    var n = Math.round(p * BAR);
    els.blocks.textContent = "█".repeat(n) + "░".repeat(BAR - n);
    els.pct.textContent = Math.round(p * 100) + "%";
  }

  var dataTimer = setInterval(tickData, 70);

  /* ---------- Terminal: escritura del arranque ---------- */

  var caret = document.createElement("span");
  caret.className = "boot__caret";

  function newLine() {
    var line = document.createElement("div");
    els.log.appendChild(line);
    line.appendChild(caret);
    while (els.log.children.length > 10) els.log.removeChild(els.log.firstChild);
    return line;
  }

  function put(line, text, cls) {
    var span = document.createElement("span");
    if (cls) span.className = cls;
    span.textContent = text;
    line.insertBefore(span, caret);
    return span;
  }

  // Escribe letra a letra (de golpe si se salta la pantalla)
  async function type(line, text, cls) {
    var span = put(line, "", cls);
    for (var i = 0; i < text.length; i++) {
      span.textContent += text.charAt(i);
      if (!state.skipped) await sleep(rand(4, 10));
    }
  }

  function withSpinner(line, promise) {
    var frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    var spin = put(line, "", "");
    var i = 0;
    var timer = setInterval(function () { spin.textContent = frames[i++ % frames.length]; }, 80);
    return promise.then(function (result) {
      clearInterval(timer);
      spin.remove();
      return result;
    });
  }

  /* ---------- Lo que se espera de verdad ---------- */

  function pageLoaded() {
    var loaded = new Promise(function (resolve) {
      if (document.readyState === "complete") resolve("ok");
      else window.addEventListener("load", function () { resolve("ok"); });
    });
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready.then(function () { return "ok"; }) : Promise.resolve("ok");
    return Promise.race([Promise.all([loaded, fonts]).then(function () { return "ok"; }), timeout(4500, "ok")]);
  }

  // El 3D lo carga js/boot3d.js (nada más empezar, mientras esta pantalla está delante)
  function sceneReady() {
    var s = root.dataset.scene;
    if (s === "full" || s === "lite") return Promise.resolve("ok");
    if (s === "off") return Promise.resolve("off");
    return Promise.race([
      new Promise(function (resolve) {
        document.addEventListener("portfolio:3d-status", function (e) {
          resolve(e.detail && e.detail.status === "ready" ? "ok" : "off");
        }, { once: true });
      }),
      timeout(6500, "off")
    ]);
  }

  var steps = [
    { key: "boot.l1", fallback: "Starting kernel" },
    { key: "boot.l2", fallback: "Checking hardware", wait: pageLoaded },
    { key: "boot.l3", fallback: "Mounting 3D modules", wait: sceneReady },
    { key: "boot.l4", fallback: "Compiling shaders" },
    { key: "boot.l5", fallback: "Loading skills" },
    { key: "boot.l6", fallback: "Encrypting connection" }
  ];

  /* ---------- Final: acceso concedido y apagado de pantalla ---------- */

  function setInert(value) {
    [document.querySelector(".site-header"), document.getElementById("content")].forEach(function (el) {
      if (el) el.inert = value;
    });
  }

  function flash() {
    var f = document.createElement("div");
    f.style.cssText = "position:absolute;inset:0;background:#fff;pointer-events:none;opacity:0";
    boot.appendChild(f);
    if (f.animate) f.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 420 * slow, easing: "ease-out" });
    setTimeout(function () { f.remove(); }, 450 * slow);
  }

  async function granted() {
    boot.classList.add("is-granted");
    rain.intensity = 1;
    rain.speed = 2.4;
    rain.hot = true;
    flash();
    await sleep(1000);
  }

  // Avisa a la página: empieza su entrada y el 3D vuela hasta su sitio
  function releasePage() {
    root.dataset.boot = "done";
    setInert(false);
    document.dispatchEvent(new CustomEvent("portfolio:boot-done"));
  }

  function finish() {
    clearInterval(dataTimer);
    rain.stop();
    document.removeEventListener("keydown", onKey);
    boot.remove();
    root.classList.remove("booting");
  }

  async function reveal(quick) {
    if (state.finished) return;
    state.finished = true;
    flush();
    var d = quick ? 0.55 : 1;
    // 1. La pantalla se aplasta hasta quedar en una línea brillante
    if (boot.animate) {
      boot.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(49.7% 0 49.7% 0)" }],
        { duration: 430 * d, easing: "cubic-bezier(0.7, 0, 0.84, 0)", fill: "forwards" });
      els.line.animate([{ opacity: 0 }, { opacity: 0, offset: 0.7 }, { opacity: 1 }], { duration: 430 * d, fill: "forwards" });
    }
    await new Promise(function (r) { setTimeout(r, 430 * d); });
    releasePage();
    // 2. La línea se contrae hasta un punto y se apaga; detrás ya empieza la entrada
    if (boot.animate) {
      boot.animate([
        { clipPath: "inset(49.7% 0 49.7% 0)", opacity: 1 },
        { clipPath: "inset(49.7% 49.6% 49.7% 49.6%)", opacity: 1, offset: 0.7 },
        { clipPath: "inset(49.7% 49.9% 49.7% 49.9%)", opacity: 0 }
      ], { duration: 330 * d, easing: "ease-in", fill: "forwards" });
    }
    await new Promise(function (r) { setTimeout(r, 340 * d); });
    finish();
  }

  function flush() {
    pending.slice().forEach(function (p) { p.resolve(); });
  }

  function skip() {
    if (state.skipped || state.finished) return;
    state.skipped = true;
    flush();
    reveal(true);
  }

  function onKey(e) {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      skip();
    }
  }

  els.skip.addEventListener("click", function (e) { e.stopPropagation(); skip(); });
  boot.addEventListener("click", skip);
  document.addEventListener("keydown", onKey);

  /* ---------- Guion ---------- */

  async function run() {
    var head = newLine();
    await type(head, "alex@portfolio:~$ ", "cmd");
    await type(head, "./boot.sh", "cmd");
    await sleep(150);

    for (var i = 0; i < steps.length && !state.skipped; i++) {
      var step = steps[i];
      var label = t(step.key, step.fallback);
      var line = newLine();
      await type(line, "> " + label + " " + ".".repeat(Math.max(3, 30 - label.length)) + " ", "");
      var result = "ok";
      if (step.wait && !state.skipped) result = await withSpinner(line, step.wait());
      put(line, "[ " + (result === "ok" ? t("boot.ok", "OK") : t("boot.omitted", "SKIPPED")) + " ]", result === "ok" ? "ok" : "skip");
      progress.target = (i + 1) / steps.length;
      rain.intensity = 0.5 + 0.5 * progress.target;
      await sleep(rand(40, 90));
    }
    if (state.skipped) return;

    var last = newLine();
    await type(last, "> " + t("boot.user", "user: guest"), "cmd");
    await sleep(280);
    if (state.skipped) return;
    await granted();
    if (!state.skipped) reveal(false);
  }

  rain.start();
  try { els.skip.focus({ preventScroll: true }); } catch (e) { /* sin foco: no pasa nada */ }
  setInert(true);
  setTimeout(skip, 12000 * slow);   // por si algo se cuelga
  run().catch(function () { skip(); });
})();
