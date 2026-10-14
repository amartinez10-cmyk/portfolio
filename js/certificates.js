/*
 * Sección Certificados: cada certificado es un enlace a su imagen y aquí se abre en grande en el
 * visor (#cert-viewer, un <dialog>) sin salir de la página. Dentro se pasa al anterior o al siguiente
 * con las flechas (botones o teclado) o deslizando el dedo, y se cierra con Esc, la X o pulsando fuera
 * de la hoja. Sin JavaScript, o con Ctrl/Cmd + clic, los enlaces abren la imagen sin más.
 */
(function () {
  "use strict";

  var links = Array.prototype.slice.call(document.querySelectorAll("[data-cert]"));
  var viewer = document.getElementById("cert-viewer");
  if (!links.length || !viewer || typeof viewer.showModal !== "function") return;

  var root = document.documentElement;
  var stage = viewer.querySelector(".cert-viewer__stage");
  var img = viewer.querySelector(".cert-viewer__img");
  var org = viewer.querySelector(".cert-viewer__org");
  var count = viewer.querySelector(".cert-viewer__count");
  var title = viewer.querySelector(".cert-viewer__title");
  var meta = viewer.querySelector(".cert-viewer__meta");
  var openLink = viewer.querySelector(".cert-viewer__open");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var current = 0;
  var loading = 0;   // sube con cada cambio: una imagen que termina de cargar tarde ya no se pone
  var images = {};   // las imágenes grandes ya pedidas, por dirección

  function textOf(link, selector) {
    var el = link.querySelector(selector);
    return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
  }

  // El pie (entidad, posición, título y horas) sale del propio enlace, ya en el idioma de la página
  function caption() {
    var link = links[current];
    var group = link.closest("[data-issuer]");
    var name = textOf(link, ".cert__title");
    var dict = window.TRANSLATIONS && window.TRANSLATIONS[root.lang];
    org.textContent = group ? group.getAttribute("data-issuer") : "";
    count.textContent = (current + 1) + " / " + links.length;
    title.textContent = name;
    meta.textContent = textOf(link, ".cert__meta");
    img.alt = dict && dict["certificates.viewerAlt"] ? dict["certificates.viewerAlt"].replace("{title}", name) : name;
  }

  function src(link) {
    return link.getAttribute("href");
  }

  // Pide la imagen grande de un certificado (una sola vez) y la devuelve. Las de los vecinos van con
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

  // Los vecinos del que se ve, para que pasar al siguiente o al anterior sea inmediato
  function preloadNeighbours() {
    [current - 1, current + 1].forEach(function (i) {
      preload(links[(i + links.length) % links.length], "low");
    });
  }

  // dir: 1 o -1 si se pasa al siguiente o al anterior (la hoja entra desde ese lado); 0 al abrir
  function show(index, dir) {
    current = (index + links.length) % links.length;
    var link = links[current];
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

  // Avisa a la escena 3D (js/scene3d.js) de que el visor la tapa o la destapa: tapada no se dibuja
  function overlay(isOpen) {
    document.dispatchEvent(new CustomEvent("portfolio:overlay", { detail: { open: isOpen } }));
  }

  function open(index) {
    // Sin barra de desplazamiento la página se ensancharía: se deja su hueco mientras está abierto
    if (window.innerWidth > root.clientWidth) root.style.scrollbarGutter = "stable";
    root.classList.add("cert-viewer-open");
    show(index, 0);
    viewer.showModal();
    overlay(true);
  }

  links.forEach(function (link, i) {
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
      open(i);
    });
  });

  // Al cerrarse (Esc, la X, pulsando fuera o al cambiar de sección) se deshace lo de open(), y el
  // navegador devuelve el foco al enlace que lo abrió. Se vigila el atributo "open" y no el evento
  // "close", que algunos navegadores lanzan tarde o no lanzan.
  new MutationObserver(function () {
    if (viewer.open) return;
    loading++;
    root.classList.remove("cert-viewer-open");
    root.style.scrollbarGutter = "";
    overlay(false);
  }).observe(viewer, { attributes: true, attributeFilter: ["open"] });

  viewer.addEventListener("click", function (e) {
    var step = e.target.closest("[data-step]");
    if (step) {
      var dir = Number(step.getAttribute("data-step"));
      show(current + dir, dir);
    } else if (e.target.closest(".cert-viewer__close") || e.target === viewer ||
               e.target.classList.contains("cert-viewer__frame") || e.target === stage) {
      viewer.close();
    }
  });

  viewer.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    var dir = e.key === "ArrowRight" ? 1 : -1;
    show(current + dir, dir);
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
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      var dir = dx < 0 ? 1 : -1;
      show(current + dir, dir);
    }
  });
  stage.addEventListener("pointercancel", function () { swipe = null; });

  // Si se cambia de sección con el botón "atrás" del navegador, el visor se cierra
  document.addEventListener("portfolio:section", function () {
    if (viewer.open) viewer.close();
  });
})();
