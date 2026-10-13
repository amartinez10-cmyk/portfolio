/*
 * Sección Currículum: cambia entre el Europass y el currículum en español (pestañas accesibles:
 * clic, flechas, Inicio y Fin). Cada panel enseña la imagen de su PDF y los botones para abrirlo o descargarlo.
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-cv]");
  if (!root) return;

  var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  var panels = tabs.map(function (tab) { return document.getElementById(tab.getAttribute("aria-controls")); });

  function select(index, focus) {
    tabs.forEach(function (tab, i) {
      var on = i === index;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      if (panels[i]) panels[i].hidden = !on;
    });
    if (focus) tabs[index].focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { select(i, false); });
    tab.addEventListener("keydown", function (e) {
      var next = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next < 0) return;
      e.preventDefault();
      select(next, true);
    });
  });
})();
