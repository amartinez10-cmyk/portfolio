/*
 * Decorado flotante del mundo, entre y alrededor de las salas: piezas de colores que giran,
 * nubes, anillos de órbita y un halo de luz del color de cada nivel. Como la cámara se mueve,
 * lo cercano pasa mucho más deprisa que lo lejano y aparece el parallax.
 */
import * as THREE from "three";
import { rng, C } from "./journey-kit.js";

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// levels: [{ center: Vector3, accent: hex }] · axis: dirección en la que están en fila ·
// depth: dirección hacia la cámara (perpendicular a la fila)
export function createDecor({ levels, axis, depth, lite }) {
  const group = new THREE.Group();
  const rand = rng(77);
  const disposables = [];
  const items = [];
  const clouds = [];
  const rings = [];

  const shapes = [
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.OctahedronGeometry(1.15, 0),
    new THREE.TetrahedronGeometry(1.3, 0),
    new THREE.BoxGeometry(1.3, 1.3, 1.3),
    new THREE.TorusGeometry(0.85, 0.32, 8, 6),
    new THREE.ConeGeometry(0.9, 1.6, 5),
    new THREE.DodecahedronGeometry(1, 0)
  ];
  disposables.push(...shapes);
  const tones = [C.pink, C.yellow, C.sky, C.mint, C.lilac, C.coral, C.white, C.orange, C.violet];
  const skins = tones.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, flatShading: true }));
  disposables.push(...skins);

  const glowTex = glowTexture();
  disposables.push(glowTex);

  const along = (v, k) => v.clone().addScaledVector(axis, k);
  // Las piezas sueltas no deben quedar dentro de ninguna sala ni delante de ella
  const inside = (p) => levels.some((l) => Math.hypot(p.x - l.center.x, p.z - l.center.z) < 17 && p.y > -9 && p.y < 15);

  levels.forEach((lv, li) => {
    const count = lite ? 12 : 34;
    for (let i = 0; i < count; i++) {
      const front = rand() < 0.22;
      let a;
      let d;
      if (front) {           // a los lados de la sala, algo adelantados: hacen de marco
        a = (rand() < 0.5 ? -1 : 1) * (15 + rand() * 12);
        d = -6 + rand() * 10;
      } else {               // detrás de la sala
        a = (rand() - 0.5) * 64;
        d = -50 + rand() * 40;
      }
      const shape = Math.floor(rand() * shapes.length);
      const mesh = new THREE.Mesh(shapes[shape], skins[Math.floor(rand() * skins.length)]);
      const size = (front ? 0.5 + rand() * 0.8 : 0.7 + rand() * 1.3) + Math.max(0, -d - 8) * 0.03;
      mesh.scale.setScalar(size);
      mesh.position.copy(along(lv.center, a)).addScaledVector(depth, d);
      mesh.position.y += front ? -4 + rand() * 16 : -8 + rand() * 30;
      if (inside(mesh.position)) continue;
      mesh.rotation.set(rand() * 6, rand() * 6, rand() * 6);
      group.add(mesh);
      items.push({
        mesh, baseY: mesh.position.y, phase: rand() * 6.28, amp: 0.4 + rand() * 1.1,
        spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.7)
      });
    }

    // Halo de luz del color del nivel, detrás de la sala
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: lv.accent, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    halo.scale.setScalar(78);
    halo.position.copy(lv.center).addScaledVector(depth, -26);
    halo.position.y += 4;
    group.add(halo);
    disposables.push(halo.material);

    // Anillos de órbita, muy finos
    [[17, 0.5], [21.5, -0.7]].forEach(([radius, tilt], k) => {
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 - k * 0.04, depthWrite: false, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.05, 6, lite ? 72 : 180), ringMat);
      ring.position.copy(lv.center);
      ring.position.y += 2;
      ring.rotation.set(Math.PI / 2 + tilt * 0.4, 0, tilt);
      group.add(ring);
      rings.push({ ring, speed: (k ? -1 : 1) * 0.06 });
      disposables.push(ring.geometry, ringMat);
    });

    // Nubes por debajo
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xf1ecff, roughness: 1, flatShading: true, transparent: true, opacity: 0.85 });
    disposables.push(cloudMat);
    for (let k = 0; k < (lite ? 2 : 4); k++) {
      const cloud = new THREE.Group();
      const puffs = 4 + Math.floor(rand() * 3);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + rand() * 1.3, 1), cloudMat);
        puff.position.set((p - puffs / 2) * 2.2, rand() * 1.2, (rand() - 0.5) * 2);
        puff.scale.y = 0.7;
        cloud.add(puff);
        disposables.push(puff.geometry);
      }
      cloud.position.copy(along(lv.center, (rand() - 0.5) * 44)).addScaledVector(depth, -6 + rand() * 20);
      cloud.position.y = -12 - rand() * 8;
      group.add(cloud);
      clouds.push({ cloud, speed: 0.15 + rand() * 0.3, base: cloud.position.clone() });
    }
  });

  return {
    group,
    update(t, dt) {
      items.forEach((it) => {
        it.mesh.position.y = it.baseY + Math.sin(t * 0.45 + it.phase) * it.amp;
        it.mesh.rotation.x += it.spin.x * dt * 0.6;
        it.mesh.rotation.y += it.spin.y * dt * 0.6;
        it.mesh.rotation.z += it.spin.z * dt * 0.6;
      });
      rings.forEach((r) => { r.ring.rotation.z += r.speed * dt; });
      clouds.forEach((c) => {
        c.cloud.position.copy(c.base).addScaledVector(axis, Math.sin(t * 0.05 * c.speed * 10 + c.base.x) * 3);
      });
    },
    dispose() {
      disposables.forEach((d) => d.dispose && d.dispose());
    }
  };
}
