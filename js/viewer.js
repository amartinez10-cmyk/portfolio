/*
 * Visor de imágenes a pantalla completa (#viewer, un <dialog>): los certificados y las diapositivas
 * de los proyectos se abren en grande sin salir de la página.
 *
 * Cada enlace con data-viewer="grupo" es una imagen de ese grupo: su href es la imagen grande y su
 * <img>, la miniatura (se ve ampliada mientras llega la grande). Dentro del visor se pasa a la anterior
 * o a la siguiente del mismo grupo con las flechas (botones o teclado) o deslizando el dedo, y se
 * cierra con Esc, la X o pulsando fuera. Un botón con data-viewer-open="grupo" abre el grupo desde la
 * primera. Sin JavaScript, o con Ctrl/Cmd + clic, los enlaces abren la imagen sin más.
 *
 * El pie sale del propio enlace: el título, de [data-viewer-title], y el detalle, de [data-viewer-meta]
 * (los dos dentro del enlace). Encima va la etiqueta del antepasado con data-viewer-label (un texto o
 * una clave de js/translations.js) y la posición. data-viewer-alt, también en un antepasado, es la
 * clave del texto alternativo de la imagen grande ("{title}" se cambia por el título).
 */
(function () {
  "use strict";

  var viewer = document.getElementById("viewer");
  if (!viewer || typeof viewer.showModal !== "function") return;

  var root = document.documentElement;
  var stage = viewer.querySelector(".viewer__stage");
  var img = viewer.querySelector(".viewer__img");
  var label = viewer.querySelector(".viewer__label");
  var count = viewer.querySelector(".viewer__count");
  var title = viewer.querySelector(".viewer__title");
  var meta = viewer.querySelector(".viewer__meta");
  var openLink = viewer.querySelector(".viewer__open");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var items = [];    // los enlaces del grupo abierto
  var current = 0;
  var loading = 0;   // sube con cada cambio: una imagen que termina de cargar tarde ya no se pone
  var images = {};   // las imágenes grandes ya pedidas, por dirección

  // Un texto de js/translations.js en el idioma de la página ("" si la clave no existe)
  function t(key) {
    var dict = window.TRANSLATIONS && window.TRANSLATIONS[root.lang];
    return (dict && key && dict[key]) || "";
  }

  function textOf(link, selector) {
    var el = link.querySelector(selector);
    return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
  }

  function attrOf(link, name) {
    var el = link.closest("[" + name + "]");
    return el ? el.getAttribute(name) : "";
  }

  // El pie sale del propio enlace, ya en el idioma de la página
  function caption() {
    var link = items[current];
    var name = textOf(link, "[data-viewer-title]");
    var key = attrOf(link, "data-viewer-label");
    var alt = t(attrOf(link, "data-viewer-alt"));
    label.textContent = t(key) || key;
    count.textContent = (current + 1) + " / " + items.length;
    title.textContent = name;
    meta.textContent = textOf(link, "[data-viewer-meta]");
    img.alt = alt ? alt.replace("{title}", name) : name;
  }

  function src(link) {
    return link.getAttribute("href");
  }

  // Pide la imagen grande de un enlace (una sola vez) y la devuelve. Las de los vecinos van con
  // prioridad baja para no quitarle velocidad a la que se quiere ver.
  function preload(link, priority) {
    var href = src(link);
    if (!images[href]) {
      images[href] = new Image();
      images[href].fetchPriority = priority || "high";
      images[href].src = href;
    }
    return images[href];
  }

  // Los vecinos de la que se ve, para que pasar a la siguiente o a la anterior sea inmediato
  function preloadNeighbours() {
    [current - 1, current + 1].forEach(function (i) {
      preload(items[(i + items.length) % items.length], "low");
    });
  }

  // dir: 1 o -1 si se pasa a la siguiente o a la anterior (la imagen entra desde ese lado); 0 al abrir
  function show(index, dir) {
    current = (index + items.length) % items.length;
    var link = items[current];
    var thumb = link.querySelector("img");
    var full = preload(link);
    var token = ++loading;
    if (thumb) img.style.setProperty("--ratio", thumb.getAttribute("width") + " / " + thumb.getAttribute("height"));
    if (full.complete || !thumb) {
      img.src = full.src;
      img.classList.remove("is-loading");
      preloadNeighbours();
    } else {
      // Mientras llega la grande se ve la miniatura (ya cargada) ampliada y desenfocada
      img.src = thumb.currentSrc || thumb.src;
      img.classList.add("is-loading");
      var done = function () {
        if (token !== loading) return;
        img.src = full.src;
        img.classList.remove("is-loading");
        preloadNeighbours();
      };
      full.addEventListener("load", done, { once: true });
      full.addEventListener("error", done, { once: true });
    }
    openLink.href = src(link);
    caption();
    if (dir && !reduceMotion.matches && img.animate) {
      img.animate(
        [{ opacity: 0, transform: "translateX(" + dir * 32 + "px)" }, { opacity: 1, transform: "none" }],
        { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
      );
    }
  }

  function step(dir) {
    if (items.length > 1) show(current + dir, dir);
  }

  // Avisa a la escena 3D (js/scene3d.js) de que el visor la tapa o la destapa: tapada no se dibuja
  function overlay(isOpen) {
    document.dispatchEvent(new CustomEvent("portfolio:overlay", { detail: { open: isOpen } }));
  }

  // Abre el grupo por el enlace "start" (o por la primera imagen)
  function open(group, start) {
    items = Array.prototype.slice.call(document.querySelectorAll('[data-viewer="' + group + '"]'));
    if (!items.length) return;
    viewer.classList.toggle("is-single", items.length < 2);
    // Sin barra de desplazamiento la página se ensancharía: se deja su hueco mientras está abierto
    if (window.innerWidth > root.clientWidth) root.style.scrollbarGutter = "stable";
    root.classList.add("viewer-open");
    show(Math.max(0, items.indexOf(start)), 0);
    viewer.showModal();
    overlay(true);
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-viewer]"), function (link) {
    link.setAttribute("aria-haspopup", "dialog");
    // Si el ratón se queda un momento encima (no al pasar de largo) o llega el foco, se empieza a
    // cargar ya la imagen grande, y al abrir el visor suele estar lista
    var intent = 0;
    link.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "mouse") intent = setTimeout(function () { preload(link); }, 120);
    });
    link.addEventListener("pointerleave", function () { clearTimeout(intent); });
    link.addEventListener("focus", function () { preload(link); });
    link.addEventListener("click", function (e) {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      open(link.getAttribute("data-viewer"), link);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-viewer-open]"), function (button) {
    button.setAttribute("aria-haspopup", "dialog");
    button.addEventListener("click", function () { open(button.getAttribute("data-viewer-open"), null); });
  });

  // Al cerrarse (Esc, la X, pulsando fuera o al cambiar de sección) se deshace lo de open(), y el
  // navegador devuelve el foco a lo que lo abrió. Se vigila el atributo "open" y no el evento
  // "close", que algunos navegadores lanzan tarde o no lanzan.
  new MutationObserver(function () {
    if (viewer.open) return;
    loading++;
    root.classList.remove("viewer-open");
    root.style.scrollbarGutter = "";
    overlay(false);
  }).observe(viewer, { attributes: true, attributeFilter: ["open"] });

  viewer.addEventListener("click", function (e) {
    var arrow = e.target.closest("[data-step]");
    if (arrow) {
      step(Number(arrow.getAttribute("data-step")));
    } else if (e.target.closest(".viewer__close") || e.target === viewer ||
               e.target.classList.contains("viewer__frame") || e.target === stage) {
      viewer.close();
    }
  });

  viewer.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    step(e.key === "ArrowRight" ? 1 : -1);
  });

  // Deslizar el dedo a un lado o al otro (con ratón no: ahí están las flechas)
  var swipe = null;
  stage.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse") swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  stage.addEventListener("pointerup", function (e) {
    if (!swipe || e.pointerId !== swipe.id) return;
    var dx = e.clientX - swipe.x;
    var dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  });
  stage.addEventListener("pointercancel", function () { swipe = null; });

  // Si se cambia de sección con el botón "atrás" del navegador, el visor se cierra
  document.addEventListener("portfolio:section", function () {
    if (viewer.open) viewer.close();
  });
})();
