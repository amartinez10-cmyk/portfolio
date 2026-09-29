/*
 * Carcasa del PC: una torre blanca "panorámica" con cristal en el frente y en el lateral (se unen en
 * la esquina sin poste), techo de cristal, bandeja de la placa al fondo, rejilla de ventilación
 * en forma de panal, patas angulares y una plataforma con un aro amarillo.
 *
 * Medidas (1 unidad ≈ 15 cm): D fondo (eje X, el frontal mira a +X), H alto (Y) y W ancho
 * (Z, el cristal lateral mira a +Z).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const DIM = { D: 3.7, H: 3.5, W: 1.75 };

// Distancia del centro de la torre al suelo de su plataforma (la plataforma queda 0,22 bajo la base y
// mide 0,16 de alto); levels.js la usa para apoyar el PC en el suelo de la sala
export const BASE_DROP = DIM.H / 2 + 0.22 + 0.02 + 0.08;

export function buildCase(kit) {
  const { D, H, W } = DIM;
  const { mats, box, rbox, meshPlane } = kit;
  const yb = -H / 2;

  // Base con cuatro patas angulares
  rbox(D, 0.2, W, 0.05, mats.white, 0, yb + 0.1, 0);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    rbox(0.8, 0.17, 0.4, 0.06, mats.white, sx * (D / 2 - 0.55), yb - 0.07, sz * (W / 2 - 0.32));
  });

  // Bandeja de la placa (fondo), panel trasero y honeycomb de ventilación
  box(D, H, 0.05, mats.steel, 0, 0, -W / 2 + 0.025);
  rbox(0.07, H, W, 0.02, mats.steel, -D / 2 + 0.035, 0, 0);
  meshPlane(0.85, 1.3, -D / 2 + 0.6, -0.55, -W / 2 + 0.056, 0, 0);

  // Marco del techo (vigas) y postes de las dos esquinas cerradas
  rbox(D, 0.09, 0.12, 0.03, mats.white, 0, H / 2 - 0.045, -W / 2 + 0.06);
  rbox(D, 0.09, 0.12, 0.03, mats.white, 0, H / 2 - 0.045, W / 2 - 0.06);
  rbox(0.12, 0.09, W, 0.03, mats.white, -D / 2 + 0.06, H / 2 - 0.045, 0);
  rbox(0.12, 0.09, W, 0.03, mats.white, D / 2 - 0.06, H / 2 - 0.045, 0);
  rbox(0.12, H, 0.12, 0.03, mats.white, D / 2 - 0.06, 0, -W / 2 + 0.06);
  rbox(0.12, H, 0.12, 0.03, mats.white, -D / 2 + 0.06, 0, W / 2 - 0.06);

  // Cristal templado: lateral, frontal (se juntan en la esquina, sin poste) y techo
  const gy = 0.055;
  const gh = H - 0.3;
  box(D - 0.12, gh, 0.02, mats.glass, 0.06, gy, W / 2 - 0.02);
  box(0.02, gh, W - 0.12, mats.glass, D / 2 - 0.02, gy, 0.06);
  box(D - 0.2, 0.02, W - 0.2, mats.glass, 0, H / 2 - 0.03, 0);
  box(0.028, gh, 0.028, mats.edge, D / 2 - 0.022, gy, W / 2 - 0.022);          // arista brillante de la esquina

  // Tornillos cromados en los postes
  [-1.35, 0, 1.35].forEach((y) => {
    kit.cyl(0.025, 0.025, 0.03, mats.chrome, D / 2 - 0.06, y, -W / 2 + 0.125, "z");
    kit.cyl(0.025, 0.025, 0.03, mats.chrome, -D / 2 + 0.06, y, W / 2 - 0.095, "z");
  });

  return { edge: null };
}

// Plataforma bajo el PC: un disco blanco con un aro amarillo (como los de las maquetas de
// threejs-journey) y marcas cada 5 grados para que se note cuánto gira al arrastrar
export function buildPedestal(kit) {
  const { H } = DIM;
  const { mats, lite } = kit;
  const y = -H / 2 - 0.22;
  const R = 2.45;
  const yellow = new THREE.MeshBasicMaterial({ color: 0xffc233, toneMapped: false });
  const navy = new THREE.MeshBasicMaterial({ color: 0x2a2361, toneMapped: false });
  kit.own(yellow);
  kit.own(navy);

  kit.cyl(R, R + 0.08, 0.16, mats.steel, 0, y - 0.02, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.06, 0.05, 10, lite ? 64 : 128), yellow);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y + 0.07;
  kit.root.add(ring);

  const ticks = [];
  for (let i = 0; i < 72; i++) {
    const g = new THREE.BoxGeometry(i % 6 === 0 ? 0.03 : 0.014, 0.006, i % 6 === 0 ? 0.16 : 0.09);
    const r = R - 0.28;
    const a = (i / 72) * Math.PI * 2;
    g.rotateY(Math.PI / 2 - a);   // la marca (larga en Z) apunta hacia fuera
    g.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
    ticks.push(g);
  }
  const tickMesh = new THREE.Mesh(mergeGeometries(ticks), navy);
  tickMesh.position.y = y + 0.065;
  kit.root.add(tickMesh);
  ticks.forEach((g) => g.dispose());
}
