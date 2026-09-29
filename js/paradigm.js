/*
 * Líneas del mapa del paradigma personal (sección 7 HHEP): une el círculo central con cada tarjeta
 * mediante una curva, con puntos que avanzan hacia ella. Solo en pantalla ancha (en el móvil las
 * tarjetas van en una columna y no hace falta).
 *
 * Se usan offsetLeft/offsetTop (posición en el diseño) y no getBoundingClientRect: así las
 * transformaciones de entrada de las tarjetas no descolocan las líneas.
 */
(function () {
  "use strict";

  var map = document.querySelector(".paradigm__map");
  if (!map) return;

  var svg = map.querySelector(".paradigm__lines");
  var hub = map.querySelector(".paradigm__hub");
  var nodes = map.querySelectorAll(".paradigm__node");
  var wide = window.matchMedia("(min-width: 1000px)");
  var NS = "http://www.w3.org/2000/svg";
  var queued = 0;

  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function draw() {
    queued = 0;
    svg.textContent = "";
    if (!wide.matches || !map.offsetWidth) return;
    svg.setAttribute("viewBox", "0 0 " + map.offsetWidth + " " + map.offsetHeight);

    var hx = hub.offsetLeft + hub.offsetWidth / 2;
    var hy = hub.offsetTop + hub.offsetHeight / 2;
    var r = hub.offsetWidth / 2;

    nodes.forEach(function (node) {
      var left = node.offsetLeft + node.offsetWidth / 2 < hx;
      var ex = left ? node.offsetLeft + node.offsetWidth : node.offsetLeft;
      var ey = node.offsetTop + Math.min(node.offsetHeight / 2, 60);
      // Sale del borde del círculo, mirando hacia la tarjeta
      var ang = Math.atan2(ey - hy, ex - hx);
      var sx = hx + Math.cos(ang) * (r + 4);
      var sy = hy + Math.sin(ang) * (r + 4);
      var mx = (sx + ex) / 2;
      var d = "M" + sx.toFixed(1) + "," + sy.toFixed(1) + " C" + mx.toFixed(1) + "," + sy.toFixed(1) + " " + mx.toFixed(1) + "," + ey.toFixed(1) + " " + ex.toFixed(1) + "," + ey.toFixed(1);
      var color = getComputedStyle(node).getPropertyValue("--node").trim() || "#9b7bff";
      svg.appendChild(el("path", { d: d, "class": "line-base", stroke: color }));
      svg.appendChild(el("path", { d: d, "class": "line-flow", stroke: color }));
      svg.appendChild(el("circle", { cx: ex.toFixed(1), cy: ey.toFixed(1), r: 5, fill: color }));
    });
  }

  function queue() {
    if (!queued) queued = requestAnimationFrame(draw);
  }

  if (window.ResizeObserver) new ResizeObserver(queue).observe(map);
  window.addEventListener("resize", queue);
  ["portfolio:lang", "portfolio:section"].forEach(function (name) { document.addEventListener(name, queue); });
  if (wide.addEventListener) wide.addEventListener("change", queue);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
  queue();
})();
