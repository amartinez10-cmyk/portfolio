/*
 * Modelo 3D principal de "Sobre mí": una torre de PC gaming construida con geometrías de
 * Three.js (sin assets, sin copyright): cristal templado, GPU en vertical, refrigeración
 * líquida, RAM, cableado y ventiladores RGB que giran.
 *
 * ── Para usar tu propio modelo ──────────────────────────────────────────────────────
 *   1. Copia tu archivo .glb (mejor si es .glb comprimido con Draco) a la carpeta /models.
 *   2. Pon aquí su ruta:   export const MODEL_URL = "models/mi-modelo.glb";
 *   Se centra y se escala solo. Con MODEL_URL = null se usa la torre procedural.
 * ────────────────────────────────────────────────────────────────────────────────────
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const MODEL_URL = null;

const DRACO_DECODER = "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/";

// Medidas de la torre (unidades de escena): D fondo (eje X, el frontal mira a +X),
// H alto (Y) y W ancho (Z, el cristal mira a +Z).
const D = 2.7;
const H = 3;
const W = 1.3;

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Placa base: pistas y chips dibujados en un canvas
function traceTexture(color) {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const rand = rng(7);
  g.fillStyle = "#080b16";
  g.fillRect(0, 0, size, size);
  g.strokeStyle = color;
  g.fillStyle = color;
  for (let i = 0; i < 70; i++) {
    let x = Math.floor(rand() * 32) * 16;
    let y = Math.floor(rand() * 32) * 16;
    g.globalAlpha = 0.25 + rand() * 0.45;
    g.lineWidth = 1 + Math.floor(rand() * 2);
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      if (rand() > 0.5) x += (Math.floor(rand() * 6) - 3) * 16;
      else y += (Math.floor(rand() * 6) - 3) * 16;
      g.lineTo(x, y);
    }
    g.stroke();
    g.fillRect(x - 3, y - 3, 6, 6);
  }
  g.globalAlpha = 0.5;
  g.lineWidth = 2;
  [[300, 100, 90, 90], [70, 300, 130, 40], [330, 330, 100, 130]].forEach(([x, y, w, h]) => g.strokeRect(x, y, w, h));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createHeroModel({ palette, lite }) {
  const group = new THREE.Group();
  const fans = [];      // { blades, speed }
  const rgb = [];       // { mat, phase }
  const disposables = [];

  const steel = new THREE.MeshStandardMaterial({ color: 0x0c0f1c, metalness: 0.85, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x05070f, metalness: 0.6, roughness: 0.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x07080d, metalness: 0.1, roughness: 0.8 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x9db4ff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.1,
    depthWrite: false, clearcoat: 1, envMapIntensity: 1.8
  });
  const edgeLine = new THREE.LineBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.85, toneMapped: false });
  disposables.push(steel, dark, rubber, glass, edgeLine);

  function glowMat(phase) {
    const mat = new THREE.MeshBasicMaterial({ color: palette.accent, toneMapped: false });
    rgb.push({ mat, phase });
    disposables.push(mat);
    return mat;
  }

  function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }

  // Ventilador que mira a +Z: aro RGB, aro interior y 7 aspas que giran
  function makeFan(radius, phase, speed) {
    const fan = new THREE.Group();
    const mat = glowMat(phase);
    fan.add(new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.045, 8, lite ? 32 : 64), mat));
    fan.add(new THREE.Mesh(new THREE.TorusGeometry(radius * 0.3, radius * 0.02, 6, lite ? 20 : 32), mat));

    const blade = new THREE.PlaneGeometry(radius * 0.42, radius * 0.72);
    blade.translate(0, radius * 0.52, 0);
    const parts = [];
    for (let i = 0; i < 7; i++) {
      const g = blade.clone();
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(0.5));      // paso de la aspa
      g.applyMatrix4(new THREE.Matrix4().makeRotationZ((i / 7) * Math.PI * 2));
      parts.push(g);
    }
    const blades = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x101426, metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide, transparent: true, opacity: 0.92
    });
    blades.add(new THREE.Mesh(mergeGeometries(parts), bladeMat));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, 0.05, 24), steel);
    hub.rotation.x = Math.PI / 2;
    blades.add(hub);
    fan.add(blades);
    fans.push({ blades, speed });
    disposables.push(blade, bladeMat, ...parts);
    return fan;
  }

  function buildShell() {
    // Carcasa: chapas por los cuatro lados y aristas con luz neón
    box(D, 0.05, W, steel, 0, H / 2, 0);                  // techo
    box(D, 0.05, W, steel, 0, -H / 2, 0);                 // base
    box(D, H, 0.04, steel, 0, 0, -W / 2 + 0.02);          // bandeja de la placa (lado lejano)
    box(0.05, H, W, steel, D / 2, 0, 0);                  // frontal
    box(0.05, H, W, steel, -D / 2, 0, 0);                 // trasera
    box(D - 0.08, H - 0.08, 0.02, glass, 0, 0, W / 2);    // cristal templado (lado visible)
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(D, H, W)), edgeLine));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      box(0.18, 0.08, 0.18, dark, sx * (D / 2 - 0.25), -H / 2 - 0.06, sz * (W / 2 - 0.2));  // patas
    });

    // Charco de luz bajo la torre
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 5.4),
      new THREE.MeshBasicMaterial({
        map: glowTexture(), color: palette.accent, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -H / 2 - 0.1;
    group.add(glow);
    disposables.push(glow.material.map, glow.material);
  }

  function buildBoard() {
    // Placa base con pistas
    const trace = traceTexture(`#${palette.accent.getHexString()}`);
    const boardMat = new THREE.MeshStandardMaterial({
      map: trace, emissiveMap: trace, emissive: palette.accent, emissiveIntensity: 0.55, roughness: 0.6, metalness: 0.3
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 2.3), boardMat);
    board.position.set(-0.05, 0.3, -W / 2 + 0.05);
    group.add(board);
    disposables.push(trace, boardMat);

    // Bomba de la refrigeración líquida + tubos hasta el radiador del techo
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.16, 40), steel);
    pump.rotation.x = Math.PI / 2;
    pump.position.set(0.1, 0.72, -0.42);
    group.add(pump);
    const pumpRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 48), glowMat(1.3));
    pumpRing.position.set(0.1, 0.72, -0.33);
    group.add(pumpRing);
    box(1.7, 0.16, 0.5, dark, -0.15, H / 2 - 0.16, -0.2);
    [-0.06, 0.24].forEach((dx) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.1 + dx, 0.85, -0.42), new THREE.Vector3(0.1 + dx, 1.15, -0.4),
        new THREE.Vector3(-0.1 + dx * 2, 1.3, -0.3), new THREE.Vector3(-0.3 + dx * 2, H / 2 - 0.24, -0.25)
      ]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.035, 8), rubber));
    });

    // Memoria RAM
    [0.58, 0.7].forEach((x, i) => {
      box(0.05, 0.62, 0.2, dark, x, 0.72, -0.47);
      box(0.052, 0.5, 0.03, glowMat(2 + i), x, 0.72, -0.36);
    });
  }

  function buildGpuAndFans() {
    // Gráfica en vertical (los ventiladores miran al cristal) y fuente de alimentación
    box(1.9, 0.66, 0.2, steel, 0, -0.46, 0.22);
    box(1.9, 0.02, 0.22, glowMat(0.4), 0, -0.13, 0.22);
    [-0.62, 0, 0.62].forEach((x, i) => {
      const fan = makeFan(0.26, i * 0.8, 9);
      fan.position.set(x, -0.46, 0.33);
      group.add(fan);
    });
    box(D - 0.1, 0.5, W - 0.1, dark, 0, -H / 2 + 0.3, 0);
    for (let i = 0; i < 6; i++) box(D - 0.5, 0.008, 0.01, glowMat(i), 0, -H / 2 + 0.45 - i * 0.06, W / 2 - 0.04);

    // Cables con funda desde la fuente hasta la placa
    [[-0.9, 0], [-0.75, 0.05], [-0.6, 0.1]].forEach(([x, z], i) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, -H / 2 + 0.55, -0.3), new THREE.Vector3(x - 0.15, -0.9, -0.5 + z),
        new THREE.Vector3(x - 0.1, 0.1, -0.55), new THREE.Vector3(x + 0.1 + i * 0.05, 0.9, -0.55)
      ]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.02, 6), rubber));
    });

    // Ventiladores del frontal (mirando a +X) y de la trasera
    [0.95, 0, -0.95].forEach((y, i) => {
      const fan = makeFan(0.4, i * 0.9, 6);
      fan.rotation.y = Math.PI / 2;
      fan.position.set(D / 2 + 0.04, y, 0);
      group.add(fan);
    });
    const rear = makeFan(0.32, 2.4, 7);
    rear.rotation.y = -Math.PI / 2;
    rear.position.set(-D / 2 - 0.04, 0.6, 0);
    group.add(rear);
  }

  // Cambio de colores RGB: accent → accent2 → accent3 → accent
  const ring = [palette.accent, palette.accent2, palette.accent3];
  function cycle(target, x) {
    const p = ((x % 3) + 3) % 3;
    const i = Math.floor(p);
    target.copy(ring[i]).lerp(ring[(i + 1) % 3], p - i);
  }

  // .glb propio (Draco opcional). Se centra y se escala a la altura de la torre.
  async function loadGlb(url) {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const { DRACOLoader } = await import("three/addons/loaders/DRACOLoader.js");
    const draco = new DRACOLoader().setDecoderPath(DRACO_DECODER);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const gltf = await loader.loadAsync(url);
    draco.dispose();
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    model.position.sub(bounds.getCenter(new THREE.Vector3()));
    const holder = new THREE.Group();
    holder.add(model);
    holder.scale.setScalar(H / Math.max(size.y, 0.0001));
    return holder;
  }

  const ready = (async () => {
    if (MODEL_URL) {
      try {
        group.add(await loadGlb(MODEL_URL));
        return;
      } catch (err) {
        console.warn("[3D] No se pudo cargar", MODEL_URL, "→ se usa la torre procedural", err);
      }
    }
    buildShell();
    buildBoard();
    buildGpuAndFans();
  })();

  return {
    group,
    ready,
    update(t) {
      fans.forEach((f) => { f.blades.rotation.z = t * f.speed; });
      rgb.forEach((r) => cycle(r.mat.color, t * 0.35 + r.phase));
      edgeLine.color.copy(palette.accent).lerp(palette.accent2, 0.5 + 0.5 * Math.sin(t * 0.5));
    },
    dispose() {
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      disposables.forEach((d) => d.dispose && d.dispose());
    }
  };
}
