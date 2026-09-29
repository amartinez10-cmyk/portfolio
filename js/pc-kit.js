/*
 * Herramientas para construir el PC: materiales (metal cepillado, cristal, plástico, fundas
 * trenzadas…), piezas sueltas (cajas redondeadas, tubos, ventiladores con marco y aspas de
 * verdad), los LED RGB que cambian de color y el registro de "partes" que se pueden señalar.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { brushedMap, ventMap, finMap, braidMap, glowTexture } from "./pc-textures.js";

// Forma de una aspa de ventilador (largo 1, curvada como una hoja)
const BLADE = new THREE.Shape();
BLADE.moveTo(0, 0);
BLADE.bezierCurveTo(0.11, 0.12, 0.24, 0.5, 0.1, 1);
BLADE.bezierCurveTo(0, 0.8, -0.1, 0.35, 0, 0);

export function createKit({ palette, lite }) {
  const root = new THREE.Group();
  const fans = [];        // { blades, speed }
  const leds = [];        // { color, phase }: colores que van cambiando
  const parts = new Map();
  const disposables = [];
  const glow = glowTexture();
  const brushed = brushedMap();
  const vent = ventMap();
  disposables.push(glow, brushed, vent);

  const fins = finMap();
  const braid = braidMap();
  disposables.push(fins, braid);

  // Materiales: caja blanca con luces lila (como el PC de la foto de referencia), piezas negras y cristal
  const mats = {
    steel: new THREE.MeshStandardMaterial({ color: 0xc4bde0, metalness: 0.12, roughness: 0.42, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.08 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf1eefc, metalness: 0.05, roughness: 0.38 }),
    matte: new THREE.MeshStandardMaterial({ color: 0x1c1838, metalness: 0.2, roughness: 0.5 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0f0c22, metalness: 0.35, roughness: 0.3 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xcfc8f2, metalness: 0.55, roughness: 0.34, roughnessMap: brushed }),
    finned: new THREE.MeshStandardMaterial({ color: 0xd9d3fb, metalness: 0.6, roughness: 0.4, map: fins }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xf1eeff, metalness: 0.9, roughness: 0.18 }),
    mesh: new THREE.MeshStandardMaterial({ color: 0xf3f0ff, metalness: 0.2, roughness: 0.45, alphaMap: vent, alphaTest: 0.5, side: THREE.DoubleSide }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.05, roughness: 0.8, map: braid, bumpMap: braid, bumpScale: 0.45 }),
    frost: new THREE.MeshStandardMaterial({ color: 0xf3edff, metalness: 0.05, roughness: 0.3, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xe4e8ff, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.09, depthWrite: false,
      clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2
    }),
    edge: new THREE.MeshBasicMaterial({ color: 0xdde6ff, transparent: true, opacity: 0.75, toneMapped: false, depthWrite: false })
  };
  Object.values(mats).forEach((m) => disposables.push(m));

  /* ---------- LED RGB: accent → accent2 → accent3 ---------- */

  function glowMat(phase) {
    const mat = new THREE.MeshBasicMaterial({ color: palette.accent.clone(), toneMapped: false });
    leds.push({ color: mat.color, phase });
    disposables.push(mat);
    return mat;
  }

  function halo(size, phase, opacity) {
    const mat = new THREE.SpriteMaterial({
      map: glow, color: palette.accent.clone(), transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    leds.push({ color: mat.color, phase });
    disposables.push(mat);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(size);
    return sprite;
  }

  // Las luces del PC pasan despacio de lila a blanco y a azul hielo, como las de la foto
  const cycleColors = [new THREE.Color(0xc9b6ff), new THREE.Color(0xffffff), new THREE.Color(0xa8d4ff)];
  function cycle(target, x) {
    const p = ((x % 3) + 3) % 3;
    const i = Math.floor(p);
    target.copy(cycleColors[i]).lerp(cycleColors[(i + 1) % 3], p - i);
  }

  /* ---------- Piezas básicas ---------- */

  function place(mesh, x, y, z, parent) {
    mesh.position.set(x, y, z);
    (parent || root).add(mesh);
    return mesh;
  }

  function box(w, h, d, mat, x, y, z, parent) {
    return place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z, parent);
  }

  function rbox(w, h, d, r, mat, x, y, z, parent) {
    return place(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, lite ? 2 : 3, r), mat), x, y, z, parent);
  }

  // axis: "y" (por defecto), "z" o "x": hacia dónde apunta el eje del cilindro
  function cyl(rTop, rBottom, h, mat, x, y, z, axis, parent) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, lite ? 24 : 44);
    if (axis === "z") g.rotateX(Math.PI / 2);
    else if (axis === "x") g.rotateZ(Math.PI / 2);
    return place(new THREE.Mesh(g, mat), x, y, z, parent);
  }

  // Plano de chapa perforada. La textura se repite según el tamaño para que los agujeros
  // salgan siempre del mismo tamaño. rotX/rotY orientan el plano.
  function meshPlane(w, h, x, y, z, rotX, rotY, parent) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 1.4, uv.getY(i) * h * 1.4);
    const m = place(new THREE.Mesh(g, mats.mesh), x, y, z, parent);
    m.rotation.set(rotX || 0, rotY || 0, 0);
    return m;
  }

  // Tubo o cable con funda trenzada que sigue una curva
  function tube(points, radius, mat, parent) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const length = curve.getLength();
    const g = new THREE.TubeGeometry(curve, Math.max(20, Math.floor(length * 22)), radius, lite ? 6 : 10, false);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * length * 9, uv.getY(i) * 3);
    return place(new THREE.Mesh(g, mat || mats.sleeve), 0, 0, 0, parent);
  }

  /* ---------- Ventiladores ---------- */

  const frameCache = new Map();
  const bladeCache = new Map();

  // Marco cuadrado con esquinas redondeadas y un agujero circular
  function frameGeometry(size, holeR, depth) {
    const key = size + "/" + holeR;
    if (frameCache.has(key)) return frameCache.get(key);
    const s = size / 2;
    const r = size * 0.09;
    const shape = new THREE.Shape();
    shape.moveTo(-s + r, -s);
    shape.lineTo(s - r, -s);
    shape.quadraticCurveTo(s, -s, s, -s + r);
    shape.lineTo(s, s - r);
    shape.quadraticCurveTo(s, s, s - r, s);
    shape.lineTo(-s + r, s);
    shape.quadraticCurveTo(-s, s, -s, s - r);
    shape.lineTo(-s, -s + r);
    shape.quadraticCurveTo(-s, -s, -s + r, -s);
    const hole = new THREE.Path();
    hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: lite ? 14 : 30
    });
    g.translate(0, 0, -depth / 2);
    frameCache.set(key, g);
    return g;
  }

  // Nueve aspas curvadas e inclinadas, fundidas en una sola malla
  function bladesGeometry(radius) {
    if (bladeCache.has(radius)) return bladeCache.get(radius);
    const base = new THREE.ExtrudeGeometry(BLADE, { depth: 0.014, bevelEnabled: false, curveSegments: 5 });
    base.scale(radius * 0.84, radius * 0.84, 1);
    base.translate(0, radius * 0.14, -0.007);
    const list = [];
    for (let i = 0; i < 9; i++) {
      const g = base.clone();
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(0.55));
      g.applyMatrix4(new THREE.Matrix4().makeRotationZ((i / 9) * Math.PI * 2));
      list.push(g);
    }
    base.dispose();
    const merged = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    bladeCache.set(radius, merged);
    return merged;
  }

  // Ventilador que mira a +Z: marco, dos aros RGB, aspas que giran, buje y un halo de luz
  function fan(radius, phase, speed, frameMat) {
    const g = new THREE.Group();
    const depth = 0.15;
    g.add(new THREE.Mesh(frameGeometry(radius * 2, radius * 0.93, depth), frameMat || mats.white));

    const ringA = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.88, radius * 0.055, 8, lite ? 32 : 72), glowMat(phase));
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.6, radius * 0.03, 6, lite ? 24 : 56), glowMat(phase + 1));
    ringA.position.z = ringB.position.z = depth / 2 - 0.004;
    g.add(ringA, ringB);

    const blades = new THREE.Group();
    blades.add(new THREE.Mesh(bladesGeometry(radius), mats.frost));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.19, radius * 0.2, 0.06, lite ? 20 : 36).rotateX(Math.PI / 2), mats.black);
    blades.add(hub);
    g.add(blades);
    const core = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.11, lite ? 16 : 28), glowMat(phase + 2));
    core.position.z = 0.032;
    g.add(core);

    if (!lite) {
      const h = halo(radius * 3.4, phase, 0.85);
      h.position.z = 0.02;
      g.add(h);
    }
    fans.push({ blades, speed });
    return g;
  }

  // Placa plana con un dibujo o un texto (logotipos de la caja, rótulo de la gráfica…). Mira a +Z.
  function label(w, h, draw, res = 260) {
    const c = document.createElement("canvas");
    c.width = Math.round(w * res);
    c.height = Math.round(h * res);
    draw(c.getContext("2d"), c.width, c.height);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 16;
    const m = new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false, depthWrite: false });
    disposables.push(map, m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.renderOrder = 3;
    return mesh;
  }

  /* ---------- Partes que se pueden señalar ---------- */

  // Un grupo con nombre. "highlight" es el objeto cuyo volumen se marca al señalarlo.
  function part(id, highlight) {
    const group = new THREE.Group();
    root.add(group);
    parts.set(id, { id, group, highlight: highlight || group, box: new THREE.Box3() });
    return group;
  }

  function boxOf(object, out) {
    const tmp = new THREE.Box3();
    out.makeEmpty();
    object.updateWorldMatrix(true, true);
    object.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      out.union(tmp);
    });
    return out;
  }

  // Marca las mallas de cada parte y calcula su volumen (con el modelo aún sin mover)
  function finalize() {
    const pickables = [];
    parts.forEach((p) => {
      p.group.traverse((o) => {
        if (o.isMesh) {
          o.userData.part = p.id;
          pickables.push(o);
        }
      });
      boxOf(p.highlight, p.box);
    });
    return pickables;
  }

  function update(t) {
    fans.forEach((f) => { f.blades.rotation.z = t * f.speed; });
    leds.forEach((l) => cycle(l.color, t * 0.35 + l.phase));
  }

  function dispose() {
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    frameCache.forEach((g) => g.dispose());
    bladeCache.forEach((g) => g.dispose());
    disposables.forEach((d) => d.dispose && d.dispose());
  }

  return {
    root, palette, lite, mats, parts, glow,
    // Registra algo más para liberarlo al final
    own: (d) => disposables.push(d),
    box, rbox, cyl, meshPlane, tube, fan, glowMat, halo, label, part, finalize, update, dispose
  };
}
