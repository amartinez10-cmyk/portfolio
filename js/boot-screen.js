/*
 * Pantalla de carga: el mismo espacio de la web (degradado índigo, estrellas y la paleta lila,
 * rosa y ámbar) con letras y piezas de colores que caen al vacío, un terminal que escribe el
 * arranque (en el idioma de la web) y una barra de progreso. Los pasos esperan de verdad a lo que cargan:
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

  /* ---------- Letras y piezas que caen al vacío ---------- */

  // Letras grandes y redondeadas (como los títulos de las salas) y piezas de colores (como las que
  // flotan entre las salas) que caen desde arriba en tres planos de profundidad: las lejanas son
  // pequeñas y lentas, las cercanas grandes y rápidas, con estela. Caen acelerando y se apagan al
  // llegar al fondo, como si se perdieran en el vacío.
  var rain = (function () {
    var canvas = els.rain;
    var ctx = canvas.getContext("2d");
    var COLORS = ["#c9b6ff", "#9b7bff", "#ff7eb6", "#ffc247", "#8fd6ff", "#7fe3c6", "#ffffff"];
    // Pocas letras distintas: cada letra y color se dibuja una sola vez (máx. ~20 × 7) y se reutiliza
    var CHARS = "ALEXMRTINZ{}</>01#$&";
    var FONT = '800 84px Outfit, "Avenir Next", "Segoe UI", system-ui, sans-serif';
    var TILE = 132;          // lado de cada dibujo precalculado
    var GLYPH = 84;          // lo que mide la letra dentro de él
    var SHAPES = 5;
    var cache = {};
    var parts = [];
    var stars = [];
    var starLayer = null;    // las estrellas fijas, dibujadas una vez; solo unas pocas parpadean cada fotograma
    var TWINKLE = 30;
    var api = { intensity: 0.7, speed: 1 };
    var w = 0;
    var h = 0;
    var px = 1;
    var raf = 0;
    var last = 0;
    var clock = 0;
    var max = 0;

    function tile(draw) {
      var c = document.createElement("canvas");
      c.width = c.height = TILE;
      draw(c.getContext("2d"), TILE / 2);
      return c;
    }

    function letterSprite(ch, color) {
      var key = "L" + ch + color;
      if (!cache[key]) {
        cache[key] = tile(function (g, m) {
          g.font = FONT;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillStyle = "rgba(24, 10, 80, 0.5)";
          g.fillText(ch, m + 4, m + 9);
          g.shadowColor = color;
          g.shadowBlur = 18;
          g.fillStyle = color;
          g.fillText(ch, m, m + 2);
          g.shadowBlur = 0;
          g.fillStyle = "rgba(255, 255, 255, 0.34)";
          g.fillText(ch, m - 1.5, m);
        });
      }
      return cache[key];
    }

    function shapeSprite(kind, color) {
      var key = "S" + kind + color;
      if (!cache[key]) {
        cache[key] = tile(function (g, m) {
          var r = m * 0.58;
          g.shadowColor = color;
          g.shadowBlur = 16;
          g.fillStyle = color;
          g.strokeStyle = color;
          g.lineWidth = 14;
          g.beginPath();
          if (kind === 0) {                                   // hexágono
            for (var i = 0; i < 6; i++) g.lineTo(m + Math.cos(i * Math.PI / 3) * r, m + Math.sin(i * Math.PI / 3) * r);
            g.closePath();
          } else if (kind === 1) {                            // triángulo
            for (var j = 0; j < 3; j++) g.lineTo(m + Math.cos(j * 2.094 - 1.5708) * r * 1.1, m + Math.sin(j * 2.094 - 1.5708) * r * 1.1 + r * 0.15);
            g.closePath();
          } else if (kind === 2) {                            // rombo
            g.moveTo(m, m - r * 1.15); g.lineTo(m + r * 0.8, m); g.lineTo(m, m + r * 1.15); g.lineTo(m - r * 0.8, m);
            g.closePath();
          } else if (kind === 3) {                            // cuadrado redondeado
            var s = r * 0.86, k = r * 0.3;
            g.moveTo(m - s + k, m - s);
            g.arcTo(m + s, m - s, m + s, m + s, k); g.arcTo(m + s, m + s, m - s, m + s, k);
            g.arcTo(m - s, m + s, m - s, m - s, k); g.arcTo(m - s, m - s, m + s, m - s, k);
            g.closePath();
          } else {                                            // aro
            g.arc(m, m, r * 0.78, 0, Math.PI * 2);
          }
          if (kind === 4) {
            g.stroke();
          } else {
            g.fill();
            g.shadowBlur = 0;
            g.save();
            g.clip();                                         // faceta clara en la mitad de arriba
            g.fillStyle = "rgba(255, 255, 255, 0.3)";
            g.fillRect(0, 0, TILE, m);
            g.restore();
          }
        });
      }
      return cache[key];
    }

    function spawn(p, initial) {
      var roll = Math.random();
      var depth = roll < 0.45 ? 0 : roll < 0.82 ? 1 : 2;
      p.depth = depth;
      p.size = depth === 0 ? rand(16, 28) : depth === 1 ? rand(30, 52) : rand(58, 100);
      p.v0 = (depth === 0 ? 34 : depth === 1 ? 84 : 170) * rand(0.8, 1.25);
      p.a = depth === 0 ? 0.5 : depth === 1 ? 0.82 : 0.95;
      p.x = rand(-0.02, 1.02) * w;
      p.y = initial ? rand(-0.05, 0.72) * h : -p.size * 1.3;
      p.age = initial ? rand(0, 3) : 0;
      p.rot = rand(-0.6, 0.6);
      p.vrot = rand(-1.1, 1.1) * (depth === 2 ? 0.7 : 1);
      p.flip = rand(0, 6.28);
      p.vflip = rand(0.6, 2.2);
      p.sway = rand(0, 6.28);
      p.swayAmp = rand(5, 22) * (depth + 1) / 2;
      p.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      p.kind = Math.random() < 0.72 ? -1 : Math.floor(Math.random() * SHAPES);     // -1: una letra
      p.ch = CHARS.charAt(Math.floor(Math.random() * CHARS.length));
      p.alive = true;
    }

    function resize() {
      px = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * px);
      canvas.height = Math.floor(h * px);
      max = Math.max(44, Math.min(150, Math.round((w * h) / 8500)));
      while (parts.length < max) parts.push({ alive: false });
      if (!stars.length) {
        for (var i = 0; i < 120; i++) stars.push({ x: Math.random(), y: Math.random(), r: rand(0.5, 1.5), ph: rand(0, 6.28), sp: rand(0.6, 2) });
      }
      starLayer = document.createElement("canvas");
      starLayer.width = canvas.width;
      starLayer.height = canvas.height;
      var sg = starLayer.getContext("2d");
      sg.setTransform(px, 0, 0, px, 0, 0);
      sg.fillStyle = "#e6dcff";
      for (var f = TWINKLE; f < stars.length; f++) {
        sg.globalAlpha = 0.2 + 0.25 * ((stars[f].ph % 1));
        sg.beginPath();
        sg.arc(stars[f].x * w, stars[f].y * h, stars[f].r, 0, 6.2832);
        sg.fill();
      }
    }

    function draw(p, x, y, sx, scale, alpha) {
      var img = p.kind < 0 ? letterSprite(p.ch, p.color) : shapeSprite(p.kind, p.color);
      ctx.globalAlpha = alpha;
      ctx.setTransform(px * Math.cos(p.rot) * sx * scale, px * Math.sin(p.rot) * sx * scale, -px * Math.sin(p.rot) * scale, px * Math.cos(p.rot) * scale, px * x, px * y);
      ctx.drawImage(img, -TILE / 2, -TILE / 2);
    }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      clock += dt;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Estrellas al fondo: las fijas de golpe y unas pocas que parpadean
      if (starLayer && starLayer.width > 0 && starLayer.height > 0) ctx.drawImage(starLayer, 0, 0);
      ctx.setTransform(px, 0, 0, px, 0, 0);
      ctx.fillStyle = "#e6dcff";
      for (var s = 0; s < TWINKLE; s++) {
        var st = stars[s];
        ctx.globalAlpha = 0.18 + 0.4 * (0.5 + 0.5 * Math.sin(clock * st.sp + st.ph));
        ctx.beginPath();
        ctx.arc(st.x * w, st.y * h, st.r, 0, 6.2832);
        ctx.fill();
      }

      var target = Math.round(max * Math.min(1, api.intensity));
      var alive = 0;
      for (var i = 0; i < parts.length; i++) if (parts[i].alive) alive++;
      var free = alive < target ? Math.min(3, Math.ceil((target - alive) * dt * 1.4)) : 0;

      // De más lejos a más cerca, para que lo cercano tape a lo lejano
      for (var d = 0; d < 3; d++) {
        for (var k = 0; k < parts.length; k++) {
          var p = parts[k];
          if (!p.alive) {
            if (d === 0 && free > 0) { spawn(p, false); free--; } else continue;
          }
          if (p.depth !== d) continue;
          p.age += dt * api.speed;
          var vel = p.v0 * (1 + Math.min(2.2, p.age * 0.55)) * api.speed;   // caen acelerando
          p.y += vel * dt;
          p.rot += p.vrot * dt * api.speed;
          p.flip += p.vflip * dt * api.speed;
          var x = p.x + Math.sin(clock * 0.8 + p.sway) * p.swayAmp;
          var fade = Math.max(0, Math.min(1, (p.y - h * 0.7) / (h * 0.3)));    // se pierde en el vacío
          if (p.y > h + p.size || fade >= 1) { p.alive = false; continue; }
          var scale = (p.size / GLYPH) * (1 - 0.4 * fade);
          var sx = 0.2 + 0.8 * Math.abs(Math.cos(p.flip));                    // giran como si fueran de bulto
          var alpha = p.a * (1 - fade);
          if (d === 2) {
            draw(p, x, p.y - vel * 0.05, sx, scale, alpha * 0.14);
            draw(p, x, p.y - vel * 0.026, sx, scale, alpha * 0.28);
          }
          draw(p, x, p.y, sx, scale, alpha);
        }
      }
      ctx.globalAlpha = 1;
    }

    api.start = function () {
      resize();
      for (var i = 0; i < parts.length; i++) {
        if (i < Math.round(max * 0.7)) spawn(parts[i], true);
      }
      window.addEventListener("resize", resize);
      // La tipografía de la web puede tardar un momento: cuando llega se vuelven a dibujar las letras
      if (document.fonts && document.fonts.load) {
        document.fonts.load('800 84px Outfit').then(function () { cache = {}; }, function () { /* se queda la de reserva */ });
      }
      last = performance.now();
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
    els.blocks.style.setProperty("--p", p.toFixed(3));
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
      if (!state.skipped) await sleep(rand(3, 7));
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
    flash();
    await sleep(850);
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
    await sleep(100);

    for (var i = 0; i < steps.length && !state.skipped; i++) {
      var step = steps[i];
      var label = t(step.key, step.fallback);
      var line = newLine();
      await type(line, "> " + label + " " + ".".repeat(Math.max(3, 30 - label.length)) + " ", "");
      var result = "ok";
      if (step.wait && !state.skipped) result = await withSpinner(line, step.wait());
      put(line, "[ " + (result === "ok" ? t("boot.ok", "OK") : t("boot.omitted", "SKIPPED")) + " ]", result === "ok" ? "ok" : "skip");
      progress.target = (i + 1) / steps.length;
      rain.intensity = 0.7 + 0.3 * progress.target;
      await sleep(rand(25, 60));
    }
    if (state.skipped) return;

    var last = newLine();
    await type(last, "> " + t("boot.user", "user: guest"), "cmd");
    await sleep(180);
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
