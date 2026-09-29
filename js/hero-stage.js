/*
 * Escenario de "Sobre mí": el modelo 3D y la red de habilidades, dibujados con una cámara
 * fija y anclados al hueco #stage del HTML: se colocan y escalan para ocupar exactamente
 * ese rectángulo aunque la página se desplace o cambie de tamaño.
 *
 * Interacción: arrastrar (ratón o dedo) gira el modelo con inercia; el cursor lo inclina;
 * pasar el cursor (o tocar) por una pieza del PC o por un nodo de habilidad la resalta y
 * muestra su nombre; con el hueco enfocado, las flechas del teclado lo giran.
 */
import * as THREE from "three";
import { createStudioEnv } from "./studio-env.js";
import { createHeroModel } from "./hero-model.js";
import { createSkillsGraph } from "./skills-graph.js";

const CAM_Z = 16;
const FOV = 30;
const DESIGN_H = 3.5;          // alto (en unidades de escena) que ocupa el conjunto en el hueco
const HINT_STRIP = 40;         // px libres bajo el modelo para el texto de ayuda
const MIN_WIDTH = 4.6;         // ancho mínimo (unidades) para que quepan el PC, su plataforma y los nodos
const DEFAULT_YAW = -0.55;     // vista de tres cuartos: cristal y frontal
const DEFAULT_PITCH = 0.1;
const clamp = THREE.MathUtils.clamp;

export function createHeroStage({ renderer, palette, lite, stage, wake }) {
  const ac = new AbortController();
  const on = (target, type, fn, opts) => target.addEventListener(type, fn, Object.assign({ signal: ac.signal }, opts));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.set(0, 0, CAM_Z);

  // Reflejos: un estudio con luces de neón generado por código (sin descargar nada)
  const envMap = createStudioEnv(renderer, palette);
  scene.environment = envMap.texture;
  scene.environmentIntensity = 0.9;

  scene.add(new THREE.AmbientLight(0x8fa0ff, 0.18));
  const key = new THREE.DirectionalLight(0xdfe6ff, 1.3);
  const rim = new THREE.DirectionalLight(palette.accent, 3);
  const fill = new THREE.DirectionalLight(palette.accent2, 1.4);
  key.position.set(3, 4, 6);
  rim.position.set(-6, 2, -4);
  fill.position.set(6, -3, 2);
  scene.add(key, rim, fill);

  const root = new THREE.Group();   // colocado y escalado según el hueco
  const spin = new THREE.Group();   // gira con el arrastre
  const model = createHeroModel({ palette, lite });
  spin.add(model.group);
  root.add(spin);
  scene.add(root);

  // Habilidades técnicas como nodos: los nombres salen de la lista HTML real
  const graph = createSkillsGraph({ palette, lite, touch: window.matchMedia("(pointer: coarse)").matches });
  root.add(graph.group);
  const raycaster = new THREE.Raycaster();
  const labelEl = stage.querySelector(".node-label");
  const hardList = document.querySelector('.skills__list[data-i18n-list="skills.hard"]');
  let labels = [];
  // Lo señalado: nodo (índice) o pieza del PC (id). Con ratón, con el dedo o desde la lista HTML
  const point = { node: -1, part: null };
  const tap = { node: -1, part: null };
  let listHover = -1;
  let labelKey = "";
  let litIdx = -1;
  let hlId = null;
  let orbit = 0;         // giro propio de la red
  let slow = 1;          // la red se frena mientras se señala algo
  const labelPos = new THREE.Vector3();

  function readLabels() {
    labels = hardList ? Array.from(hardList.children).map((li) => li.textContent.trim()) : [];
    graph.setCount(labels.length);
    labelKey = "";
    litIdx = -1;   // los <li> son nuevos: hay que volver a iluminar el que toque
  }
  readLabels();

  // Nombre de una pieza en el idioma actual (claves pc.* de translations.js)
  function partName(id) {
    const all = window.TRANSLATIONS || {};
    const dict = all[document.documentElement.lang] || all.es || {};
    return dict["pc." + id] || id;
  }

  /* ---------- Estado ---------- */

  let W = 1;
  let H = 1;
  let visible = false;
  let animated = true;
  let enter = 0;                 // 0 fuera → 1 en su sitio (con un pequeño rebote)
  let enterV = 0;
  let enterTarget = 1;
  let yaw = DEFAULT_YAW;
  let pitch = DEFAULT_PITCH;
  let yawVel = 0;                // rad/s, para la inercia
  let tiltX = 0;
  let tiltY = 0;
  const pointer = { inside: false, x: 0, y: 0 };
  const drag = { active: false, id: null, x: 0, y: 0, t: 0, startX: 0, startY: 0 };

  function trackPointer(e) {
    const r = stage.getBoundingClientRect();
    pointer.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    pointer.y = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
  }

  // Qué hay bajo el puntero: primero los nodos (están delante) y si no, una pieza del PC
  function pickAt(e) {
    raycaster.setFromCamera(new THREE.Vector2((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1), camera);
    const node = graph.pick(raycaster);
    return { node, part: node >= 0 ? null : model.pick(raycaster) };
  }

  function endDrag(e) {
    if (!drag.active || (e && e.pointerId !== drag.id)) return;
    drag.active = false;
    // Un toque corto con el dedo selecciona lo que haya debajo (o quita la selección)
    if (e && e.type === "pointerup" && e.pointerType === "touch" &&
        Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 8) {
      const hit = visible ? pickAt(e) : { node: -1, part: null };
      const same = hit.node === tap.node && hit.part === tap.part;
      tap.node = same ? -1 : hit.node;
      tap.part = same ? null : hit.part;
    }
    stage.classList.remove("is-dragging");
    if (!animated) yawVel = 0;
    wake();
  }

  on(stage, "pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.active = true;
    drag.id = e.pointerId;
    drag.x = drag.startX = e.clientX;
    drag.y = drag.startY = e.clientY;
    drag.t = performance.now();
    yawVel = 0;
    point.node = -1;
    point.part = null;
    stage.classList.add("is-dragging");
    stage.classList.remove("is-pointing");
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* sin captura: no pasa nada */ }
    wake();
  });

  on(stage, "pointermove", (e) => {
    if (e.pointerType !== "touch") {
      pointer.inside = true;
      trackPointer(e);
      if (!drag.active && visible) {
        const hit = pickAt(e);
        point.node = hit.node;
        point.part = hit.part;
        stage.classList.toggle("is-pointing", hit.node >= 0 || !!hit.part);
      }
    }
    if (drag.active && e.pointerId === drag.id) {
      const now = performance.now();
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      const dt = Math.max((now - drag.t) / 1000, 0.001);
      yaw += dx * 0.0085;
      pitch = clamp(pitch + dy * 0.005, -0.7, 0.7);
      // Velocidad suavizada: al soltar, el modelo sigue girando y se frena solo
      if (animated) yawVel = clamp(yawVel * 0.7 + ((dx * 0.0085) / dt) * 0.3, -6.5, 6.5);
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
    pointer.inside = false;
    point.node = -1;
    point.part = null;
    stage.classList.remove("is-pointing");
    wake();
  });

  // Pasar el cursor por una habilidad de la lista enciende su nodo
  if (hardList) {
    on(hardList, "pointerover", (e) => {
      const li = e.target.closest("li");
      if (li) { listHover = Array.prototype.indexOf.call(hardList.children, li); wake(); }
    });
    on(hardList, "pointerout", () => { listHover = -1; wake(); });
  }

  // Teclado (con el hueco enfocado): flechas para girar, Inicio para volver a la vista inicial
  on(stage, "keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const dir = e.key === "ArrowLeft" ? -1 : 1;
      if (animated) yawVel = clamp(yawVel + dir * 2.4, -6.5, 6.5);
      else yaw += dir * 0.3;
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      pitch = clamp(pitch + (e.key === "ArrowUp" ? -0.15 : 0.15), -0.7, 0.7);
    } else if (e.key === "Home") {
      yaw = DEFAULT_YAW;
      pitch = DEFAULT_PITCH;
      yawVel = 0;
    } else {
      return;
    }
    e.preventDefault();
    wake();
  });

  // El hueco pasa de display:none a visible cuando el 3D está listo: hay que redibujar
  const resizeObserver = new ResizeObserver(() => wake());
  resizeObserver.observe(stage);

  /* ---------- API para scene3d.js ---------- */

  // Mientras dura la pantalla de carga el modelo espera fuera; al terminar entra girando
  let held = false;
  let wanted = true;
  function setHold(value) {
    held = value;
    enterTarget = held || !wanted ? 0 : 1;
    if (held) {
      enter = 0;
      enterV = 0;
    }
    wake();
  }

  function setSection(id, previous, animate) {
    wanted = id === "about";
    enterTarget = held || !wanted ? 0 : 1;
    if (!animate) {
      enter = enterTarget;
      enterV = 0;
    }
  }

  function layout(w, h) {
    W = w;
    H = h;
  }

  // Lo que se muestra ahora: {kind, id} o null. Arrastrando no se muestra nada.
  function currentSelection() {
    if (drag.active) return null;
    if (point.node >= 0) return { kind: "node", id: point.node };
    if (point.part) return { kind: "part", id: point.part };
    if (tap.node >= 0) return { kind: "node", id: tap.node };
    if (tap.part) return { kind: "part", id: tap.part };
    if (listHover >= 0) return { kind: "node", id: listHover };
    return null;
  }

  // Etiqueta HTML con el nombre, pegada al nodo o a la pieza señalados
  function updateLabel(sel, rect) {
    if (!labelEl) return;
    const k = sel ? sel.kind + ":" + sel.id : "";
    if (k !== labelKey) {
      labelKey = k;
      if (sel) labelEl.textContent = sel.kind === "node" ? labels[sel.id] || "" : partName(sel.id);
      labelEl.classList.toggle("is-visible", !!sel);
    }
    if (!sel) return;
    if (sel.kind === "node") graph.worldPosition(sel.id, labelPos);
    else model.partAnchor(sel.id, labelPos);
    labelPos.project(camera);
    const half = (labelEl.offsetWidth || 160) / 2;
    const x = clamp((labelPos.x * 0.5 + 0.5) * W - rect.left, half, Math.max(half, rect.width - half));
    const y = (-labelPos.y * 0.5 + 0.5) * H - rect.top;
    labelEl.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) translate(-50%, calc(-100% - 16px))";
  }

  // El elemento de la lista HTML correspondiente se ilumina junto al nodo
  function syncList(idx) {
    if (!hardList || idx === litIdx) return;
    litIdx = idx;
    Array.prototype.forEach.call(hardList.children, (li, i) => li.classList.toggle("is-lit", i === idx));
  }

  // Devuelve true mientras algo se mueva
  function update(dt, t, ambient, isAnimated) {
    animated = isAnimated;
    if (animated) {
      // Muelle con un poco de rebote
      enterV += (48 * (enterTarget - enter) - 8 * enterV) * dt;
      enter += enterV * dt;
      if (Math.abs(enter - enterTarget) < 0.002 && Math.abs(enterV) < 0.01) {
        enter = enterTarget;
        enterV = 0;
      }
    } else {
      enter = enterTarget;
    }
    const entering = enter !== enterTarget;

    const rect = stage.getBoundingClientRect();
    visible = enter > 0.004 && rect.width > 0 && rect.height > 0 && rect.bottom > -60 && rect.top < H + 60;
    if (!visible) {
      point.node = tap.node = -1;
      point.part = tap.part = null;
      updateLabel(null, rect);
      syncList(-1);
      if (hlId) { model.highlight(null); hlId = null; }
      return entering;
    }

    // Colocación: el centro del hueco → posición en la escena; su alto → escala
    const wpp = (2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / H;
    // Abajo se deja una franja libre para el texto de ayuda
    const usableH = Math.max(rect.height - HINT_STRIP, rect.height * 0.6);
    root.position.set((rect.left + rect.width / 2 - W / 2) * wpp, -(rect.top + usableH / 2 - H / 2) * wpp, 0);
    // En huecos estrechos (móvil) manda el ancho, para que nada se salga por los lados
    const s = Math.min((usableH * wpp) / DESIGN_H, (rect.width * wpp) / MIN_WIDTH);
    root.scale.setScalar(Math.max(0.0001, s * Math.max(0, enter)));
    camera.aspect = W / H;
    camera.updateProjectionMatrix();

    const sel = currentSelection();

    // Giro: inercia del arrastre + giro lento de reposo (más lento al señalar algo, para poder leerlo)
    if (animated && !drag.active) {
      yaw += yawVel * dt;
      yawVel *= Math.exp(-dt * 2.6);
      if (Math.abs(yawVel) < 0.01) yawVel = 0;
      yaw += dt * 0.16 * ambient * (sel ? 0.06 : pointer.inside ? 0.35 : 1);
      pitch += (DEFAULT_PITCH - pitch) * (1 - Math.exp(-dt * 0.6));
    }

    // El cursor inclina el modelo hacia donde apunta
    const k = 1 - Math.exp(-dt * 6);
    const goalY = animated && pointer.inside ? pointer.x * 0.3 : 0;
    const goalX = animated && pointer.inside ? pointer.y * 0.18 : 0;
    const tiltMoving = Math.abs(goalY - tiltY) + Math.abs(goalX - tiltX) > 0.0005;
    tiltY += (goalY - tiltY) * k;
    tiltX += (goalX - tiltX) * k;

    spin.rotation.set(pitch + tiltX, yaw + tiltY + (1 - clamp(enter, 0, 1)) * Math.PI * 1.2, 0, "YXZ");
    spin.position.y = animated ? Math.sin(t * 0.9) * 0.05 * ambient : 0;
    model.update(t);

    const partId = sel && sel.kind === "part" ? sel.id : null;
    if (partId !== hlId) {
      hlId = partId;
      model.highlight(partId);
    }

    // Red de habilidades: gira despacio alrededor del modelo (algo con el arrastre) y se
    // adapta al ancho del hueco
    const nodeIdx = sel && sel.kind === "node" ? sel.id : -1;
    slow += ((sel ? 0.1 : 1) - slow) * (1 - Math.exp(-dt * 5));
    if (animated) orbit += dt * 0.12 * ambient * slow;
    graph.group.rotation.y = orbit + (yaw - DEFAULT_YAW) * 0.35;
    const widthUnits = (rect.width * wpp) / s;
    const rx = clamp(widthUnits * 0.45, 1.9, 5.4);
    graph.setLayout(rx, 1.35, Math.min(rx * 0.55, 2.4));
    const graphActive = graph.update(dt, t, ambient, animated, nodeIdx);
    root.updateMatrixWorld(true);
    updateLabel(sel, rect);
    syncList(point.node >= 0 ? point.node : tap.node);

    return entering || drag.active || yawVel !== 0 || tiltMoving || graphActive || ambient > 0;
  }

  function dispose() {
    ac.abort();
    resizeObserver.disconnect();
    model.dispose();
    graph.dispose();
    envMap.dispose();
  }

  return {
    scene,
    camera,
    get visible() { return visible; },
    layout,
    update,
    setSection,
    setHold,
    // Al cambiar de idioma la lista HTML se vuelve a escribir: se leen de nuevo los nombres
    refreshLabels() {
      readLabels();
      wake();
    },
    // Para pruebas: coloca el modelo en un ángulo exacto
    debugPose(newYaw, newPitch) {
      yaw = newYaw;
      pitch = newPitch === undefined ? DEFAULT_PITCH : newPitch;
      yawVel = 0;
      wake();
    },
    // Posición en pantalla (px) de un nodo o de una pieza: para pruebas
    nodeScreen(i) {
      graph.worldPosition(i, labelPos).project(camera);
      return [Math.round((labelPos.x * 0.5 + 0.5) * W), Math.round((-labelPos.y * 0.5 + 0.5) * H)];
    },
    partScreen(id) {
      model.partAnchor(id, labelPos);
      labelPos.project(camera);
      return [Math.round((labelPos.x * 0.5 + 0.5) * W), Math.round((-labelPos.y * 0.5 + 0.5) * H)];
    },
    state: () => ({
      yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3), yawVel: +yawVel.toFixed(3), dragging: drag.active,
      enter: +enter.toFixed(3), visible, nodes: graph.count, hover: point.node, part: point.part, tapped: tap.node,
      label: labelEl && labelEl.textContent
    }),
    dispose
  };
}
