/*
 * Objetos especiales de los niveles Currículum, Certificados, Proyectos, 7 HHEP y Contacto:
 * trofeos, podio, impresora 3D, dron, telescopio, portal a una galaxia, buzón, antena…
 * Igual que journey-props.js: cada uno devuelve un grupo listo para colocar, y si algo se mueve
 * lleva una función userData.tick(t, dt).
 */
import * as THREE from "three";
import { rng } from "./journey-kit.js";
import { CV_PHOTO } from "./cv-photo.js";

export function createProps2(kit, base) {
  const { C, box, rbox, cyl, cone, ball, torus, plane, grp, mat, glow, canvasTex, decal, screen, roundRect, mesh } = kit;
  const { hex } = base;
  const Q = {};
  const gold = () => mat(C.gold, { rough: 0.3, metal: 0.5, emissive: 0x7a5200, emissiveIntensity: 0.45 });

  const fontStack = '"Outfit", "Avenir Next", "Segoe UI", system-ui, sans-serif';

  /* ---------- Premios ---------- */

  Q.trophy = ({ s = 1, color = C.gold } = {}) => {
    const g = grp();
    const metal = mat(color, { rough: 0.3, metal: 0.5, emissive: color, emissiveIntensity: 0.16 });
    rbox(1.8 * s, 0.42 * s, 1.8 * s, C.navy, 0, 0.21 * s, 0, g, 0.1 * s);
    rbox(1.3 * s, 0.22 * s, 1.3 * s, C.plum, 0, 0.5 * s, 0, g, 0.06 * s);
    cyl(0.28 * s, 0.42 * s, 0.9 * s, metal, 0, 1.1 * s, 0, g, 18);
    const prof = [[0.01, 0], [0.32, 0.06], [0.5, 0.45], [0.82, 1.2], [0.92, 1.72], [0.8, 1.74], [0.7, 1.25], [0.4, 0.55], [0.01, 0.4]]
      .map(([x, y]) => new THREE.Vector2(x * s, y * s));
    const cup = mesh(new THREE.LatheGeometry(prof, 28), mat(color, { rough: 0.3, metal: 0.5, emissive: color, emissiveIntensity: 0.16, side: THREE.DoubleSide }), 0, 1.55 * s, 0, g);
    [-1, 1].forEach((sx) => {
      const h = torus(0.42 * s, 0.075 * s, metal, sx * 0.98 * s, 2.55 * s, 0, g);
      h.scale.set(0.8, 1, 1);
    });
    ball(0.16 * s, C.red, 0, 1.6 * s + 1.0 * s, 0.86 * s, g);
    return g;
  };

  Q.medal = ({ s = 1, ribbon = C.red } = {}) => {
    const g = grp();
    [-1, 1].forEach((sx) => {
      const r = rbox(0.42 * s, 1.6 * s, 0.06 * s, ribbon, sx * 0.22 * s, 0.7 * s, 0, g, 0.02);
      r.rotation.z = sx * 0.22;
    });
    const disc = cyl(0.62 * s, 0.62 * s, 0.14 * s, gold(), 0, -0.25 * s, 0, g, 30);
    disc.rotation.x = Math.PI / 2;
    const inner = cyl(0.44 * s, 0.44 * s, 0.18 * s, C.yellow, 0, -0.25 * s, 0, g, 30);
    inner.rotation.x = Math.PI / 2;
    return g;
  };

  function starGeometry(outer, inner, depth) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? inner : outer;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 });
    geo.center();
    return geo;
  }

  Q.star = ({ r = 1.2, color = C.gold } = {}) => {
    const g = grp();
    const m = mesh(starGeometry(r, r * 0.46, r * 0.32), mat(color, { rough: 0.35, metal: 0.4, emissive: color, emissiveIntensity: 0.3 }), 0, 0, 0, g);
    g.userData.tick = (t) => { m.rotation.y = t * 1.1; m.position.y = Math.sin(t * 1.6) * 0.18; };
    return g;
  };

  // Podio de tres puestos con su número en el frente. Mira a +Z.
  Q.podium = () => {
    const g = grp();
    const numTex = (n) => canvasTex(128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.font = "800 100px " + fontStack;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "rgba(20,8,70,0.25)";
      c.fillText(String(n), 66, 70);
      c.fillStyle = "#ffffff";
      c.fillText(String(n), 64, 66);
    });
    [[-2.3, 2.1, 2, C.pink], [0, 3.1, 1, C.violet], [2.3, 1.5, 3, C.sky]].forEach(([x, h, n, color]) => {
      rbox(2.2, h, 2.2, color, x, h / 2, 0, g, 0.16);
      rbox(2.3, 0.14, 2.3, C.white, x, h + 0.02, 0, g, 0.06);
      decal(numTex(n), Math.min(1.5, h * 0.7), Math.min(1.5, h * 0.7), x, h * 0.5, 1.11, g);
    });
    return g;
  };

  // Diploma con marco. Mira a +Z.
  const certCache = new Map();
  function certTex(seed) {
    if (certCache.has(seed)) return certCache.get(seed);
    const r = rng(seed);
    const tex = canvasTex(320, 240, (c, w, h) => {
      c.fillStyle = "#fffaf0";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = hex(C.gold);
      c.lineWidth = 8;
      c.strokeRect(10, 10, w - 20, h - 20);
      c.strokeStyle = hex(C.yellow);
      c.lineWidth = 2;
      c.strokeRect(22, 22, w - 44, h - 44);
      c.fillStyle = hex(C.navy);
      roundRect(c, w / 2 - 70, 44, 140, 14, 7);
      c.fill();
      c.fillStyle = "#cfc7ea";
      for (let i = 0; i < 4; i++) { roundRect(c, 60 + r() * 20, 84 + i * 22, 200 - r() * 60, 9, 4.5); c.fill(); }
      c.fillStyle = hex(C.red);
      c.beginPath(); c.arc(w / 2, h - 62, 24, 0, 6.3); c.fill();
      c.fillStyle = hex(C.gold);
      c.beginPath(); c.arc(w / 2, h - 62, 16, 0, 6.3); c.fill();
      c.fillStyle = hex(C.red);
      c.fillRect(w / 2 - 20, h - 42, 12, 30);
      c.fillRect(w / 2 + 8, h - 42, 12, 30);
    });
    certCache.set(seed, tex);
    return tex;
  }

  Q.cert = ({ w = 3.2, h = 2.4, seed = 1, frame = C.navy } = {}) => {
    const g = grp();
    rbox(w, h, 0.2, frame, 0, 0, 0, g, 0.08);
    screen(certTex(seed), w - 0.3, h - 0.3, 0, 0, 0.11, g).material.toneMapped = true;
    return g;
  };

  // Estante con trofeos (frente a +X)
  Q.trophyShelf = ({ w = 6, h = 4.2, d = 1.5 } = {}) => {
    const g = grp();
    rbox(0.2, h, w, mat(0x5a4ab0, { rough: 0.9 }), -d / 2 + 0.1, h / 2, 0, g, 0.04);
    [-1, 1].forEach((s) => rbox(d, h, 0.24, C.white, 0, h / 2, s * (w / 2 - 0.12), g, 0.08));
    [0.2, h / 2, h - 0.2].forEach((y) => rbox(d, 0.22, w - 0.2, C.white, 0, y, 0, g, 0.06));
    const t1 = Q.trophy({ s: 0.42 });
    t1.position.set(0.25, h / 2 + 0.11, -1.7);
    const t2 = Q.trophy({ s: 0.34, color: C.orange });
    t2.position.set(0.25, h / 2 + 0.11, 0.4);
    const t3 = Q.trophy({ s: 0.4, color: 0xd9d9f0 });
    t3.position.set(0.25, 0.31, 1.7);
    const m1 = Q.medal({ s: 0.55 });
    m1.position.set(0.25, h - 0.3, -1.1);
    m1.rotation.y = Math.PI / 2;
    const m2 = Q.medal({ s: 0.55, ribbon: C.blue });
    m2.position.set(0.25, h - 0.3, 1.1);
    m2.rotation.y = Math.PI / 2;
    const cup = Q.trophy({ s: 0.36, color: C.pink });
    cup.position.set(0.25, 0.31, -1.4);
    [t1, t2, t3, m1, m2, cup].forEach((o) => { o.rotation.y = o === m1 || o === m2 ? o.rotation.y : Math.PI / 2; g.add(o); });
    return g;
  };

  /* ---------- Taller ---------- */

  // Impresora 3D que construye una pieza una y otra vez
  Q.printer3d = () => {
    const g = grp();
    rbox(3.6, 0.5, 3.3, C.navy, 0, 0.25, 0, g, 0.14);
    rbox(2.8, 0.14, 2.5, C.white, 0, 0.6, 0, g, 0.06);
    [-1, 1].forEach((sx) => rbox(0.34, 4.6, 0.34, C.violet, sx * 1.6, 2.5, -1.2, g, 0.1));
    rbox(3.6, 0.36, 0.5, C.violet, 0, 4.85, -1.2, g, 0.1);
    const gantry = grp(0, 1.4, -0.5, g);
    rbox(3.3, 0.24, 0.3, C.lilac, 0, 0, -0.55, gantry, 0.06);
    const head = grp(0, 0, 0, gantry);
    rbox(0.8, 0.6, 0.7, C.orange, 0, 0, 0, head, 0.12);
    cone(0.16, 0.36, C.white, 0, -0.45, 0.05, head, 10).rotation.x = Math.PI;
    const object = rbox(1.1, 1.6, 1.1, C.coral, 0.1, 0.8, 0.1, g, 0.1);
    object.material = mat(C.coral, { rough: 0.5 });
    const spoolG = grp(2.15, 3.7, -1.2, g);
    const spool = torus(0.62, 0.3, C.orange, 0, 0, 0, spoolG);
    spool.rotation.y = Math.PI / 2;
    cyl(0.18, 0.18, 0.7, C.white, 0, 0, 0, spoolG, 12).rotation.z = Math.PI / 2;
    g.userData.tick = (t) => {
      const k = (t % 9) / 9;
      const grow = Math.min(1, k * 1.25);
      object.scale.y = 0.06 + grow * 0.94;
      object.position.y = 0.67 + object.scale.y * 0.8;
      gantry.position.y = 0.95 + object.scale.y * 1.6 + 0.35;
      head.position.x = Math.sin(t * 2.4) * 0.8;
      head.position.z = Math.cos(t * 1.7) * 0.25;
      spool.rotation.x = t * 1.2;
    };
    return g;
  };

  Q.drone = () => {
    const g = grp();
    const body = grp(0, 0, 0, g);
    rbox(1.5, 0.5, 1.5, C.white, 0, 0, 0, body, 0.2);
    ball(0.5, C.lilac, 0, 0.25, 0, body).scale.y = 0.6;
    ball(0.28, C.ink, 0, -0.35, 0.5, body);
    const props = [];
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz], i) => {
      const arm = rbox(1.9, 0.16, 0.24, C.navy, sx * 0.85, 0.02, sz * 0.85, body, 0.06);
      arm.rotation.y = sx * sz > 0 ? -Math.PI / 4 : Math.PI / 4;
      const p = grp(sx * 1.55, 0.25, sz * 1.55, body);
      cyl(0.22, 0.22, 0.28, C.navy, 0, 0, 0, p, 10);
      const rotor = grp(0, 0.22, 0, p);
      rbox(1.7, 0.04, 0.2, C.white, 0, 0, 0, rotor, 0.02);
      rbox(0.2, 0.04, 1.7, C.white, 0, 0, 0, rotor, 0.02);
      const disc = cyl(0.85, 0.85, 0.01, 0xffffff, 0, 0, 0, rotor, 24);
      disc.material = mat(0xffffff, { opacity: 0.16, rough: 1 });
      disc.castShadow = false;
      props.push(rotor);
      ball(0.1, i < 2 ? C.red : C.green, sx * 0.55, 0, sz * 0.75, body).material = glow(i < 2 ? 0xff4d6a : 0x4dff9a);
    });
    g.userData.tick = (t) => {
      props.forEach((r, i) => { r.rotation.y = t * (i % 2 ? 40 : -40); });
      body.position.y = Math.sin(t * 1.5) * 0.35;
      body.rotation.z = Math.sin(t * 1.1) * 0.08;
      body.rotation.x = Math.cos(t * 0.9) * 0.08;
      g.rotation.y = t * 0.35;
    };
    return g;
  };

  // Pizarra kanban con notas de colores, sobre un caballete con ruedas. Mira a +Z.
  const kanbanTex = () => canvasTex(512, 320, (c, w, h) => {
    c.fillStyle = "#fbf8ff";
    c.fillRect(0, 0, w, h);
    const cols = [C.coral, C.yellow, C.teal];
    const r = rng(12);
    for (let i = 0; i < 3; i++) {
      const x = 22 + i * 162;
      c.fillStyle = hex(cols[i]);
      roundRect(c, x, 20, 146, 26, 13);
      c.fill();
      for (let k = 0; k < 4 - (i === 1 ? 1 : 0) + (i === 2 ? 1 : 0); k++) {
        c.fillStyle = hex([C.pink, C.yellow, C.sky, C.mint, C.lilac][Math.floor(r() * 5)]);
        roundRect(c, x + r() * 6, 62 + k * 62, 138, 50, 8);
        c.fill();
        c.fillStyle = "rgba(27,22,66,0.28)";
        roundRect(c, x + 16, 76 + k * 62, 80 + r() * 30, 8, 4);
        c.fill();
        roundRect(c, x + 16, 92 + k * 62, 50 + r() * 30, 8, 4);
        c.fill();
      }
    }
  });

  Q.whiteboard = ({ w = 6.4, h = 4 } = {}) => {
    const g = grp();
    rbox(w, h, 0.22, C.white, 0, 3.6 + h / 2 - 1.2, 0, g, 0.1);
    screen(kanbanTex(), w - 0.36, h - 0.36, 0, 3.6 + h / 2 - 1.2, 0.12, g);
    [-1, 1].forEach((sx) => {
      rbox(0.3, 3.6, 0.3, C.steel, sx * (w / 2 - 0.5), 1.8, -0.2, g, 0.08);
      rbox(0.3, 0.3, 1.8, C.steel, sx * (w / 2 - 0.5), 0.35, -0.2, g, 0.08);
      ball(0.22, C.ink, sx * (w / 2 - 0.5), 0.2, 0.55, g);
      ball(0.22, C.ink, sx * (w / 2 - 0.5), 0.2, -0.95, g);
    });
    return g;
  };

  // Franjas amarillas y negras (zona de aterrizaje del dron)
  let hazard = null;
  function hazardMat() {
    if (hazard) return hazard;
    const tex = canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = hex(C.yellow);
      c.fillRect(0, 0, w, h);
      c.fillStyle = hex(C.ink);
      for (let i = -2; i < 6; i++) {
        c.beginPath();
        c.moveTo(i * 32, 0); c.lineTo(i * 32 + 16, 0); c.lineTo(i * 32 + 16 + h, h); c.lineTo(i * 32 + h, h);
        c.fill();
      }
    }, [3, 1]);
    hazard = mat(0xffffff, { map: tex, rough: 0.7 });
    return hazard;
  }

  Q.landingPad = ({ s = 5 } = {}) => {
    const g = grp();
    const hz = hazardMat();
    rbox(s, 0.18, s, C.white, 0, 0.09, 0, g, 0.08);
    [[0, s / 2 - 0.2, s, 0.4], [0, -s / 2 + 0.2, s, 0.4], [s / 2 - 0.2, 0, 0.4, s - 0.8], [-s / 2 + 0.2, 0, 0.4, s - 0.8]].forEach(([x, z, w, d]) => {
      rbox(w, 0.06, d, hz, x, 0.2, z, g, 0.02);
    });
    const ringM = torus(s * 0.32, 0.12, C.yellow, 0, 0.22, 0, g, true);
    return g;
  };

  // Torre de cubos de colores
  Q.cubeTower = () => {
    const g = grp();
    const cols = [C.pink, C.sky, C.yellow, C.mint, C.violet];
    const cubes = [];
    [[0, 0, 0], [1.25, 0, 0.2], [0.6, 1.2, 0.1], [-0.2, 1.2, 0.3], [0.5, 2.4, 0.2]].forEach(([x, y, z], i) => {
      const c = rbox(1.2, 1.2, 1.2, cols[i], x, y + 0.6, z, g, 0.18);
      c.rotation.y = (i - 2) * 0.12;
      cubes.push(c);
    });
    g.userData.tick = (t) => {
      cubes.forEach((c, i) => { c.scale.y = 1 + Math.sin(t * 2 + i) * 0.03; });
      cubes[4].position.y = 3.0 + Math.sin(t * 1.4) * 0.12;
      cubes[4].rotation.y = t * 0.6;
    };
    return g;
  };

  /* ---------- Currículum ---------- */

  const cvCache = {};
  function cvTex() {
    if (cvCache.tex) return cvCache.tex;
    const draw = (c, w, h, img) => {
      c.fillStyle = "#fffdf8";
      c.fillRect(0, 0, w, h);
      c.fillStyle = hex(C.blue);
      c.fillRect(0, 0, w, 150);
      // Foto
      c.save();
      c.beginPath(); c.arc(92, 96, 56, 0, 6.3); c.clip();
      if (img) {
        c.drawImage(img, 36, 40, 112, 112);   // la foto ya viene recortada en cuadrado
      } else { c.fillStyle = hex(C.lilac); c.fillRect(30, 30, 130, 130); }
      c.restore();
      c.lineWidth = 6; c.strokeStyle = "#fff";
      c.beginPath(); c.arc(92, 96, 56, 0, 6.3); c.stroke();
      c.fillStyle = "#fff";
      roundRect(c, 170, 62, 210, 22, 11); c.fill();
      c.globalAlpha = 0.55;
      roundRect(c, 170, 98, 150, 14, 7); c.fill();
      c.globalAlpha = 1;
      // Bloques
      const blocks = [[190, C.pink], [340, C.yellow], [490, C.mint]];
      blocks.forEach(([y, color], i) => {
        c.fillStyle = hex(color);
        roundRect(c, 36, y, 26, 26, 8); c.fill();
        c.fillStyle = hex(C.navy);
        roundRect(c, 78, y, 170, 16, 8); c.fill();
        c.fillStyle = "#cfc7ea";
        for (let k = 0; k < 4; k++) { roundRect(c, 78, y + 30 + k * 22, 300 - k * 34 - i * 10, 10, 5); c.fill(); }
      });
      c.fillStyle = "#e8e2fa";
      roundRect(c, 400, 190, 84, 300, 12); c.fill();
      [0, 1, 2, 3].forEach((k) => { c.fillStyle = hex([C.blue, C.pink, C.yellow, C.mint][k]); roundRect(c, 412, 208 + k * 66, 60, 20, 10); c.fill(); });
    };
    cvCache.tex = canvasTex(512, 660, (c, w, h) => draw(c, w, h, null));
    const img = new Image();
    img.onload = () => {
      const c = cvCache.tex.image;
      draw(c.getContext("2d"), c.width, c.height, img);
      cvCache.tex.needsUpdate = true;
    };
    img.src = CV_PHOTO;
    return cvCache.tex;
  }

  // Currículum grande sobre un caballete. Mira a +Z.
  Q.cvEasel = () => {
    const g = grp();
    const H = 8.4;
    [-1, 1].forEach((sx) => {
      const leg = rbox(0.3, H, 0.3, C.woodDark, sx * 1.9, H / 2, 0.55, g, 0.08);
      leg.rotation.z = -sx * 0.06;
      leg.rotation.x = 0.06;
    });
    const back = rbox(0.3, H - 0.6, 0.3, C.woodDark, 0, (H - 0.6) / 2, -1.6, g, 0.08);
    back.rotation.x = -0.34;
    rbox(4.6, 0.3, 0.4, C.woodDark, 0, 2.3, 0.35, g, 0.08);
    const board = grp(0, 5.6, 0.25, g);
    board.rotation.x = -0.06;
    rbox(4.7, 6.2, 0.2, C.white, 0, 0, 0, board, 0.1);
    screen(cvTex(), 4.4, 5.9, 0, 0, 0.11, board);
    return g;
  };

  Q.cabinet = ({ color = C.white, drawers = 3 } = {}) => {
    const g = grp();
    const h = 1.5 * drawers + 0.4;
    rbox(3, h, 3, color, 0, h / 2, 0, g, 0.12);
    for (let i = 0; i < drawers; i++) {
      rbox(2.6, 1.2, 0.1, C.lilac, 0, 0.9 + i * 1.5, 1.5, g, 0.06);
      rbox(1.1, 0.14, 0.14, C.ink, 0, 1.15 + i * 1.5, 1.6, g, 0.06);
      rbox(0.9, 0.34, 0.03, C.paper, 0, 0.72 + i * 1.5, 1.57, g, 0.03);
    }
    return g;
  };

  // Tablón de corcho con notas y chinchetas. Mira a +Z.
  Q.corkboard = ({ w = 6, h = 3.6 } = {}) => {
    const g = grp();
    rbox(w, h, 0.22, C.white, 0, 0, 0, g, 0.1);
    rbox(w - 0.4, h - 0.4, 0.14, C.cork, 0, 0, 0.09, g, 0.06);
    const r = rng(21);
    const cols = [C.pink, C.yellow, C.sky, C.mint, C.lilac, C.white];
    for (let i = 0; i < 7; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const n = rbox(1.05, 1.05, 0.05, cols[i % cols.length], -w / 2 + 1.1 + col * 1.35 + (r() - 0.5) * 0.2, h / 2 - 1.05 - row * 1.25, 0.2, g, 0.03);
      n.rotation.z = (r() - 0.5) * 0.3;
      ball(0.1, C.red, n.position.x, n.position.y + 0.36, 0.28, g);
    }
    return g;
  };

  /* ---------- 7 HHEP ---------- */

  let galaxyTexture = null;
  function galaxyTex() {
    if (galaxyTexture) return galaxyTexture;
    const r = rng(9);
    galaxyTexture = canvasTex(512, 512, (c, w, h) => {
      const bg = c.createRadialGradient(256, 256, 0, 256, 256, 256);
      bg.addColorStop(0, "#2a1266");
      bg.addColorStop(0.6, "#120a3a");
      bg.addColorStop(1, "#05031a");
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
      // Brazos de la espiral
      for (let i = 0; i < 3200; i++) {
        const arm = i % 2;
        const dist = Math.pow(r(), 0.7) * 220;
        const a = dist * 0.028 + arm * Math.PI + (r() - 0.5) * 0.55 * (1 - dist / 260);
        const x = 256 + Math.cos(a) * dist;
        const y = 256 + Math.sin(a) * dist * 0.92;
        const k = r();
        c.fillStyle = k < 0.45 ? "rgba(255,120,220,0.85)" : k < 0.8 ? "rgba(110,150,255,0.85)" : "rgba(255,255,255,0.95)";
        c.fillRect(x, y, 1 + r() * 2, 1 + r() * 2);
      }
      const core = c.createRadialGradient(256, 256, 0, 256, 256, 56);
      core.addColorStop(0, "rgba(255,240,255,1)");
      core.addColorStop(1, "rgba(255,120,220,0)");
      c.fillStyle = core;
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) { c.fillStyle = "rgba(255,255,255," + (0.3 + r() * 0.6) + ")"; c.fillRect(r() * w, r() * h, 1.5, 1.5); }
    });
    return galaxyTexture;
  }

  // Ventana redonda con una galaxia girando. Mira a +Z (para la pared del fondo).
  Q.porthole = ({ r = 2.1 } = {}) => {
    const g = grp();
    torus(r + 0.15, 0.3, C.white, 0, 0, 0.1, g);
    torus(r - 0.05, 0.08, C.lilac, 0, 0, 0.2, g);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ map: galaxyTex(), toneMapped: false }));
    disc.position.z = 0.04;
    g.add(disc);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ball(0.09, C.steel, Math.cos(a) * (r + 0.15), Math.sin(a) * (r + 0.15), 0.42, g);
    }
    g.userData.tick = (t) => { disc.rotation.z = t * 0.05; };
    return g;
  };

  // Telescopio sobre un trípode: apunta hacia -Z y hacia arriba
  Q.telescope = () => {
    const g = grp();
    const top = new THREE.Vector3(0, 3.4, 0);
    [0, 1, 2].forEach((i) => {
      const a = (i / 3) * Math.PI * 2 + 0.6;
      const foot = new THREE.Vector3(Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2);
      const mid = top.clone().add(foot).multiplyScalar(0.5);
      const leg = cyl(0.09, 0.07, top.distanceTo(foot), C.steel, mid.x, mid.y, mid.z, g, 8);
      leg.lookAt(top.x, top.y, top.z);
      leg.rotateX(Math.PI / 2);
    });
    const tube = grp(0, 3.7, 0, g);
    tube.rotation.set(0.5, 0, 0);
    const body = cyl(0.42, 0.36, 3.6, C.sky, 0, 0, 0, tube, 22);
    body.rotation.x = Math.PI / 2;
    [-1.3, 0.4, 1.7].forEach((z) => { const ring = torus(0.44, 0.07, C.white, 0, 0, z, tube); });
    const lens = cyl(0.5, 0.42, 0.5, C.blue, 0, 0, -1.9, tube, 22);
    lens.rotation.x = Math.PI / 2;
    cyl(0.3, 0.3, 0.06, glow(0xbfe6ff), 0, 0, -2.17, tube, 20).rotation.x = Math.PI / 2;
    const finder = cyl(0.13, 0.13, 1.2, C.navy, 0, 0.62, -0.4, tube, 10);
    finder.rotation.x = Math.PI / 2;
    cyl(0.1, 0.1, 0.6, C.yellow, 0, -0.2, 2.0, tube, 12).rotation.x = Math.PI / 2;
    return g;
  };

  // Brújula sobre el suelo: aro, marcas y una aguja que se orienta despacio
  Q.compass = ({ r = 2.8 } = {}) => {
    const g = grp();
    cyl(r, r, 0.16, C.white, 0, 0.09, 0, g, 44).castShadow = false;
    torus(r - 0.08, 0.1, C.yellow, 0, 0.2, 0, g, true);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tick = box(i % 3 === 0 ? 0.16 : 0.08, 0.05, i % 3 === 0 ? 0.55 : 0.32, C.navy, Math.sin(a) * (r - 0.55), 0.19, Math.cos(a) * (r - 0.55), g);
      tick.rotation.y = a;
    }
    const needle = grp(0, 0.28, 0, g);
    const n1 = cone(0.32, r * 0.95, C.red, 0, 0, -r * 0.42, needle, 4);
    n1.rotation.x = -Math.PI / 2;
    n1.rotation.y = Math.PI / 4;
    const n2 = cone(0.32, r * 0.95, C.white, 0, 0, r * 0.42, needle, 4);
    n2.rotation.x = Math.PI / 2;
    n2.rotation.y = Math.PI / 4;
    ball(0.16, C.gold, 0, 0.08, 0, needle);
    g.userData.tick = (t) => { needle.rotation.y = Math.sin(t * 0.5) * 0.7 + t * 0.06; };
    return g;
  };

  Q.flag = ({ color = C.red } = {}) => {
    const g = grp();
    cyl(0.07, 0.07, 3.2, C.steel, 0, 1.6, 0, g, 8);
    ball(0.14, C.gold, 0, 3.25, 0, g);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(1.7, 0.35); shape.lineTo(0, 0.8); shape.closePath();
    const pennant = mesh(new THREE.ShapeGeometry(shape), mat(color, { side: THREE.DoubleSide }), 0.04, 2.35, 0, g);
    g.userData.tick = (t) => { pennant.rotation.y = Math.sin(t * 3) * 0.16; pennant.rotation.z = Math.sin(t * 2.2) * 0.05; };
    return g;
  };

  /* ---------- Contacto ---------- */

  // Cartel de neón con una arroba. Mira a +Z.
  Q.neonAt = ({ w = 4, color = "#ff6fa5" } = {}) => {
    const g = grp();
    rbox(w, w, 0.24, C.navy, 0, 0, 0, g, 0.3);
    const tex = canvasTex(512, 512, (c, ww, hh) => {
      c.clearRect(0, 0, ww, hh);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = "700 380px " + fontStack;
      c.shadowColor = color;
      c.shadowBlur = 40;
      c.fillStyle = color;
      c.fillText("@", 256, 272);
      c.shadowBlur = 14;
      c.fillStyle = "#fff";
      c.fillText("@", 256, 272);
    });
    const d = decal(tex, w * 0.86, w * 0.86, 0, 0, 0.14, g);
    g.userData.tick = (t) => { d.material.opacity = 0.9 + Math.sin(t * 7) * 0.05 + (Math.sin(t * 1.3) > 0.97 ? -0.4 : 0); };
    return g;
  };

  Q.mailbox = ({ color = C.red } = {}) => {
    const g = grp();
    rbox(0.4, 3.2, 0.4, C.woodDark, 0, 1.6, 0, g, 0.08);
    const body = grp(0, 3.6, 0, g);
    rbox(1.8, 1.0, 2.8, color, 0, -0.1, 0, body, 0.1);
    const roof = cyl(0.9, 0.9, 2.8, color, 0, 0.4, 0, body, 24);
    roof.rotation.x = Math.PI / 2;
    box(1.2, 0.9, 0.06, C.ink, 0, 0, 1.42, body);
    rbox(0.16, 1.5, 0.08, C.yellow, 1.0, 0.7, 0.6, body, 0.03);
    rbox(0.5, 0.3, 0.08, C.yellow, 1.0, 1.4, 0.6, body, 0.03);
    [0.2, -0.3].forEach((x, i) => {
      const l = rbox(0.9, 0.06, 0.65, i ? C.pink : C.white, x, 0.3, 1.5, body, 0.02);
      l.rotation.set(-0.5, i ? 0.25 : -0.2, 0);
    });
    return g;
  };

  // Antena parabólica con ondas que salen
  Q.dish = () => {
    const g = grp();
    cyl(0.9, 1.1, 0.3, C.navy, 0, 0.15, 0, g, 24);
    cyl(0.14, 0.14, 2.6, C.white, 0, 1.5, 0, g, 10);
    const head = grp(0, 2.9, 0, g);
    head.rotation.set(-0.7, 0, 0);
    const dish = mesh(new THREE.SphereGeometry(1.7, 30, 14, 0, Math.PI * 2, 0, 0.9), mat(C.white, { rough: 0.35, side: THREE.DoubleSide }), 0, 0, 0, head);
    dish.rotation.x = Math.PI / 2 + 0.0;
    dish.position.z = -0.6;
    const arm = cyl(0.05, 0.05, 1.9, C.steel, 0, 0, 0.5, head, 6);
    arm.rotation.x = Math.PI / 2;
    ball(0.2, C.red, 0, 0, 1.5, head);
    const waves = [0, 1, 2].map((i) => {
      const w = torus(0.5, 0.05, 0xffffff, 0, 0, 0, head);
      w.material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false });
      return w;
    });
    g.userData.tick = (t) => {
      waves.forEach((w, i) => {
        const k = ((t * 0.6 + i / 3) % 1);
        w.position.z = 1.6 + k * 3.4;
        w.scale.setScalar(0.4 + k * 2.4);
        w.material.opacity = (1 - k) * 0.7;
      });
    };
    return g;
  };

  Q.envelope = ({ color = C.white } = {}) => {
    const g = grp();
    const tex = canvasTex(256, 176, (c, w, h) => {
      c.fillStyle = hex(color);
      roundRect(c, 4, 4, w - 8, h - 8, 14); c.fill();
      c.strokeStyle = "rgba(27,22,66,0.28)";
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(8, 12); c.lineTo(w / 2, h * 0.58); c.lineTo(w - 8, 12); c.stroke();
      c.beginPath(); c.moveTo(8, h - 12); c.lineTo(w * 0.4, h * 0.5); c.moveTo(w - 8, h - 12); c.lineTo(w * 0.6, h * 0.5); c.stroke();
      c.fillStyle = hex(C.red);
      c.beginPath(); c.arc(w / 2, h * 0.58, 16, 0, 6.3); c.fill();
    });
    const m = decal(tex, 2, 1.38, 0, 0, 0, g, { side: THREE.DoubleSide });
    m.material.depthWrite = true;
    return g;
  };

  // Avión de papel (dos alas plegadas)
  Q.paperPlane = ({ color = C.white } = {}) => {
    const g = grp();
    const v = new Float32Array([
      0, 0, 1.3, -0.85, 0.12, -0.7, 0, -0.05, -0.55,
      0, 0, 1.3, 0, -0.05, -0.55, 0.85, 0.12, -0.7,
      0, 0, 1.3, 0, -0.42, -0.6, 0, -0.05, -0.55
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
    geo.computeVertexNormals();
    mesh(geo, mat(color, { flat: true, side: THREE.DoubleSide, rough: 0.9 }), 0, 0, 0, g);
    return g;
  };

  Q.globe = ({ r = 1.5 } = {}) => {
    const g = grp();
    const rr = rng(4);
    const tex = canvasTex(512, 256, (c, w, h) => {
      c.fillStyle = hex(C.blue);
      c.fillRect(0, 0, w, h);
      c.fillStyle = hex(C.mint);
      for (let i = 0; i < 14; i++) {
        c.beginPath();
        c.ellipse(rr() * w, 40 + rr() * (h - 80), 20 + rr() * 50, 12 + rr() * 30, rr() * 3, 0, 6.3);
        c.fill();
      }
    });
    torus(r + 0.15, 0.06, C.gold, 0, r + 0.9, 0, g).rotation.y = Math.PI / 2;
    cyl(0.14, 0.14, 0.9, C.gold, 0, 0.55, 0, g, 8);
    cyl(0.7, 0.85, 0.2, C.navy, 0, 0.1, 0, g, 24);
    const globe = mesh(new THREE.SphereGeometry(r, 28, 20), mat(0xffffff, { map: tex, rough: 0.5 }), 0, r + 0.9, 0, g);
    globe.rotation.z = 0.4;
    g.userData.tick = (t) => { globe.rotation.y = t * 0.4; };
    return g;
  };

  Q.balloon = ({ color = C.pink, len = 5 } = {}) => {
    const g = grp();
    const b = ball(0.8, color, 0, 0, 0, g);
    b.scale.y = 1.2;
    cone(0.15, 0.25, color, 0, -1.0, 0, g, 8).rotation.x = Math.PI;
    const string = cyl(0.015, 0.015, len, C.white, 0, -1.1 - len / 2, 0, g, 4);
    string.castShadow = false;
    g.userData.tick = (t) => { g.rotation.z = Math.sin(t * 0.9 + color) * 0.05; };
    return g;
  };

  return Q;
}
