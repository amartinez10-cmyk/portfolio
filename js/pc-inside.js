/*
 * Interior del PC, con la distribución de una torre panorámica de refrigeración líquida:
 *   · placa base en el fondo, con la memoria RAM y el bloque de la CPU
 *   · radiador de 360 mm arriba, con tres ventiladores, unido al bloque por dos tubos blancos
 *   · tarjeta gráfica en horizontal, con un cable blanco desde la fuente
 *   · fuente de alimentación en la base y tres ventiladores en el frontal
 * Cada pieza importante es una "parte" que se puede señalar con el cursor: board (placa base),
 * cooler (refrigeración líquida), ram, gpu (tarjeta gráfica), psu (fuente) y fans (ventiladores).
 *
 * Ejes: X hacia el frontal (+) y la trasera (−), Y arriba, Z hacia el cristal lateral (+).
 */
import * as THREE from "three";
import { DIM } from "./pc-case.js";
import { pcbMap } from "./pc-textures.js";

const FONT = '"Outfit", "Avenir Next", "Segoe UI", system-ui, sans-serif';

export function buildInside(kit) {
  const { D, H, W } = DIM;
  const { mats, box, rbox, cyl, tube, meshPlane, label } = kit;
  const accent = "#c9b6ff";
  const zb = -W / 2 + 0.12;       // cara de la placa base
  const OX = 0.35;                // la placa y sus piezas van algo a la derecha: a la izquierda cabe el ventilador trasero
  const X = (x) => x + OX;
  const yb = -H / 2;

  /* ---------- Placa base ---------- */

  const board = kit.part("board");
  const pcb = pcbMap(accent, false);
  const pcbGlow = pcbMap(accent, true);
  const pcbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: pcb, emissive: 0xffffff, emissiveMap: pcbGlow, emissiveIntensity: 0.4, roughness: 0.5, metalness: 0.2
  });
  kit.own(pcb);
  kit.own(pcbGlow);
  kit.own(pcbMat);

  box(1.63, 2.03, 0.03, pcbMat, X(-0.5), 0.25, zb - 0.015, board);
  rbox(0.36, 0.7, 0.14, 0.03, mats.white, X(-1.13), 0.9, zb + 0.07, board);              // cubierta de las entradas
  box(0.016, 0.5, 0.006, kit.glowMat(0.2), X(-1.03), 0.9, zb + 0.143, board);             // línea de luz de la cubierta
  box(0.75, 0.14, 0.12, mats.finned, X(-0.58), 1.17, zb + 0.06, board);                   // disipador de las fases
  box(0.62, 0.1, 0.05, mats.alu, X(-0.72), 0.16, zb + 0.025, board);                      // disipador del M.2
  box(0.08, 0.62, 0.09, mats.matte, X(0.27), 0.3, zb + 0.045, board);                     // conector de 24 pines
  [[-1.25, 1.2], [0.25, 1.2], [-1.25, -0.7], [0.25, -0.7], [-0.55, 0.42]].forEach(([x, y]) => {
    cyl(0.022, 0.022, 0.02, mats.chrome, X(x), y, zb + 0.01, "z", board);                 // tornillos
  });
  for (let i = 0; i < 7; i++) {                                                            // condensadores
    cyl(0.028, 0.028, 0.07, i % 2 ? mats.chrome : mats.alu, X(-1.02 + i * 0.1), 1.02, zb + 0.035, "z", board);
  }
  [-0.2, -0.32, -0.44, -0.56].forEach((y) => {                                             // conectores SATA
    box(0.15, 0.06, 0.07, mats.matte, X(0.22), y, zb + 0.035, board);
    box(0.05, 0.06, 0.1, mats.matte, X(0.28), y, zb + 0.05, board);
  });

  /* ---------- Memoria RAM: dos módulos blancos con barra de luz ---------- */

  const ram = kit.part("ram");
  [-0.02, 0.07, 0.16, 0.25].forEach((x, i) => {
    box(0.028, 0.9, 0.07, mats.matte, X(x), 0.75, zb + 0.035, ram);                       // ranura
    if (i % 2 === 1) {
      box(0.05, 0.84, 0.2, mats.white, X(x), 0.75, zb + 0.14, ram);                       // disipador
      box(0.056, 0.78, 0.035, kit.glowMat(2 + i), X(x), 0.75, zb + 0.235, ram);           // barra de luz
      [-0.3, -0.1, 0.1, 0.3].forEach((dy) => box(0.06, 0.02, 0.16, mats.chrome, X(x), 0.75 + dy, zb + 0.15, ram));
    }
  });

  /* ---------- Refrigeración líquida: bloque de la CPU, tubos, radiador y ventiladores del techo ---------- */

  const pump = new THREE.Group();
  const cooler = kit.part("cooler", pump);
  cooler.add(pump);
  const px = X(-0.55);
  const py = 0.78;
  rbox(0.66, 0.66, 0.34, 0.14, mats.black, px, py, zb + 0.17, pump);
  cyl(0.3, 0.3, 0.05, mats.black, px, py, zb + 0.35, "z", pump);
  const ringLed = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.012, 8, 64), kit.glowMat(1.3));
  ringLed.position.set(px, py, zb + 0.378);
  pump.add(ringLed);
  const logo = label(0.5, 0.5, (c, w, h) => {
    // Una "A" de líneas gruesas: la inicial de Alex
    c.clearRect(0, 0, w, h);
    c.lineWidth = w * 0.09;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "#ffffff";
    c.beginPath();
    c.moveTo(w * 0.24, h * 0.76); c.lineTo(w * 0.5, h * 0.22); c.lineTo(w * 0.76, h * 0.76);
    c.stroke();
    c.lineWidth = w * 0.06;
    c.strokeStyle = "#c9b6ff";
    c.beginPath(); c.moveTo(w * 0.36, h * 0.58); c.lineTo(w * 0.64, h * 0.58); c.stroke();
  });
  logo.position.set(px, py, zb + 0.378);
  pump.add(logo);
  [-0.13, 0.13].forEach((dx) => cyl(0.06, 0.06, 0.2, mats.chrome, px + dx, py + 0.42, zb + 0.17, undefined, pump));   // racores

  // Radiador de 360 mm en el techo (sobre sus tres ventiladores)
  const ry = H / 2 - 0.2;
  rbox(2.85, 0.3, 0.64, 0.05, mats.white, 0.05, ry, 0.15, cooler);
  box(2.7, 0.14, 0.02, mats.finned, 0.05, ry, 0.15 + 0.322, cooler);
  [-1, 1].forEach((sx) => rbox(0.2, 0.34, 0.7, 0.05, mats.white, 0.05 + sx * 1.43, ry, 0.15, cooler));
  [1.15, 1.42].forEach((x) => cyl(0.07, 0.07, 0.18, mats.chrome, x, ry, 0.15 + 0.4, "z", cooler));
  [-0.83, 0.07, 0.97].forEach((x, i) => {
    const f = kit.fan(0.44, i * 0.8, 7);
    f.rotation.x = -Math.PI / 2;                 // el frente del ventilador mira hacia arriba
    f.position.set(x, ry - 0.24, 0.15);
    cooler.add(f);
  });
  // Dos tubos blancos trenzados: del bloque, hacia delante y arriba, hasta el radiador
  tube([[px - 0.13, py + 0.5, zb + 0.17], [px - 0.13, 1.05, -0.35], [0.05, 1.08, 0.25], [0.6, 1.0, 0.62], [1.05, 1.25, 0.68], [1.15, ry, 0.56]], 0.062, mats.sleeve, cooler);
  tube([[px + 0.13, py + 0.5, zb + 0.17], [px + 0.13, 1.0, -0.3], [0.3, 0.95, 0.32], [0.8, 0.92, 0.74], [1.3, 1.15, 0.72], [1.42, ry, 0.56]], 0.062, mats.sleeve, cooler);

  /* ---------- Ventiladores: tres en el frontal y uno trasero, con aros de luz ---------- */

  const fans = kit.part("fans");
  [1.0, 0.1, -0.8].forEach((y, i) => {
    const f = kit.fan(0.44, i * 0.9, 6);
    f.rotation.y = Math.PI / 2;                  // el frente del ventilador mira hacia el frontal
    f.position.set(D / 2 - 0.2, y, 0.05);
    fans.add(f);
  });
  const rear = kit.fan(0.4, 2.4, 7);
  rear.position.set(-D / 2 + 0.55, 0.62, -0.3);
  fans.add(rear);
  // Tiras de luz verticales a los lados de los ventiladores del frontal
  [-0.42, 0.55].forEach((z) => box(0.03, 2.5, 0.03, kit.glowMat(0.6), D / 2 - 0.1, 0.1, z, fans));

  /* ---------- Tarjeta gráfica en horizontal ---------- */

  const gpu = kit.part("gpu");
  const card = new THREE.Group();
  card.position.set(0, -0.28, -0.23);
  gpu.add(card);
  rbox(2.2, 0.46, 0.95, 0.07, mats.white, 0, 0, 0, card);
  box(1.95, 0.02, 0.8, mats.black, 0, 0.225, 0, card);                                    // placa trasera (bajo la rejilla)
  meshPlane(1.9, 0.75, 0, 0.234, 0, -Math.PI / 2, 0, card);
  // Cara que se ve desde el cristal: rótulo, pila de aletas negra y emblema
  const zf = 0.478;
  const title = label(1.45, 0.16, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#15112e";
    c.font = "800 " + Math.round(h * 0.72) + "px " + FONT;
    c.textBaseline = "middle";
    c.fillText("ULTRA GAMING", w * 0.02, h * 0.54);
  }, 300);
  title.position.set(-0.22, 0.135, zf);
  card.add(title);
  rbox(1.95, 0.15, 0.03, 0.02, mats.black, -0.05, -0.02, zf - 0.008, card);
  for (let i = 0; i < 40; i++) box(0.014, 0.15, 0.036, mats.white, -1.0 + i * 0.05, -0.02, zf - 0.004, card);
  const badge = label(0.34, 0.34, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#15112e";
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      c.lineTo(w / 2 + Math.cos(a) * w * 0.46, h / 2 + Math.sin(a) * h * 0.46);
    }
    c.closePath(); c.fill();
    c.strokeStyle = "#c9b6ff"; c.lineWidth = w * 0.05; c.stroke();
    c.fillStyle = "#ffffff";
    c.beginPath(); c.moveTo(w * 0.55, h * 0.2); c.lineTo(w * 0.34, h * 0.55); c.lineTo(w * 0.5, h * 0.55); c.lineTo(w * 0.42, h * 0.82); c.lineTo(w * 0.68, h * 0.45); c.lineTo(w * 0.52, h * 0.45); c.closePath(); c.fill();
  });
  badge.position.set(0.95, 0.06, zf + 0.004);
  card.add(badge);
  box(2.05, 0.02, 0.02, kit.glowMat(0.4), 0, -0.215, zf - 0.002, card);                  // tira de luz inferior
  box(0.2, 0.1, 0.3, mats.matte, 0.85, 0.28, 0.1, card);                                  // conector de corriente
  rbox(0.05, 0.5, 0.62, 0.02, mats.steel, -1.12, 0, 0.05, card);                          // escuadra trasera

  /* ---------- Fuente de alimentación y cable ---------- */

  // La parte "psu" incluye el cable (se puede señalar), pero el contorno que se marca es solo la caja
  const shroud = new THREE.Group();
  const psu = kit.part("psu", shroud);
  psu.add(shroud);
  const sy = yb + 0.2 + 0.31;
  rbox(2.6, 0.62, W - 0.16, 0.06, mats.white, 0.2, sy, 0, shroud);
  meshPlane(2.2, W - 0.45, 0.2, sy + 0.312, 0, -Math.PI / 2, 0, shroud);
  box(2.0, 0.035, 0.02, mats.matte, 0.2, sy - 0.08, W / 2 - 0.08 + 0.012, shroud);
  box(2.4, 0.012, 0.012, kit.glowMat(1.1), 0.2, sy + 0.2, W / 2 - 0.08 + 0.014, shroud);
  // Cable blanco grueso hasta la gráfica
  tube([[0.3, sy + 0.3, 0.25], [0.15, sy + 0.62, 0.5], [0.05, -0.3, 0.55], [0.35, -0.12, 0.42], [0.8, 0.04, 0.16], [0.85, 0.0, -0.1]], 0.1, mats.sleeve, psu);
  tube([[0.5, sy + 0.3, -0.1], [0.62, sy + 0.5, -0.45], [X(0.27), 0.0, zb + 0.12]], 0.05, mats.sleeve, psu);   // cable de la placa

  /* ---------- Luz interior: da volumen al plástico y al cristal ---------- */

  const l1 = new THREE.PointLight(0xc9b6ff, 6, 9, 2);
  const l2 = new THREE.PointLight(0xa8d4ff, 5, 9, 2);
  l1.position.set(0.3, 0.9, 0.4);
  l2.position.set(-0.9, -0.15, 0.45);
  kit.root.add(l1, l2);
}
