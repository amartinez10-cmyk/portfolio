/*
 * Escena 3D de fondo. Un único canvas fijo entre el vídeo y el contenido, con dos pasadas:
 *   1. El MUNDO: campo de partículas + un emblema por sección. Su cámara viaja de un
 *      emblema a otro al cambiar de sección (cada una con un muelle distinto) y reacciona
 *      al ratón, al scroll y a la rueda.
 *   2. El ESCENARIO de "Sobre mí" (js/hero-stage.js): el modelo 3D y la red de habilidades,
 *      con una cámara fija anclada al hueco #stage del HTML.
 *
 * Los colores se leen de css/theme3d.css (--accent, --accent-2, --accent-3).
 * Con "reducir movimiento" no hay bucle de animación: se dibujan fotogramas estáticos
 * solo cuando cambia algo (sección, tamaño, o al arrastrar el modelo).
 * El botón de fondo (play/pausa) también congela el movimiento ambiente del 3D.
 *
 * Depuración desde la consola: portfolio3d.stats() (fps, llamadas de dibujo, cámara…) y
 * portfolio3d.step(segundos), que avanza la simulación de golpe aunque la pestaña esté oculta.
 */
import * as THREE from "three";
import { createWorldProps } from "./world-props.js";
import { createHeroStage } from "./hero-stage.js";

const SPACING = 70; // separación entre emblemas en el eje X del mundo

// Cámara de cada sección, relativa a su emblema.
//   off: dónde está la cámara · ndcL/ndcP: en qué punto de la pantalla queda el emblema
//   (apaisado / vertical) · k y c: rigidez y amortiguación del muelle (cada sección "se
//   siente" distinta) · roll: giro de la cámara · fov: campo de visión
const POSES = {
  about:        { off: [0, 1.5, 48],  ndcL: [0.44, 0.02],  ndcP: [0, 0],        k: 34, c: 8.5, roll: 0,     fov: 46 },
  resume:       { off: [-17, 2, 25],  ndcL: [0.5, -0.02],  ndcP: [0, -0.42],    k: 70, c: 15,  roll: 0,     fov: 50 },
  certificates: { off: [13, -7, 23],  ndcL: [0.5, -0.02],  ndcP: [0, -0.42],    k: 30, c: 4.5, roll: 0.32,  fov: 54 },
  projects:     { off: [0, 17, 21],   ndcL: [0.46, -0.08], ndcP: [0, -0.42],    k: 22, c: 10,  roll: -0.1,  fov: 48 },
  hhep:         { off: [25, 1, 46],   ndcL: [0.5, -0.02],  ndcP: [0, -0.42],    k: 40, c: 6.5, roll: 0,     fov: 60 },
  contact:      { off: [-7, 4, 25],   ndcL: [0.5, -0.02],  ndcP: [0, -0.42],    k: 55, c: 14,  roll: 0,     fov: 42 }
};

const PARTICLES = { full: 2600, lite: 900 };
const BOX = new THREE.Vector3(84, 48, 84); // volumen de partículas que rodea a la cámara

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
    p.z += uDrift;
    p.y += sin(uTime * 0.3 + aSeed * 6.2831) * 0.4;
    p.x += cos(uTime * 0.23 + aSeed * 12.566) * 0.3;
    // Se repite en todos los ejes alrededor de la cámara: el campo parece infinito
    vec3 rel = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
    vec4 mv = viewMatrix * vec4(uCenter + rel, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = max(-mv.z, 0.5);
    float edge = 1.0 - smoothstep(0.72, 1.0, max(abs(rel.x) / (uBox.x * 0.5), max(abs(rel.y) / (uBox.y * 0.5), abs(rel.z) / (uBox.z * 0.5))));
    float twinkle = 0.7 + 0.3 * sin(uTime * 1.6 + aSeed * 60.0);
    vAlpha = edge * twinkle * smoothstep(1.5, 5.0, d) * (0.45 + 0.55 * aScale);
    vColor = aMix < 0.62 ? uA : (aMix < 0.9 ? uB : uC);
    gl_PointSize = clamp(uSize * aScale * uPx * (34.0 / d), uPx, 18.0 * uPx);
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(clamp(1.0 - r, 0.0, 1.0), 1.6) * vAlpha * 1.6;
    vec3 col = mix(vColor, vec3(1.0), smoothstep(0.35, 0.0, r) * 0.55);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const color = (name, fallback) => new THREE.Color(css.getPropertyValue(name).trim() || fallback);
  return {
    accent: color("--accent", "#6c86ff"),
    accent2: color("--accent-2", "#33e1ff"),
    accent3: color("--accent-3", "#b57cff")
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
    scale[i] = 0.6 + Math.pow(Math.random(), 3) * 1.6;
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
      uSize: { value: 2.2 },
      uDrift: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uBox: { value: BOX },
      uA: { value: palette.accent },
      uB: { value: palette.accent2 },
      uC: { value: palette.accent3 }
    }
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false; // las posiciones se calculan en el shader
  return points;
}

export function start({ level = "full", force = false } = {}) {
  const canvas = document.getElementById("scene");
  const root = document.documentElement;
  const lite = level === "lite";
  const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const bgToggle = document.querySelector(".bg-toggle");
  const order = Array.from(document.querySelectorAll(".main-nav a")).map((a) => a.getAttribute("href").slice(1));
  const palette = readPalette();
  const ac = new AbortController();
  const on = (target, type, fn, opts) => target.addEventListener(type, fn, Object.assign({ signal: ac.signal }, opts));

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !lite,
      powerPreference: "high-performance",
      // Sin aceleración por hardware el 3D iría a saltos: mejor no activarlo
      failIfMajorPerformanceCaveat: !force
    });
  } catch (err) {
    return Promise.reject(err);
  }
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  let maxDpr = lite ? 1.5 : 2;
  const world = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
  const particles = makeParticles(lite ? PARTICLES.lite : PARTICLES.full, palette);
  const props = createWorldProps({ palette, lite, order, spacing: SPACING });
  world.add(particles, props.group);

  /* ---------- Estado ---------- */

  let W = 1;
  let H = 1;
  let animated = !reduceMq.matches;               // false con "reducir movimiento": fotogramas estáticos
  let bgPlaying = bgToggle ? bgToggle.dataset.state === "playing" : true;
  let section = currentSection();
  let ambient = animated && bgPlaying ? 1 : 0;    // 0 → 1: movimiento ambiente (sube y baja suave, como el vídeo)
  let simTime = 0;
  let drift = 0;
  let wheelVel = 0;
  let scrollS = 0;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const rig = {
    pos: new THREE.Vector3(), posV: new THREE.Vector3(),
    look: new THREE.Vector3(), lookV: new THREE.Vector3(),
    roll: 0, rollV: 0, fov: 46, fovV: 0,
    target: null
  };
  const scratch = new THREE.Vector3();
  const forward = new THREE.Vector3();

  function currentSection() {
    const page = document.querySelector(".page:not([hidden])");
    return page && POSES[page.id] ? page.id : "about";
  }

  /* ---------- Cámara: pose de cada sección ---------- */

  function computePose(id) {
    const spec = POSES[id] || POSES.about;
    const slot = Math.max(0, order.indexOf(id));
    const aspect = W / H;
    // En pantallas estrechas la cámara se aleja para que el emblema quepa
    const zoom = aspect >= 1.2 ? 1 : 1 + (1.2 - aspect) * 1.3;
    const anchor = new THREE.Vector3(slot * SPACING, 0, -10);
    const pos = anchor.clone().add(new THREE.Vector3(spec.off[0] * zoom, spec.off[1] * zoom, spec.off[2] * zoom));
    const ndc = aspect > 0.9 ? spec.ndcL : spec.ndcP;
    const halfH = pos.distanceTo(anchor) * Math.tan(THREE.MathUtils.degToRad(spec.fov / 2));
    // Se mira un poco al lado para que el emblema quede en el punto de pantalla pedido
    const look = anchor.clone().add(new THREE.Vector3(-ndc[0] * halfH * aspect, -ndc[1] * halfH, 0));
    return { pos, look, roll: spec.roll, fov: spec.fov, k: spec.k, c: spec.c };
  }

  function snapRig() {
    const t = rig.target;
    rig.pos.copy(t.pos);
    rig.look.copy(t.look);
    rig.roll = t.roll;
    rig.fov = t.fov;
    rig.posV.set(0, 0, 0);
    rig.lookV.set(0, 0, 0);
    rig.rollV = rig.fovV = 0;
  }

  // Con la pantalla de carga delante (js/boot-screen.js) la entrada se retiene: la cámara espera
  // lejos y el modelo fuera hasta que la pantalla termina (evento portfolio:boot-done)
  let held = animated && root.dataset.boot === "running";
  const FLIGHT = new THREE.Vector3(-8, -6, 42);   // de dónde llega la cámara en la entrada

  function activePose(id) {
    const pose = computePose(id);
    if (held) {
      pose.pos.add(FLIGHT);
      pose.fov += 14;
    }
    return pose;
  }

  rig.target = activePose(section);
  snapRig();
  if (animated && !held) {
    // Entrada: la cámara llega desde lejos y un poco por debajo
    rig.pos.add(FLIGHT);
    rig.fov += 14;
  }

  function spring1(p, v, t, k, c, dt) {
    v += (k * (t - p) - c * v) * dt;
    return [p + v * dt, v];
  }

  // Devuelve true si la cámara aún se está moviendo
  function stepRig(dt) {
    const t = rig.target;
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      for (const axis of ["x", "y", "z"]) {
        let r = spring1(rig.pos[axis], rig.posV[axis], t.pos[axis], t.k, t.c, h);
        rig.pos[axis] = r[0]; rig.posV[axis] = r[1];
        r = spring1(rig.look[axis], rig.lookV[axis], t.look[axis], t.k * 1.4, t.c * 1.2, h);
        rig.look[axis] = r[0]; rig.lookV[axis] = r[1];
      }
      let r = spring1(rig.roll, rig.rollV, t.roll, t.k, t.c, h);
      rig.roll = r[0]; rig.rollV = r[1];
      r = spring1(rig.fov, rig.fovV, t.fov, t.k, t.c, h);
      rig.fov = r[0]; rig.fovV = r[1];
    }
    const err = rig.pos.distanceTo(t.pos) + rig.look.distanceTo(t.look) + Math.abs(rig.fov - t.fov);
    const speed = rig.posV.length() + rig.lookV.length() + Math.abs(rig.rollV) + Math.abs(rig.fovV);
    return err > 0.01 || speed > 0.01;
  }

  function setSection(id, animate) {
    if (!POSES[id]) return;
    const previous = section;
    section = id;
    rig.target = activePose(id);
    if (!animate || !animated) {
      snapRig();
    } else if (previous !== id) {
      // Ráfaga de partículas: hacia delante si la sección está más a la derecha en el menú
      const span = order.indexOf(id) - order.indexOf(previous);
      wheelVel = THREE.MathUtils.clamp(wheelVel + Math.sign(span) * (8 + Math.abs(span) * 3), -26, 26);
    }
    if (hero) hero.setSection(id, previous, animate && animated);
    wake();
  }

  /* ---------- Cuadro a cuadro ---------- */

  let hero = null; // escenario de "Sobre mí" (se añade en js/hero-stage.js)
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
    cam.updateProjectionMatrix();
    particles.material.uniforms.uPx.value = renderer.getPixelRatio();
    rig.target = activePose(section);
    if (!animated) snapRig();
    if (hero) hero.layout(W, H);
    wake();
  }

  // Devuelve true si algo sigue cambiando (si no, el bucle se duerme hasta el próximo aviso)
  function update(dt) {
    const ambientTarget = animated && bgPlaying ? 1 : 0;
    ambient += (ambientTarget - ambient) * (1 - Math.exp(-dt * 2.5));
    if (Math.abs(ambient - ambientTarget) < 0.004) ambient = ambientTarget;
    simTime += dt * ambient;

    const kp = 1 - Math.exp(-dt * 5);
    const pdx = (animated ? ptr.tx : 0) - ptr.x;
    const pdy = (animated ? ptr.ty : 0) - ptr.y;
    ptr.x += pdx * kp;
    ptr.y += pdy * kp;

    const scrollMax = Math.max(1, root.scrollHeight - window.innerHeight);
    const sdx = (animated ? Math.min(1, Math.max(0, window.scrollY / scrollMax)) : 0) - scrollS;
    scrollS += sdx * kp;

    wheelVel *= Math.exp(-dt * 2.2);
    if (Math.abs(wheelVel) < 0.02) wheelVel = 0;
    drift += (ambient * 0.6 + wheelVel) * dt;

    const moving = animated ? stepRig(dt) : false;

    cam.position.copy(rig.pos);
    cam.position.x += ptr.x * 1.6 + Math.sin(simTime * 0.13) * 0.7 * ambient;
    cam.position.y += ptr.y * 1 + Math.cos(simTime * 0.11) * 0.5 * ambient;
    cam.position.z -= scrollS * 8;
    scratch.copy(rig.look);
    scratch.x += ptr.x * 1.1;
    scratch.y += ptr.y * 0.7;
    cam.up.set(0, 1, 0);
    cam.lookAt(scratch);
    cam.rotateZ(rig.roll + scrollS * 0.06);
    if (Math.abs(cam.fov - rig.fov) > 0.005) {
      cam.fov = rig.fov;
      cam.updateProjectionMatrix();
    }

    const u = particles.material.uniforms;
    u.uTime.value = simTime;
    u.uDrift.value = drift;
    cam.getWorldDirection(forward);
    u.uCenter.value.copy(cam.position).addScaledVector(forward, BOX.z * 0.3);
    props.update(simTime, cam.position.x);

    const heroActive = hero ? hero.update(dt, simTime, ambient, animated) : false;

    return ambient > 0 || moving || heroActive || wheelVel !== 0 ||
      Math.abs(pdx) + Math.abs(pdy) > 0.0005 || Math.abs(sdx) > 0.0005;
  }

  function render() {
    renderer.clear();
    renderer.render(world, cam);
    if (hero && hero.visible) {
      renderer.clearDepth();
      renderer.render(hero.scene, hero.camera);
    }
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

  /* ---------- Rendimiento adaptable ---------- */

  // Si la media baja de ~29 fps: primero se baja la resolución, luego las partículas y,
  // si aun así va a menos de 20 fps, se apaga el 3D (la página sigue igual sin él).
  const perf = { avg: 1 / 60, samples: 0, quality: 0 };

  function watchPerformance(raw) {
    if (!animated || ambient < 0.99 || document.hidden || raw > 0.25) return;
    perf.avg += (raw - perf.avg) * 0.05;
    if (++perf.samples < 150 || perf.samples % 60) return;
    if (perf.quality === 0 && perf.avg > 0.034) {
      perf.quality = 1;
      maxDpr = 1;
      resize();
    } else if (perf.quality === 1 && perf.avg > 0.034) {
      perf.quality = 2;
      particles.geometry.setDrawRange(0, Math.floor(particles.geometry.getAttribute("position").count / 2));
    } else if (perf.quality === 2 && perf.avg > 0.05) {
      dispose();
      return;
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
    wheelVel = THREE.MathUtils.clamp(wheelVel + THREE.MathUtils.clamp(e.deltaY, -120, 120) * 0.05, -26, 26);
    wake();
  }, { passive: true });

  on(document, "portfolio:section", (e) => setSection(e.detail.id, e.detail.animate));
  on(document, "portfolio:bg", (e) => { bgPlaying = e.detail.playing; wake(); });
  on(document, "portfolio:lang", () => { if (hero) hero.refreshLabels(); wake(); });
  // Termina la pantalla de carga: la cámara vuela hasta su sitio, con una ráfaga de partículas,
  // y el modelo entra girando
  on(document, "portfolio:boot-done", () => {
    if (!held) return;
    held = false;
    rig.target = computePose(section);
    wheelVel = THREE.MathUtils.clamp(wheelVel + 20, -26, 26);
    if (hero) hero.setHold(false);
    wake();
  });
  on(document, "visibilitychange", () => wake());
  on(canvas, "webglcontextlost", (e) => { e.preventDefault(); dispose(); });

  const onMotionChange = () => {
    animated = !reduceMq.matches;
    if (!animated) snapRig();
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
    if (hero) hero.dispose();
    world.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
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
      hero: hero ? hero.state() : null,
      target: { pos: rig.target.pos.toArray(), look: rig.target.look.toArray(), fov: rig.target.fov },
      anchorNdc: new THREE.Vector3(order.indexOf(section) * SPACING, 0, -10).project(cam).toArray().slice(0, 2).map((n) => +n.toFixed(2))
    }),
    // Avanza la simulación de golpe (para pruebas y capturas con la pestaña en segundo plano)
    step: (seconds = 1) => {
      for (let t = 0; t < seconds; t += 1 / 60) update(1 / 60);
      render();
    },
    nodeScreen: (i) => hero && hero.nodeScreen(i),
    partScreen: (id) => hero && hero.partScreen(id),
    pose: (yaw, pitch) => hero && hero.debugPose(yaw, pitch),
    dispose
  };

  const stageEl = document.getElementById("stage");
  if (stageEl) {
    hero = createHeroStage({ renderer, palette, lite, stage: stageEl, wake });
    hero.setSection(section, section, false);
    if (held) hero.setHold(true);
  }

  resize();
  update(1 / 60);
  render();
  ready = true;
  wake();
  return Promise.resolve({ level: lite ? "lite" : "full", dispose });
}
