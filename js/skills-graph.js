/*
 * Habilidades técnicas como red de iconos 3D: un icono flotante por habilidad (su logo o su
 * símbolo, ver js/skill-icons.js), colocados en hélice alrededor del modelo y unidos por líneas
 * con pulsos de datos. El icono señalado se agranda y se ilumina junto a sus conexiones.
 *
 * Solo dibuja: los nombres y la interacción los pone js/stage-input.js, a partir de la lista
 * HTML real (que sigue existiendo, accesible y traducida, debajo).
 */
import * as THREE from "three";
import { createBillboards } from "./billboards.js";

const GOLDEN_ANGLE = 2.399963;
const NODE_SIZE = 0.5;      // tamaño del icono (unidades de escena)

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.4)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Disco oscuro con un aro blanco y el icono (o iconos) de la habilidad dentro. Se dibuja en 512 × 512
// para que se vea nítido aunque el icono se acerque a la cámara (modo "explorar el PC"). Todos los
// iconos van juntos en un atlas: así se dibujan de una vez.
const TILE = 512;
const MAX_ATLAS = 4096;                      // lado máximo del atlas (casi todas las tarjetas admiten al menos 4096)

function drawIcon(g, ox, oy, tile, ids, palette) {
  const k = tile / 192;                      // los tamaños de SkillIcons.draw están pensados para 192 px
  const h = tile / 2;
  g.save();
  g.translate(ox, oy);
  g.beginPath();
  g.arc(h, h, h - 20, 0, Math.PI * 2);
  g.fillStyle = "rgba(36, 26, 96, 0.97)";
  g.fill();
  g.lineWidth = 18;
  g.strokeStyle = "#ffffff";
  g.stroke();
  const icons = window.SkillIcons;
  if (icons && ids && ids.length) icons.draw(g, ids, h, h, (ids.length === 1 ? 92 : 112) * k, palette);
  g.restore();
}

function iconAtlas(lists, count, palette) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  // Si hubiera tantas habilidades que el atlas no cupiera en una textura, las casillas se hacen más pequeñas
  let tile = TILE;
  while (tile > 64 && Math.max(cols, rows) * tile > MAX_ATLAS) tile /= 2;
  const c = document.createElement("canvas");
  c.width = cols * tile;
  c.height = rows * tile;
  const g = c.getContext("2d");
  for (let i = 0; i < count; i++) drawIcon(g, (i % cols) * tile, Math.floor(i / cols) * tile, tile, lists[i], palette);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, cols, rows };
}

export function createSkillsGraph({ palette, lite, touch, listKey = "skills.hard" }) {
  const group = new THREE.Group();
  const glow = glowTexture();
  const hitGeo = new THREE.SphereGeometry(touch ? 0.42 : 0.3, 8, 6);
  const tmp = new THREE.Color();

  let nodes = [];           // { mesh (ancla), icon, halo (fichas de los lotes de cuadrados), hit, base, level }
  let iconBatch = null;     // todos los iconos, en una sola llamada de dibujo
  let haloBatch = null;
  let pulseBatch = null;
  let atlas = null;
  let dirs = [];            // dirección de cada nodo (unitaria), independiente del tamaño
  let edges = [];           // pares [a, b]
  let edgeLines = null;
  let pulses = [];
  const layout = { rx: 4.6, ry: 1.45, rz: 2.4 };

  function clearAll() {
    nodes.forEach((n) => {
      group.remove(n.mesh, n.hit);
      n.hit.material.dispose();
    });
    [iconBatch, haloBatch, pulseBatch].forEach((batch) => {
      if (!batch) return;
      group.remove(batch.mesh);
      batch.dispose();
    });
    if (atlas) atlas.tex.dispose();
    if (edgeLines) { group.remove(edgeLines); edgeLines.geometry.dispose(); edgeLines.material.dispose(); }
    nodes = []; dirs = []; edges = []; pulses = []; edgeLines = null;
    iconBatch = haloBatch = pulseBatch = atlas = null;
  }

  // Hélice: los nodos suben dando vueltas alrededor del eje del modelo
  function build(count) {
    clearAll();
    const lists = ((window.SkillIcons && window.SkillIcons.LISTS) || {})[listKey] || [];
    atlas = iconAtlas(lists, count, palette);
    iconBatch = createBillboards({ map: atlas.tex, capacity: count, grid: [atlas.cols, atlas.rows], renderOrder: 6, sorted: true });
    haloBatch = createBillboards({ map: glow, capacity: count, additive: true, renderOrder: 5 });
    group.add(haloBatch.mesh, iconBatch.mesh);
    for (let i = 0; i < count; i++) {
      const h = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
      const ring = 0.82 + 0.18 * Math.cos((h * Math.PI) / 2);
      const a = i * GOLDEN_ANGLE;
      dirs.push(new THREE.Vector3(Math.cos(a) * ring, h, Math.sin(a) * ring));

      const mesh = new THREE.Object3D();                       // ancla: dónde está el icono (para etiquetas, líneas y pulsos)
      const icon = iconBatch.add(0, 0, 0, NODE_SIZE, 1, 1, 1, 1, i);
      const halo = haloBatch.add(0, 0, 0, NODE_SIZE * 2.1, palette.accent3.r, palette.accent3.g, palette.accent3.b, 0.4, 0);
      const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
      group.add(mesh, hit);
      nodes.push({ mesh, icon, halo, hit, base: new THREE.Vector3(), level: 0 });
    }

    // Cada nodo se une a sus dos vecinos más cercanos
    const seen = new Set();
    dirs.forEach((d, i) => {
      dirs.map((o, j) => ({ j, dist: i === j ? Infinity : d.distanceTo(o) }))
        .sort((p, q) => p.dist - q.dist).slice(0, 2)
        .forEach(({ j }) => {
          const key = i < j ? i + "-" + j : j + "-" + i;
          if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
        });
    });
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edges.length * 6), 3));
    lineGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(edges.length * 6), 3));
    edgeLines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false
    }));
    edgeLines.frustumCulled = false;
    group.add(edgeLines);

    // Pulsos de datos que recorren las conexiones
    const pulseCount = edges.length ? (lite ? 5 : 12) : 0;
    pulseBatch = createBillboards({ map: glow, capacity: Math.max(1, pulseCount), additive: true });
    group.add(pulseBatch.mesh);
    for (let i = 0; i < pulseCount; i++) {
      const item = pulseBatch.add(0, 0, 0, 0.22, 1, 1, 1, 0.9, 0);
      pulses.push({ item, edge: Math.floor(Math.random() * edges.length), t: Math.random(), speed: 0.25 + Math.random() * 0.35 });
    }
    applyLayout();
  }

  function applyLayout() {
    dirs.forEach((d, i) => nodes[i].base.set(d.x * layout.rx, d.y * layout.ry, d.z * layout.rz));
  }

  function setLayout(rx, ry, rz) {
    if (Math.abs(rx - layout.rx) + Math.abs(ry - layout.ry) + Math.abs(rz - layout.rz) < 0.01) return;
    layout.rx = rx;
    layout.ry = ry;
    layout.rz = rz;
    applyLayout();
  }

  // hover: índice del nodo señalado (-1 ninguno). Devuelve true mientras algo cambie.
  function update(dt, t, ambient, animated, hover) {
    if (!nodes.length) return false;
    const k = animated ? 1 - Math.exp(-dt * 12) : 1;
    let moving = false;

    nodes.forEach((n, i) => {
      const d = (hover === i ? 1 : 0) - n.level;
      if (Math.abs(d) > 0.002) {
        n.level += d * k;
        moving = true;
      } else {
        n.level = hover === i ? 1 : 0;
      }
      const bob = animated ? Math.sin(t * 0.7 + i * 1.3) * 0.08 : 0;
      n.mesh.position.set(n.base.x, n.base.y + bob, n.base.z);
      n.hit.position.copy(n.mesh.position);
      const icon = n.icon;
      icon.x = n.mesh.position.x; icon.y = n.mesh.position.y; icon.z = n.mesh.position.z;
      icon.size = NODE_SIZE * (1 + n.level * 0.55);
      icon.r = icon.g = icon.b = 0.82 + 0.18 * n.level;
      const halo = n.halo;
      halo.x = icon.x; halo.y = icon.y; halo.z = icon.z;
      tmp.copy(palette.accent3).lerp(palette.accent2, n.level);
      halo.r = tmp.r; halo.g = tmp.g; halo.b = tmp.b;
      halo.a = 0.32 + n.level * 0.6;
      halo.size = NODE_SIZE * (2.1 + n.level * 1.4);
    });
    iconBatch.touch();
    haloBatch.touch();

    const pos = edgeLines.geometry.attributes.position;
    const col = edgeLines.geometry.attributes.color;
    edges.forEach(([a, b], e) => {
      const A = nodes[a].mesh.position;
      const B = nodes[b].mesh.position;
      const lit = Math.max(nodes[a].level, nodes[b].level);
      tmp.set(0xffffff).lerp(palette.accent2, lit);
      pos.setXYZ(e * 2, A.x, A.y, A.z);
      pos.setXYZ(e * 2 + 1, B.x, B.y, B.z);
      col.setXYZ(e * 2, tmp.r, tmp.g, tmp.b);
      col.setXYZ(e * 2 + 1, tmp.r, tmp.g, tmp.b);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;

    pulseBatch.mesh.visible = animated;
    if (animated) {
      pulses.forEach((p) => {
        p.t += dt * p.speed * ambient;
        if (p.t >= 1) {
          p.t = 0;
          p.edge = Math.floor(Math.random() * edges.length);
        }
        const [a, b] = edges[p.edge];
        const A = nodes[a].mesh.position;
        const B = nodes[b].mesh.position;
        p.item.x = A.x + (B.x - A.x) * p.t;
        p.item.y = A.y + (B.y - A.y) * p.t;
        p.item.z = A.z + (B.z - A.z) * p.t;
        p.item.a = 0.9 * Math.sin(p.t * Math.PI);
      });
      pulseBatch.touch();
    }
    return moving || (animated && ambient > 0);
  }

  // Índice del nodo bajo el rayo (o -1)
  function pick(raycaster) {
    const hits = raycaster.intersectObjects(nodes.map((n) => n.hit), false);
    return hits.length ? nodes.findIndex((n) => n.hit === hits[0].object) : -1;
  }

  function dispose() {
    clearAll();
    glow.dispose();
    hitGeo.dispose();
  }

  return {
    group,
    get count() { return nodes.length; },
    setCount(n) { if (n !== nodes.length) build(n); },
    // Vuelve a dibujar los iconos (por si se cambia la lista de iconos)
    rebuild() { build(nodes.length); },
    setLayout,
    update,
    pick,
    worldPosition: (i, target) => nodes[i].mesh.getWorldPosition(target),
    dispose
  };
}
