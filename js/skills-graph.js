/*
 * Habilidades técnicas como red de iconos 3D: un icono flotante por habilidad (su logo o su
 * símbolo, ver js/skill-icons.js), colocados en hélice alrededor del modelo y unidos por líneas
 * con pulsos de datos. El icono señalado se agranda y se ilumina junto a sus conexiones.
 *
 * Solo dibuja: los nombres y la interacción los pone js/stage-input.js, a partir de la lista
 * HTML real (que sigue existiendo, accesible y traducida, debajo).
 */
import * as THREE from "three";

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

// Disco oscuro con un aro de neón y el icono (o iconos) de la habilidad dentro
function iconTexture(ids, palette) {
  const size = 192;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const h = size / 2;
  g.beginPath();
  g.arc(h, h, h - 8, 0, Math.PI * 2);
  g.fillStyle = "rgba(36, 26, 96, 0.97)";
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = "#ffffff";
  g.stroke();
  const icons = window.SkillIcons;
  if (icons && ids && ids.length) icons.draw(g, ids, h, h, ids.length === 1 ? 92 : 112, palette);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createSkillsGraph({ palette, lite, touch, listKey = "skills.hard" }) {
  const group = new THREE.Group();
  const glow = glowTexture();
  const hitGeo = new THREE.SphereGeometry(touch ? 0.42 : 0.3, 8, 6);
  const tmp = new THREE.Color();

  let nodes = [];           // { mesh (icono), halo, hit, base, level }
  let dirs = [];            // dirección de cada nodo (unitaria), independiente del tamaño
  let edges = [];           // pares [a, b]
  let edgeLines = null;
  let pulses = [];
  const pulseGroup = new THREE.Group();
  group.add(pulseGroup);
  const layout = { rx: 4.6, ry: 1.45, rz: 2.4 };

  function clearAll() {
    nodes.forEach((n) => {
      group.remove(n.mesh, n.halo, n.hit);
      n.mesh.material.map.dispose();
      n.mesh.material.dispose();
      n.halo.material.dispose();
      n.hit.material.dispose();
    });
    if (edgeLines) { group.remove(edgeLines); edgeLines.geometry.dispose(); edgeLines.material.dispose(); }
    pulses.forEach((p) => { pulseGroup.remove(p.sprite); p.sprite.material.dispose(); });
    nodes = []; dirs = []; edges = []; pulses = []; edgeLines = null;
  }

  // Hélice: los nodos suben dando vueltas alrededor del eje del modelo
  function build(count) {
    clearAll();
    const lists = (window.SkillIcons && window.SkillIcons.LISTS) || {};
    for (let i = 0; i < count; i++) {
      const h = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
      const ring = 0.82 + 0.18 * Math.cos((h * Math.PI) / 2);
      const a = i * GOLDEN_ANGLE;
      dirs.push(new THREE.Vector3(Math.cos(a) * ring, h, Math.sin(a) * ring));

      const ids = (lists[listKey] || [])[i];
      const mesh = new THREE.Sprite(new THREE.SpriteMaterial({
        map: iconTexture(ids, palette), transparent: true, depthWrite: false, toneMapped: false
      }));
      mesh.scale.setScalar(NODE_SIZE);
      mesh.renderOrder = 6;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glow, color: palette.accent3.clone(), transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      }));
      halo.scale.setScalar(NODE_SIZE * 2.1);
      halo.renderOrder = 5;
      const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
      group.add(halo, mesh, hit);
      nodes.push({ mesh, halo, hit, base: new THREE.Vector3(), level: 0 });
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
    for (let i = 0; i < (lite ? 5 : 12) && edges.length; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glow, color: 0xffffff, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      }));
      sprite.scale.setScalar(0.22);
      pulseGroup.add(sprite);
      pulses.push({ sprite, edge: Math.floor(Math.random() * edges.length), t: Math.random(), speed: 0.25 + Math.random() * 0.35 });
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
      n.halo.position.copy(n.mesh.position);
      n.hit.position.copy(n.mesh.position);
      n.mesh.scale.setScalar(NODE_SIZE * (1 + n.level * 0.55));
      n.mesh.material.color.setScalar(0.82 + 0.18 * n.level);
      n.halo.material.color.copy(palette.accent3).lerp(palette.accent2, n.level);
      n.halo.material.opacity = 0.32 + n.level * 0.6;
      n.halo.scale.setScalar(NODE_SIZE * (2.1 + n.level * 1.4));
    });

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

    pulseGroup.visible = animated;
    if (animated) {
      pulses.forEach((p) => {
        p.t += dt * p.speed * ambient;
        if (p.t >= 1) {
          p.t = 0;
          p.edge = Math.floor(Math.random() * edges.length);
        }
        const [a, b] = edges[p.edge];
        p.sprite.position.lerpVectors(nodes[a].mesh.position, nodes[b].mesh.position, p.t);
        p.sprite.material.opacity = 0.9 * Math.sin(p.t * Math.PI);
      });
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
