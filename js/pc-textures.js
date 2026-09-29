/*
 * Texturas del PC dibujadas por código en un <canvas> (sin descargar imágenes): metal cepillado,
 * chapa perforada, aletas de disipador, funda trenzada de cables, placa base y la pantallita
 * animada de la refrigeración líquida.
 */
import * as THREE from "three";

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}

export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(canvas, { srgb = false, repeat = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Metal cepillado: vetas horizontales (sirve para la rugosidad y para el relieve)
export function brushedMap(seed = 3) {
  const [c, g] = makeCanvas(256, 256);
  const rand = rng(seed);
  g.fillStyle = "#8c8c8c";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const v = 90 + Math.floor(rand() * 120);
    g.strokeStyle = "rgba(" + v + "," + v + "," + v + "," + (0.15 + rand() * 0.35).toFixed(2) + ")";
    g.lineWidth = 0.5 + rand() * 1.2;
    const x = rand() * 256;
    const y = rand() * 256;
    const len = 40 + rand() * 200;
    const dy = (rand() - 0.5) * 1.5;
    for (const ox of [0, -256]) {
      g.beginPath();
      g.moveTo(x + ox, y);
      g.lineTo(x + ox + len, y + dy);
      g.stroke();
    }
  }
  return finish(c);
}

// Chapa perforada (alphaMap: blanco = chapa, negro = agujero), con los agujeros al tresbolillo
export function ventMap(cell = 16) {
  const size = 128;
  const [c, g] = makeCanvas(size, size);
  g.fillStyle = "#fff";
  g.fillRect(0, 0, size, size);
  g.fillStyle = "#000";
  const n = size / cell;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const ox = (y % 2) * (cell / 2);
      for (const dx of [0, -size]) {
        g.beginPath();
        g.arc(x * cell + cell / 2 + ox + dx, y * cell + cell / 2, cell * 0.31, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  return finish(c);
}

// Aletas de un disipador: ranuras finas horizontales
export function finMap() {
  const [c, g] = makeCanvas(16, 64);
  for (let i = 0; i < 64; i++) {
    g.fillStyle = i % 4 < 2 ? "#8b8f9c" : "#2a2d38";
    g.fillRect(0, i, 16, 1);
  }
  return finish(c, { srgb: true });
}

// Funda trenzada de los cables: franjas diagonales
export function braidMap() {
  const [c, g] = makeCanvas(32, 32);
  g.fillStyle = "#3a3d48";
  g.fillRect(0, 0, 32, 32);
  g.strokeStyle = "#0a0b10";
  g.lineWidth = 4;
  for (let i = -32; i < 64; i += 8) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 32, 32);
    g.stroke();
  }
  return finish(c, { srgb: true });
}

// Placa base: pistas y chips. "glow" = solo las pistas sobre negro (para el emissiveMap)
export function pcbMap(color, glow) {
  const size = 512;
  const [c, g] = makeCanvas(size, size);
  const rand = rng(7);
  g.fillStyle = glow ? "#000" : "#0b0e15";
  g.fillRect(0, 0, size, size);
  g.strokeStyle = color;
  g.fillStyle = color;
  for (let i = 0; i < 90; i++) {
    let x = Math.floor(rand() * 32) * 16;
    let y = Math.floor(rand() * 32) * 16;
    g.globalAlpha = (glow ? 0.35 : 0.12) + rand() * (glow ? 0.5 : 0.2);
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
  g.globalAlpha = glow ? 0.5 : 0.25;
  g.lineWidth = 2;
  [[300, 100, 90, 90], [70, 300, 130, 40], [330, 330, 100, 130]].forEach(([x, y, w, h]) => g.strokeRect(x, y, w, h));
  return finish(c, { srgb: true, repeat: false });
}

export function glowTexture(size = 128) {
  const [c, g] = makeCanvas(size, size);
  const h = size / 2;
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// Pantalla circular de la bomba: un anillo que gira, la temperatura y una gráfica que se mueve
export function createLcd(palette) {
  const size = 256;
  const [c, g] = makeCanvas(size, size);
  const texture = finish(c, { srgb: true, repeat: false });
  const a = "#" + palette.accent.getHexString();
  const b = "#" + palette.accent2.getHexString();
  const history = [];
  for (let i = 0; i < 48; i++) history.push(0.5 + 0.3 * Math.sin(i * 0.4));
  let last = -1;

  function draw(t) {
    g.fillStyle = "#04060c";
    g.fillRect(0, 0, size, size);
    g.lineWidth = 8;
    g.strokeStyle = "rgba(108,134,255,0.25)";
    g.beginPath();
    g.arc(128, 128, 112, 0, Math.PI * 2);
    g.stroke();
    const start = t * 2;
    g.strokeStyle = b;
    g.beginPath();
    g.arc(128, 128, 112, start, start + 1.6);
    g.stroke();
    g.strokeStyle = a;
    g.beginPath();
    g.arc(128, 128, 112, start + 3.14, start + 4.04);
    g.stroke();

    const value = 38 + Math.round(6 * Math.sin(t * 0.7) + 3 * Math.sin(t * 2.3));
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#eaffff";
    g.font = "700 64px ui-monospace, Consolas, monospace";
    g.fillText(value + "°", 128, 106);
    g.fillStyle = b;
    g.font = "600 20px ui-monospace, Consolas, monospace";
    g.fillText("CPU", 128, 152);

    history.push(0.5 + 0.35 * Math.sin(t * 1.3) + 0.15 * Math.sin(t * 4.1));
    history.shift();
    g.strokeStyle = a;
    g.lineWidth = 3;
    g.beginPath();
    history.forEach((v, i) => {
      const x = 48 + i * (160 / 47);
      const y = 208 - v * 30;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.stroke();
    texture.needsUpdate = true;
  }

  draw(0);
  return {
    texture,
    update(t) {
      if (Math.abs(t - last) < 0.12) return;
      last = t;
      draw(t);
    }
  };
}
