/*
 * Objetos de las maquetas (mesas, sillas, estanterías, monitores, plantas…). Cada uno es una
 * función que devuelve un grupo listo para colocar; si algo se mueve, el grupo lleva una
 * función userData.tick(t, dt) que js/levels.js llama en cada fotograma.
 * Medidas: la sala mide 14 × 14; una mesa alta ≈ 2,7.
 */
import * as THREE from "three";
import { rng } from "./journey-kit.js";

export function createProps(kit) {
  const { C, box, rbox, cyl, cone, ball, torus, plane, grp, mat, glow, canvasTex, decal, screen, roundRect, mesh, halo } = kit;
  const P = {};
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

  // Silla de oficina / gaming. Mira a +Z.
  P.chair = ({ color = C.violet, trim = C.white, gaming = true } = {}) => {
    const g = grp();
    const swivel = grp(0, 0, 0, g);
    rbox(2, 0.4, 2, color, 0, 1.75, 0, swivel, 0.16);
    const back = rbox(2, gaming ? 2.9 : 2.2, 0.42, color, 0, gaming ? 3.35 : 3.0, -0.9, swivel, 0.18);
    back.rotation.x = -0.1;
    if (gaming) {
      rbox(1.2, 0.7, 0.36, trim, 0, 4.55, -1.0, swivel, 0.14).rotation.x = -0.1;
      rbox(0.22, 2.3, 0.46, trim, -0.72, 3.25, -0.86, swivel, 0.08).rotation.x = -0.1;
      rbox(0.22, 2.3, 0.46, trim, 0.72, 3.25, -0.86, swivel, 0.08).rotation.x = -0.1;
    }
    [-1.15, 1.15].forEach((x) => {
      rbox(0.3, 0.26, 1.5, trim, x, 2.55, 0.05, swivel, 0.08);
      rbox(0.2, 0.8, 0.2, C.ink, x, 2.15, -0.3, swivel, 0.06);
    });
    cyl(0.2, 0.2, 1.05, C.ink, 0, 1.15, 0, swivel, 14);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = rbox(1.6, 0.16, 0.24, C.ink, Math.cos(a) * 0.8, 0.45, Math.sin(a) * 0.8, swivel, 0.06);
      leg.rotation.y = -a;
      ball(0.2, C.navy, Math.cos(a) * 1.55, 0.2, Math.sin(a) * 1.55, swivel);
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

  // Monitor con soporte. Mira a +Z.
  P.monitor = ({ w = 3.7, h = 2.1, seed = 5, bezel = C.ink, tex } = {}) => {
    const g = grp();
    rbox(w, h, 0.2, bezel, 0, 1.15 + h / 2, 0, g, 0.1);
    const t = tex || codeTex(seed, false);
    const s = screen(t, w - 0.26, h - 0.26, 0, 1.15 + h / 2, 0.11, g);
    g.userData.screen = s;
    g.userData.tick = (time) => { if (!tex) t.offset.y = (time * 0.03) % 1; };
    cyl(0.14, 0.18, 0.95, C.navy, 0, 0.72, -0.05, g, 12);
    rbox(1.6, 0.14, 1.0, C.navy, 0, 0.18, 0.05, g, 0.06);
    return g;
  };

  P.keyboard = ({ color = C.white } = {}) => {
    const g = grp();
    rbox(2.3, 0.14, 0.78, color, 0, 0.07, 0, g, 0.06);
    const keys = canvasTex(256, 96, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        const n = 14 - (r === 3 ? 4 : 0);
        for (let i = 0; i < n; i++) {
          c.fillStyle = (i + r) % 5 === 0 ? hex(C.lilac) : hex(C.grey);
          const kw = r === 3 && i === 4 ? 100 : 15;
          if (r === 3 && i > 4) break;
          roundRect(c, 8 + i * 17.2 + (r === 3 && i > 4 ? 90 : 0), 8 + r * 21, kw, 15, 4);
          c.fill();
        }
      }
    });
    const d = decal(keys, 2.1, 0.7, 0, 0.16, 0, g);
    d.rotation.x = -Math.PI / 2;
    return g;
  };

  P.mouse = ({ color = C.white } = {}) => {
    const g = grp();
    const m = rbox(0.5, 0.2, 0.8, color, 0, 0.1, 0, g, 0.18);
    rbox(0.06, 0.05, 0.22, C.violet, 0, 0.21, -0.12, g, 0.02);
    return g;
  };

  P.laptop = ({ open = 1.7, seed = 9, color = C.steel } = {}) => {
    const g = grp();
    rbox(2.6, 0.13, 1.8, color, 0, 0.07, 0, g, 0.06);
    const lid = grp(0, 0.13, -0.85, g);
    lid.rotation.x = -open;
    rbox(2.6, 1.75, 0.1, color, 0, 0.87, 0, lid, 0.06);
    screen(codeTex(seed, true), 2.34, 1.5, 0, 0.87, 0.06, lid);
    const kb = canvasTex(128, 64, (c, w, h) => {
      for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) { c.fillStyle = hex(C.grey); roundRect(c, 4 + i * 10, 6 + r * 13, 8, 10, 2); c.fill(); }
    });
    const d = decal(kb, 2.2, 0.85, 0, 0.145, 0.2, g);
    d.rotation.x = -Math.PI / 2;
    return g;
  };

  P.headphones = ({ color = C.coral } = {}) => {
    const g = grp();
    torus(0.55, 0.09, color, 0, 0.6, 0, g).scale.set(1, 1.1, 1);
    [-1, 1].forEach((s) => rbox(0.3, 0.55, 0.5, color, s * 0.55, 0.32, 0, g, 0.12));
    g.rotation.x = -0.1;
    return g;
  };

  P.mug = ({ color = C.white } = {}) => {
    const g = grp();
    cyl(0.3, 0.26, 0.5, color, 0, 0.25, 0, g, 16);
    cyl(0.25, 0.25, 0.02, C.ink, 0, 0.49, 0, g, 16);
    const h = torus(0.16, 0.05, color, 0.32, 0.26, 0, g);
    return g;
  };

  P.phone = ({ color = C.ink, seed = 4 } = {}) => {
    const g = grp();
    rbox(0.95, 1.85, 0.14, color, 0, 0, 0, g, 0.14);
    screen(artTex(seed, [C.violet, C.pink, C.yellow, C.sky]), 0.8, 1.7, 0, 0, 0.08, g);
    return g;
  };

  /* ---------- Luces ---------- */

  P.floorLamp = ({ h = 6.2, shade = C.yellow, color = C.white } = {}) => {
    const g = grp();
    cyl(0.75, 0.85, 0.22, C.navy, 0, 0.11, 0, g, 24);
    cyl(0.07, 0.07, h, color, 0, h / 2, 0, g, 10);
    const cap = cyl(0.55, 1.05, 1.15, shade, 0, h, 0, g, 24);
    cap.material = mat(shade, { rough: 0.6, emissive: shade, emissiveIntensity: 0.55 });
    cyl(0.5, 0.98, 0.02, 0xfff3c8, 0, h - 0.57, 0, g, 24).material = glow(0xfff0b8);
    halo(0xffd27a, 7, 0, h - 0.4, 0, g, 0.5);
    return g;
  };

  P.deskLamp = ({ color = C.coral } = {}) => {
    const g = grp();
    cyl(0.5, 0.55, 0.14, color, 0, 0.07, 0, g, 20);
    cyl(0.06, 0.06, 1.6, color, 0, 0.9, 0, g, 8);
    const arm = cyl(0.05, 0.05, 1.3, color, 0.5, 1.65, 0, g, 8);
    arm.rotation.z = -1.0;
    const head = cone(0.5, 0.7, color, 1.0, 1.95, 0, g, 18);
    head.rotation.z = -2.2;
    ball(0.2, glow(0xfff0b8), 1.18, 1.72, 0, g).castShadow = false;
    halo(0xffd27a, 3.4, 1.2, 1.6, 0, g, 0.55);
    return g;
  };

  /* ---------- Plantas y decoración ---------- */

  P.plant = ({ pot = C.white, leaf = C.leaf, size = 1, kind = "bush" } = {}) => {
    const g = grp();
    cyl(0.75 * size, 0.55 * size, 1.1 * size, pot, 0, 0.55 * size, 0, g, 18);
    cyl(0.68 * size, 0.68 * size, 0.06, 0x4b3a2a, 0, 1.08 * size, 0, g, 18);
    if (kind === "cactus") {
      rbox(0.8 * size, 2.2 * size, 0.8 * size, leaf, 0, 2.1 * size, 0, g, 0.38 * size);
      rbox(0.45 * size, 1.1 * size, 0.45 * size, leaf, 0.7 * size, 2.3 * size, 0, g, 0.2 * size);
      rbox(0.45 * size, 0.6 * size, 0.45 * size, leaf, 0.45 * size, 1.75 * size, 0, g, 0.2 * size);
      rbox(0.4 * size, 0.9 * size, 0.4 * size, leaf, -0.6 * size, 2.5 * size, 0, g, 0.18 * size);
      rbox(0.4 * size, 0.4 * size, 0.4 * size, leaf, -0.4 * size, 1.95 * size, 0, g, 0.18 * size);
      ball(0.2 * size, C.pink, 0, 3.2 * size, 0, g);
    } else {
      const r = rng(11 + Math.floor(size * 10));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + r();
        const len = (1.5 + r() * 1.3) * size;
        const leafM = cone(0.34 * size, len, i % 3 === 0 ? C.green : leaf, Math.cos(a) * 0.35 * size, 1.1 * size + len * 0.45, Math.sin(a) * 0.35 * size, g, 5);
        leafM.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
        leafM.scale.z = 0.5;
      }
    }
    return g;
  };

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
