/*
 * Efectos que no necesitan WebGL (funcionan también sin el 3D):
 *   · tilt 3D con brillo en las tarjetas  → elementos con data-tilt y las tarjetas de habilidades
 *   · parallax por capas con el puntero   → elementos con data-depth="N" (píxeles de desplazamiento)
 *   · cursor personalizado sutil          → un punto y un aro; el cursor normal sigue visible
 *   · parallax con el scroll              → elementos con data-scroll="F"
 *   · entrada de las tarjetas de habilidades con el scroll (variable --p de cada tarjeta)
 *
 * Lo del puntero solo con ratón (puntero fino con hover); lo del scroll también con el dedo.
 * Con "reducir movimiento" no se activa nada y la página queda estática.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  var TILT_MAX = 7; // grados

  var active = false;
  var raf = 0;
  var last = 0;

  // Puntero (centrado: -1 … 1) para el parallax
  var px = 0, py = 0, tx = 0, ty = 0;
  // Cursor
  var cursor = null, dot = null, ring = null;
  var cx = 0, cy = 0, rx = 0, ry = 0, cursorSeen = false;
  // Tarjetas con tilt: { el, x, y, tx, ty, on }
  var tilts = [];

  function enabled() {
    return finePointer.matches && !reduceMotion.matches;
  }

  /* ---------- Cursor ---------- */

  function createCursor() {
    cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.setAttribute("aria-hidden", "true");
    dot = document.createElement("i");
    dot.className = "cursor__dot";
    ring = document.createElement("i");
    ring.className = "cursor__ring";
    cursor.appendChild(ring);
    cursor.appendChild(dot);
    document.body.appendChild(cursor);
  }

  function removeCursor() {
    if (cursor) cursor.remove();
    cursor = dot = ring = null;
    cursorSeen = false;
  }

  /* ---------- Tilt ---------- */

  function setupTilt(el) {
    var state = { el: el, x: 0, y: 0, tx: 0, ty: 0, on: false };
    tilts.push(state);

    el.addEventListener("pointermove", function (e) {
      if (!active || e.pointerType === "touch") return;
      var r = el.getBoundingClientRect();
      var nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      var ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      state.tx = Math.max(-1, Math.min(1, nx));
      state.ty = Math.max(-1, Math.min(1, ny));
      state.on = true;
      el.style.setProperty("--mx", ((nx + 1) * 50).toFixed(1) + "%");
      el.style.setProperty("--my", ((ny + 1) * 50).toFixed(1) + "%");
      el.style.setProperty("--glare", "1");
      wake();
    });

    el.addEventListener("pointerleave", function () {
      state.tx = state.ty = 0;
      state.on = false;
      el.style.setProperty("--glare", "0");
      wake();
    });
  }

  function applyTilt(s, k) {
    s.x += (s.tx - s.x) * k;
    s.y += (s.ty - s.y) * k;
    var mag = Math.hypot(s.x, s.y);
    if (!s.on && mag < 0.002) {
      s.x = s.y = 0;
      s.el.style.removeProperty("rotate");
      return false;
    }
    // Eje de giro perpendicular a la posición del puntero: el punto señalado se "hunde"
    s.el.style.rotate = (-s.y).toFixed(3) + " " + s.x.toFixed(3) + " 0 " + (mag * (s.max || TILT_MAX)).toFixed(2) + "deg";
    return true;
  }

  // Las tarjetas de habilidades se crean de nuevo al cambiar de idioma, así que el tilt se
  // gestiona por delegación sobre su contenedor y no elemento a elemento
  var cardStates = new WeakMap();

  function cardState(li) {
    var s = cardStates.get(li);
    if (!s) {
      s = { el: li, x: 0, y: 0, tx: 0, ty: 0, on: false, max: 13 };
      cardStates.set(li, s);
      tilts.push(s);
    }
    return s;
  }

  function leaveCard(li) {
    var s = cardStates.get(li);
    if (!s) return;
    s.tx = s.ty = 0;
    s.on = false;
    li.style.setProperty("--glare", "0");
    wake();
  }

  function setupCardTilt() {
    var box = document.querySelector(".about__skills");
    if (!box) return;
    var current = null;
    box.addEventListener("pointermove", function (e) {
      if (!active || e.pointerType === "touch") return;
      var li = e.target.closest && e.target.closest(".skills__list li");
      if (current && current !== li) leaveCard(current);
      current = li;
      if (!li) return;
      var s = cardState(li);
      var r = li.getBoundingClientRect();
      var nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      var ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      s.tx = Math.max(-1, Math.min(1, nx));
      s.ty = Math.max(-1, Math.min(1, ny));
      s.on = true;
      li.style.setProperty("--mx", ((nx + 1) * 50).toFixed(1) + "%");
      li.style.setProperty("--my", ((ny + 1) * 50).toFixed(1) + "%");
      li.style.setProperty("--glare", "1");
      wake();
    });
    box.addEventListener("pointerleave", function () {
      if (current) leaveCard(current);
      current = null;
    });
  }

  /* ---------- Scroll: parallax y entrada de las tarjetas ---------- */

  // Funciona con ratón y con dedo; solo se apaga con "reducir movimiento"
  var scrollQueued = 0;

  // 0 cuando la tarjeta asoma por abajo, 1 cuando ha subido hasta quedar del todo dentro.
  // Al llegar al final de la página todas quedan en 1 (si no, las de la última fila, que ya no
  // pueden subir más, se quedarían a medias).
  function entryProgress(el, column) {
    var vh = window.innerHeight;
    var p = (vh * 0.98 - el.getBoundingClientRect().top) / (vh * 0.36) - column * 0.06;
    var remaining = root.scrollHeight - vh - window.scrollY;
    p = Math.max(p, 1 - remaining / (vh * 0.3));
    p = Math.max(0, Math.min(1, p));
    return 1 - Math.pow(1 - p, 3);
  }

  function updateScroll() {
    scrollQueued = 0;
    if (reduceMotion.matches) return;
    root.style.setProperty("--sy", window.scrollY.toFixed(1));
    var cards = document.querySelectorAll(".skills__list li");
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.setProperty("--p", entryProgress(cards[i], i % 4).toFixed(3));
    }
  }

  function queueScroll() {
    if (!scrollQueued) scrollQueued = requestAnimationFrame(updateScroll);
  }

  function resetScroll() {
    root.style.removeProperty("--sy");
    document.querySelectorAll(".skills__list li").forEach(function (li) { li.style.removeProperty("--p"); });
  }

  /* ---------- Bucle único ---------- */

  function frame(now) {
    raf = 0;
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    var moving = false;

    // Parallax: se suaviza el puntero y se publica en --px / --py (las capas lo leen en CSS)
    var kp = 1 - Math.exp(-dt * 7);
    px += (tx - px) * kp;
    py += (ty - py) * kp;
    if (Math.abs(tx - px) + Math.abs(ty - py) > 0.0005) moving = true;
    root.style.setProperty("--px", px.toFixed(4));
    root.style.setProperty("--py", py.toFixed(4));

    // Cursor: el punto sigue al puntero y el aro llega un poco después
    if (cursor) {
      var kr = 1 - Math.exp(-dt * 16);
      rx += (cx - rx) * kr;
      ry += (cy - ry) * kr;
      // Con la propiedad "translate" y no con "transform": el aro se agranda con "scale" (CSS) y
      // el orden de las propiedades sueltas es translate → rotate → scale → transform, de modo
      // que un translate() dentro de "transform" también se escalaría y el aro se alejaría
      // del cursor (60 % de su distancia a la esquina al agrandarse sobre un enlace).
      dot.style.translate = cx.toFixed(1) + "px " + cy.toFixed(1) + "px";
      ring.style.translate = rx.toFixed(1) + "px " + ry.toFixed(1) + "px";
      if (Math.abs(cx - rx) + Math.abs(cy - ry) > 0.2) moving = true;
    }

    var kt = 1 - Math.exp(-dt * 10);
    for (var i = tilts.length - 1; i >= 0; i--) {
      if (!tilts[i].el.isConnected) { tilts.splice(i, 1); continue; }   // tarjetas ya sustituidas
      if (applyTilt(tilts[i], kt)) moving = true;
    }

    if (moving) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (raf || !active || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- Activar / desactivar ---------- */

  function onPointerMove(e) {
    if (e.pointerType === "touch") return;
    tx = (e.clientX / window.innerWidth) * 2 - 1;
    ty = (e.clientY / window.innerHeight) * 2 - 1;
    cx = e.clientX;
    cy = e.clientY;
    if (cursor) {
      if (!cursorSeen) {
        rx = cx;
        ry = cy;
        cursorSeen = true;
        cursor.classList.add("is-visible");
      }
      var target = e.target;
      var interactive = !!(target && target.closest && target.closest("a, button, [role=\"group\"], [data-tilt]"));
      cursor.classList.toggle("is-link", interactive);
    }
    wake();
  }

  function onPointerDown() { if (cursor) cursor.classList.add("is-down"); }
  function onPointerUp() { if (cursor) cursor.classList.remove("is-down"); }
  function onLeave() { if (cursor) { cursor.classList.remove("is-visible"); cursorSeen = false; } }

  function enable() {
    if (active) return;
    active = true;
    createCursor();
    root.classList.add("has-fx");
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", wake);
  }

  function disable() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    document.removeEventListener("visibilitychange", wake);
    removeCursor();
    root.classList.remove("has-fx");
    root.style.removeProperty("--px");
    root.style.removeProperty("--py");
    tilts.forEach(function (s) {
      s.x = s.y = s.tx = s.ty = 0;
      s.on = false;
      s.el.style.removeProperty("rotate");
      s.el.style.setProperty("--glare", "0");
    });
  }

  function sync() {
    if (enabled()) enable();
    else disable();
  }

  document.querySelectorAll("[data-depth]").forEach(function (el) {
    el.style.setProperty("--depth", el.getAttribute("data-depth"));
  });
  document.querySelectorAll("[data-scroll]").forEach(function (el) {
    el.style.setProperty("--sfactor", el.getAttribute("data-scroll"));
  });
  document.querySelectorAll("[data-tilt]").forEach(setupTilt);
  setupCardTilt();

  [reduceMotion, finePointer].forEach(function (mq) {
    if (mq.addEventListener) mq.addEventListener("change", sync);
  });
  sync();

  // Scroll: parallax de capas y entrada de las tarjetas (también en pantallas táctiles)
  window.addEventListener("scroll", queueScroll, { passive: true });
  window.addEventListener("resize", queueScroll);
  window.addEventListener("load", queueScroll);
  ["portfolio:lang", "portfolio:section", "portfolio:boot-done"].forEach(function (name) {
    document.addEventListener(name, queueScroll);
  });
  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener("change", function () {
      if (reduceMotion.matches) resetScroll();
      else queueScroll();
    });
  }
  queueScroll();
})();
