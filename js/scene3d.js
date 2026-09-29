/*
 * Escena 3D de la web. Un único canvas fijo entre el fondo y el contenido.
 *
 * Cada sección es un NIVEL: una sala flotante (js/levels.js) con su decorado. Los niveles están
 * en fila y la cámara, isométrica, viaja de uno a otro al cambiar de sección (con muelles, así
 * que arranca, se pasa un poco y se asienta). Además de la fila hay partículas, piezas de colores
 * y nubes flotando (js/world-decor.js), que con el movimiento de la cámara dan el parallax.
 *
 * Reacciona al ratón (la cámara "respira"), al scroll (en "Sobre mí" gira y se acerca) y al
 * arrastre (js/stage-input.js). En "Sobre mí", un clic en el PC acerca la cámara hasta él.
 *
 * Los colores se leen de css/theme3d.css (--accent, --accent-2, --accent-3).
 * Con "reducir movimiento" no hay bucle de animación: se dibujan fotogramas estáticos solo
 * cuando cambia algo (sección, tamaño, o al arrastrar).
 *
 * Depuración desde la consola: portfolio3d.stats() y portfolio3d.step(segundos), que avanza la
 * simulación de golpe aunque la pestaña esté oculta.
 */
import * as THREE from "three";
import { createLevels, LEVEL_STYLE } from "./levels.js";
import { createDecor } from "./world-decor.js";
import { createStudioEnv } from "./studio-env.js";
import { createStageInput } from "./stage-input.js";

const GAP = 30;                                          // separación entre niveles
const AXIS = new THREE.Vector3(1, 0, -1).normalize();    // la fila de niveles va hacia la derecha de la pantalla
const DEPTH = new THREE.Vector3(1, 0, 1).normalize();    // hacia la cámara
const BASE_YAW = Math.PI / 4;                            // vista isométrica
const BASE_PITCH = 0.58;
const FOV = 24;
const SIL = { w: 19.2, h: 18.8 };                          // lo que ocupa una sala en pantalla (unidades)
const CENTER_Y = 3.4;                                    // punto al que mira la cámara, sobre el suelo de la sala

// Cada nivel se mira desde un ángulo algo distinto
const VARIANT = {
  about:        { yaw: 0,     pitch: 0 },
  resume:       { yaw: -0.09, pitch: 0.02 },
  certificates: { yaw: 0.1,   pitch: -0.02 },
  projects:     { yaw: -0.05, pitch: 0.04 },
  hhep:         { yaw: 0.07,  pitch: 0 },
  contact:      { yaw: -0.11, pitch: 0.02 }
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const PARTICLES = { full: 5200, lite: 1400 };
const BOX = new THREE.Vector3(120, 70, 120);             // volumen de partículas que rodea a la cámara

const VERTEX = /* glsl */ `
  attribute float aScale;
  attribute float aSeed;
  attribute float aMix;
  uniform float uTime, uPx, uSize, uDrift;
  uniform vec3 uCenter, uBox, uA, uB, uC;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p += vec3(1.0, 0.0, -1.0) * uDrift * 0.7071;
    p.y += sin(uTime * 0.3 + aSeed * 6.2831) * 0.5;
    p.x += cos(uTime * 0.23 + aSeed * 12.566) * 0.4;
    // Se repite en todos los ejes alrededor de la cámara: el campo parece infinito
    vec3 rel = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
    vec4 mv = viewMatrix * vec4(uCenter + rel, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = max(-mv.z, 0.5);
    float edge = 1.0 - smoothstep(0.72, 1.0, max(abs(rel.x) / (uBox.x * 0.5), max(abs(rel.y) / (uBox.y * 0.5), abs(rel.z) / (uBox.z * 0.5))));
    float twinkle = 0.65 + 0.35 * sin(uTime * 1.8 + aSeed * 60.0);
    vAlpha = edge * twinkle * smoothstep(3.0, 10.0, d) * (0.5 + 0.5 * aScale);
    vColor = aMix < 0.6 ? uA : (aMix < 0.85 ? uB : uC);
    gl_PointSize = clamp(uSize * aScale * uPx * (60.0 / d), uPx * 1.2, 20.0 * uPx);
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float r = length(q) * 2.0;
    // Destello con cuatro puntas suaves
    float star = max(0.0, 1.0 - abs(q.x) * 14.0) * max(0.0, 1.0 - abs(q.y) * 2.4) + max(0.0, 1.0 - abs(q.y) * 14.0) * max(0.0, 1.0 - abs(q.x) * 2.4);
    float a = (pow(clamp(1.0 - r, 0.0, 1.0), 1.8) * 1.4 + star * 0.5) * vAlpha;
    vec3 col = mix(vColor, vec3(1.0), smoothstep(0.4, 0.0, r) * 0.6);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const color = (name, fallback) => new THREE.Color(css.getPropertyValue(name).trim() || fallback);
  return {
    accent: color("--accent", "#9b7bff"),
    accent2: color("--accent-2", "#ffc247"),
    accent3: color("--accent-3", "#ff7eb6")
  };
}

function makeParticles(count, palette) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const scale = new Float32Array(count);
  const seed = new Float32Array(count);
  const mix = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.random() * BOX.x;
    pos[i * 3 + 1] = Math.random() * BOX.y;
    pos[i * 3 + 2] = Math.random() * BOX.z;
    scale[i] = 0.6 + Math.pow(Math.random(), 3) * 1.8;
    seed[i] = Math.random();
    mix[i] = Math.random();
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aScale", new THREE.BufferAttribute(scale, 1));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geo.setAttribute("aMix", new THREE.BufferAttribute(mix, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPx: { value: 1 },
      uSize: { value: 2.4 },
      uDrift: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uBox: { value: BOX },
      uA: { value: new THREE.Color(0xffffff) },
      uB: { value: palette.accent.clone().lerp(new THREE.Color(0xffffff), 0.4) },
      uC: { value: palette.accent2.clone() }
    }
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false; // las posiciones se calculan en el shader
  return points;
}

// Muelle con rebote: se usa para la cámara y para la aparición de cada sala
class Spring {
  constructor(v = 0) { this.v = v; this.t = v; this.vel = 0; }
  step(dt, k, c) {
    this.vel += (k * (this.t - this.v) - c * this.vel) * dt;
    this.v += this.vel * dt;
  }
  snap(v = this.t) { this.v = this.t = v; this.vel = 0; }
  get busy() { return Math.abs(this.t - this.v) > 0.003 || Math.abs(this.vel) > 0.003; }
}

// Los rótulos dibujados en canvas (título de la sala, gráfica del PC, nombre del currículum) usan la
// tipografía de la web: se espera a que llegue (con un límite) para que no queden con la de reserva
async function waitForFonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.race([
      Promise.all([document.fonts.load('800 100px "Outfit"'), document.fonts.load('600 100px "Outfit"')]),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
  } catch (err) { /* sin tipografía: se usa la de reserva */ }
}

export async function start(options = {}) {
  await waitForFonts();
  return startNow(options);
}

function startNow({ level = "full", force = false } = {}) {
  const canvas = document.getElementById("scene");
  const stageEl = document.getElementById("stage");
  const root = document.documentElement;
  const lite = level === "lite";
  const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const order = Array.from(document.querySelectorAll(".main-nav a")).map((a) => a.getAttribute("href").slice(1));
  const palette = readPalette();
  const ac = new AbortController();
  const on = (target, type, fn, opts) => target.addEventListener(type, fn, Object.assign({ signal: ac.signal }, opts));

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  } catch (err) {
    return Promise.reject(err);
  }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  let maxDpr = lite ? 1.5 : 2;
  const world = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(FOV, 1, 1, 500);
  const particles = makeParticles(lite ? PARTICLES.lite : PARTICLES.full, palette);
  world.add(particles);

  /* ---------- Luces ---------- */

  const envMap = createStudioEnv(renderer);
  world.environment = envMap.texture;
  world.environmentIntensity = 0.75;
  world.add(new THREE.HemisphereLight(0xffffff, 0x8f7bea, 0.55));
  const fill = new THREE.DirectionalLight(0xb9a8ff, 0.7);
  fill.position.set(-30, 12, 20);
  world.add(fill);

  // Dos luces con sombra: una sigue al nivel actual y la otra al siguiente (que asoma por la derecha)
  function makeKey() {
    const key = new THREE.DirectionalLight(0xfff2e2, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048);
    const s = key.shadow.camera;
    s.left = s.bottom = -19;
    s.right = s.top = 19;
    s.near = 1;
    s.far = 90;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.05;
    world.add(key, key.target);
    return key;
  }
  const keyA = makeKey();
  const keyB = makeKey();
  keyB.intensity = 2;

  /* ---------- Niveles y decorado ---------- */

  const levelPos = (i) => AXIS.clone().multiplyScalar(i * GAP);
  const levels = createLevels({ palette, lite, order });
  levels.items.forEach((lv) => {
    lv.pos = levelPos(lv.index);
    lv.holder.position.copy(lv.pos);
    lv.pop = new Spring(0);
    world.add(lv.holder);
  });
  // Luz real de cada lámpara. Siempre están en la escena (con la intensidad a 0 si su sala no se ve)
  // porque cambiar el número de luces obliga a recompilar los shaders.
  levels.items.forEach((lv) => {
    const anchors = [];
    lv.root.traverse((o) => { if (o.userData.lamp) anchors.push(o); });
    lv.holder.updateMatrixWorld(true);
    lv.lamps = anchors.map((obj) => {
      const light = new THREE.PointLight(obj.userData.lamp.color, 0, 12, 2);
      world.add(light);
      // Posición de la bombilla respecto a la sala (se calcula una sola vez)
      const local = lv.holder.worldToLocal(obj.localToWorld(new THREE.Vector3(0, obj.userData.lamp.y, 0)));
      return { light, local, power: obj.userData.lamp.power };
    });
  });
  const decor = createDecor({
    levels: levels.items.map((lv) => ({ center: lv.pos, accent: lv.style.accent })),
    axis: AXIS, depth: DEPTH, lite
  });
  world.add(decor.group);

  /* ---------- Estado ---------- */

  let W = 1;
  let H = 1;
  let animated = !reduceMq.matches;               // false con "reducir movimiento": fotogramas estáticos
  let section = currentSection();
  let ambient = animated ? 1 : 0;
  let simTime = 0;
  let drift = 0;
  let wheelVel = 0;
  let scrollS = 0;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const forward = new THREE.Vector3();
  let fadedInline = false;

  const rig = {
    cx: new Spring(0), cy: new Spring(0), cz: new Spring(0),
    dist: new Spring(60), yaw: new Spring(BASE_YAW), pitch: new Spring(BASE_PITCH),
    fov: new Spring(FOV), roll: new Spring(0), ox: new Spring(0), oy: new Spring(0)
  };
  const rigList = Object.values(rig);

  function currentSection() {
    const page = document.querySelector(".page:not([hidden])");
    return page && order.includes(page.id) ? page.id : "about";
  }

  const activeIndex = () => Math.max(0, order.indexOf(section));

  /* ---------- Interacción (arrastre, ratón, teclado) ---------- */

  const input = createStageInput({
    stage: stageEl, wake: () => wake(), camera: cam, size: () => ({ W, H }),
    getAbout: () => (levels.about && levels.about.model ? levels.about : null),
    getProps: () => levels.items[activeIndex()].hoverables,
    onPropClick: (obj) => { bumpFor(obj).s.vel += 9; wake(); },   // clic en un objeto: salta
    onFocus: () => { applyTarget(false); wake(); }      // entra o sale del modo "explorar el PC"
  });

  // Los objetos de la sala dan un saltito al pasar el cursor por encima (o al hacer clic)
  const bumps = new Map();
  let lastHover = null;
  function bumpFor(obj) {
    let b = bumps.get(obj);
    if (!b) {
      b = { s: new Spring(0), y: obj.position.y, k: obj.scale.x };
      bumps.set(obj, b);
    }
    return b;
  }
  input.setSection(section);
  input.readLabels();

  /* ---------- Cámara: pose de cada nivel ---------- */

  // Con la pantalla de carga delante la entrada se retiene: la cámara espera lejos y las salas
  // sin subir hasta que la pantalla termina (evento portfolio:boot-done)
  let held = animated && root.dataset.boot === "running";

  function computeTarget() {
    const i = activeIndex();
    const v = VARIANT[section] || VARIANT.about;
    const aspect = W / H;
    // Zona de la pantalla donde debe quedar la sala (el resto lo ocupa el texto). Con pantalla
    // ancha (≥ 1000 px, como en el CSS) la tarjeta va a la derecha y la sala ocupa el resto; en
    // pantallas estrechas la sala va arriba y la tarjeta debajo.
    let region;
    if (W >= 1000) {
      const gutter = THREE.MathUtils.clamp(0.045 * W, 16, 72);
      const left = 20;
      const right = Math.max(left + 300, W - gutter - 464 - 12);
      region = { cx: ((left + right) / 2 / W) * 2 - 1, cy: 0.05, fw: (right - left) / W, fh: 0.78 };
    } else {
      region = { cx: 0, cy: 0.4, fw: 0.98, fh: 0.5 };
    }
    let sw = SIL.w;
    let sh = SIL.h;
    const c = levelPos(i);
    c.y = CENTER_Y;
    let pitch = BASE_PITCH + v.pitch;
    let yaw = BASE_YAW + v.yaw;
    if (input.focus) {
      // Se acerca al PC: su centro en la sala de "Sobre mí"
      const pc = levels.about && levels.about.pc.position;       // el PC de "Sobre mí"
      c.add(new THREE.Vector3(pc ? pc.x : 0, 0.2, pc ? pc.z : 0));
      sw = 14;
      sh = 9.5;
      pitch = 0.36;
      yaw = BASE_YAW - 0.05;
    }
    const viewH = Math.max(sh / region.fh, sw / (aspect * region.fw));
    let dist = viewH / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    let fov = FOV;
    if (held) {
      dist *= 2.4;
      fov += 8;
      c.x -= 8;
      c.y -= 6;
    }
    return { c, dist, yaw, pitch, fov, ox: region.cx, oy: region.cy };
  }

  function applyTarget(snap) {
    const t = computeTarget();
    rig.cx.t = t.c.x; rig.cy.t = t.c.y; rig.cz.t = t.c.z;
    rig.dist.t = t.dist; rig.yaw.t = t.yaw; rig.pitch.t = t.pitch; rig.fov.t = t.fov;
    rig.ox.t = t.ox; rig.oy.t = t.oy; rig.roll.t = 0;
    if (snap) rigList.forEach((s) => s.snap());
  }

  function updatePops(snap) {
    const a = activeIndex();
    levels.items.forEach((lv) => {
      const near = Math.abs(lv.index - a) <= 1;
      lv.pop.t = held && lv.index === a ? 0 : near ? 1 : 0;
      if (snap) lv.pop.snap();
    });
  }

  applyTarget(true);
  updatePops(true);
  if (animated && !held) {
    // Entrada sin pantalla de carga: la cámara llega desde lejos
    rig.dist.v *= 1.8;
    rig.fov.v += 8;
  }

  function stepSprings(dt) {
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    let busy = false;
    for (let s = 0; s < steps; s++) {
      rig.cx.step(h, 38, 9); rig.cy.step(h, 38, 9); rig.cz.step(h, 38, 9);
      rig.dist.step(h, 30, 8);
      rig.yaw.step(h, 26, 7.5); rig.pitch.step(h, 26, 7.5);
      rig.fov.step(h, 40, 7); rig.roll.step(h, 34, 5);
      rig.ox.step(h, 40, 10); rig.oy.step(h, 40, 10);
      levels.items.forEach((lv) => lv.pop.step(h, 58, 8.5));
    }
    rigList.forEach((s) => { if (s.busy) busy = true; });
    levels.items.forEach((lv) => { if (lv.pop.busy) busy = true; });
    return busy;
  }

  // Al llegar a un nivel, sus objetos dan un saltito uno detrás de otro (una ola por la sala)
  let rippleTimers = [];
  function ripple(delay = 380) {
    rippleTimers.forEach(clearTimeout);
    rippleTimers = [];
    if (!animated) return;
    levels.items[activeIndex()].hoverables.forEach((obj, i) => {
      rippleTimers.push(setTimeout(() => { bumpFor(obj).s.vel += 5.5; wake(); }, delay + i * 55));
    });
  }

  function setSection(id, animate) {
    if (!order.includes(id)) return;
    const previous = section;
    section = id;
    input.setSection(id);
    applyTarget(!animate || !animated);
    updatePops(!animate || !animated);
    if (animate && animated && previous !== id) {
      const span = order.indexOf(id) - order.indexOf(previous);
      const dir = Math.sign(span) || 1;
      // Ráfaga de partículas, un toque de alejamiento y una inclinación al arrancar
      wheelVel = THREE.MathUtils.clamp(wheelVel + dir * (10 + Math.abs(span) * 3), -30, 30);
      rig.fov.vel += 30;
      rig.roll.vel += dir * 0.9;
      rig.dist.vel += 40;
      ripple();
    }
    wake();
  }

  /* ---------- Cuadro a cuadro ---------- */

  let ready = false;
  let running = false;
  let raf = 0;
  let last = 0;
  let idleFrames = 0;

  function resize() {
    W = Math.max(1, canvas.clientWidth);
    H = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    particles.material.uniforms.uPx.value = renderer.getPixelRatio();
    applyTarget(!animated);
    wake();
  }

  const tmp = new THREE.Vector3();

  // Devuelve true si algo sigue cambiando (si no, el bucle se duerme hasta el próximo aviso)
  function update(dt) {
    const ambientTarget = animated ? 1 : 0;
    ambient += (ambientTarget - ambient) * (1 - Math.exp(-dt * 2.5));
    if (Math.abs(ambient - ambientTarget) < 0.004) ambient = ambientTarget;
    simTime += dt * ambient;

    const kp = 1 - Math.exp(-dt * 4);
    const pdx = (animated ? ptr.tx : 0) - ptr.x;
    const pdy = (animated ? ptr.ty : 0) - ptr.y;
    ptr.x += pdx * kp;
    ptr.y += pdy * kp;

    const scrollMax = Math.max(1, root.scrollHeight - window.innerHeight);
    const sdx = (animated ? Math.min(1, Math.max(0, window.scrollY / scrollMax)) : 0) - scrollS;
    scrollS += sdx * kp;

    wheelVel *= Math.exp(-dt * 2.2);
    if (Math.abs(wheelVel) < 0.02) wheelVel = 0;
    drift += (ambient * 0.5 + wheelVel) * dt;

    // Los niveles: aparecen subiendo con rebote, flotan y se balancean un poco
    let moving = animated ? stepSprings(dt) : false;
    const a = activeIndex();
    levels.items.forEach((lv) => {
      const pop = Math.max(0, lv.pop.v);
      lv.holder.visible = pop > 0.004;
      if (!lv.holder.visible) {
        lv.lamps.forEach((l) => { l.light.intensity = 0; });
        return;
      }
      lv.holder.scale.setScalar(Math.max(0.0001, pop));
      lv.holder.position.set(lv.pos.x, lv.pos.y + (1 - pop) * -12 + Math.sin(simTime * 0.6 + lv.index * 1.7) * 0.32 * ambient, lv.pos.z);
      lv.holder.rotation.y = Math.sin(simTime * 0.25 + lv.index) * 0.022 * ambient;
      lv.update(simTime, dt * ambient);
      lv.lamps.forEach((l) => {
        // La sala se escala, gira un poco y flota: la luz sigue a la lámpara sin actualizar toda la sala
        l.light.position.copy(l.local).multiplyScalar(lv.holder.scale.x).applyAxisAngle(Y_AXIS, lv.holder.rotation.y).add(lv.holder.position);
        l.light.intensity = l.power * pop * pop;
      });
    });

    // Cámara
    const inAbout = section === "about";
    // En "Sobre mí" hay contenido debajo (habilidades y paradigma): al bajar, la cámara gira y se acerca
    const sy = inAbout && !input.focus ? scrollS : 0;
    // Al bajar hacia las habilidades la escena se atenúa un poco para que las tarjetas se lean
    const fade = 1 - 0.5 * THREE.MathUtils.smoothstep(sy, 0.08, 0.5);
    if (fade < 0.999) {
      canvas.style.opacity = fade.toFixed(3);
      fadedInline = true;
    } else if (fadedInline) {
      canvas.style.opacity = "";
      fadedInline = false;
    }
    const yaw = rig.yaw.v + input.orbit.yaw + ptr.x * 0.055 + sy * 0.55;
    const pitch = THREE.MathUtils.clamp(rig.pitch.v + input.orbit.pitch - ptr.y * 0.03 - sy * 0.06, 0.1, 1.25);
    const dist = rig.dist.v * (1 - sy * 0.17);
    const cy = rig.cy.v + Math.sin(simTime * 0.4) * 0.15 * ambient + sy * 2.5;
    cam.position.set(
      rig.cx.v + dist * Math.sin(yaw) * Math.cos(pitch),
      cy + dist * Math.sin(pitch),
      rig.cz.v + dist * Math.cos(yaw) * Math.cos(pitch)
    );
    cam.up.set(0, 1, 0);
    cam.lookAt(rig.cx.v, cy, rig.cz.v);
    cam.rotateZ(rig.roll.v);
    cam.fov = rig.fov.v;
    cam.aspect = W / H;
    // Desplaza la imagen para que la sala quede en la zona libre de la pantalla
    cam.setViewOffset(W, H, -rig.ox.v * W * 0.5, rig.oy.v * H * 0.5, W, H);

    // Las luces con sombra siguen al nivel actual y al siguiente
    const lvA = levels.items[a];
    const lvB = levels.items[Math.min(a + 1, levels.items.length - 1)];
    [[keyA, lvA], [keyB, lvB]].forEach(([key, lv]) => {
      key.position.copy(lv.pos).add(tmp.set(11, 24, 15));
      key.target.position.copy(lv.pos);
      key.target.position.y = 3;
      key.target.updateMatrixWorld();
    });

    const u = particles.material.uniforms;
    u.uTime.value = simTime;
    u.uDrift.value = drift;
    cam.getWorldDirection(forward);
    u.uCenter.value.copy(cam.position).addScaledVector(forward, BOX.z * 0.3);
    decor.update(simTime, dt * ambient);

    const hp = input.hoverProp;
    if (hp !== lastHover) {
      if (lastHover) bumpFor(lastHover).s.t = 0;
      if (hp) bumpFor(hp).s.t = 1;
      lastHover = hp;
    }
    let bumping = false;
    bumps.forEach((b, obj) => {
      if (!b.s.busy) return;
      const steps = Math.max(1, Math.ceil(dt / 0.008));
      for (let i = 0; i < steps; i++) b.s.step(dt / steps, 160, 10);
      obj.position.y = b.y + b.s.v * 0.5;
      obj.scale.setScalar(b.k * (1 + b.s.v * 0.06));
      bumping = bumping || b.s.busy;
    });

    const aboutLv = levels.items[order.indexOf("about")];
    const aboutVisible = !!aboutLv && aboutLv.pop.v > 0.7;
    const inputActive = input.update(dt, simTime, ambient, animated, aboutVisible);

    return ambient > 0 || moving || inputActive || bumping || wheelVel !== 0 ||
      Math.abs(pdx) + Math.abs(pdy) > 0.0005 || Math.abs(sdx) > 0.0005;
  }

  function render() {
    renderer.render(world, cam);
  }

  function frame(now) {
    raf = 0;
    const raw = (now - last) / 1000;
    last = now;
    const active = update(Math.max(0, Math.min(raw, 0.05)));
    render();
    watchPerformance(raw);
    idleFrames = active ? 0 : idleFrames + 1;
    // Pestaña oculta o nada que animar: el bucle se para hasta que haga falta otro fotograma
    if (document.hidden || idleFrames > 8) {
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (!ready || running || document.hidden) return;
    running = true;
    idleFrames = 0;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- Resolución adaptable ---------- */

  // Si la media baja de ~29 fps se baja la resolución (nunca se apaga el 3D)
  const perf = { avg: 1 / 60, samples: 0, quality: 0 };

  function watchPerformance(raw) {
    if (!animated || document.hidden || raw > 0.25) return;
    perf.avg += (raw - perf.avg) * 0.05;
    if (++perf.samples < 150 || perf.samples % 60) return;
    if (perf.quality === 0 && perf.avg > 0.034) {
      perf.quality = 1;
      maxDpr = 1.25;
      resize();
    } else if (perf.quality === 1 && perf.avg > 0.04) {
      perf.quality = 2;
      maxDpr = 1;
      resize();
    } else {
      return;
    }
    perf.samples = 0;
    perf.avg = 1 / 60;
  }

  /* ---------- Entradas: ratón, scroll, rueda, cambios de la página ---------- */

  on(window, "pointermove", (e) => {
    if (e.pointerType === "touch" || !animated) return;
    ptr.tx = (e.clientX / window.innerWidth) * 2 - 1;
    ptr.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    wake();
  }, { passive: true });
  on(window, "scroll", () => { if (animated) wake(); }, { passive: true });
  on(window, "wheel", (e) => {
    if (!animated) return;
    wheelVel = THREE.MathUtils.clamp(wheelVel + THREE.MathUtils.clamp(e.deltaY, -120, 120) * 0.05, -30, 30);
    wake();
  }, { passive: true });

  function refreshTitles() {
    const all = window.TRANSLATIONS || {};
    const dict = all[document.documentElement.lang] || all.es || {};
    levels.setTitles(dict);
  }

  on(document, "portfolio:section", (e) => setSection(e.detail.id, e.detail.animate));
  on(document, "portfolio:lang", () => { refreshTitles(); input.refreshLabels(); wake(); });
  // Termina la pantalla de carga: la cámara vuela hasta su sitio con una ráfaga de partículas
  // y la sala actual sube con rebote
  on(document, "portfolio:boot-done", () => {
    if (!held) return;
    held = false;
    applyTarget(false);
    updatePops(false);
    wheelVel = THREE.MathUtils.clamp(wheelVel + 24, -30, 30);
    rig.roll.vel += 0.6;
    ripple(900);
    wake();
  });
  on(document, "visibilitychange", () => wake());
  on(canvas, "webglcontextlost", (e) => { e.preventDefault(); dispose(); });

  const onMotionChange = () => {
    animated = !reduceMq.matches;
    if (!animated) { applyTarget(true); updatePops(true); }
    wake();
  };
  if (reduceMq.addEventListener) on(reduceMq, "change", onMotionChange);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  function dispose() {
    ac.abort();
    resizeObserver.disconnect();
    running = false;
    ready = false;
    cancelAnimationFrame(raf);
    input.dispose();
    levels.dispose();
    decor.dispose();
    world.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    envMap.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    root.classList.remove("has-3d");
    root.classList.add("no-3d");
    root.dataset.scene = "off";
  }

  // Para revisar el estado desde la consola: portfolio3d.stats()
  window.portfolio3d = {
    stats: () => ({
      level, running, animated, ambient, section, quality: perf.quality,
      fps: Math.round(1 / perf.avg), dpr: renderer.getPixelRatio(),
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      cam: { pos: cam.position.toArray().map((n) => +n.toFixed(2)), fov: +cam.fov.toFixed(2), aspect: +cam.aspect.toFixed(3) },
      input: input.state(),
      pops: levels.items.map((lv) => +lv.pop.v.toFixed(2))
    }),
    // Avanza la simulación de golpe (para pruebas y capturas con la pestaña en segundo plano)
    step: (seconds = 1) => {
      for (let t = 0; t < seconds; t += 1 / 60) update(1 / 60);
      render();
    },
    focus: (v) => input.setFocus(v),
    // Para revisar un objeto de cerca: mira al punto (x, y, z) de la sala actual desde 'dist' unidades
    look: (x, y, z, dist = 10, yaw, pitch) => {
      const lv = levels.items[activeIndex()];
      rig.cx.t = lv.pos.x + x; rig.cy.t = y; rig.cz.t = lv.pos.z + z;
      rig.dist.t = dist; rig.ox.t = 0; rig.oy.t = 0;
      if (yaw !== undefined) rig.yaw.t = yaw;
      if (pitch !== undefined) rig.pitch.t = pitch;
    },
    // Revisa qué objetos de cada sala atraviesan las paredes o se salen del suelo (para pruebas)
    audit: () => {
      const out = [];
      const box = new THREE.Box3();
      const part = new THREE.Box3();
      levels.items.forEach((lv) => {
        // Sin el balanceo ni el tamaño animado del nivel: se mide la sala tal cual está construida
        const keep = [lv.holder.rotation.y, lv.holder.scale.x, lv.holder.position.y];
        lv.holder.rotation.y = 0;
        lv.holder.scale.setScalar(1);
        lv.holder.position.y = lv.pos.y;
        lv.holder.updateMatrixWorld(true);
        lv.root.children.forEach((o, i) => {
          if (!o.isGroup && !o.isMesh) return;
          // Solo geometría real (no sprites ni resplandores)
          box.makeEmpty();
          o.traverse((m) => {
            if (!m.isMesh || !m.geometry || m.isSprite || !m.castShadow) return;      // solo geometría sólida
            if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
            part.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
            box.union(part);
          });
          if (box.isEmpty()) return;
          const p = lv.pos;
          const min = { x: box.min.x - p.x, z: box.min.z - p.z };
          const max = { x: box.max.x - p.x, z: box.max.z - p.z, y: box.max.y - p.y };
          if (min.x < -7.06 || min.z < -7.06 || max.x > 7.3 || max.z > 7.3) {
            out.push(lv.id + "#" + i + " [" + o.children.length + " hijos] x " + min.x.toFixed(2) + ".." + max.x.toFixed(2) + " z " + min.z.toFixed(2) + ".." + max.z.toFixed(2) + " y<" + max.y.toFixed(1));
          }
        });
        lv.holder.rotation.y = keep[0];
        lv.holder.scale.setScalar(keep[1]);
        lv.holder.position.y = keep[2];
        lv.holder.updateMatrixWorld(true);
      });
      return out;
    },
    // Posición en pantalla (px) de una pieza del PC o de un icono de habilidad: para pruebas
    partScreen: (id) => {
      const v = new THREE.Vector3();
      levels.about.pc.updateWorldMatrix(true, true);
      levels.about.model.partAnchor(id, v).project(cam);
      return [Math.round((v.x * 0.5 + 0.5) * W), Math.round((-v.y * 0.5 + 0.5) * H)];
    },
    nodeScreen: (i) => {
      const v = new THREE.Vector3();
      levels.about.graph.worldPosition(i, v).project(cam);
      return [Math.round((v.x * 0.5 + 0.5) * W), Math.round((-v.y * 0.5 + 0.5) * H)];
    },
    orbit: (yaw, pitch) => { input.orbit.yaw = yaw; input.orbit.pitch = pitch || 0; input.orbit.idle = 0; wake(); },
    levels, input, THREE, rig,
    dispose
  };

  resize();
  refreshTitles();
  // Los títulos de las paredes se dibujan con la tipografía de la web: se repintan cuando llega
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('800 100px "Outfit"'), document.fonts.ready]).then(() => { refreshTitles(); wake(); }, () => {});
  }
  update(1 / 60);
  render();
  ready = true;
  wake();
  return Promise.resolve({ level: lite ? "lite" : "full", dispose });
}
