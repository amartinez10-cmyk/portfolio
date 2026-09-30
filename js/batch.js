/*
 * Fusión de mallas fijas para dibujar menos veces por fotograma (mismo aspecto, menos trabajo).
 *
 * Cada objeto de una sala se construye con muchas piezas pequeñas (una caja, un cilindro…) y cada
 * malla, con su propio material, es una llamada de dibujo que además obliga a three.js a volver a
 * cargar todos los parámetros del material en la tarjeta gráfica. Aquí se juntan, dentro de cada
 * objeto, las piezas que no se mueven:
 *   · las de material liso (solo color, sin texturas) van en una malla por "tipo de material"
 *     (rugosidad, metal, brillo propio…); el color de cada pieza se guarda en los vértices
 *     y se multiplica por el del material, que es blanco: el resultado es idéntico
 *   · las demás (con textura, o con un color que cambia con el tiempo) se juntan por material
 *
 * Las mallas originales se quedan en la escena, ocultas: así el ratón sigue señalando exactamente
 * las mismas piezas, los cálculos de colocación no cambian y el objeto entero sigue dando su
 * saltito al pasar el cursor (la malla fusionada es hija del mismo grupo).
 *
 * Qué NO se fusiona: lo que se anima (se descubre ejecutando los tick() del objeto en varios
 * instantes y viendo qué nodos cambian), lo transparente o aditivo (cristal, vapor, resplandores,
 * rótulos: dependen del orden de dibujo), las mallas instanciadas y las que tienen espejo.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const NOOP = () => {};
// Instantes en los que se comprueba qué se mueve. Lo que se anime solo en condiciones raras se marca a mano con userData.noBatch
const PROBE_TIMES = [0.7, 3.9, 8.3, 21.1, 47.3, 113.9];

// Con ?batch=off no se fusiona nada (para comparar el dibujado con y sin fusión)
export const BATCH_ENABLED = !/[?&]batch=off(&|$)/.test(location.search);
const _inv = new THREE.Matrix4();
const _rel = new THREE.Matrix4();

// Posición, giro y escala de un nodo, para saber después si se ha movido
function snapshot(o) {
  return [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z];
}

function restore(o, s) {
  o.position.set(s[0], s[1], s[2]);
  o.rotation.set(s[3], s[4], s[5]);
  o.scale.set(s[6], s[7], s[8]);
  o.updateMatrix();
}

const colorState = (m) => [m.color ? m.color.r : 0, m.color ? m.color.g : 0, m.color ? m.color.b : 0, m.emissive ? m.emissive.r : 0, m.emissive ? m.emissive.g : 0, m.emissive ? m.emissive.b : 0, m.opacity];

function differs(a, b) {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-6) return true;
  return false;
}

// Ejecuta los tick() del objeto en varios instantes y devuelve qué nodos se mueven y qué materiales
// cambian de color (null si algún tick falla)
function probe(target, ticks) {
  const moving = new Set();
  const animated = new Set();
  if (!ticks.length) return { moving, animated };
  const nodes = [];
  const mats = new Set();
  target.traverse((o) => {
    nodes.push(o);
    if (o.isMesh && o.material && !Array.isArray(o.material)) mats.add(o.material);
  });
  const matList = Array.from(mats);
  const before = nodes.map(snapshot);
  const colors = matList.map(colorState);
  const back = () => {
    nodes.forEach((o, i) => restore(o, before[i]));
    matList.forEach((m, i) => {
      if (m.color) m.color.setRGB(colors[i][0], colors[i][1], colors[i][2]);
      if (m.emissive) m.emissive.setRGB(colors[i][3], colors[i][4], colors[i][5]);
      m.opacity = colors[i][6];
    });
  };
  try {
    PROBE_TIMES.forEach((t) => {
      ticks.forEach((tick) => tick(t, 0.05));
      nodes.forEach((o, i) => {
        if (o !== target && differs(before[i], snapshot(o))) moving.add(o);
      });
      matList.forEach((m, i) => { if (differs(colors[i], colorState(m))) animated.add(m); });
      back();
    });
  } catch (err) {
    back();
    return null;
  }
  return { moving, animated };
}

function batchable(mesh) {
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.userData.noBatch) return false;
  const m = mesh.material;
  if (!m || Array.isArray(m) || m.isShaderMaterial || m.transparent || m.depthWrite === false || m.blending !== THREE.NormalBlending) return false;
  // Materiales con ajustes que el material compartido no reproduce
  if (m.visible === false || m.polygonOffset || m.wireframe || m.dithering) return false;
  const g = mesh.geometry;
  if (!g || !g.attributes.position || !g.attributes.normal || Object.keys(g.morphAttributes).length) return false;
  for (const name in g.attributes) if (g.attributes[name].isInterleavedBufferAttribute) return false;
  return true;
}

/* ---------- Materiales lisos: el color pasa a los vértices ---------- */

const TEXTURES = ["map", "alphaMap", "aoMap", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "envMap", "lightMap", "displacementMap"];
const shared = new Map();       // un material por tipo, común a todos los objetos y salas

function isPlain(m, mesh) {
  const standard = m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial;
  if (!standard && !m.isMeshBasicMaterial) return false;
  if (m.vertexColors || m.alphaTest > 0 || m.clippingPlanes || mesh.geometry.attributes.color) return false;
  return !TEXTURES.some((k) => m[k]);
}

function kindOf(m) {
  return m.isMeshBasicMaterial
    ? ["basic", m.toneMapped, m.side, m.fog].join()
    : ["std", m.roughness, m.metalness, m.flatShading, m.side, m.emissive.getHex(), m.emissiveIntensity, m.envMapIntensity, m.toneMapped].join();
}

function sharedMaterial(m, kind) {
  let s = shared.get(kind);
  if (!s) {
    s = m.isMeshBasicMaterial
      ? new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: m.toneMapped, side: m.side, fog: m.fog })
      : new THREE.MeshStandardMaterial({
        color: 0xffffff, vertexColors: true, roughness: m.roughness, metalness: m.metalness, flatShading: m.flatShading,
        side: m.side, emissive: m.emissive.clone(), emissiveIntensity: m.emissiveIntensity, envMapIntensity: m.envMapIntensity,
        toneMapped: m.toneMapped
      });
    shared.set(kind, s);
  }
  return s;
}

// Añade a la geometría el color del material en cada vértice
function paint(geometry, color) {
  const n = geometry.attributes.position.count;
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    data[i * 3] = color.r;
    data[i * 3 + 1] = color.g;
    data[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(data, 3));
}

function signature(mesh, materialKey) {
  const g = mesh.geometry;
  const attrs = Object.keys(g.attributes).sort().map((n) => {
    const a = g.attributes[n];
    return n + a.itemSize + a.array.constructor.name + (a.normalized ? "n" : "");
  });
  return [
    materialKey, mesh.castShadow ? 1 : 0, mesh.receiveShadow ? 1 : 0, mesh.renderOrder, mesh.frustumCulled ? 1 : 0,
    g.index ? "i" : "x", attrs.join(",")
  ].join("|");
}

// Fusiona las mallas fijas de 'target'. Devuelve las mallas nuevas.
//   ticks: funciones que animan el objeto (por defecto, los userData.tick que encuentre dentro)
//   skip:  nodos que no se tocan (con todo lo que llevan dentro)
export function batchStatic(target, { ticks, skip } = {}) {
  if (target.userData.noBatch) return [];
  const list = ticks || [];
  if (!ticks) target.traverse((o) => { if (typeof o.userData.tick === "function") list.push(o.userData.tick); });
  const found = probe(target, list);
  if (!found) return [];
  const { moving, animated } = found;

  target.updateWorldMatrix(true, true);
  _inv.copy(target.matrixWorld).invert();

  const groups = new Map();
  const visit = (node) => {
    if (moving.has(node) || (skip && skip.has(node)) || node.userData.noBatch || node.visible === false) return;
    if (node.isMesh && batchable(node)) {
      _rel.multiplyMatrices(_inv, node.matrixWorld);
      if (_rel.determinant() > 0) {
        const m = node.material;
        const plain = !animated.has(m) && isPlain(m, node);
        const kind = plain ? kindOf(m) : null;
        const key = signature(node, plain ? "v|" + kind : "m|" + m.uuid);
        let entry = groups.get(key);
        if (!entry) { entry = { plain, kind, meshes: [], matrices: [] }; groups.set(key, entry); }
        entry.meshes.push(node);
        entry.matrices.push(_rel.clone());
      }
    }
    for (let i = 0; i < node.children.length; i++) visit(node.children[i]);
  };
  for (let i = 0; i < target.children.length; i++) visit(target.children[i]);

  const made = [];
  groups.forEach(({ plain, kind, meshes, matrices }) => {
    if (meshes.length < 2 && !plain) return;
    const parts = meshes.map((m, i) => {
      const g = m.geometry.clone().applyMatrix4(matrices[i]);
      if (plain) paint(g, m.material.color);
      return g;
    });
    const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
    if (parts.length > 1) parts.forEach((g) => g.dispose());
    if (!geometry) return;
    const first = meshes[0];
    const merged = new THREE.Mesh(geometry, plain ? sharedMaterial(first.material, kind) : first.material);
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.renderOrder = first.renderOrder;
    merged.frustumCulled = first.frustumCulled;
    merged.matrixAutoUpdate = false;
    merged.raycast = NOOP;                      // al señalar con el ratón cuentan las piezas originales
    merged.userData.batched = meshes.length;
    target.add(merged);
    meshes.forEach((m) => { m.visible = false; });
    made.push(merged);
  });
  return made;
}
