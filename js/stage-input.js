/*
 * Interacción con la escena 3D. El elemento #stage cubre toda la pantalla por detrás del
 * contenido, así que lo que no tape una tarjeta responde a:
 *   · arrastrar (ratón o dedo): gira la cámara alrededor de la sala, con inercia; al soltar,
 *     vuelve sola a la vista isométrica
 *   · pasar el cursor (o tocar) por una pieza del PC o por un icono de habilidad de "Sobre mí":
 *     se resalta y aparece su nombre; un clic en el PC (o el botón "Explorar el PC") acerca la
 *     cámara al PC
 *   · teclado con el escenario enfocado: flechas para girar, Inicio para volver, Intro para
 *     explorar el PC y Esc para salir
 */
import * as THREE from "three";

const clamp = THREE.MathUtils.clamp;
const YAW_LIMIT = 1.3;
const PITCH_MIN = -0.32;
const PITCH_MAX = 0.6;

export function createStageInput({ stage, wake, camera, size, getAbout, getProps, onFocus, onPropClick }) {
  const ac = new AbortController();
  const on = (target, type, fn, opts) => target.addEventListener(type, fn, Object.assign({ signal: ac.signal }, opts));

  const raycaster = new THREE.Raycaster();
  const labelEl = stage.querySelector(".node-label");
  const focusBtn = stage.querySelector(".stage__focus");
  const hardList = document.querySelector('.skills__list[data-i18n-list="skills.hard"]');

  let labels = [];
  const point = { node: -1, part: null, prop: null };   // lo señalado con el ratón (icono, pieza del PC u objeto de la sala)
  const tap = { node: -1, part: null };     // lo tocado con el dedo
  let listHover = -1;                        // lo señalado en la lista HTML
  let labelKey = "";
  let litIdx = -1;
  let hlId = null;
  let orbitSpin = 0;                         // giro propio de la red de iconos
  let slow = 1;
  let section = "about";
  let focus = false;
  let aboutVisible = false;
  const labelPos = new THREE.Vector3();

  const orbit = { yaw: 0, pitch: 0, yawVel: 0, idle: 0 };
  const drag = { active: false, id: null, x: 0, y: 0, t: 0, startX: 0, startY: 0, moved: 0 };

  function readLabels() {
    labels = hardList
      ? Array.from(hardList.children).map((li) => (li.querySelector(".skill__name") || li).textContent.trim())
      : [];
    const about = getAbout();
    if (about) about.graph.setCount(labels.length);
    labelKey = "";
    litIdx = -1;   // los <li> son nuevos: hay que volver a iluminar el que toque
  }

  function partName(id) {
    const all = window.TRANSLATIONS || {};
    const dict = all[document.documentElement.lang] || all.es || {};
    return dict["pc." + id] || id;
  }

  /* ---------- Qué hay bajo el puntero ---------- */

  function pickAt(e) {
    const about = getAbout();
    const { W, H } = size();
    raycaster.setFromCamera(new THREE.Vector2((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1), camera);
    let node = -1;
    let part = null;
    if (about && aboutVisible) {
      node = about.graph.pick(raycaster);
      if (node < 0) part = about.model.pick(raycaster);
    }
    // Si no hay icono ni pieza del PC, algún objeto de la sala (mesa, trofeo, dron…)
    let prop = null;
    if (node < 0 && !part && getProps) {
      const list = getProps();
      if (list && list.length) {
        const hits = raycaster.intersectObjects(list, true);
        if (hits.length) {
          let o = hits[0].object;
          while (o && list.indexOf(o) === -1) o = o.parent;
          prop = o || null;
        }
      }
    }
    return { node, part, prop };
  }

  function setFocus(value) {
    value = !!value && aboutVisible;
    if (value === focus) return;
    focus = value;
    stage.classList.toggle("is-focus", focus);
    if (focusBtn) focusBtn.setAttribute("aria-pressed", String(focus));
    document.documentElement.classList.toggle("pc-focus", focus);
    tap.node = -1;
    tap.part = null;
    if (onFocus) onFocus(focus);
    wake();
  }

  function endDrag(e) {
    if (!drag.active || (e && e.pointerId !== drag.id)) return;
    drag.active = false;
    stage.classList.remove("is-dragging");
    if (e && e.type === "pointerup" && drag.moved < 8) {
      const hit = pickAt(e);
      if (e.pointerType === "touch") {
        // Un toque corto con el dedo selecciona lo que haya debajo (o quita la selección)
        const same = hit.node === tap.node && hit.part === tap.part;
        tap.node = same ? -1 : hit.node;
        tap.part = same ? null : hit.part;
      } else if (hit.part) {
        setFocus(!focus);       // clic en el PC: acerca o aleja la cámara
      } else if (hit.prop && onPropClick) {
        onPropClick(hit.prop);  // clic en un objeto: da un salto
      }
    }
    wake();
  }

  on(stage, "pointerdown", (e) => {
    if (e.target.closest("button")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.active = true;
    drag.id = e.pointerId;
    drag.x = drag.startX = e.clientX;
    drag.y = drag.startY = e.clientY;
    drag.t = performance.now();
    drag.moved = 0;
    orbit.yawVel = 0;
    orbit.idle = 0;
    point.node = -1;
    point.part = null;
    point.prop = null;
    stage.classList.add("is-dragging");
    stage.classList.remove("is-pointing");
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* sin captura: no pasa nada */ }
    wake();
  });

  on(stage, "pointermove", (e) => {
    if (e.pointerType !== "touch" && !drag.active) {
      const hit = pickAt(e);
      point.node = hit.node;
      point.part = hit.part;
      point.prop = hit.prop;
      stage.classList.toggle("is-pointing", hit.node >= 0 || !!hit.part || !!hit.prop);
    }
    if (drag.active && e.pointerId === drag.id) {
      const now = performance.now();
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      const dt = Math.max((now - drag.t) / 1000, 0.001);
      drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY));
      orbit.yaw = clamp(orbit.yaw - dx * 0.0062, -YAW_LIMIT, YAW_LIMIT);
      orbit.pitch = clamp(orbit.pitch + dy * 0.0042, PITCH_MIN, PITCH_MAX);
      orbit.yawVel = clamp(orbit.yawVel * 0.7 + ((-dx * 0.0062) / dt) * 0.3, -4, 4);
      orbit.idle = 0;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.t = now;
    }
    wake();
  });

  on(stage, "pointerup", endDrag);
  on(stage, "pointercancel", endDrag);
  on(stage, "lostpointercapture", endDrag);
  on(stage, "pointerleave", () => {
    point.node = -1;
    point.part = null;
    point.prop = null;
    stage.classList.remove("is-pointing");
    wake();
  });

  if (focusBtn) on(focusBtn, "click", () => setFocus(!focus));

  // Pasar el cursor por una habilidad de la lista enciende su icono
  if (hardList) {
    on(hardList, "pointerover", (e) => {
      const li = e.target.closest("li");
      if (li) { listHover = Array.prototype.indexOf.call(hardList.children, li); wake(); }
    });
    on(hardList, "pointerout", () => { listHover = -1; wake(); });
  }

  on(stage, "keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      orbit.yaw = clamp(orbit.yaw + (e.key === "ArrowLeft" ? 0.16 : -0.16), -YAW_LIMIT, YAW_LIMIT);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      orbit.pitch = clamp(orbit.pitch + (e.key === "ArrowUp" ? -0.1 : 0.1), PITCH_MIN, PITCH_MAX);
    } else if (e.key === "Home") {
      orbit.yaw = orbit.pitch = orbit.yawVel = 0;
    } else if (e.key === "Enter" || e.key === " ") {
      setFocus(!focus);
    } else {
      return;
    }
    orbit.idle = 0;
    e.preventDefault();
    wake();
  });
  on(window, "keydown", (e) => { if (e.key === "Escape" && focus) setFocus(false); });

  /* ---------- Etiqueta con el nombre y lista HTML ---------- */

  function currentSelection() {
    if (drag.active || !aboutVisible) return null;
    if (point.node >= 0) return { kind: "node", id: point.node };
    if (point.part) return { kind: "part", id: point.part };
    if (tap.node >= 0) return { kind: "node", id: tap.node };
    if (tap.part) return { kind: "part", id: tap.part };
    if (listHover >= 0) return { kind: "node", id: listHover };
    return null;
  }

  function updateLabel(sel, about) {
    if (!labelEl) return;
    const k = sel ? sel.kind + ":" + sel.id : "";
    if (k !== labelKey) {
      labelKey = k;
      if (sel) labelEl.textContent = sel.kind === "node" ? labels[sel.id] || "" : partName(sel.id);
      labelEl.classList.toggle("is-visible", !!sel);
    }
    if (!sel) return;
    if (sel.kind === "node") about.graph.worldPosition(sel.id, labelPos);
    else about.model.partAnchor(sel.id, labelPos);
    labelPos.project(camera);
    const { W, H } = size();
    const half = (labelEl.offsetWidth || 160) / 2;
    const x = clamp((labelPos.x * 0.5 + 0.5) * W, half + 8, Math.max(half + 8, W - half - 8));
    const y = clamp((-labelPos.y * 0.5 + 0.5) * H, 40, H - 40);
    labelEl.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) translate(-50%, calc(-100% - 16px))";
  }

  function syncList(idx) {
    if (!hardList || idx === litIdx) return;
    litIdx = idx;
    Array.prototype.forEach.call(hardList.children, (li, i) => li.classList.toggle("is-lit", i === idx));
  }

  /* ---------- API para scene3d.js ---------- */

  function setSection(id) {
    section = id;
    point.prop = null;
    if (id !== "about") {
      setFocus(false);
      point.node = tap.node = -1;
      point.part = tap.part = null;
    }
  }

  // Devuelve true mientras algo siga moviéndose
  function update(dt, t, ambient, animated, visibleAbout) {
    aboutVisible = visibleAbout && section === "about";
    if (!aboutVisible && focus) setFocus(false);

    // Giro de la cámara: inercia del arrastre y regreso a la vista isométrica en reposo
    let moving = drag.active;
    if (!drag.active) {
      if (animated) {
        orbit.yaw = clamp(orbit.yaw + orbit.yawVel * dt, -YAW_LIMIT, YAW_LIMIT);
        orbit.yawVel *= Math.exp(-dt * 3);
        if (Math.abs(orbit.yawVel) < 0.01) orbit.yawVel = 0;
        orbit.idle += dt;
        if (orbit.idle > (focus ? 9 : 3.2)) {
          const k = 1 - Math.exp(-dt * 0.9);
          orbit.yaw -= orbit.yaw * k;
          orbit.pitch -= orbit.pitch * k;
        }
      }
      moving = moving || orbit.yawVel !== 0 || Math.abs(orbit.yaw) + Math.abs(orbit.pitch) > 0.002;
    }

    const about = getAbout();
    if (!about) return moving;
    const sel = currentSelection();

    // El PC y la red de iconos
    const partId = sel && sel.kind === "part" ? sel.id : null;
    if (partId !== hlId) {
      hlId = partId;
      about.model.highlight(partId);
    }
    about.model.update(t);
    const nodeIdx = sel && sel.kind === "node" ? sel.id : -1;
    slow += ((sel ? 0.1 : 1) - slow) * (1 - Math.exp(-dt * 5));
    if (animated) orbitSpin += dt * 0.14 * ambient * slow;
    about.graph.group.rotation.y = orbitSpin;
    about.graph.setLayout(2.15, 1.05, 1.75);
    const graphActive = about.graph.update(dt, t, ambient, animated, nodeIdx);
    about.pc.updateWorldMatrix(true, true);
    updateLabel(sel, about);
    syncList(point.node >= 0 ? point.node : tap.node);

    return moving || graphActive;
  }

  function dispose() {
    ac.abort();
  }

  return {
    orbit,
    get focus() { return focus; },
    get hoverProp() { return point.prop; },
    setFocus,
    setSection,
    update,
    refreshLabels() { readLabels(); wake(); },
    readLabels,
    state: () => ({ focus, hover: point.node, part: point.part, tapped: tap.node, yaw: +orbit.yaw.toFixed(3), pitch: +orbit.pitch.toFixed(3), label: labelEl && labelEl.textContent }),
    dispose
  };
}
