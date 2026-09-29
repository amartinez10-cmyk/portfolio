/*
 * La "sala" de cada sección: un bloque con el suelo y dos paredes (el frente y el techo quedan
 * abiertos, como una maqueta cortada) sobre un pedestal escalonado con una luz en el borde.
 * Es el escenario donde js/levels.js coloca los objetos de cada nivel.
 *
 * Ejes de la sala: el interior va de -7 a 7 en X y en Z. Las paredes están en X = -7 (izquierda
 * de la pantalla) y en Z = -7 (derecha); la cámara mira desde +X, +Z. El suelo está en Y = 0.
 */
import * as THREE from "three";

export const HALF = 7;
export const WALL_H = 9;

const shade = (hex, l, s = 0) => new THREE.Color(hex).offsetHSL(0, s, l).getHex();

export function buildRoom(kit, { wall, accent }) {
  const { C, rbox, box, grp, mat, glow, canvasTex, redraw, decal } = kit;
  const group = new THREE.Group();

  const wallHex = wall;
  const wallB = shade(wall, -0.035);
  const cap = shade(wall, 0.13, -0.05);
  const dado = shade(wall, -0.1, -0.02);
  const rail = shade(wall, 0.07, -0.03);
  const floorA = shade(wall, -0.2, -0.32);
  const floorB = shade(wall, -0.235, -0.32);
  const slab = shade(wall, -0.3, -0.05);
  const under = shade(wall, -0.38, -0.05);
  const under2 = shade(wall, -0.46, -0.05);

  /* ---------- Suelo ---------- */

  const floorTex = canvasTex(512, 512, (g, w, h) => {
    const n = 7;
    const s = w / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        g.fillStyle = "#" + (((i + j) & 1) ? floorA : floorB).toString(16).padStart(6, "0");
        g.fillRect(i * s, j * s, s, s);
      }
    }
    g.strokeStyle = "rgba(20, 10, 60, 0.13)";
    g.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke();
    }
  });
  floorTex.anisotropy = 16;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), mat(0xffffff, { map: floorTex, rough: 0.92 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.02, 0);
  floor.receiveShadow = true;
  group.add(floor);

  /* ---------- Bloque, pedestal y luz del borde ---------- */

  rbox(15.3, 1.3, 15.3, slab, -0.45, -0.65, -0.45, group, 0.3);
  rbox(11.6, 1.3, 11.6, under, -0.45, -1.95, -0.45, group, 0.25);
  rbox(7.6, 1.3, 7.6, under2, -0.45, -3.25, -0.45, group, 0.22);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(15.36, 0.14, 15.36), glow(accent));
  strip.position.set(-0.45, -1.28, -0.45);
  group.add(strip);
  const strip2 = strip.clone();
  strip2.scale.set(0.76, 1, 0.76);
  strip2.position.y = -2.58;
  group.add(strip2);

  /* ---------- Paredes ---------- */

  const walls = grp(0, 0, 0, group);
  rbox(0.9, WALL_H, 14.9, wallHex, -7.45, WALL_H / 2, -0.45, walls, 0.16);
  rbox(14, WALL_H, 0.9, wallB, 0, WALL_H / 2, -7.45, walls, 0.16);
  rbox(1.06, 0.42, 15.06, cap, -7.45, WALL_H + 0.05, -0.45, walls, 0.14);
  rbox(14.06, 0.42, 1.06, cap, 0, WALL_H + 0.05, -7.45, walls, 0.14);
  // Zócalo y moldura
  rbox(0.2, 2.7, 14, dado, -6.9, 1.35, 0, walls, 0.06);
  rbox(0.34, 0.24, 14, rail, -6.86, 2.72, 0, walls, 0.08);
  rbox(14, 2.7, 0.2, dado, 0, 1.35, -6.9, walls, 0.06);
  rbox(14, 0.24, 0.34, rail, 0, 2.72, -6.86, walls, 0.08);

  /* ---------- Título en la pared: número grande y nombre del nivel ---------- */

  const titleTex = canvasTex(1024, 512, () => {});
  function setTitle(text) {
    redraw(titleTex, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.textBaseline = "alphabetic";
      const fontStack = '"Outfit", "Avenir Next", "Segoe UI", system-ui, sans-serif';
      // El nombre de la sala, grande, en una o dos líneas si no cabe
      const words = String(text).split(" ");
      let lines = [text];
      let size = 270;
      g.font = "800 " + size + "px " + fontStack;
      while (size > 90 && g.measureText(text).width > w - 70) {
        size -= 8;
        g.font = "800 " + size + "px " + fontStack;
      }
      if (g.measureText(text).width > w - 70 && words.length > 1) {
        const half = Math.ceil(words.length / 2);
        lines = [words.slice(0, half).join(" "), words.slice(half).join(" ")];
        size = 210;
        g.font = "800 " + size + "px " + fontStack;
        while (size > 80 && Math.max(...lines.map((l) => g.measureText(l).width)) > w - 70) {
          size -= 8;
          g.font = "800 " + size + "px " + fontStack;
        }
      }
      const lineH = size * 1.02;
      const y0 = h / 2 + (size * 0.36) - ((lines.length - 1) * lineH) / 2;
      lines.forEach((line, i) => {
        const y = y0 + i * lineH;
        g.fillStyle = "rgba(20, 8, 70, 0.22)";
        g.fillText(line, 36, y + 8);
        g.fillStyle = "rgba(255, 255, 255, 0.96)";
        g.fillText(line, 30, y);
      });
    });
  }
  setTitle("");
  const titleG = grp(-6.78, 6.05, 1.6, group, Math.PI / 2);
  const title = decal(titleTex, 8.6, 4.3, 0, 0, 0, titleG);
  title.position.z = 0.02;

  return { group, walls, setTitle, floor, accent };
}
