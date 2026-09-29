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
  tex.anisotropy = 16;
  return tex;
}

// Metal cepillado: vetas horizontales (sirve para la rugosidad y para el relieve)
export function brushedMap(seed = 3) {
  const N = 512;
  const [c, g] = makeCanvas(N, N);
  const rand = rng(seed);
  g.fillStyle = "#8c8c8c";
  g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2400; i++) {
    const v = 90 + Math.floor(rand() * 120);
    g.strokeStyle = "rgba(" + v + "," + v + "," + v + "," + (0.12 + rand() * 0.3).toFixed(2) + ")";
    g.lineWidth = 0.5 + rand() * 1.1;
    const x = rand() * N;
    const y = rand() * N;
    const len = 80 + rand() * 400;
    const dy = (rand() - 0.5) * 2;
    for (const ox of [0, -N]) {
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
  const size = 256;
  cell = cell * 2;
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
  const [c, g] = makeCanvas(64, 256);
  for (let i = 0; i < 256; i++) {
    g.fillStyle = i % 8 < 5 ? "#9aa0b6" : "#2a2d44";
    g.fillRect(0, i, 64, 1);
  }
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.fillRect(0, 0, 64, 3);
  return finish(c, { srgb: true });
}

// Funda trenzada de los cables: hilos entrelazados en diagonal
export function braidMap() {
  const N = 128;
  const [c, g] = makeCanvas(N, N);
  g.fillStyle = "#c9c9d6";
  g.fillRect(0, 0, N, N);
  for (const dir of [1, -1]) {
    for (let i = -N; i < N * 2; i += 16) {
      const grad = g.createLinearGradient(0, 0, 0, N);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.5, "#8d8ba8");
      grad.addColorStop(1, "#e9e9f2");
      g.strokeStyle = dir > 0 ? "#f2f2fa" : "#9c9ab8";
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + dir * N, N);
      g.stroke();
    }
  }
  return finish(c, { srgb: true });
}

// Placa base (1,63 × 2,03 unidades) en alta resolución: buses de pistas, pistas metalizadas, chips,
// vías y serigrafía. "glow" = solo las pistas de color sobre negro (para el emissiveMap).
export function pcbMap(color, glow) {
  const W = 1600;
  const H = 2000;
  const [c, g] = makeCanvas(W, H);
  const rand = rng(7);
  const K = W / 1.63;                                   // píxeles por unidad
  const X = (x) => (x + 1.315) * K;                     // coordenadas de la placa → píxeles
  const Y = (y) => (1.265 - y) * K;
  if (glow) {
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
  } else {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#2a2075");
    bg.addColorStop(1, "#171045");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
  }
  g.lineJoin = "round";
  g.lineCap = "round";

  // Buses: haces de pistas paralelas con codos rectos; cada copia va desplazada en diagonal
  function bus(points, n, gap, width, alpha, col) {
    g.strokeStyle = col;
    g.globalAlpha = alpha;
    g.lineWidth = width;
    for (let k = 0; k < n; k++) {
      g.beginPath();
      points.forEach(([x, y], i) => {
        const px = x * K + k * gap;
        const py = y * K + k * gap;
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      });
      g.stroke();
      const [ex, ey] = points[points.length - 1];
      g.beginPath();
      g.arc(ex * K + k * gap, ey * K + k * gap, width * 1.7, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  const trace = glow ? color : "rgba(150,132,255,0.55)";
  g.fillStyle = trace;
  const buses = 16 + Math.floor(rand() * 4);
  for (let b = 0; b < 26; b++) {
    let x = 0.05 + rand() * 1.5;
    let y = 0.05 + rand() * 1.9;
    const pts = [[x, y]];
    for (let s = 0; s < 4; s++) {
      if (s % 2) y += (rand() - 0.5) * 0.7;
      else x += (rand() - 0.5) * 0.7;
      pts.push([Math.min(1.6, Math.max(0.03, x)), Math.min(2.0, Math.max(0.03, y))]);
    }
    const bright = rand() < 0.4;
    if (glow && !bright) continue;
    bus(pts, 3 + Math.floor(rand() * 7), 7 + rand() * 4, glow ? 2.6 + rand() * 2 : 2.2, glow ? 0.55 + rand() * 0.4 : 0.35 + rand() * 0.35, trace);
  }

  if (!glow) {
    // Vías: agujeros pequeños con anillo
    for (let i = 0; i < 700; i++) {
      const x = rand() * W;
      const y = rand() * H;
      g.fillStyle = "rgba(190,175,255,0.35)";
      g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#0e0a2c";
      g.beginPath(); g.arc(x, y, 1.9, 0, Math.PI * 2); g.fill();
    }
    // Chips pequeños con patillas
    for (let i = 0; i < 14; i++) {
      const x = 80 + rand() * (W - 240);
      const y = 80 + rand() * (H - 240);
      const w = 60 + rand() * 90;
      const h = 44 + rand() * 60;
      g.fillStyle = "#0f0b30";
      g.fillRect(x, y, w, h);
      g.fillStyle = "rgba(200,190,255,0.5)";
      for (let p = 0; p < w; p += 9) { g.fillRect(x + p, y - 6, 4, 6); g.fillRect(x + p, y + h, 4, 6); }
      g.fillStyle = "rgba(255,255,255,0.28)";
      g.fillRect(x + 6, y + 6, 8, 8);
    }
    // Serigrafía: contornos y rótulos de la placa
    g.strokeStyle = "rgba(255,255,255,0.32)";
    g.fillStyle = "rgba(255,255,255,0.4)";
    g.lineWidth = 3;
    g.font = "600 30px ui-monospace, Consolas, monospace";
    const box = (x, y, w, h, label) => {
      g.strokeRect(X(x), Y(y), w * K, h * K);
      if (label) g.fillText(label, X(x) + 8, Y(y) - 10);
    };
    box(-0.9, 1.0, 0.7, 0.7, "CPU_SOCKET");
    box(-1.28, 0.08, 1.5, 0.16, "PCIEX16_1");
    box(-1.25, -0.42, 1.2, 0.1, "PCIEX1_2");
    box(-1.0, 0.36, 0.7, 0.12, "M.2_1");
    box(-0.05, 1.22, 0.3, 0.94, "DDR5_A1 · A2 · B1 · B2");
    g.font = "600 24px ui-monospace, Consolas, monospace";
    g.fillText("ATX PWR", X(0.02), Y(-0.1));
    g.fillText("CPU_FAN", X(-0.4), Y(1.22));
    g.fillText("USB 3.2", X(-1.25), Y(0.55));
    // Tornillos: anillos plateados
    [[-1.25, 1.2], [0.25, 1.2], [-1.25, -0.7], [0.25, -0.7], [-0.55, 0.42]].forEach(([x, y]) => {
      g.strokeStyle = "rgba(220,215,255,0.8)";
      g.lineWidth = 6;
      g.beginPath(); g.arc(X(x), Y(y), 26, 0, Math.PI * 2); g.stroke();
    });
  }
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
  const size = 512;
  const [c, g] = makeCanvas(size, size);
  const texture = finish(c, { srgb: true, repeat: false });
  g.scale(2, 2);      // el dibujo está pensado para 256 × 256
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
