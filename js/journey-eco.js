/*
 * Cubos de reciclaje de las salas. Se colocan desde levels.js y levels-extra.js.
 */
import * as THREE from "three";

export const BIN_COLORS = [0xf4c430, 0x2f7fe0, 0x2fa35f, 0x8a5a33];   // envases, papel, vidrio, orgánico

export function createEco(kit) {
  const { C, rbox, cyl, grp, canvasTex, decal, mesh } = kit;

  // Símbolo de reciclaje: tres flechas formando un triángulo
  const symbolTex = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.translate(w / 2, h / 2 + 14);
    g.fillStyle = g.strokeStyle = "#fff";
    g.lineWidth = 27;
    const R = 92;
    const corner = (deg) => [Math.cos((deg * Math.PI) / 180) * R, Math.sin((deg * Math.PI) / 180) * R];
    [-90, 30, 150].forEach((deg) => {
      const a = corner(deg);
      const b = corner(deg + 120);
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const sx = a[0] + dx * 0.1;
      const sy = a[1] + dy * 0.1;
      const ex = a[0] + dx * 0.62;
      const ey = a[1] + dy * 0.62;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
      g.beginPath();
      g.moveTo(ex + ux * 42, ey + uy * 42);
      g.lineTo(ex - uy * 34, ey + ux * 34);
      g.lineTo(ex + uy * 34, ey - ux * 34);
      g.closePath();
      g.fill();
    });
  });
  let symbol = null;

  function bin({ color = BIN_COLORS[0] } = {}) {
    const g = grp();
    const lid = new THREE.Color(color).offsetHSL(0, 0, -0.1).getHex();
    rbox(1.1, 1.75, 1.1, color, 0, 1.03, 0, g, 0.1);
    rbox(1.26, 0.2, 1.26, lid, 0, 2.0, 0, g, 0.08);
    rbox(0.5, 0.08, 0.14, C.white, 0, 2.13, 0.3, g, 0.03);
    [-0.36, 0.36].forEach((x) => {
      const w = cyl(0.15, 0.15, 0.12, C.ink, x, 0.15, -0.46, g, 14);
      w.rotation.z = Math.PI / 2;
    });
    if (!symbol) {
      symbol = decal(symbolTex, 0.78, 0.78, 0, 1.08, 0.558, g);
    } else {
      const s = mesh(symbol.geometry, symbol.material, 0, 1.08, 0.558, g, false);
      s.renderOrder = 2;
    }
    return g;
  }

  // Los cuatro cubos en fila. horizontal: a lo largo de X, mirando a +Z; si no, a lo largo de Z, mirando a +X
  function binRow(root, x, z, { horizontal = true, step = 1.42 } = {}) {
    // Un solo grupo: las piezas se funden en muy pocos dibujos (importa en gráficas integradas)
    const row = grp(x, 0, z, root, horizontal ? 0 : Math.PI / 2);
    BIN_COLORS.forEach((color, i) => {
      const one = bin({ color });
      one.position.x = (i - 1.5) * step * (horizontal ? 1 : -1);
      row.add(one);
    });
    return row;
  }

  return { bin, binRow };
}
