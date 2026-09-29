/*
 * Plantas de las maquetas. Todas son redondeadas y de bajo poligonaje, y cada una es de una
 * especie distinta para que no se repitan dentro de una sala:
 *   · monstera   hojas grandes en forma de corazón con agujeros ("planta del queso suizo")
 *   · fiddle     ficus lira: tronco y hojas ovaladas grandes
 *   · bush       arbusto redondo (topiario) de copa esférica
 *   · succulent  suculenta en roseta
 *   · barrel     cactus redondo con flor
 *   · pothos     potos colgante que cae por la maceta
 * El origen está en la base de la maceta. Todas aceptan size (escala), pot (color de la maceta).
 */
import * as THREE from "three";
import { rng } from "./journey-kit.js";

export function createPlants(kit) {
  const { C, grp, cyl, ball, bar, mat, mesh, lathe, torus } = kit;
  const G = {};

  const GREENS = { deep: 0x2f9a63, mid: 0x49b877, light: 0x7ad392, lime: 0x9adf7f };
  const ico1 = new THREE.IcosahedronGeometry(1, 1);
  const ico2 = new THREE.IcosahedronGeometry(1, 2);

  // Maceta cónica con borde y tierra. Devuelve la altura de la tierra.
  function pot(g, s, color, shape = "cone") {
    const rb = (shape === "round" ? 0.62 : 0.5) * s;
    const rt = (shape === "round" ? 0.66 : 0.72) * s;
    const h = (shape === "tall" ? 1.5 : 1.05) * s;
    const prof = shape === "round"
      ? [[0.001, 0], [rb * 0.8, 0], [rb * 1.05, h * 0.2], [rt * 1.12, h * 0.55], [rt * 1.05, h * 0.9], [rt * 1.12, h * 0.9], [rt * 1.12, h], [rt * 1.0, h], [rt * 0.94, h * 0.92], [0.001, h * 0.92]]
      : [[0.001, 0], [rb, 0], [rt, h * 0.9], [rt * 1.08, h * 0.9], [rt * 1.08, h], [rt * 0.96, h], [rt * 0.9, h * 0.92], [0.001, h * 0.92]];
    lathe(prof, color, 0, 0, 0, g, 28);
    cyl(rt * 0.92, rt * 0.92, 0.05 * s, 0x5a3f2c, 0, h * 0.9, 0, g, 24).castShadow = false;
    return h * 0.92;
  }

  const leafMat = (color, extra = {}) => mat(color, Object.assign({ flat: true, rough: 0.6 }, extra));

  /* ---------- Arbusto redondo ---------- */
  G.bush = ({ size = 1, pot: potColor = C.white, leaf = GREENS.mid } = {}) => {
    const g = grp();
    const s = size;
    const top = pot(g, s, potColor, "round");
    bar([0, top, 0], [0, top + 1.5 * s, 0], 0.07 * s, C.woodDark, g, 8);
    const r = rng(5 + Math.round(s * 10));
    const blobs = [[0, 2.85, 0, 1.0]];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + r() * 0.4;
      blobs.push([Math.cos(a) * 0.78, 2.5 + r() * 0.75, Math.sin(a) * 0.78, 0.5 + r() * 0.28]);
    }
    blobs.push([0.1, 3.5, -0.1, 0.55]);
    blobs.forEach(([x, y, z, rad], i) => {
      const m = mesh(ico1, leafMat([GREENS.mid, GREENS.light, GREENS.deep, GREENS.lime][i % 4]), x * s, top + (y - 1.2) * s, z * s, g);
      m.scale.setScalar(rad * s);
      m.rotation.set(r() * 6, r() * 6, 0);
    });
    // Florecitas
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2;
      ball(0.1 * s, [C.pink, C.yellow, C.white][i % 3], Math.cos(a) * 1.05 * s, top + (2.3 + r() * 1.1) * s, Math.sin(a) * 1.05 * s, g);
    }
    return g;
  };

  /* ---------- Ficus lira ---------- */
  G.fiddle = ({ size = 1, pot: potColor = C.white, leaf = GREENS.mid, count = 15 } = {}) => {
    const g = grp();
    const s = size;
    const top = pot(g, s, potColor, "tall");
    const r = rng(9);
    const H = 3.1 * s;
    bar([0, top, 0], [0.08 * s, top + H * 0.5, 0.05 * s], 0.09 * s, C.woodDark, g, 8, 0.07 * s);
    bar([0.08 * s, top + H * 0.5, 0.05 * s], [0, top + H, 0], 0.07 * s, C.woodDark, g, 8, 0.05 * s);
    for (let i = 0; i < count; i++) {
      const k = i / (count - 1);
      const y = top + H * (0.42 + k * 0.6);
      const a = i * 2.4 + r() * 0.3;
      const pivot = grp(0, y, 0, g);
      pivot.rotation.set(0, a, 0);
      const arm = grp(0, 0, 0, pivot);
      arm.rotation.x = -(0.15 + (1 - k) * 0.5);      // más caídas abajo, más erguidas arriba
      const m = mesh(ico2, leafMat(i % 3 === 0 ? GREENS.light : leaf), 0, 0, 0.8 * s * (1.2 - k * 0.3), arm);
      m.scale.set(0.68 * s, 0.08 * s, (1.2 - k * 0.25) * s);
      bar([0, 0, 0], [0, 0, 0.5 * s], 0.025 * s, GREENS.deep, arm, 6);
    }
    return g;
  };

  /* ---------- Monstera ---------- */
  function monsteraLeafGeo() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-0.18, 0.18, -0.78, 0.12, -0.82, 0.68);
    shape.bezierCurveTo(-0.86, 1.2, -0.36, 1.6, 0, 1.78);
    shape.bezierCurveTo(0.36, 1.6, 0.86, 1.2, 0.82, 0.68);
    shape.bezierCurveTo(0.78, 0.12, 0.18, 0.18, 0, 0);
    [[-0.42, 0.55, 0.13, 0.05, 0.4], [-0.42, 0.98, 0.14, 0.05, 0.3], [-0.3, 1.35, 0.1, 0.04, 0.2]].forEach(([x, y, rx, ry, rot]) => {
      [-1, 1].forEach((sd) => {
        const h = new THREE.Path();
        h.absellipse(sd * -x, y, rx, ry, 0, Math.PI * 2, false, sd * rot);
        shape.holes.push(h);
      });
    });
    // Rajas del borde
    [[-0.78, 0.7], [-0.7, 1.05], [0.78, 0.7], [0.7, 1.05]].forEach(([x, y]) => {
      const h = new THREE.Path();
      h.absellipse(x, y, 0.09, 0.04, 0, Math.PI * 2, false, x < 0 ? 0.2 : -0.2);
      shape.holes.push(h);
    });
    return new THREE.ShapeGeometry(shape, 8);
  }
  let monsteraGeo = null;

  G.monstera = ({ size = 1, pot: potColor = C.white, count = 9 } = {}) => {
    const g = grp();
    const s = size;
    if (!monsteraGeo) monsteraGeo = monsteraLeafGeo();
    const top = pot(g, s, potColor, "round");
    const r = rng(17);
    const dark = mat(GREENS.deep, { side: THREE.DoubleSide, rough: 0.55 });
    const mid = mat(GREENS.mid, { side: THREE.DoubleSide, rough: 0.55 });
    for (let i = 0; i < count; i++) {
      const a = i * 2.4 + 0.4;
      const h = (1.25 + (i % 4) * 0.5 + r() * 0.25) * s;
      const out = (0.4 + (i % 3) * 0.3) * s;
      const bx = Math.cos(a) * out;
      const bz = Math.sin(a) * out;
      bar([0, top, 0], [bx * 0.4, top + h * 0.6, bz * 0.4], 0.05 * s, GREENS.deep, g, 6);
      bar([bx * 0.4, top + h * 0.6, bz * 0.4], [bx, top + h, bz], 0.045 * s, GREENS.deep, g, 6);
      // La hoja está dibujada en el plano XY con la punta en +Y: se inclina hacia fuera y hacia arriba
      const pivot = grp(bx, top + h, bz, g);
      pivot.rotation.set(0, -a + Math.PI / 2, 0);
      const arm = grp(0, 0, 0, pivot);
      arm.rotation.x = 0.85 + (i % 3) * 0.14;
      const leaf = mesh(monsteraGeo, i % 2 ? mid : dark, 0, 0, 0, arm);
      leaf.scale.setScalar(1.08 * s);
      bar([0, 0.02, 0], [0, 1.55 * s, 0.02], 0.022 * s, 0x9adf7f, arm, 5);          // nervio central
    }
    return g;
  };

  /* ---------- Suculenta ---------- */
  G.succulent = ({ size = 1, pot: potColor = C.pink } = {}) => {
    const g = grp();
    const s = size * 0.7;
    const top = pot(g, s, potColor, "round");
    const rings = [[6, 0.42, 0.2, 0.62, GREENS.light], [8, 0.66, 0.38, 0.6, GREENS.mid], [10, 0.86, 0.6, 0.55, 0x6cc7a0]];
    rings.forEach(([n, rad, lift, len, color], ri) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ri * 0.35;
        const pivot = grp(0, top + 0.05 * s, 0, g);
        pivot.rotation.y = a;
        const arm = grp(0, 0, 0, pivot);
        arm.rotation.x = -(0.45 + lift);
        const m = mesh(ico1, leafMat(color), 0, 0, (rad * 0.5 + 0.1) * s, arm);
        m.scale.set(0.24 * s, 0.09 * s, len * s * 0.8);
      }
    });
    ball(0.16 * s, C.pink, 0, top + 0.28 * s, 0, g);
    return g;
  };

  /* ---------- Cactus redondo ---------- */
  G.barrel = ({ size = 1, pot: potColor = C.white } = {}) => {
    const g = grp();
    const s = size * 0.75;
    const top = pot(g, s, potColor, "round");
    const body = mesh(new THREE.SphereGeometry(1, 14, 9), leafMat(0x4bbf86), 0, top + 0.85 * s, 0, g);
    body.scale.set(0.9 * s, 0.85 * s, 0.9 * s);
    // Espinitas en las aristas
    const r = rng(23);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const b = 0.15 + r() * 1.1;
      const px = Math.cos(a) * Math.sin(b) * 0.9 * s;
      const py = Math.cos(b) * 0.85 * s;
      const pz = Math.sin(a) * Math.sin(b) * 0.9 * s;
      ball(0.035 * s, C.cream, px * 1.01, top + 0.85 * s + py, pz * 1.01, g).castShadow = false;
    }
    // Flor
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = mesh(ico1, leafMat(C.pink), Math.cos(a) * 0.2 * s, top + 1.7 * s, Math.sin(a) * 0.2 * s, g);
      petal.scale.set(0.09 * s, 0.22 * s, 0.09 * s);
      petal.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    }
    ball(0.09 * s, C.yellow, 0, top + 1.7 * s, 0, g);
    return g;
  };

  /* ---------- Potos colgante ---------- */
  G.pothos = ({ size = 1, pot: potColor = C.white } = {}) => {
    const g = grp();
    const s = size;
    const top = pot(g, s, potColor, "round");
    const r = rng(31);
    // Mata de hojas sobre la maceta
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const m = mesh(ico1, leafMat(i % 2 ? GREENS.mid : GREENS.light), Math.cos(a) * 0.32 * s, top + 0.28 * s, Math.sin(a) * 0.32 * s, g);
      m.scale.set(0.34 * s, 0.14 * s, 0.34 * s);
    }
    // Zarcillos que caen por fuera
    for (let v = 0; v < 6; v++) {
      const a = (v / 6) * Math.PI * 2 + r() * 0.4;
      const len = 2.2 + r() * 1.7;
      const n = 8;
      let prev = [Math.cos(a) * 0.45 * s, top + 0.1 * s, Math.sin(a) * 0.45 * s];
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const rad = (0.75 + 0.22 * Math.sin(t * 2)) * s;
        const p = [Math.cos(a + Math.sin(t * 3 + v) * 0.12) * rad, top + 0.05 * s - t * len * s * 0.62, Math.sin(a + Math.sin(t * 3 + v) * 0.12) * rad];
        bar(prev, p, 0.018 * s, GREENS.deep, g, 5);
        const leaf = mesh(ico1, leafMat(i % 2 ? GREENS.mid : GREENS.light), p[0] * 1.06, p[1], p[2] * 1.06, g);
        leaf.scale.set(0.2 * s, 0.05 * s, 0.26 * s);
        leaf.rotation.y = -a;
        leaf.rotation.x = 0.4;
        prev = p;
      }
    }
    return g;
  };

  /* ---------- Cactus alto con brazos (redondeado) ---------- */
  G.cactus = ({ size = 1, pot: potColor = C.white } = {}) => {
    const g = grp();
    const s = size;
    const top = pot(g, s, potColor, "round");
    const green = leafMat(0x4bbf86);
    const stem = (h, rad, x, y, z, tilt = 0) => {
      const grpS = grp(x, y, z, g);
      grpS.rotation.z = tilt;
      const cyl1 = cyl(rad, rad, h, green, 0, h / 2, 0, grpS, 12);
      ball(rad, green, 0, h, 0, grpS);
      return grpS;
    };
    stem(2.2 * s, 0.42 * s, 0, top, 0);
    // Brazos: salen de lado y suben
    const arm = (side, y, h) => {
      bar([side * 0.35 * s, y, 0], [side * 0.9 * s, y, 0], 0.22 * s, 0x4bbf86, g, 10);
      ball(0.22 * s, green, side * 0.35 * s, y, 0, g);
      stem(h * s, 0.22 * s, side * 0.9 * s, y, 0);
    };
    arm(1, top + 0.95 * s, 0.85);
    arm(-1, top + 1.35 * s, 0.6);
    ball(0.11 * s, C.pink, 0, top + 2.75 * s, 0, g);
    return g;
  };

  return G;
}
