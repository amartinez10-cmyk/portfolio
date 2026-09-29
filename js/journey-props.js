/*
 * Objetos de las maquetas (mesas, sillas, estanterías, monitores, plantas…). Cada uno es una
 * función que devuelve un grupo listo para colocar; si algo se mueve, el grupo lleva una
 * función userData.tick(t, dt) que js/levels.js llama en cada fotograma.
 * Medidas: la sala mide 14 × 14; una mesa alta ≈ 2,7.
 */
import * as THREE from "three";
import { rng } from "./journey-kit.js";
import { createPlants } from "./journey-plants.js";

export function createProps(kit) {
  const { C, box, rbox, cyl, cone, ball, torus, plane, grp, mat, glow, canvasTex, decal, screen, roundRect, mesh, halo, bar, lathe } = kit;
  const P = {};
  P.plants = createPlants(kit);      // monstera, ficus lira, arbusto redondo, suculenta, cactus, potos…
  const hex = (n) => "#" + n.toString(16).padStart(6, "0");

  /* ---------- Texturas de pantallas y cuadros ---------- */

  // Código de colores que se desplaza: sirve de pantalla para los monitores
  const codeTexCache = new Map();
  function codeTex(seed, tone) {
    const key = seed + "|" + tone;
    if (codeTexCache.has(key)) return codeTexCache.get(key);
    const r = rng(seed);
    const tex = canvasTex(512, 1024, (g, w, h) => {
      g.fillStyle = "#171238";
      g.fillRect(0, 0, w, h);
      const cols = [C.pink, C.yellow, C.sky, C.mint, C.lilac, C.white];
      let y = 24;
      while (y < h - 20) {
        const indent = Math.floor(r() * 4) * 34;
        let x = 30 + indent;
        const n = 2 + Math.floor(r() * 4);
        for (let i = 0; i < n; i++) {
          const len = 30 + Math.floor(r() * 110);
          g.fillStyle = hex(cols[Math.floor(r() * cols.length)]);
          roundRect(g, x, y, len, 14, 7);
          g.fill();
          x += len + 14;
          if (x > w - 60) break;
        }
        y += 34;
      }
      if (tone) {
        g.fillStyle = "rgba(255,255,255,0.05)";
        g.fillRect(0, 0, w, h);
      }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 0.5);
    codeTexCache.set(key, tex);
    return tex;
  }

  // Cuadro abstracto (cada semilla da uno distinto)
  function artTex(seed, palette) {
    const r = rng(seed);
    return canvasTex(256, 256, (g, w, h) => {
      const bg = palette[Math.floor(r() * palette.length)];
      g.fillStyle = hex(bg);
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = hex(palette[Math.floor(r() * palette.length)]);
        const kind = Math.floor(r() * 3);
        if (kind === 0) { g.beginPath(); g.arc(r() * w, r() * h, 30 + r() * 60, 0, 6.3); g.fill(); }
        else if (kind === 1) { g.fillRect(r() * w * 0.6, r() * h * 0.6, 50 + r() * 110, 40 + r() * 100); }
        else { g.beginPath(); g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.fill(); }
      }
    });
  }

  /* ---------- Muebles ---------- */

  // Mesa de escritorio. Mira a +Z (el frente). Origen en el suelo, centrada.
  P.desk = ({ w = 8, d = 3, h = 2.7, top = C.wood, body = C.white, accent = C.lilac } = {}) => {
    const g = grp();
    rbox(w, 0.32, d, top, 0, h - 0.16, 0, g, 0.1);
    rbox(0.3, h - 0.3, d - 0.3, body, -w / 2 + 0.35, (h - 0.3) / 2, 0, g, 0.06);
    rbox(2.3, h - 0.3, d - 0.3, body, w / 2 - 1.35, (h - 0.3) / 2, 0, g, 0.08);
    for (let i = 0; i < 2; i++) {
      rbox(2.0, 0.78, 0.08, accent, w / 2 - 1.35, 0.55 + i * 0.95, d / 2 - 0.13, g, 0.05);
      rbox(0.7, 0.09, 0.09, C.white, w / 2 - 1.35, 0.55 + i * 0.95 + 0.15, d / 2 - 0.05, g, 0.04);
    }
    return g;
  };

  // Mesa baja redonda o rectangular
  P.table = ({ w = 3.6, d = 2.4, h = 1.2, top = C.white, legs = C.lilac, round = false } = {}) => {
    const g = grp();
    if (round) cyl(w / 2, w / 2, 0.24, top, 0, h - 0.12, 0, g);
    else rbox(w, 0.26, d, top, 0, h - 0.13, 0, g, 0.1);
    const lx = w / 2 - 0.35;
    const lz = (round ? w : d) / 2 - 0.35;
    if (round) cyl(0.18, 0.4, h - 0.2, legs, 0, (h - 0.2) / 2, 0, g);
    else [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => cyl(0.14, 0.11, h - 0.24, legs, sx * lx, (h - 0.24) / 2, sz * lz, g, 10));
    return g;
  };

  // Silla gaming / de oficina con respaldo inclinado, alas laterales, cojines, reposabrazos, pistón y base
  // de cinco brazos con ruedas. Mira a +Z.
  P.chair = ({ color = C.violet, trim = C.white, gaming = true } = {}) => {
    const g = grp();
    const swivel = grp(0, 0, 0, g);
    const dark = new THREE.Color(color).offsetHSL(0, 0, -0.1).getHex();
    const seatY = 1.9;
    // Asiento: base, centro más claro y dos alas laterales
    rbox(2.15, 0.44, 2.05, color, 0, seatY, 0.05, swivel, 0.2);
    rbox(1.2, 0.1, 1.55, trim, 0, seatY + 0.21, 0.18, swivel, 0.05);
    [-1, 1].forEach((sd) => rbox(0.34, 0.34, 1.95, dark, sd * 0.93, seatY + 0.16, 0.05, swivel, 0.15));
    // Respaldo inclinado hacia atrás
    const back = grp(0, seatY + 0.22, -0.92, swivel);
    back.rotation.x = -0.14;
    const bh = gaming ? 3.1 : 2.3;
    rbox(1.95, bh, 0.42, color, 0, bh / 2 + 0.05, 0, back, 0.22);
    rbox(0.5, bh * 0.82, 0.07, trim, 0, bh * 0.5, 0.23, back, 0.03);
    [-1, 1].forEach((sd) => rbox(0.36, bh * 0.66, 0.56, dark, sd * 0.84, bh * 0.44, 0.06, back, 0.16));
    rbox(1.15, 0.5, 0.32, trim, 0, bh * 0.3, 0.32, back, 0.16);      // cojín lumbar
    if (gaming) rbox(1.05, 0.62, 0.34, trim, 0, bh + 0.28, 0.14, back, 0.18);   // cojín del cuello
    // Reposabrazos
    [-1, 1].forEach((sd) => {
      rbox(0.22, 0.95, 0.24, C.ink, sd * 1.22, seatY + 0.55, -0.2, swivel, 0.07);
      rbox(0.36, 0.15, 1.25, C.ink, sd * 1.22, seatY + 1.06, 0.1, swivel, 0.07);
    });
    // Pistón, tapa y base de cinco brazos con ruedas
    cyl(0.34, 0.26, 0.42, C.ink, 0, seatY - 0.4, 0, swivel, 18);
    cyl(0.14, 0.14, 1.05, C.steel, 0, 1.15, 0, swivel, 14);
    cyl(0.32, 0.4, 0.3, C.ink, 0, 0.62, 0, swivel, 18);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      bar([0, 0.6, 0], [Math.cos(a) * 1.5, 0.36, Math.sin(a) * 1.5], 0.12, C.ink, swivel, 10, 0.09);
      const wx = Math.cos(a) * 1.55;
      const wz = Math.sin(a) * 1.55;
      cyl(0.09, 0.09, 0.2, C.steel, wx, 0.3, wz, swivel, 8);
      const wheel = cyl(0.19, 0.19, 0.16, C.navy, wx, 0.19, wz, swivel, 14);
      wheel.rotation.z = Math.PI / 2;
      wheel.rotation.y = -a;
    }
    g.userData.swivel = swivel;
    return g;
  };

  // Sofá de tres plazas con cojines. Mira a +Z.
  P.sofa = ({ w = 7.6, color = C.orange, cushions = [C.blue, C.pink, C.white] } = {}) => {
    const g = grp();
    rbox(w, 1.1, 3.1, color, 0, 0.75, 0, g, 0.3);
    rbox(w, 2.5, 0.95, color, 0, 2.05, -1.1, g, 0.35);
    [-1, 1].forEach((s) => rbox(1, 2.1, 3.1, color, s * (w / 2 - 0.5), 1.5, 0, g, 0.35));
    const n = 2;
    for (let i = 0; i < n; i++) {
      rbox((w - 2.2) / n - 0.1, 0.55, 2.3, new THREE.Color(color).offsetHSL(0, 0, 0.07).getHex(), -((w - 2.2) / 2) + (i + 0.5) * ((w - 2.2) / n), 1.5, 0.35, g, 0.22);
    }
    cushions.forEach((c, i) => {
      const cu = rbox(1.35, 1.35, 0.5, c, (i - 1) * 1.55 - (w / 2 - 2.2) * 0.4, 2.2, -0.35, g, 0.22);
      cu.rotation.set(-0.35, (i - 1) * 0.4, (i - 1) * 0.25);
    });
    [-1, 1].forEach((s) => cyl(0.16, 0.12, 0.3, C.ink, s * (w / 2 - 0.4), 0.15, 1.2, g, 10));
    return g;
  };

  // Estantería llena de libros y objetos. El frente mira a +X (para ir contra la pared izquierda).
  P.bookshelf = ({ w = 6.4, h = 4.4, d = 1.5, rows = 3, seed = 3, body = C.white, items = [] } = {}) => {
    const g = grp();
    const r = rng(seed);
    // Marco abierto por delante: fondo, dos laterales y las baldas
    rbox(0.2, h, w, mat(0x6a58c0, { rough: 0.9 }), -d / 2 + 0.1, h / 2, 0, g, 0.04);
    [-1, 1].forEach((s) => rbox(d, h, 0.24, body, 0, h / 2, s * (w / 2 - 0.12), g, 0.08));
    const gap = (h - 0.4) / rows;
    for (let i = 0; i <= rows; i++) rbox(d, 0.22, w - 0.2, body, 0, 0.2 + i * gap, 0, g, 0.06);
    const cols = [C.pink, C.yellow, C.sky, C.mint, C.coral, C.lilac, C.blue, C.orange, C.white];
    for (let row = 0; row < rows; row++) {
      let z = -w / 2 + 0.45;
      const y0 = 0.31 + row * gap;
      while (z < w / 2 - 1.2) {
        const bw = 0.26 + r() * 0.3;
        const bh = gap * (0.55 + r() * 0.32);
        const b = rbox(d * 0.62, bh, bw, cols[Math.floor(r() * cols.length)], 0.15, y0 + bh / 2, z + bw / 2, g, 0.04);
        if (r() < 0.14) { b.rotation.x = 0.22; b.position.y -= 0.02; z += 0.3; }
        z += bw + 0.03;
        if (r() < 0.12) z += 0.55 + r() * 0.5;   // hueco entre libros
      }
    }
    items.forEach((it) => {
      it.obj.position.set(0.15, 0.3 + it.row * gap, it.z);
      g.add(it.obj);
    });
    return g;
  };

  // Alfombra rectangular o redonda
  P.rug = ({ w = 6, d = 4, color = C.pink, border = C.white, round = false } = {}) => {
    const g = grp();
    if (round) {
      cyl(w / 2, w / 2, 0.08, border, 0, 0.05, 0, g, 40);
      cyl(w / 2 - 0.35, w / 2 - 0.35, 0.1, color, 0, 0.06, 0, g, 40);
    } else {
      rbox(w, 0.08, d, border, 0, 0.05, 0, g, 0.04);
      rbox(w - 0.7, 0.1, d - 0.7, color, 0, 0.06, 0, g, 0.04);
    }
    g.children.forEach((m) => { m.castShadow = false; });
    g.userData.noHover = true;
    return g;
  };

  /* ---------- Electrónica ---------- */

  // Monitor de marco fino con carcasa trasera, cuello inclinado y peana ovalada. Mira a +Z.
  let sheenTex = null;
  P.monitor = ({ w = 3.7, h = 2.1, seed = 5, bezel = C.ink, tex } = {}) => {
    const g = grp();
    const y0 = 1.08;
    const cy = y0 + h / 2;
    rbox(w, h, 0.13, bezel, 0, cy, 0, g, 0.06);                                   // marco fino
    rbox(w * 0.6, h * 0.62, 0.17, 0x241f52, 0, cy + 0.04, -0.13, g, 0.07);       // abultamiento trasero
    const t = tex || codeTex(seed, false);
    const s = screen(t, w - 0.17, h - 0.19, 0, cy + 0.015, 0.07, g);
    g.userData.screen = s;
    g.userData.tick = (time) => { if (!tex) t.offset.y = (time * 0.03) % 1; };
    if (!sheenTex) {
      sheenTex = canvasTex(128, 128, (c, ww, hh) => {
        const grad = c.createLinearGradient(0, 0, ww, hh);
        grad.addColorStop(0, "rgba(255,255,255,0.0)");
        grad.addColorStop(0.35, "rgba(255,255,255,0.13)");
        grad.addColorStop(0.5, "rgba(255,255,255,0.03)");
        grad.addColorStop(1, "rgba(255,255,255,0.0)");
        c.fillStyle = grad;
        c.fillRect(0, 0, ww, hh);
      });
    }
    decal(sheenTex, w - 0.17, h - 0.19, 0, cy + 0.015, 0.075, g);                 // reflejo en el cristal
    ball(0.035, glow(0x66ffb0), w / 2 - 0.35, y0 + 0.055, 0.07, g).castShadow = false;   // led de encendido
    // Soporte: cuello algo inclinado hacia atrás y peana ovalada
    const neck = rbox(0.34, 1.1, 0.1, C.steel, 0, y0 - 0.38, -0.2, g, 0.05);
    neck.rotation.x = 0.08;
    rbox(0.5, 0.42, 0.14, C.steel, 0, y0 + 0.12, -0.12, g, 0.06);
    const base = cyl(1.0, 1.0, 0.07, C.steel, 0, 0.035, -0.02, g, 32);
    base.scale.set(1, 1, 0.6);
    return g;
  };

  // Teclado con teclas de verdad (6 filas, letras y modificadores), algo inclinado y con tira RGB.
  let keysTexture = null;
  function keysTex() {
    if (keysTexture) return keysTexture;
    keysTexture = canvasTex(1536, 624, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const u = w / 15.2;
      const gap = u * 0.09;
      const font = '600 ' + Math.round(u * 0.34) + 'px "Outfit", "Segoe UI", system-ui, sans-serif';
      // Definición sencilla: [texto, ancho en unidades, tono]
      const layout = [
        { y: 0.0, h: 0.8, keys: [["Esc", 1, 1], [null, 0.55], ["F1", 1], ["F2", 1], ["F3", 1], ["F4", 1], [null, 0.35], ["F5", 1], ["F6", 1], ["F7", 1], ["F8", 1], [null, 0.35], ["F9", 1], ["F10", 1], ["F11", 1], ["F12", 1], [null, 0.4], ["Del", 1.15, 1]] },
        { y: 1.05, h: 1, keys: "` 1 2 3 4 5 6 7 8 9 0 - =".split(" ").map((t) => [t, 1]).concat([["⌫", 2, 1]]) },
        { y: 2.1, h: 1, keys: [["Tab", 1.5, 1]].concat("Q W E R T Y U I O P [ ]".split(" ").map((t) => [t, 1]), [["\\", 1.5]]) },
        { y: 3.15, h: 1, keys: [["Caps", 1.75, 1]].concat("A S D F G H J K L ; '".split(" ").map((t) => [t, 1]), [["Enter", 2.25, 1]]) },
        { y: 4.2, h: 1, keys: [["Shift", 2.25, 1]].concat("Z X C V B N M , . /".split(" ").map((t) => [t, 1]), [["Shift", 2.75, 1]]) },
        { y: 5.25, h: 1, keys: [["Ctrl", 1.25, 1], ["Win", 1.25, 1], ["Alt", 1.25, 1], ["", 6.25], ["Alt", 1.25, 1], ["Fn", 1.25, 1], ["Ctrl", 1.25, 1], [null, 0.0]] }
      ];
      layout.forEach((row) => {
        let x = 0;
        row.keys.forEach(([label, wu, dark]) => {
          if (label === null) { x += wu; return; }
          const kx = x * u + gap / 2;
          const ky = row.y * u + gap / 2;
          const kw = wu * u - gap;
          const kh = row.h * u - gap;
          // sombra, cuerpo de la tecla y brillo del borde superior
          c.fillStyle = "rgba(30,20,90,0.35)";
          roundRect(c, kx, ky + u * 0.05, kw, kh, u * 0.14); c.fill();
          c.fillStyle = dark ? hex(C.lilac) : "#f7f4ff";
          roundRect(c, kx, ky, kw, kh - u * 0.04, u * 0.14); c.fill();
          c.fillStyle = dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.9)";
          roundRect(c, kx + u * 0.06, ky + u * 0.05, kw - u * 0.12, kh * 0.5, u * 0.1); c.fill();
          if (label) {
            c.fillStyle = dark ? "#2a2361" : "#4a3a99";
            c.font = font;
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText(label, kx + kw / 2, ky + kh / 2 - u * 0.03);
          }
          x += wu;
        });
      });
    });
    return keysTexture;
  }

  P.keyboard = ({ color = C.white, rgb = 0xff7eb6 } = {}) => {
    const g = grp();
    const body = grp(0, 0, 0, g);
    body.rotation.x = 0.06;
    rbox(2.7, 0.2, 1.12, color, 0, 0.13, 0, body, 0.08);
    rbox(2.56, 0.05, 0.98, 0x3b3380, 0, 0.245, 0, body, 0.04);
    const keys = decal(keysTex(), 2.48, 1.0, 0, 0.275, 0.02, body);
    keys.rotation.x = -Math.PI / 2;
    box(2.6, 0.025, 0.03, glow(rgb), 0, 0.09, 0.57, body).castShadow = false;
    return g;
  };

  // Ratón ergonómico: cuerpo ovalado, botones separados, rueda y franja de color. Los botones miran a -Z.
  P.mouse = ({ color = C.white, accent = C.violet } = {}) => {
    const g = grp();
    const body = mesh(new THREE.SphereGeometry(1, 28, 18), color, 0, 0.06, 0, g);
    body.scale.set(0.33, 0.2, 0.52);
    box(0.014, 0.012, 0.3, 0x2a2361, 0, 0.255, -0.26, g).castShadow = false;
    box(0.5, 0.012, 0.014, 0x2a2361, 0, 0.245, -0.11, g).castShadow = false;
    const wheel = cyl(0.045, 0.045, 0.07, accent, 0, 0.27, -0.2, g, 12);
    wheel.rotation.z = Math.PI / 2;
    [-1, 1].forEach((sd) => box(0.012, 0.06, 0.24, accent, sd * 0.31, 0.11, 0.04, g).castShadow = false);
    return g;
  };

  // Alfombrilla grande de escritorio, con borde cosido
  P.deskMat = ({ w = 5.6, d = 2.2, color = C.navy, edge = C.violet } = {}) => {
    const g = grp();
    rbox(w, 0.05, d, edge, 0, 0.025, 0, g, 0.03).castShadow = false;
    rbox(w - 0.14, 0.055, d - 0.14, color, 0, 0.03, 0, g, 0.03).castShadow = false;
    g.userData.noHover = true;
    return g;
  };

  // Portátil de aluminio: base fina con teclado y trackpad, bisagra, tapa con marco negro y cámara
  let deckTexture = null;
  function deckTex() {
    if (deckTexture) return deckTexture;
    deckTexture = canvasTex(768, 384, (c, w, h) => {
      c.fillStyle = "rgba(0,0,0,0)";
      c.clearRect(0, 0, w, h);
      const rows = [14, 14, 13, 12, 11];
      rows.forEach((n, r) => {
        const kw = (w - 60) / 14;
        const off = (14 - n) * kw / 2;
        for (let i = 0; i < n; i++) {
          c.fillStyle = "rgba(60,50,120,0.35)";
          roundRect(c, 30 + off + i * kw + 3, 24 + r * 38 + 3, kw - 6, 32, 6); c.fill();
          c.fillStyle = "#3a3170";
          roundRect(c, 30 + off + i * kw + 3, 24 + r * 38, kw - 6, 32, 6); c.fill();
        }
      });
      c.fillStyle = "rgba(255,255,255,0.14)";
      roundRect(c, w / 2 - 110, 230, 220, 120, 12); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.28)";
      c.lineWidth = 2;
      roundRect(c, w / 2 - 110, 230, 220, 120, 12); c.stroke();
    });
    return deckTexture;
  }

  P.laptop = ({ tilt = 0.3, seed = 9, color = C.steel } = {}) => {
    const g = grp();
    rbox(2.7, 0.1, 1.85, color, 0, 0.06, 0, g, 0.05);
    const deck = decal(deckTex(), 2.4, 1.2, 0, 0.115, -0.15, g);
    deck.rotation.x = -Math.PI / 2;
    cyl(0.05, 0.05, 2.3, 0xaba6cf, 0, 0.11, -0.9, g, 8).rotation.z = Math.PI / 2;          // bisagra
    const lid = grp(0, 0.11, -0.9, g);
    lid.rotation.x = -tilt;      // la tapa se inclina un poco hacia atrás desde la vertical
    rbox(2.7, 1.8, 0.07, color, 0, 0.92, 0, lid, 0.05);
    rbox(2.6, 1.7, 0.02, 0x14102e, 0, 0.92, 0.04, lid, 0.03);                                  // marco negro
    screen(codeTex(seed, true), 2.44, 1.52, 0, 0.9, 0.056, lid);
    ball(0.025, 0x222244, 0, 1.75, 0.055, lid).castShadow = false;                            // cámara
    return g;
  };

  // Cascos cerrados colgados de su soporte: diadema acolchada, arcos, auriculares con almohadillas.
  P.headphones = ({ color = C.coral } = {}) => {
    const g = grp();
    const light = new THREE.Color(color).offsetHSL(0, 0, 0.16).getHex();
    // Soporte
    cyl(0.5, 0.56, 0.1, C.navy, 0, 0.05, 0, g, 28);
    bar([0, 0.08, 0], [0, 1.85, 0], 0.05, C.steel, g, 10);
    const cap = ball(0.15, C.navy, 0, 1.92, 0, g);
    cap.scale.y = 0.7;
    // Cascos: el punto más alto de la diadema apoya en el soporte
    const hp = grp(0, 2.04, 0, g);
    const R = 0.66;
    const band = mesh(new THREE.TorusGeometry(R, 0.06, 10, 40, Math.PI * 1.06), color, 0, -R, 0, hp);
    band.rotation.z = Math.PI * -0.03;
    band.scale.z = 2.3;
    const pad = mesh(new THREE.TorusGeometry(R - 0.03, 0.075, 10, 24, Math.PI * 0.42), C.cream, 0, -R, 0, hp);
    pad.rotation.z = Math.PI / 2 - Math.PI * 0.21;
    pad.scale.z = 2.0;
    [-1, 1].forEach((sd) => {
      // Arco y auricular, ligeramente girado hacia dentro
      rbox(0.07, 0.42, 0.15, 0xaba6cf, sd * (R + 0.02), -R - 0.2, 0, hp, 0.03);
      const cup = grp(sd * (R + 0.06), -R - 0.6, 0, hp);
      cup.rotation.z = -sd * 0.12;
      const shell = cyl(0.43, 0.43, 0.26, color, 0, 0, 0, cup, 32);
      shell.rotation.z = Math.PI / 2;
      const plate = cyl(0.33, 0.33, 0.05, light, sd * 0.15, 0, 0, cup, 32);
      plate.rotation.z = Math.PI / 2;
      const ring = torus(0.27, 0.022, glow(0xffffff), sd * 0.18, 0, 0, cup);
      ring.rotation.y = Math.PI / 2;
      ring.castShadow = false;
      const cushion = torus(0.34, 0.11, C.cream, -sd * 0.2, 0, 0, cup);
      cushion.rotation.y = Math.PI / 2;
    });
    return g;
  };

  // Taza de cerámica hueca con café dentro y asa
  P.mug = ({ color = C.white } = {}) => {
    const g = grp();
    lathe([[0.001, 0], [0.24, 0], [0.29, 0.05], [0.33, 0.55], [0.3, 0.55], [0.275, 0.5], [0.255, 0.14], [0.001, 0.14]], color, 0, 0, 0, g, 28);
    const coffee = cyl(0.27, 0.27, 0.01, 0x4a2a1c, 0, 0.44, 0, g, 28);
    coffee.material = mat(0x4a2a1c, { rough: 0.25 });
    coffee.castShadow = false;
    const handle = torus(0.17, 0.05, color, 0.36, 0.3, 0, g);
    handle.scale.set(0.85, 1.1, 1);
    // Hilos de vapor
    const steam = [0, 1, 2].map((i) => {
      const s = ball(0.055, 0xffffff, (i - 1) * 0.1, 0.75, 0, g);
      s.material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
      s.castShadow = false;
      return s;
    });
    g.userData.tick = (t) => {
      steam.forEach((s, i) => {
        const k = (t * 0.4 + i / 3) % 1;
        s.position.set((i - 1) * 0.1 + Math.sin(t * 2 + i * 2) * 0.05, 0.6 + k * 0.7, 0);
        s.scale.setScalar(0.7 + k * 1.4);
        s.material.opacity = 0.4 * (1 - k);
      });
    };
    return g;
  };

  P.phone = ({ color = C.ink, seed = 4 } = {}) => {
    const g = grp();
    rbox(0.95, 1.85, 0.14, color, 0, 0, 0, g, 0.14);
    screen(artTex(seed, [C.violet, C.pink, C.yellow, C.sky]), 0.8, 1.7, 0, 0, 0.08, g);
    return g;
  };

  /* ---------- Luces ---------- */

  // Lámpara de pie: base pesada, varilla fina y pantalla de tambor de tela que brilla por dentro
  P.floorLamp = ({ h = 6.2, shade = C.yellow } = {}) => {
    const g = grp();
    cyl(0.85, 0.95, 0.14, C.navy, 0, 0.07, 0, g, 32);
    cyl(0.16, 0.2, 0.16, C.steel, 0, 0.22, 0, g, 16);
    bar([0, 0.2, 0], [0, h - 0.9, 0], 0.05, C.steel, g, 10);
    // Pantalla
    const cy = h - 0.35;
    const cloth = mat(shade, { emissive: shade, emissiveIntensity: 0.42, side: THREE.DoubleSide, rough: 0.95 });
    const drum = mesh(new THREE.CylinderGeometry(0.95, 1.12, 1.35, 40, 1, true), cloth, 0, cy, 0, g, false);
    drum.castShadow = true;
    [[0.95, 0.68], [1.12, -0.68]].forEach(([r, y]) => {
      const ring = torus(r, 0.025, C.steel, 0, cy + y, 0, g, true);
      ring.castShadow = false;
    });
    // Varillas del armazón hasta el casquillo
    [0, 1, 2].forEach((i) => {
      const a = (i / 3) * Math.PI * 2;
      bar([0, cy + 0.66, 0], [Math.cos(a) * 0.93, cy + 0.68, Math.sin(a) * 0.93], 0.012, C.steel, g, 5).castShadow = false;
    });
    cyl(0.07, 0.07, 0.2, C.steel, 0, cy + 0.6, 0, g, 8);
    // Bombilla y resplandor
    ball(0.24, glow(0xfff1c0), 0, cy - 0.1, 0, g).castShadow = false;
    kit.halo(0xffd27a, 8.5, 0, cy - 0.05, 0, g, 0.42);
    return g;
  };

  // Lámpara de escritorio articulada (estilo flexo): base, brazo doble, codo, brazo alto y pantalla en cúpula
  P.deskLamp = ({ color = C.coral } = {}) => {
    const g = grp();
    cyl(0.5, 0.56, 0.12, C.ink, 0, 0.06, 0, g, 30);
    cyl(0.2, 0.24, 0.12, color, 0, 0.18, 0, g, 18);
    ball(0.13, C.steel, 0, 0.3, 0, g);
    const knee = [-0.42, 1.65, 0];
    const top = [0.55, 2.3, 0];
    [0, 0.09].forEach((dz) => bar([0, 0.3, dz - 0.045], [knee[0], knee[1], knee[2] + dz - 0.045], 0.026, color, g, 8));   // brazo bajo (doble varilla)
    ball(0.12, C.steel, knee[0], knee[1], knee[2], g);
    bar(knee, top, 0.045, color, g, 8);                                                                                     // brazo alto
    // Cabeza: cúpula abierta por abajo hacia delante, bombilla y resplandor
    const head = grp(top[0], top[1], top[2], g);
    head.rotation.z = 0.85;
    const dome = mesh(new THREE.SphereGeometry(0.48, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, { side: THREE.DoubleSide, rough: 0.5 }), 0, 0.05, 0, head);
    cyl(0.06, 0.06, 0.2, C.steel, 0, 0.5, 0, head, 8);
    ball(0.17, glow(0xfff1c0), 0, -0.03, 0, head).castShadow = false;
    kit.halo(0xffd27a, 3.4, 0, -0.15, 0, head, 0.5);
    return g;
  };

  /* ---------- Plantas y decoración ---------- */

  // Cuadro colgado. Mira a +Z.
  P.frame = ({ w = 2.6, h = 3.2, frame = C.white, seed = 1, palette = [C.violet, C.pink, C.yellow, C.sky], tex } = {}) => {
    const g = grp();
    rbox(w, h, 0.22, frame, 0, 0, 0, g, 0.08);
    screen(tex || artTex(seed, palette), w - 0.42, h - 0.42, 0, 0, 0.12, g).material.toneMapped = true;
    return g;
  };

  // Reloj de pared con manecillas que se mueven
  P.clock = ({ r = 1.1, face = C.white, rim = C.yellow } = {}) => {
    const g = grp();
    const body = cyl(r, r, 0.22, rim, 0, 0, 0, g, 40);
    body.rotation.x = Math.PI / 2;
    const f = cyl(r * 0.86, r * 0.86, 0.06, face, 0, 0, 0.13, g, 40);
    f.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rbox(0.06, i % 3 === 0 ? 0.22 : 0.12, 0.04, C.ink, Math.sin(a) * r * 0.7, Math.cos(a) * r * 0.7, 0.18, g, 0.02).rotation.z = -a;
    }
    const hour = grp(0, 0, 0.2, g);
    rbox(0.09, r * 0.45, 0.04, C.ink, 0, r * 0.2, 0, hour, 0.02);
    const min = grp(0, 0, 0.23, g);
    rbox(0.06, r * 0.68, 0.04, C.navy, 0, r * 0.32, 0, min, 0.02);
    const sec = grp(0, 0, 0.26, g);
    rbox(0.03, r * 0.72, 0.03, C.red, 0, r * 0.26, 0, sec, 0.01);
    ball(0.07, C.red, 0, 0, 0.27, g);
    g.userData.tick = (t) => {
      hour.rotation.z = -t * 0.02;
      min.rotation.z = -t * 0.25;
      sec.rotation.z = -t * 1.5;
    };
    return g;
  };

  P.crate = ({ s = 1.6, color = C.wood, band = C.woodDark } = {}) => {
    const g = grp();
    rbox(s, s, s, color, 0, s / 2, 0, g, 0.08);
    rbox(s + 0.04, 0.16, s + 0.04, band, 0, s * 0.18, 0, g, 0.04);
    rbox(s + 0.04, 0.16, s + 0.04, band, 0, s * 0.82, 0, g, 0.04);
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => rbox(0.16, s + 0.04, 0.16, band, sx * s * 0.45, s / 2, sz * s * 0.45, g, 0.04)));
    return g;
  };

  // Pila de libros
  P.books = ({ n = 4, seed = 2 } = {}) => {
    const g = grp();
    const r = rng(seed);
    const cols = [C.pink, C.yellow, C.sky, C.mint, C.coral, C.lilac];
    let y = 0;
    for (let i = 0; i < n; i++) {
      const h = 0.28 + r() * 0.16;
      const b = rbox(1.5 + r() * 0.5, h, 1.05 + r() * 0.25, cols[Math.floor(r() * cols.length)], (r() - 0.5) * 0.14, y + h / 2, (r() - 0.5) * 0.1, g, 0.05);
      b.rotation.y = (r() - 0.5) * 0.35;
      y += h;
    }
    return g;
  };

  return { P, codeTex, artTex, hex };
}
