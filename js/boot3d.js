/*
 * Arranque perezoso de la capa 3D (js/scene3d.js + Three.js desde el CDN).
 *
 * Se espera a que la página esté pintada y el navegador libre, y solo se sigue
 * si hay WebGL. Si algo falla (sin WebGL, sin conexión al CDN, ahorro de datos) la página se queda como está, sin 3D.
 *
 * Estado en <html data-scene="…">:  loading · full · lite · off
 * Para probar:  ?3d=off (sin 3D) · ?3d=lite (ligero) · ?3d=full (completo)
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var flag = new URLSearchParams(location.search).get("3d");
  var base = document.currentScript
    ? new URL(".", document.currentScript.src).href
    : new URL("js/", location.href).href;

  // Avisa a la pantalla de carga de cómo ha ido (ver js/boot-screen.js)
  function announce(status) {
    document.dispatchEvent(new CustomEvent("portfolio:3d-status", { detail: { status: status } }));
  }

  function off(reason) {
    root.dataset.scene = "off";
    announce("off");
    root.classList.remove("has-3d");
    root.classList.add("no-3d");
    if (reason && window.console) console.info("[3D] desactivado:", reason);
  }

  function webglAvailable() {
    try {
      var c = document.createElement("canvas");
      var gl = c.getContext("webgl2") || c.getContext("webgl");
      if (!gl) return false;
      var lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
      return true;
    } catch (e) {
      return false;
    }
  }

  // "full", "lite" o null (sin 3D). Solo se renuncia al 3D si no hay WebGL o el usuario ahorra datos;
  // en equipos flojos se sigue mostrando (se baja la resolución, ver scene3d.js) y en móviles se
  // usa la versión ligera.
  function pickLevel() {
    if (flag === "off") return null;
    if (!webglAvailable()) return null;
    if (flag === "lite" || flag === "full" || flag === "force") return flag === "lite" ? "lite" : "full";

    var conn = navigator.connection || {};
    if (conn.saveData) return null;

    var small = window.matchMedia("(max-width: 699px)").matches || window.matchMedia("(pointer: coarse)").matches;
    return small ? "lite" : "full";
  }

  function load() {
    var level = pickLevel();
    if (!level) return off(flag === "off" ? "?3d=off" : "sin WebGL o ahorro de datos");

    root.dataset.scene = "loading";
    import(base + "scene3d.js")
      .then(function (scene) {
        return scene.start({ level: level, force: flag === "force" });
      })
      .then(function (info) {
        root.dataset.scene = info.level;
        root.classList.add("has-3d");
        announce("ready");
      })
      .catch(function (err) {
        off(err && err.message ? err.message : err);
      });
  }

  // Después de pintar y con el navegador libre; el margen deja acabar la animación de entrada.
  // Con la pantalla de carga delante, en cambio, se carga ya: es justo lo que se está esperando.
  function schedule() {
    setTimeout(function () {
      if (window.requestIdleCallback) window.requestIdleCallback(load, { timeout: 2000 });
      else load();
    }, 1800);
  }

  if (root.dataset.boot === "running") load();
  else if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule);
})();
