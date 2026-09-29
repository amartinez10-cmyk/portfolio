/*
 * Elementos 3D que flotan por la página "Sobre mí", detrás del contenido:
 *   · cristales metálicos que reflejan las luces de neón del estudio (studio-env.js)
 *   · aros luminosos en fila: al hacer scroll la cámara avanza y los atraviesa
 *   · los logos de las habilidades, flotando a distintas profundidades
 *
 * El parallax sale de la propia perspectiva: al bajar con el scroll (o mover el ratón) los
 * objetos cercanos pasan mucho más rápido que los lejanos. Además giran más deprisa mientras
 * se hace scroll. Solo se dibujan cuando la cámara está en "Sobre mí".
 */
import * as THREE from "three";

// Generador pseudoaleatorio con semilla: la disposición es siempre la misma
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Logo de una habilidad con un halo de luz, sobre fondo transparente
function logoTexture(ids, palette) {
  const size = 160;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.shadowColor = "rgba(120, 190, 255, 0.95)";
  g.shadowBlur = 16;
  window.SkillIcons.draw(g, ids, size / 2, size / 2, ids.length === 1 ? 84 : 104, palette);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCrystals({ palette, lite }) {
  const group = new THREE.Group();
  const rand = rng(21);
  const items = [];          // { obj, spin: Vector3, phase, floatAmp }
  const disposables = [];

  const shapes = [
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.OctahedronGeometry(1.15, 0),
    new THREE.TetrahedronGeometry(1.3, 0),
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.TorusGeometry(0.9, 0.34, 10, 6)
  ];
  const edgeGeos = shapes.map((g) => new THREE.EdgesGeometry(g, 12));
  disposables.push(...shapes, ...edgeGeos);

  // Metal oscuro muy pulido: casi todo lo que se ve son los reflejos del neón
  const skins = [0x0b0e1c, 0x0a1430, 0x1a0f33].map((color) => new THREE.MeshStandardMaterial({
    color, metalness: 1, roughness: 0.16, flatShading: true, envMapIntensity: 1.7
  }));
  const edgeMats = [palette.accent, palette.accent2, palette.accent3].map((color) => new THREE.LineBasicMaterial({
    color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  disposables.push(...skins, ...edgeMats);

  /* ---------- Cristales, a los lados y al fondo ---------- */

  const count = lite ? 12 : 26;
  for (let i = 0; i < count; i++) {
    const shape = Math.floor(rand() * shapes.length);
    const tone = Math.floor(rand() * 3);
    const mesh = new THREE.Mesh(shapes[shape], skins[tone]);
    mesh.add(new THREE.LineSegments(edgeGeos[shape], edgeMats[tone]));
    const z = -62 + rand() * 92;
    const side = rand() < 0.5 ? -1 : 1;
    // Más grandes cuanto más lejos, para que todos se lean bien
    mesh.scale.setScalar(0.8 + rand() * 1.4 + (-z + 30) * 0.018);
    mesh.position.set(side * (9 + rand() * 26), (rand() - 0.5) * 24, z);
    mesh.rotation.set(rand() * 6, rand() * 6, rand() * 6);
    group.add(mesh);
    items.push({
      obj: mesh,
      spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.7),
      phase: rand() * 6.28,
      baseY: mesh.position.y,
      floatAmp: 0.3 + rand() * 0.7
    });
  }

  /* ---------- Aros: un túnel que la cámara atraviesa al hacer scroll ---------- */

  const rings = [];
  [-58, -38, -18, 2, 22].forEach((z, i) => {
    const radius = 7 + (i % 3) * 2.5;
    const mat = new THREE.MeshBasicMaterial({
      color: [palette.accent, palette.accent2, palette.accent3][i % 3], transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.05, 8, lite ? 64 : 160), mat);
    ring.position.set(0, 0.5, z);
    ring.rotation.set(0.15 * (i % 2 ? 1 : -1), 0.1, 0);
    group.add(ring);
    rings.push({ ring, base: 0.55, phase: i * 1.1 });
    disposables.push(ring.geometry, mat);
  });

  /* ---------- Logos de las habilidades, flotando ---------- */

  const icons = window.SkillIcons;
  if (icons && !lite) {
    const all = [].concat(icons.LISTS["skills.hard"], icons.LISTS["skills.soft"]);
    all.forEach((ids, i) => {
      const tex = logoTexture(ids, palette);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false });
      const sprite = new THREE.Sprite(mat);
      const z = -50 + rand() * 70;
      const side = i % 2 ? 1 : -1;
      sprite.scale.setScalar(2.4 + rand() * 2.2);
      sprite.position.set(side * (7 + rand() * 24), (rand() - 0.5) * 20, z);
      group.add(sprite);
      items.push({ obj: sprite, spin: null, phase: rand() * 6.28, baseY: sprite.position.y, floatAmp: 0.4 + rand() * 0.8 });
      disposables.push(tex, mat);
    });
  }

  return {
    group,
    // t: tiempo de simulación · dt: lo que ha avanzado (0 con el fondo en pausa) ·
    // scrollS: 0…1 según lo que se ha bajado · camX: para saber si se ve
    update(t, dt, scrollS, camX) {
      group.visible = Math.abs(camX) < 80;
      if (!group.visible) return;
      const boost = (1 + scrollS * 3) * dt * 0.36;
      items.forEach((it) => {
        it.obj.position.y = it.baseY + Math.sin(t * 0.45 + it.phase) * it.floatAmp;
        if (it.spin) {
          it.obj.rotation.x += it.spin.x * boost;
          it.obj.rotation.y += it.spin.y * boost;
          it.obj.rotation.z += it.spin.z * boost;
        }
      });
      rings.forEach((r, i) => {
        r.ring.rotation.z = t * 0.12 * (i % 2 ? 1 : -1) + scrollS * 2.4;
        r.ring.material.opacity = r.base + 0.2 * Math.sin(t * 0.8 + r.phase);
      });
    },
    dispose() {
      disposables.forEach((d) => d.dispose && d.dispose());
    }
  };
}
