/*
 * Selector de nivel (abajo, en el centro): los botones suben y bajan por las seis secciones del
 * menú y el número indica en cuál se está. Además publica el nivel actual en <html>:
 *   data-section="about"  ·  --level-accent (el color de ese nivel, que usa el CSS)
 * Los colores son los mismos de las paredes de las salas 3D (LEVEL_STYLE en js/levels.js).
 */
(function () {
  "use strict";

  var ACCENTS = {
    about: "#8b6cff",
    resume: "#5c8dff",
    certificates: "#ffb02e",
    projects: "#2fd0b5",
    hhep: "#b18cff",
    contact: "#ff6fa5"
  };

  var root = document.documentElement;
  var nav = document.querySelector(".level-nav");
  var order = Array.prototype.map.call(document.querySelectorAll(".main-nav a"), function (a) {
    return a.getAttribute("href").slice(1);
  });
  var current = 0;

  function show(id) {
    var index = Math.max(0, order.indexOf(id));
    current = index;
    root.dataset.section = order[index];
    root.style.setProperty("--level-accent", ACCENTS[order[index]] || ACCENTS.about);
    if (!nav) return;
    nav.querySelector(".level-nav__num").textContent = String(index + 1).padStart(2, "0");
    nav.querySelector(".level-nav__total").textContent = "/" + String(order.length).padStart(2, "0");
    nav.querySelector('[data-step="-1"]').disabled = index === 0;
    nav.querySelector('[data-step="1"]').disabled = index === order.length - 1;
  }

  if (nav) {
    nav.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-step]");
      if (!btn || btn.disabled) return;
      var next = order[current + Number(btn.dataset.step)];
      if (next) location.hash = "#" + next;
    });
  }

  document.addEventListener("portfolio:section", function (e) { show(e.detail.id); });
  var hash = location.hash.slice(1);
  show(order.indexOf(hash) !== -1 ? hash : order[0]);
})();
