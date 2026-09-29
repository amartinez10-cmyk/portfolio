/*
 * Tema de cada sección: publica en <html> la sección actual y el color de su sala.
 *   data-section="about"  ·  --level-accent (el color de esa sala, que usa el CSS y cambia poco a poco)
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
  var order = Array.prototype.map.call(document.querySelectorAll(".main-nav a"), function (a) {
    return a.getAttribute("href").slice(1);
  });

  function show(id) {
    var name = order.indexOf(id) === -1 ? order[0] : id;
    root.dataset.section = name;
    root.style.setProperty("--level-accent", ACCENTS[name] || ACCENTS.about);
  }

  document.addEventListener("portfolio:section", function (e) { show(e.detail.id); });
  show(location.hash.slice(1));
})();
