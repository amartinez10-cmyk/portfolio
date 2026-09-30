/*
 * Revisión de la colocación de los objetos de cada sala (solo para pruebas: portfolio3d.audit()).
 *
 *   bounds  objetos que se salen del hueco de la sala (paredes en -7, suelo hasta 7, techo en 9)
 *   pairs   pares de objetos distintos cuyas piezas sólidas se atraviesan, con cuánto (unidades)
 *
 * Los choques se calculan pieza a pieza con cajas orientadas (SAT), no con la caja de todo el
 * objeto, para no dar falsas alarmas con sillas, lámparas o mesas en L.
 */
const TOL = 0.1;          // profundidad mínima que se considera atravesar
const WALL = 7.02;

export function auditLayout(levels, THREE) {
  const out = { bounds: [], pairs: [] };
  const flat = (m) => m.isSprite || (m.material && m.material.blending === THREE.AdditiveBlending);

  function obb(m) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    const c = bb.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld);
    const e = m.matrixWorld.elements;
    const ax = [0, 1, 2].map((i) => new THREE.Vector3(e[i * 4], e[i * 4 + 1], e[i * 4 + 2]));
    const half = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const s = ax.map((a) => a.length());
    ax.forEach((a) => a.normalize());
    return { c, ax, h: [half.x * s[0], half.y * s[1], half.z * s[2]] };
  }

  // Cuánto se penetran dos cajas orientadas (0 si no se tocan)
  function depth(A, B) {
    const d = B.c.clone().sub(A.c);
    let best = Infinity;
    const test = (L) => {
      const l = L.length();
      if (l < 1e-6) return true;
      L = L.clone().divideScalar(l);
      const rA = A.h[0] * Math.abs(A.ax[0].dot(L)) + A.h[1] * Math.abs(A.ax[1].dot(L)) + A.h[2] * Math.abs(A.ax[2].dot(L));
      const rB = B.h[0] * Math.abs(B.ax[0].dot(L)) + B.h[1] * Math.abs(B.ax[1].dot(L)) + B.h[2] * Math.abs(B.ax[2].dot(L));
      const ov = rA + rB - Math.abs(d.dot(L));
      if (ov <= 0) return false;
      if (ov < best) best = ov;
      return true;
    };
    for (let i = 0; i < 3; i++) if (!test(A.ax[i])) return 0;
    for (let i = 0; i < 3; i++) if (!test(B.ax[i])) return 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!test(new THREE.Vector3().crossVectors(A.ax[i], B.ax[j]))) return 0;
    return best;
  }

  levels.items.forEach((lv) => {
    // Sin el balanceo ni el tamaño animado del nivel: se mide la sala tal cual está construida
    const keep = [lv.holder.rotation.y, lv.holder.scale.x, lv.holder.position.y];
    lv.holder.rotation.y = 0;
    lv.holder.scale.setScalar(1);
    lv.holder.position.y = lv.pos.y;
    lv.holder.updateMatrixWorld(true);
    try {

    const parts = [];
    const box = new THREE.Box3();
    const part = new THREE.Box3();
    lv.root.children.forEach((o, i) => {
      if (!o.isGroup && !o.isMesh) return;
      // Lo que gira o vuela (aviones, dron, esferas) no tiene sitio fijo; el PC se revisa aparte
      const moving = o.userData.flying || (o.userData.noHover && o.userData.tick);
      box.makeEmpty();
      o.traverse((m) => {
        if (!m.isMesh || !m.geometry || flat(m) || m.isInstancedMesh || m.userData.batched) return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        part.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
        box.union(part);
        if (m.castShadow && !moving) parts.push({ top: i, o, obb: obb(m) });
      });
      if (box.isEmpty() || moving) return;
      const q = lv.pos;
      const mn = [box.min.x - q.x, box.min.y - q.y, box.min.z - q.z];
      const mx = [box.max.x - q.x, box.max.y - q.y, box.max.z - q.z];
      if (mn[0] < -WALL || mn[2] < -WALL || mx[0] > WALL || mx[2] > WALL || mx[1] > 9.05) {
        out.bounds.push(lv.id + "#" + i + (o.userData.lamp ? " (lámpara)" : "") + " x " + mn[0].toFixed(2) + ".." + mx[0].toFixed(2) +
          " y " + mn[1].toFixed(2) + ".." + mx[1].toFixed(2) + " z " + mn[2].toFixed(2) + ".." + mx[2].toFixed(2));
      }
    });

    const worst = {};
    for (let a = 0; a < parts.length; a++) {
      for (let b = a + 1; b < parts.length; b++) {
        const A = parts[a];
        const B = parts[b];
        if (A.top === B.top) continue;
        if (A.obb.c.distanceTo(B.obb.c) > A.obb.h.reduce((s, v) => s + v, 0) + B.obb.h.reduce((s, v) => s + v, 0)) continue;
        const d = depth(A.obb, B.obb);
        if (d <= TOL) continue;
        const key = A.top + "×" + B.top;
        if (!worst[key] || worst[key].d < d) worst[key] = { d, at: [A.obb.c.x - lv.pos.x, A.obb.c.y, A.obb.c.z - lv.pos.z], la: !!A.o.userData.lamp, lb: !!B.o.userData.lamp };
      }
    }
    Object.entries(worst).forEach(([k, v]) => {
      out.pairs.push(lv.id + " " + k + (v.la || v.lb ? " (lámpara)" : "") + " prof " + v.d.toFixed(2) + " en " + v.at.map((n) => n.toFixed(1)).join(","));
    });

    } finally {
      lv.holder.rotation.y = keep[0];
      lv.holder.scale.setScalar(keep[1]);
      lv.holder.position.y = keep[2];
      lv.holder.updateMatrixWorld(true);
    }
  });
  return out;
}
