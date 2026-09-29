/*
 * Carcasa del PC: chapas con canto redondeado, cristal templado con marco y tornillos,
 * frontal de malla, patas y una plataforma giratoria con marcas de grados (para que se
 * note cuánto gira al arrastrar).
 *
 * Medidas (1 unidad ≈ 15 cm): D fondo (eje X, el frontal mira a +X), H alto (Y) y W ancho
 * (Z, el cristal mira a +Z).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const DIM = { D: 3, H: 3, W: 1.4 };

export function buildCase(kit) {
  const { D, H, W } = DIM;
  const { mats, box, rbox, cyl, meshPlane, palette } = kit;
  const t = 0.05;

  // Chapas: techo, base, bandeja de la placa (lado lejano), frontal y trasera
  rbox(D, t, W, 0.02, mats.steel, 0, H / 2 - t / 2, 0);
  rbox(D, t, W, 0.02, mats.steel, 0, -H / 2 + t / 2, 0);
  box(D, H, 0.04, mats.steel, 0, 0, -W / 2 + 0.02);
  rbox(t, H, W, 0.02, mats.steel, -D / 2 + t / 2, 0, 0);
  meshPlane(D - 0.7, W - 0.5, 0.2, H / 2 + 0.002, 0, -Math.PI / 2, 0);   // rejilla del techo

  // Ojales de goma de la bandeja (por donde pasan los cables)
  [0.9, 0, -0.65].forEach((y, i) => {
    rbox(0.1, i === 1 ? 0.7 : 0.45, 0.02, 0.02, mats.rubber, 0.55, y, -W / 2 + 0.05);
  });

  // Frontal: marco + malla, con luz en el canto
  rbox(t, H, 0.09, 0.02, mats.steel, D / 2 - t / 2, 0, -W / 2 + 0.045);
  rbox(t, H, 0.09, 0.02, mats.steel, D / 2 - t / 2, 0, W / 2 - 0.045);
  rbox(t, 0.09, W, 0.02, mats.steel, D / 2 - t / 2, H / 2 - 0.045, 0);
  rbox(t, 0.09, W, 0.02, mats.steel, D / 2 - t / 2, -H / 2 + 0.045, 0);
  meshPlane(W - 0.16, H - 0.16, D / 2 - 0.005, 0, 0, 0, Math.PI / 2);
  box(0.012, H - 0.3, 0.014, kit.glowMat(0.5), D / 2 + 0.004, 0, W / 2 - 0.02);

  // Trasera: bloque de entradas y salidas, fuente de alimentación y ventilador de salida
  box(0.03, 0.55, 0.55, mats.alu, -D / 2 - 0.005, 0.55, -0.34);
  [0.8, 0.68, 0.56, 0.44, 0.32].forEach((y) => box(0.034, 0.06, 0.4, mats.matte, -D / 2 - 0.01, y, -0.34));
  box(0.03, 0.42, 0.8, mats.matte, -D / 2 - 0.005, -H / 2 + 0.3, 0);
  cyl(0.06, 0.06, 0.036, mats.chrome, -D / 2 - 0.015, -H / 2 + 0.3, 0.2, "x");
  const rear = kit.fan(0.32, 2.4, 7);          // ventilador de salida, dentro de la caja y con el LED hacia el interior
  rear.rotation.y = Math.PI / 2;
  rear.position.set(-D / 2 + t + 0.08, 1.05, 0.24);
  kit.root.add(rear);

  // Cristal templado con marco negro y cuatro tornillos cromados
  box(D - 0.14, H - 0.14, 0.018, mats.glass, 0, 0, W / 2 - 0.02);
  const zg = W / 2 - 0.02;
  box(D, 0.075, 0.05, mats.matte, 0, H / 2 - 0.0375, zg);
  box(D, 0.075, 0.05, mats.matte, 0, -H / 2 + 0.0375, zg);
  box(0.075, H, 0.05, mats.matte, -D / 2 + 0.0375, 0, zg);
  box(0.075, H, 0.05, mats.matte, D / 2 - 0.0375, 0, zg);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    cyl(0.03, 0.03, 0.03, mats.chrome, sx * (D / 2 - 0.075), sy * (H / 2 - 0.075), W / 2 + 0.005, "z");
    box(0.2, 0.06, 0.2, mats.rubber, sx * (D / 2 - 0.3), -H / 2 - 0.03, sy * (W / 2 - 0.3));   // patas
  });

  // Aristas con luz de neón
  const edge = new THREE.LineBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.6, toneMapped: false });
  kit.root.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(D, H, W)), edge));
  return { edge };
}

// Plataforma giratoria bajo el PC: placa brillante, aro de neón y marcas cada 5 grados
export function buildPedestal(kit) {
  const { H } = DIM;
  const { mats, palette, lite } = kit;
  const y = -H / 2 - 0.2;
  const R = 2.05;

  kit.cyl(R, R + 0.05, 0.1, mats.plate, 0, y, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.016, 8, lite ? 64 : 128), kit.glowMat(1.7));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y + 0.052;
  kit.root.add(ring);

  const ticks = [];
  for (let i = 0; i < 72; i++) {
    const g = new THREE.BoxGeometry(i % 6 === 0 ? 0.03 : 0.014, 0.006, i % 6 === 0 ? 0.16 : 0.09);
    const r = R - 0.12;
    const a = (i / 72) * Math.PI * 2;
    g.rotateY(Math.PI / 2 - a);   // la marca (larga en Z) apunta hacia fuera
    g.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
    ticks.push(g);
  }
  const tickMesh = new THREE.Mesh(mergeGeometries(ticks), kit.glowMat(0.9));
  tickMesh.position.y = y + 0.053;
  kit.root.add(tickMesh);
  ticks.forEach((g) => g.dispose());

  // Charco de luz en el suelo, bajo la plataforma
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 3.1, R * 3.1),
    new THREE.MeshBasicMaterial({
      map: kit.glow, color: palette.accent, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = y - 0.08;
  kit.root.add(pool);
  kit.own(pool.material);
}
