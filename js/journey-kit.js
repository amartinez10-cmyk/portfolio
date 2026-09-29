/*
 * Kit para construir las maquetas 3D: piezas básicas con bordes redondeados, materiales mate
 * de colores pastel y texturas dibujadas por código. Es el mismo lenguaje visual que las
 * salas isométricas de threejs-journey.com: bloques suaves, colores planos y sombras.
 *
 * Todo lo que se crea aquí proyecta y recibe sombra. Las geometrías y los materiales se
 * reutilizan entre piezas (caché) y se liberan juntos con dispose().
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Paleta de las maquetas
export const C = {
  white: 0xf6f3ff, cream: 0xffe9cc, paper: 0xfffaf0,
  lilac: 0xb8a4f4, violet: 0x8b6cff, purple: 0x6c55c9, plum: 0x4a3a99, navy: 0x2a2361, ink: 0x1b1642,
  yellow: 0xffbf2f, gold: 0xf6b81c, orange: 0xff8a3d, coral: 0xff6f61, red: 0xef4f6b, pink: 0xff8db4,
  blue: 0x4f9dff, sky: 0x8fd2ff, teal: 0x2fd0b5, mint: 0x7fdccb, green: 0x5fd08a, leaf: 0x3fbf78,
  wood: 0xe2a56b, woodDark: 0xb87a44, grey: 0xb7b2d4, steel: 0xcfcbe6, cork: 0xd9a066
};

export function createKit({ lite = false } = {}) {
  const geos = new Map();
  const mats = new Map();
  const owned = [];               // texturas propias
  const seg = lite ? 10 : 22;     // caras de los cilindros y las esferas
  const bevel = lite ? 2 : 3;

  const geo = (key, make) => {
    let g = geos.get(key);
    if (!g) { g = make(); geos.set(key, g); }
    return g;
  };

  /* ---------- Materiales ---------- */

  function mat(color, o = {}) {
    const key = [color, o.rough, o.metal, o.emissive, o.opacity, o.flat, o.side, o.map && o.map.uuid].join("|");
    let m = mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color,
        roughness: o.rough === undefined ? 0.74 : o.rough,
        metalness: o.metal || 0,
        flatShading: !!o.flat,
        emissive: o.emissive === undefined ? 0x000000 : o.emissive,
        emissiveIntensity: o.emissiveIntensity === undefined ? 1 : o.emissiveIntensity,
        transparent: o.opacity !== undefined && o.opacity < 1,
        opacity: o.opacity === undefined ? 1 : o.opacity,
        side: o.side === undefined ? THREE.FrontSide : o.side,
        map: o.map || null
      });
      mats.set(key, m);
    }
    return m;
  }

  // Material que brilla por sí mismo (pantallas, luces): no le afecta la iluminación
  function glow(color, opacity = 1) {
    const key = "glow|" + color + "|" + opacity;
    let m = mats.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity });
      mats.set(key, m);
    }
    return m;
  }

  const asMat = (c, o) => (c && c.isMaterial ? c : mat(c, o));

  /* ---------- Piezas ---------- */

  function put(mesh, x, y, z, parent, shadow = true) {
    mesh.position.set(x || 0, y || 0, z || 0);
    if (shadow) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    if (parent) parent.add(mesh);
    return mesh;
  }

  const box = (w, h, d, c, x, y, z, p) =>
    put(new THREE.Mesh(geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), asMat(c)), x, y, z, p);

  function rbox(w, h, d, c, x, y, z, p, r = 0.12) {
    r = Math.max(0.005, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    return put(new THREE.Mesh(geo(`r${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, bevel, r)), asMat(c)), x, y, z, p);
  }

  const cyl = (rt, rb, h, c, x, y, z, p, s = seg) =>
    put(new THREE.Mesh(geo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)), asMat(c)), x, y, z, p);

  const cone = (r, h, c, x, y, z, p, s = seg) =>
    put(new THREE.Mesh(geo(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)), asMat(c)), x, y, z, p);

  const ball = (r, c, x, y, z, p) =>
    put(new THREE.Mesh(geo(`s${r}`, () => new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.75))), asMat(c)), x, y, z, p);

  // Aro (toro). Sin giro queda de pie, como una rueda mirando a +Z; con flat=true queda tumbado.
  function torus(R, r, c, x, y, z, p, flat = false) {
    const m = put(new THREE.Mesh(geo(`t${R},${r}`, () => new THREE.TorusGeometry(R, r, 10, seg * 2)), asMat(c)), x, y, z, p);
    if (flat) m.rotation.x = Math.PI / 2;
    return m;
  }

  const plane = (w, h, c, x, y, z, p, shadow = false) =>
    put(new THREE.Mesh(geo(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h)), asMat(c)), x, y, z, p, shadow);

  function grp(x, y, z, parent, ry) {
    const g = new THREE.Group();
    g.position.set(x || 0, y || 0, z || 0);
    g.rotation.y = ry || 0;
    if (parent) parent.add(g);
    return g;
  }

  // Barra (cilindro) entre dos puntos: brazos de lámpara, patas de trípode, ramitas…
  // r2 = radio en el extremo B (por defecto, igual que en A)
  const UP = new THREE.Vector3(0, 1, 0);
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  function bar(a, b, r, c, parent, s = 10, r2 = r) {
    tmpA.set(a[0], a[1], a[2]);
    tmpB.set(b[0], b[1], b[2]);
    const len = tmpA.distanceTo(tmpB);
    const m = put(
      new THREE.Mesh(geo(`bar${r},${r2},${len.toFixed(3)},${s}`, () => new THREE.CylinderGeometry(r2, r, len, s)), asMat(c)),
      (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, parent
    );
    m.quaternion.setFromUnitVectors(UP, tmpB.sub(tmpA).normalize());
    return m;
  }

  // Pieza de revolución a partir de un perfil [[radio, altura], …] (vasos, macetas, tazas…)
  function lathe(profile, c, x, y, z, parent, s = seg, side) {
    const pts = profile.map((p) => new THREE.Vector2(p[0], p[1]));
    const material = side !== undefined ? mat(c, { side }) : asMat(c);
    return put(new THREE.Mesh(new THREE.LatheGeometry(pts, s), material), x, y, z, parent);
  }

  // Suelo de la habitación, las piezas que cuelgan de la pared… cualquier malla propia
  function mesh(geometry, material, x, y, z, parent, shadow = true) {
    return put(new THREE.Mesh(geometry, asMat(material)), x, y, z, parent, shadow);
  }

  /* ---------- Texturas dibujadas por código ---------- */

  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    owned.push(t);
    return t;
  }

  // Vuelve a dibujar una textura de canvas (por ejemplo, al cambiar de idioma)
  function redraw(tex, draw) {
    const c = tex.image;
    draw(c.getContext("2d"), c.width, c.height);
    tex.needsUpdate = true;
  }

  // Plano con una textura con transparencia (texto, dibujos): no le afecta la luz
  function decal(tex, w, h, x, y, z, parent, opts = {}) {
    const m = new THREE.Mesh(
      geo(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h)),
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, toneMapped: false, depthWrite: false,
        opacity: opts.opacity === undefined ? 1 : opts.opacity, side: opts.side || THREE.FrontSide
      })
    );
    owned.push(m.material);
    m.position.set(x || 0, y || 0, z || 0);
    m.renderOrder = 2;
    if (parent) parent.add(m);
    return m;
  }

  // Pantalla encendida con una textura
  function screen(tex, w, h, x, y, z, parent) {
    const m = new THREE.Mesh(geo(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h)), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    owned.push(m.material);
    m.position.set(x || 0, y || 0, z || 0);
    if (parent) parent.add(m);
    return m;
  }

  // Borra un canvas con esquinas redondeadas (compatibilidad con navegadores sin roundRect)
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // Resplandor suave (una luz encendida): sprite aditivo, no le afecta la iluminación
  let haloTex = null;
  function halo(color, size, x, y, z, parent, opacity = 0.6) {
    if (!haloTex) {
      haloTex = canvasTex(128, 128, (g, w, h) => {
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(0.3, "rgba(255,255,255,0.4)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      });
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    owned.push(s.material);
    s.scale.setScalar(size);
    s.position.set(x || 0, y || 0, z || 0);
    if (parent) parent.add(s);
    return s;
  }

  function dispose() {
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    owned.forEach((t) => t.dispose());
    geos.clear();
    mats.clear();
    owned.length = 0;
  }

  return {
    C, lite, seg, mat, glow, asMat, box, rbox, cyl, cone, ball, torus, plane, grp, mesh, bar, lathe,
    canvasTex, redraw, decal, screen, roundRect, halo, dispose
  };
}

// Generador pseudoaleatorio con semilla: la disposición es siempre la misma
export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
