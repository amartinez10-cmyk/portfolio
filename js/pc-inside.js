/*
 * Interior del PC. Cada pieza importante es una "parte" que se puede señalar con el cursor:
 * board (placa base), cooler (refrigeración líquida), ram, gpu (tarjeta gráfica), psu (fuente
 * de alimentación y cables) y fans (ventiladores del frontal).
 *
 * Ejes: X hacia el frontal (+) y la trasera (−), Y arriba, Z hacia el cristal (+).
 */
import * as THREE from "three";
import { DIM } from "./pc-case.js";
import { pcbMap } from "./pc-textures.js";

export function buildInside(kit) {
  const { D, H, W } = DIM;
  const { mats, box, rbox, cyl, tube, palette } = kit;
  const accent = "#" + palette.accent.getHexString();
  const zb = -W / 2 + 0.1;   // cara de la placa base

  /* ---------- Placa base ---------- */

  const board = kit.part("board");
  const pcb = pcbMap(accent, false);
  const pcbGlow = pcbMap(accent, true);
  const pcbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: pcb, emissive: 0xffffff, emissiveMap: pcbGlow, emissiveIntensity: 0.55, roughness: 0.55, metalness: 0.25
  });
  kit.own(pcb);
  kit.own(pcbGlow);
  kit.own(pcbMat);

  box(1.63, 2.03, 0.03, pcbMat, -0.5, 0.25, zb - 0.015, board);
  rbox(0.36, 0.7, 0.14, 0.03, mats.steel, -1.13, 0.9, zb + 0.07, board);                  // cubierta de las entradas
  box(0.016, 0.5, 0.006, kit.glowMat(0.2), -1.03, 0.9, zb + 0.143, board);                // línea de luz de la cubierta
  box(0.75, 0.14, 0.12, mats.finned, -0.58, 1.17, zb + 0.06, board);                     // disipador de las fases
  box(0.62, 0.1, 0.05, mats.alu, -0.72, 0.16, zb + 0.025, board);                        // disipador del M.2
  box(0.08, 0.62, 0.09, mats.matte, 0.27, 0.3, zb + 0.045, board);                       // conector de 24 pines
  [[-1.25, 1.2], [0.25, 1.2], [-1.25, -0.7], [0.25, -0.7], [-0.55, 0.42]].forEach(([x, y]) => {
    cyl(0.022, 0.022, 0.02, mats.chrome, x, y, zb + 0.01, "z", board);                    // tornillos
  });

  /* ---------- Memoria RAM: se ve de canto, con su barra de luz en el borde ---------- */

  const ram = kit.part("ram");
  [-0.02, 0.07, 0.16, 0.25].forEach((x, i) => {
    box(0.028, 0.9, 0.07, mats.matte, x, 0.75, zb + 0.035, ram);                          // ranura
    if (i % 2 === 1) {
      box(0.05, 0.84, 0.2, mats.alu, x, 0.75, zb + 0.14, ram);                            // disipador
      box(0.056, 0.78, 0.035, kit.glowMat(2 + i), x, 0.75, zb + 0.235, ram);              // barra RGB
    }
  });

  /* ---------- Refrigeración líquida: bomba con pantalla, tubos y radiador delantero ---------- */

  const pump = new THREE.Group();
  const cooler = kit.part("cooler", pump);
  cooler.add(pump);
  const px = -0.55;
  const py = 0.72;
  cyl(0.3, 0.3, 0.22, mats.steel, px, py, zb + 0.11, "z", pump);
  cyl(0.255, 0.255, 0.05, mats.matte, px, py, zb + 0.245, "z", pump);
  const led = new THREE.Mesh(new THREE.TorusGeometry(0.282, 0.011, 8, 64), kit.glowMat(1.3));
  led.position.set(px, py, zb + 0.235);
  pump.add(led);
  const screen = new THREE.Mesh(new THREE.CircleGeometry(0.205, 48), mats.lcd);
  screen.position.set(px, py, zb + 0.272);
  pump.add(screen);

  box(0.27, 2.45, 0.8, mats.finned, 1.145, 0, 0, cooler);                                 // radiador de 360 mm
  box(0.28, 0.08, 0.82, mats.alu, 1.145, 1.265, 0, cooler);
  box(0.28, 0.08, 0.82, mats.alu, 1.145, -1.265, 0, cooler);
  cyl(0.045, 0.045, 0.14, mats.chrome, 0.96, 1.24, -0.22, "x", cooler);
  cyl(0.045, 0.045, 0.14, mats.chrome, 0.96, 1.24, 0.02, "x", cooler);
  tube([[0.9, 1.24, -0.22], [0.6, 1.36, -0.3], [0.1, 1.38, -0.38], [-0.35, 1.15, -0.42], [-0.5, 0.98, -0.38]], 0.042, mats.sleeve, cooler);
  tube([[0.9, 1.24, 0.02], [0.6, 1.31, -0.08], [0.05, 1.31, -0.2], [-0.3, 1.1, -0.3], [-0.62, 0.97, -0.38]], 0.042, mats.sleeve, cooler);

  /* ---------- Ventiladores del frontal ---------- */

  const fans = kit.part("fans");
  [0.82, 0, -0.82].forEach((y, i) => {
    const f = kit.fan(0.4, i * 0.9, 6);
    f.rotation.y = Math.PI / 2;
    f.position.set(D / 2 - 0.14, y, 0);
    fans.add(f);
  });

  /* ---------- Tarjeta gráfica en vertical (los ventiladores miran al cristal) ---------- */

  const gpu = kit.part("gpu");
  const gx = -0.3;
  const gy = -0.32;
  const gz = 0.3;
  rbox(2, 0.8, 0.26, 0.05, mats.matte, gx, gy, gz, gpu);
  box(2.02, 0.025, 0.27, kit.glowMat(0.4), gx, gy + 0.4, gz, gpu);                        // tira RGB superior
  box(2.02, 0.02, 0.27, mats.chrome, gx, gy - 0.4, gz, gpu);                              // canto cromado
  box(0.03, 0.85, 0.3, mats.alu, gx - 1.015, gy, gz - 0.02, gpu);                         // escuadra trasera
  box(0.5, 0.06, 0.006, mats.chrome, gx + 0.35, gy - 0.3, gz + 0.133, gpu);               // placa de logotipo
  [-0.66, 0, 0.66].forEach((dx, i) => {
    // Fondo oscuro pegado a la cara de la tarjeta y, por delante, el ventilador (con sus aspas
    // y su aro LED fuera del cuerpo, para que se vean)
    cyl(0.29, 0.29, 0.004, mats.rubber, gx + dx, gy, gz + 0.132, "z", gpu);
    const f = kit.fan(0.29, 0.8 + i * 0.8, 9);
    f.position.set(gx + dx, gy, gz + 0.145);
    gpu.add(f);
  });
  box(0.09, 0.16, 0.13, mats.matte, gx + 1.04, gy + 0.16, gz, gpu);                       // conectores de corriente
  box(0.09, 0.16, 0.13, mats.matte, gx + 1.04, gy - 0.1, gz, gpu);

  /* ---------- Fuente de alimentación y cables con funda trenzada ---------- */

  const psu = kit.part("psu");
  const sy = -H / 2 + 0.05 + 0.3;
  rbox(2.5, 0.6, W - 0.08, 0.05, mats.matte, -0.2, sy, 0, psu);
  kit.meshPlane(2.2, W - 0.3, -0.25, sy + 0.302, 0, -Math.PI / 2, 0, psu);
  box(2.4, 0.012, 0.012, kit.glowMat(1.1), -0.2, sy + 0.15, W / 2 - 0.045, psu);

  tube([[0.27, -0.01, zb + 0.045], [0.5, -0.15, -0.5], [0.88, -0.4, -0.4], [0.88, -0.75, -0.3], [0.8, -0.9, -0.2]], 0.075, mats.sleeve, psu);
  tube([[-1, 1.24, -0.5], [-1.2, 1.3, -0.5], [-1.38, 1, -0.55], [-1.38, -0.4, -0.58], [-1.3, -0.86, -0.55]], 0.035, mats.sleeve, psu);
  tube([[0.9, -0.86, 0.05], [0.95, -0.6, 0.15], [0.86, -0.35, 0.28], [0.76, -0.16, 0.3]], 0.042, mats.sleeve, psu);
  tube([[0.85, -0.86, 0.2], [0.9, -0.65, 0.3], [0.78, -0.42, 0.3]], 0.042, mats.sleeve, psu);

  /* ---------- Luz interior: da volumen al metal y a la placa ---------- */

  const l1 = new THREE.PointLight(palette.accent, 2.2, 3.4, 2);
  const l2 = new THREE.PointLight(palette.accent2, 1.8, 3.4, 2);
  l1.position.set(0.3, 0.6, 0.4);
  l2.position.set(-0.9, -0.15, 0.45);
  kit.root.add(l1, l2);
}
