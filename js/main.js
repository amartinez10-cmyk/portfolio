(function () {
  "use strict";

  var LANGS = ["ca", "en", "es"];
  var DEFAULT_LANG = "es";
  var LANG_KEY = "portfolio-lang";
  var DEFAULT_PAGE = "about";

  var T = window.TRANSLATIONS;
  var main = document.getElementById("content");
  var langButtons = document.querySelectorAll(".lang-switch button");
  var navLinks = document.querySelectorAll(".main-nav a");
  var pages = document.querySelectorAll(".page");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Preferencias guardadas en el navegador ---------- */

  function readStore(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }

  // Lo mismo, pero solo mientras dure la visita (se olvida al cerrar la pestaña)
  function readSession(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function writeSession(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }

  /* ---------- Utilidades de animación ---------- */

  // Curvas --ease-out y --ease-in-out de styles.css. Se leen la primera vez que
  // hacen falta y no al arrancar: leerlas antes de marcar la sección y el idioma
  // activos haría que esos cambios se animaran al cargar.
  var curves = {};
  function curve(name) {
    if (!curves[name]) {
      curves[name] = getComputedStyle(document.documentElement).getPropertyValue("--" + name).trim() || "ease-out";
    }
    return curves[name];
  }

  // Si el navegador no está pintando (ventana tapada), las animaciones no avanzan.
  // Pasado su tiempo se dan por terminadas para no dejar nada invisible o a medias.
  function settle(anim) {
    setTimeout(function () {
      if (anim.playState === "running") anim.finish();
    }, anim.effect.getComputedTiming().endTime + 250);
    return anim;
  }

  // Aparecer desde "from" (un transform) hasta su sitio
  function rise(el, from, timing) {
    return settle(el.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], timing));
  }

  // Entradas y salidas con profundidad: el elemento viene desde atrás, girado, con perspectiva.
  // Con "reducir movimiento" no hay desplazamiento ni giro: solo cambia la opacidad.
  var DEPTH_REST = "perspective(1100px) translate3d(0px, 0px, 0px) rotateY(0deg) rotateX(0deg)";
  function depth(dx, dy, dz, ry, rx) {
    if (reduceMotion.matches) return "translateX(0)";
    return "perspective(1100px) translate3d(" + dx + "px, " + dy + "px, " + dz + "px) rotateY(" + ry + "deg) rotateX(" + rx + "deg)";
  }

  // Avisa a la capa 3D (js/scene3d.js) de los cambios de sección e idioma
  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent("portfolio:" + name, { detail: detail }));
  }

  /* ---------- Idioma ---------- */

  function initialLang() {
    var stored = readStore(LANG_KEY);
    if (LANGS.indexOf(stored) !== -1) return stored;
    var browser = (navigator.language || "").slice(0, 2).toLowerCase();
    return LANGS.indexOf(browser) !== -1 ? browser : DEFAULT_LANG;
  }

  function applyLang(lang) {
    var dict = T[lang];
    document.documentElement.lang = lang;
    document.title = dict["meta.title"];
    document.querySelector('meta[name="description"]').setAttribute("content", dict["meta.description"]);

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var text = dict[el.getAttribute("data-i18n")];
      if (text !== undefined) el.textContent = text;
    });
    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      el.alt = dict[el.getAttribute("data-i18n-alt")];
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
      el.setAttribute("aria-label", dict[el.getAttribute("data-i18n-aria-label")]);
    });
    // Listas (las habilidades): un <li> por cada elemento
    document.querySelectorAll("[data-i18n-list]").forEach(function (list) {
      var items = dict[list.getAttribute("data-i18n-list")];
      if (!items) return;
      var key = list.getAttribute("data-i18n-list");
      list.textContent = "";
      items.forEach(function (text, index) {
        var li = document.createElement("li");
        li.textContent = text;
        // Iconos y etiquetas de cada habilidad (js/skill-icons.js)
        if (window.SkillIcons) window.SkillIcons.decorate(li, key, index);
        list.appendChild(li);
      });
    });

    langButtons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });
    emit("lang", { lang: lang });
  }

  function switchLang(lang) {
    if (lang === document.documentElement.lang) return;
    applyLang(lang);
    writeStore(LANG_KEY, lang);
    if (!reduceMotion.matches && main.animate) {
      settle(main.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 220, easing: curve("ease-out") }));
    }
  }

  langButtons.forEach(function (btn) {
    btn.addEventListener("click", function () { switchLang(btn.dataset.lang); });
  });

  /* ---------- Secciones (una por apartado del menú) ---------- */

  // Orden de las secciones en el menú: decide hacia qué lado se desliza el cambio
  var pageOrder = Array.prototype.map.call(navLinks, function (link) {
    return link.getAttribute("href").slice(1);
  });
  var targetId = null;  // la última sección pedida
  var leaving = null;   // animación de salida en curso

  function currentPageId() {
    var id = location.hash.slice(1);
    return document.getElementById(id) && document.getElementById(id).classList.contains("page")
      ? id
      : DEFAULT_PAGE;
  }

  function visiblePage() {
    for (var i = 0; i < pages.length; i++) {
      if (!pages[i].hidden) return pages[i];
    }
    return null;
  }

  // 1 si la sección nueva está más a la derecha en el menú; -1 si está más a la izquierda
  function direction(fromId, toId) {
    return pageOrder.indexOf(toId) > pageOrder.indexOf(fromId) ? 1 : -1;
  }

  function markCurrent(id) {
    navLinks.forEach(function (link) {
      if (link.getAttribute("href") === "#" + id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function focusPage(page) {
    var heading = page.querySelector("h1");
    if (heading) heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  // Opacidad y posición tal como se ven ahora, aunque haya una animación a medias,
  // para que la siguiente parta de ahí y no dé un salto.
  function liveFrame(el) {
    var style = getComputedStyle(el);
    return {
      opacity: style.opacity,
      transform: style.transform === "none" ? DEPTH_REST : style.transform
    };
  }

  function stopAnimations(el) {
    el.getAnimations().forEach(function (anim) { anim.cancel(); });
  }

  // Los bloques de la sección nueva entran uno detrás de otro, en profundidad, desde el
  // lado hacia el que se va en el menú. Las tarjetas (data-tilt) entran además enteras.
  function enterPage(page, dir) {
    if (page.hasAttribute("data-tilt") && page.id !== "about") {
      stopAnimations(page);
      rise(page, depth(dir * 70, 0, -240, -dir * 16, 0), { duration: 640, easing: curve("ease-out"), fill: "backwards" });
    }
    Array.prototype.forEach.call(page.children, function (block, i) {
      stopAnimations(block);
      rise(block, depth(dir * 40, 18, -160, -dir * 12, 0), {
        duration: 560, delay: 60 + i * 70, easing: curve("ease-out"), fill: "backwards"
      });
    });
  }

  // La sección actual sale hacia un lado y la nueva entra desde el otro, según
  // su orden en el menú. Con "reducir movimiento" solo cambia la opacidad.
  function showPage(animate) {
    var id = currentPageId();
    var to = document.getElementById(id);
    var from = visiblePage();
    markCurrent(id);
    targetId = id;
    emit("section", { id: id, from: from ? from.id : null, animate: !!animate });
    if (animate) flushReveals();

    if (!animate || !from || !to.animate || document.hidden) {
      pages.forEach(function (page) { page.hidden = page !== to; });
      if (animate) focusPage(to);
      return;
    }

    // Si ya hay una salida en marcha, al terminar mostrará la última sección pedida
    if (leaving || from === to) return;

    var dir = direction(from.id, id);
    var start = liveFrame(from);
    stopAnimations(from);
    leaving = settle(from.animate(
      [start, { opacity: 0, transform: depth(-dir * 60, 0, -180, dir * 14, 0) }],
      { duration: 180, easing: curve("ease-out"), fill: "forwards" }
    ));
    leaving.finished.then(function () {
      leaving = null;
      var next = document.getElementById(targetId);
      pages.forEach(function (page) { page.hidden = page !== next; });
      stopAnimations(from); // quita el estado final de la salida
      enterPage(next, next === from ? 0 : direction(from.id, next.id));
      focusPage(next);
    });
  }

  window.addEventListener("hashchange", function () { showPage(true); });

  /* ---------- Párrafos que aparecen al llegar con el scroll ---------- */

  // En el móvil los párrafos de "Sobre mí" quedan debajo de las ondas. En vez de
  // animarlos al cargar, donde nadie los ve, esperan quietos a que se llegue a ellos.
  var reveals = [];
  var revealObserver = null;

  function revealOnScroll(el) {
    var anim = el.animate(
      [{ opacity: 0, transform: depth(0, 22, -110, 0, -8) }, { opacity: 1, transform: "none" }],
      { duration: 800, easing: curve("ease-out"), fill: "backwards" }
    );
    anim.pause();
    reveals.push({ el: el, anim: anim });

    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        var n = 0;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          revealObserver.unobserve(entry.target);
          reveals.forEach(function (r) {
            if (r.el !== entry.target) return;
            r.anim.effect.updateTiming({ delay: n++ * 100 });
            r.anim.play();
            settle(r.anim);
          });
        });
      }, { threshold: 0.15 });
    }
    revealObserver.observe(el);
  }

  // Al cambiar de sección o al imprimir se muestran los que aún esperaban
  function flushReveals() {
    if (revealObserver) revealObserver.disconnect();
    reveals.forEach(function (r) { r.anim.finish(); });
    reveals = [];
  }

  window.addEventListener("beforeprint", flushReveals);

  /* ---------- Entrada al cargar la página ---------- */

  // La primera vez en la visita: el menú baja a su sitio, la foto se destapa, el saludo sube
  // palabra a palabra y después llega el texto. Si se recarga la página, o con
  // "reducir movimiento", todo aparece con un fundido corto.
  var INTRO_KEY = "portfolio-intro-seen";

  // Parte el saludo en palabras, cada una dentro de su máscara (.word)
  function splitWords(el) {
    var text = el.textContent;
    var inners = [];
    el.textContent = "";
    text.split(/(\s+)/).forEach(function (part) {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        el.appendChild(document.createTextNode(part));
        return;
      }
      var word = document.createElement("span");
      var inner = document.createElement("span");
      word.className = "word";
      inner.className = "word__inner";
      inner.textContent = part;
      word.appendChild(inner);
      el.appendChild(word);
      inners.push(inner);
    });
    return {
      inners: inners,
      // Deja el texto como estaba, salvo que ya se haya cambiado de idioma
      restore: function () { if (el.querySelector(".word")) el.textContent = text; }
    };
  }

  function introAbout() {
    var ease = curve("ease-out");
    var photo = document.querySelector(".about__photo");
    var title = document.getElementById("about-title");

    // La foto se destapa de abajo arriba mientras la imagen se asienta
    settle(photo.animate(
      [{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: 900, delay: 200, easing: ease, fill: "backwards" }
    ));
    settle(photo.querySelector("img").animate(
      [{ transform: "scale(1.15)" }, { transform: "scale(1)" }],
      { duration: 1300, delay: 200, easing: ease, fill: "backwards" }
    ));

    // El saludo sube palabra a palabra desde detrás de su máscara
    var words = splitWords(title);
    var last = null;
    words.inners.forEach(function (inner, i) {
      last = settle(inner.animate(
        [{ transform: "translate3d(0, 110%, -140px) rotateX(-55deg)" }, { transform: "translate3d(0, 0, 0) rotateX(0deg)" }],
        { duration: 900, delay: 320 + i * 80, easing: ease, fill: "backwards" }
      ));
    });
    if (last) last.finished.then(words.restore, words.restore);

    rise(document.querySelector(".about__role"), depth(0, 14, -80, 0, -10),
      { duration: 700, delay: 620, easing: ease, fill: "backwards" });

    // Los párrafos que ya se ven entran ahora; los que están más abajo, con el scroll.
    // Las tarjetas de habilidades tienen su propia entrada con el scroll (js/fx.js).
    var shown = 0;
    document.querySelectorAll(".about__body p").forEach(function (p) {
      if (p.getBoundingClientRect().top < window.innerHeight * 0.92) {
        rise(p, depth(0, 22, -110, 0, -8), { duration: 800, delay: 760 + shown++ * 100, easing: ease, fill: "backwards" });
      } else {
        revealOnScroll(p);
      }
    });
  }

  // fromBoot: la entrada empieza justo al terminar la pantalla de carga (js/boot-screen.js)
  function playIntro(fromBoot) {
    var root = document.documentElement;
    if (!root.classList.contains("intro-pending") || document.hidden || !main.animate) {
      root.classList.remove("intro-pending");
      return;
    }

    if (reduceMotion.matches || (!fromBoot && readSession(INTRO_KEY) === "1")) {
      [document.querySelector(".site-header"), main].forEach(function (el) {
        settle(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: curve("ease-out") }));
      });
      root.classList.remove("intro-pending");
      return;
    }
    writeSession(INTRO_KEY, "1");

    // 1. Los controles flotantes del 3D (nivel y ayuda) aparecen con un fundido
    document.querySelectorAll(".level-nav, .stage__focus, .stage__hint").forEach(function (el) {
      settle(el.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
        { duration: 800, delay: 500, easing: curve("ease-out"), fill: "backwards" }));
    });

    // 2. El menú y los botones bajan a su sitio, uno detrás de otro
    var header = Array.prototype.slice.call(document.querySelectorAll(".main-nav li"));
    header.push(document.querySelector(".site-controls"));
    header.forEach(function (el, i) {
      rise(el, "translateY(-8px)", { duration: 600, delay: 80 + i * 35, easing: curve("ease-out"), fill: "backwards" });
    });

    // 3. El contenido de la sección con la que se abre la página
    var page = document.getElementById(currentPageId());
    if (page.id === "about") {
      introAbout();
    } else {
      Array.prototype.forEach.call(page.children, function (block, i) {
        rise(block, depth(0, 16, -100, 0, -6), { duration: 700, delay: 250 + i * 90, easing: curve("ease-out"), fill: "backwards" });
      });
    }

    // En el mismo paso que se crean las animaciones, para que no se pinte nada entre medias
    root.classList.remove("intro-pending");
  }

  /* ---------- Inicio ---------- */

  // Cada sección es una "página", no un ancla: al abrir con #sección no hay que bajar hasta ella
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
  window.addEventListener("load", function () { if (window.scrollY < 400) window.scrollTo(0, 0); }, { once: true });

  applyLang(initialLang());
  showPage(false);
  // Con la pantalla de carga delante, la entrada espera a que termine
  if (document.documentElement.classList.contains("booting")) {
    document.addEventListener("portfolio:boot-done", function () { playIntro(true); }, { once: true });
  } else {
    playIntro(false);
  }

})();
