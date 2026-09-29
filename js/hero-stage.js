/*
 * Escenario de "Sobre mí": el modelo 3D y la red de habilidades, dibujados con una cámara
 * fija y anclados al hueco #stage del HTML: se colocan y escalan para ocupar exactamente
 * ese rectángulo aunque la página se desplace o cambie de tamaño.
 *
 * Interacción: arrastrar (ratón o dedo) gira el modelo con inercia; el cursor lo inclina;
 * con el hueco enfocado, las flechas del teclado lo giran.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createHeroModel } from "./hero-model.js";

const CAM_Z = 16;
const FOV = 30;
const DESIGN_H = 3.5;          // alto (en unidades de escena) que ocupa el conjunto en el hueco
const DEFAULT_YAW = -0.55;     // vista de tres cuartos: cristal y frontal
const DEFAULT_PITCH = 0.1;
const clamp = THREE.MathUtils.clamp;

export function createHeroStage({ renderer, palette, lite, stage, wake }) {
  const ac = new AbortController();
  const on = (target, type, fn, opts) => target.addEventListener(type, fn, Object.assign({ signal: ac.signal }, opts));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.set(0, 0, CAM_Z);

  // Reflejos: un entorno de estudio generado por código (sin descargar nada)
  const room = new RoomEnvironment();
  const envMap = new THREE.PMREMGenerator(renderer).fromScene(room, 0.04);
  room.dispose();
  scene.environment = envMap.texture;
  scene.environmentIntensity = 0.6;

  scene.add(new THREE.AmbientLight(0x8fa0ff, 0.25));
  const key = new THREE.DirectionalLight(0xdfe6ff, 1.6);
  const rim = new THREE.DirectionalLight(palette.accent, 3.2);
  const fill = new THREE.DirectionalLight(palette.accent2, 1.6);
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
  const drag = { active: false, id: null, x: 0, y: 0, t: 0 };

  function trackPointer(e) {
    const r = stage.getBoundingClientRect();
    pointer.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    pointer.y = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
  }

  function endDrag(e) {
    if (!drag.active || (e && e.pointerId !== drag.id)) return;
    drag.active = false;
    stage.classList.remove("is-dragging");
    if (!animated) yawVel = 0;
    wake();
  }

  on(stage, "pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.active = true;
    drag.id = e.pointerId;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.t = performance.now();
    yawVel = 0;
    stage.classList.add("is-dragging");
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* sin captura: no pasa nada */ }
    wake();
  });

  on(stage, "pointermove", (e) => {
    if (e.pointerType !== "touch") {
      pointer.inside = true;
      trackPointer(e);
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
  on(stage, "pointerleave", () => { pointer.inside = false; wake(); });

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

  function setSection(id, previous, animate) {
    enterTarget = id === "about" ? 1 : 0;
    if (!animate) {
      enter = enterTarget;
      enterV = 0;
    }
  }

  function layout(w, h) {
    W = w;
    H = h;
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
    if (!visible) return entering;

    // Colocación: el centro del hueco → posición en la escena; su alto → escala
    const wpp = (2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / H;
    root.position.set((rect.left + rect.width / 2 - W / 2) * wpp, -(rect.top + rect.height / 2 - H / 2) * wpp, 0);
    const s = (rect.height * wpp) / DESIGN_H;
    root.scale.setScalar(Math.max(0.0001, s * Math.max(0, enter)));
    camera.aspect = W / H;
    camera.updateProjectionMatrix();

    // Giro: inercia del arrastre + giro lento de reposo (con el fondo en marcha)
    if (animated && !drag.active) {
      yaw += yawVel * dt;
      yawVel *= Math.exp(-dt * 2.6);
      if (Math.abs(yawVel) < 0.01) yawVel = 0;
      yaw += dt * 0.16 * ambient * (pointer.inside ? 0.35 : 1);
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

    return entering || drag.active || yawVel !== 0 || tiltMoving || ambient > 0;
  }

  function dispose() {
    ac.abort();
    resizeObserver.disconnect();
    model.dispose();
    envMap.dispose();
  }

  return {
    scene,
    camera,
    get visible() { return visible; },
    layout,
    update,
    setSection,
    refreshLabels() {},
    state: () => ({ yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3), yawVel: +yawVel.toFixed(3), dragging: drag.active, enter: +enter.toFixed(3), visible }),
    dispose
  };
}
