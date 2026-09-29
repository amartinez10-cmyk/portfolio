/*
 * Un emblema 3D de alambre por sección, colocados en fila a lo largo del eje X del
 * mundo. Al cambiar de sección la cámara viaja hasta el suyo (ver scene3d.js).
 * Son formas abstractas: no representan ningún dato personal.
 */
import * as THREE from "three";

export function createWorldProps({ palette, lite, order, spacing }) {
  const group = new THREE.Group();

  const lines = (color, opacity) => new THREE.LineBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const wire = (color, opacity) => new THREE.MeshBasicMaterial({
    color, wireframe: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const fill = (color, opacity) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const dot = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

  function ring(radius, color, opacity) {
    const pts = [];
    const n = lite ? 64 : 128;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lines(color, opacity));
  }

  // "Sobre mí" no tiene emblema: su fondo son los cristales, los aros y los logos de
  // js/world-crystals.js. Las demás secciones tienen el suyo.
  const builders = {
    // Pila de hojas en abanico
    resume() {
      const g = new THREE.Group();
      const plane = new THREE.PlaneGeometry(4, 5.4);
      const edges = new THREE.EdgesGeometry(plane);
      const strokes = [];
      for (let i = 0; i < 7; i++) {
        const y = 1.9 - i * 0.5;
        const w = i === 0 ? 1.4 : i % 3 === 2 ? 2.2 : 3;
        strokes.push(-1.7, y, 0, -1.7 + w, y, 0);
      }
      const strokeGeo = new THREE.BufferGeometry();
      strokeGeo.setAttribute("position", new THREE.Float32BufferAttribute(strokes, 3));

      const sheets = [];
      const count = lite ? 4 : 6;
      for (let i = 0; i < count; i++) {
        const sheet = new THREE.Group();
        sheet.add(new THREE.Mesh(plane, fill(palette.accent, 0.05)));
        sheet.add(new THREE.LineSegments(edges, lines(i === 0 ? palette.accent2 : palette.accent, i === 0 ? 0.9 : 0.5)));
        if (i < 3) sheet.add(new THREE.LineSegments(strokeGeo, lines(palette.accent2, 0.35)));
        sheet.position.set(i * 0.7, -i * 0.15, -i * 1.4);
        sheet.rotation.z = -i * 0.04;
        g.add(sheet);
        sheets.push(sheet);
      }
      return {
        group: g,
        update(t) {
          g.rotation.y = -0.5 + Math.sin(t * 0.3) * 0.18;
          sheets.forEach((s, i) => { s.position.z = -i * 1.4 + Math.sin(t * 0.7 + i) * 0.25; });
        }
      };
    },

    // Sello: dodecaedro con un núcleo y satélites
    certificates() {
      const g = new THREE.Group();
      const seal = new THREE.Mesh(new THREE.DodecahedronGeometry(3.4, 0), wire(palette.accent3, 0.4));
      const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 0), fill(palette.accent, 0.16));
      const innerWire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 0), wire(palette.accent2, 0.7));
      const r1 = ring(5.2, palette.accent2, 0.55);
      const r2 = ring(6.4, palette.accent3, 0.32);
      r1.rotation.x = 1.1;
      r2.rotation.set(0.4, 0.6, 0);
      const sats = [0, 1, 2].map((i) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), dot(palette.accent2));
        s.userData.phase = (i / 3) * Math.PI * 2;
        return s;
      });
      g.add(seal, inner, innerWire, r1, r2, ...sats);
      return {
        group: g,
        update(t) {
          seal.rotation.set(t * 0.1, t * 0.16, 0);
          inner.rotation.y = innerWire.rotation.y = -t * 0.3;
          r1.rotation.z = t * 0.25;
          r2.rotation.z = -t * 0.18;
          sats.forEach((s) => {
            const a = t * 0.6 + s.userData.phase;
            s.position.set(Math.cos(a) * 5.2, Math.sin(a) * 5.2 * Math.cos(1.1), Math.sin(a) * 5.2 * Math.sin(1.1));
          });
        }
      };
    },

    // Rejilla de cubos que ondula
    projects() {
      const g = new THREE.Group();
      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.4, 1.4, 1.4));
      const cols = lite ? 4 : 5;
      const rows = 3;
      const cubes = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cube = new THREE.LineSegments(edges, lines((r + c) % 3 === 0 ? palette.accent2 : palette.accent, 0.7));
          cube.position.set((c - (cols - 1) / 2) * 2.2, 0, (r - (rows - 1) / 2) * 2.2);
          g.add(cube);
          cubes.push(cube);
        }
      }
      g.rotation.set(0.35, -0.6, 0);
      return {
        group: g,
        update(t) {
          cubes.forEach((cube, i) => {
            cube.position.y = Math.sin(t * 0.9 + i * 0.8) * 0.9;
            cube.rotation.y = t * 0.3 + i * 0.2;
          });
        }
      };
    },

    // Nudo toroidal
    hhep() {
      const g = new THREE.Group();
      const knot = new THREE.Mesh(
        new THREE.TorusKnotGeometry(3, 0.7, lite ? 90 : 160, lite ? 8 : 12, 2, 3),
        wire(palette.accent2, 0.32)
      );
      const halo = ring(6, palette.accent, 0.4);
      halo.rotation.x = 1.3;
      g.add(knot, halo);
      return {
        group: g,
        update(t) {
          knot.rotation.set(t * 0.12, t * 0.2, 0);
          halo.rotation.z = t * 0.3;
        }
      };
    },

    // Globo de alambre con satélites
    contact() {
      const g = new THREE.Group();
      const globe = new THREE.Mesh(new THREE.SphereGeometry(4.2, lite ? 16 : 26, lite ? 12 : 18), wire(palette.accent, 0.24));
      const r1 = ring(5.6, palette.accent2, 0.5);
      const r2 = ring(6.6, palette.accent3, 0.3);
      r1.rotation.x = 1.4;
      r2.rotation.set(0.7, 0.8, 0);
      const sats = [0, 1].map((i) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), dot(i ? palette.accent3 : palette.accent2));
        s.userData.phase = i * Math.PI;
        return s;
      });
      g.add(globe, r1, r2, ...sats);
      return {
        group: g,
        update(t) {
          globe.rotation.y = t * 0.1;
          r1.rotation.z = t * 0.3;
          r2.rotation.z = -t * 0.2;
          sats.forEach((s, i) => {
            const a = t * (0.5 + i * 0.2) + s.userData.phase;
            s.position.set(Math.cos(a) * 5.6, Math.sin(a) * 5.6 * Math.cos(1.4), Math.sin(a) * 5.6 * Math.sin(1.4));
          });
        }
      };
    }
  };

  const props = [];
  order.forEach((id, slot) => {
    const build = builders[id];
    if (!build) return;
    const item = build();
    const holder = new THREE.Group();
    holder.position.set(slot * spacing, 0, -10);
    holder.add(item.group);
    group.add(holder);
    props.push({ holder, update: item.update });
  });

  return {
    group,
    // Solo se animan (y se dibujan) los que quedan cerca de la cámara
    update(t, camX) {
      props.forEach((p) => {
        const near = Math.abs(p.holder.position.x - camX) < spacing * 0.8;
        p.holder.visible = near;
        if (near) p.update(t);
      });
    }
  };
}
