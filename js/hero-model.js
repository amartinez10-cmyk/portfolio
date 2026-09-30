/*
 * Modelo 3D principal de "Sobre mí": un PC gaming construido con geometrías de Three.js (sin
 * assets ni copyright). Se reparte en varios módulos:
 *   pc-textures.js  texturas dibujadas por código (metal cepillado, chapa perforada, pantalla…)
 *   pc-kit.js       materiales y piezas (cajas redondeadas, tubos trenzados, ventiladores…)
 *   pc-case.js      carcasa, cristal, frontal y plataforma giratoria
 *   pc-inside.js    placa base, refrigeración líquida, RAM, gráfica, fuente y cables
 *
 * ── Para usar tu propio modelo ──────────────────────────────────────────────────────
 *   1. Copia tu archivo .glb (mejor si es .glb comprimido con Draco) a la carpeta /models.
 *   2. Pon aquí su ruta:   export const MODEL_URL = "models/mi-modelo.glb";
 *   Se centra y se escala solo. Con MODEL_URL = null se usa el PC procedural.
 * ────────────────────────────────────────────────────────────────────────────────────
 */
import * as THREE from "three";
import { createKit } from "./pc-kit.js";
import { buildCase, buildPedestal } from "./pc-case.js";
import { buildInside } from "./pc-inside.js";
import { batchStatic, BATCH_ENABLED } from "./batch.js";

export const MODEL_URL = null;

const DRACO_DECODER = "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/";
const H = 3;   // alto del modelo en unidades de escena

// Marca de "objetivo fijado" alrededor de la pieza señalada: esquinas y un volumen tenue
function createHighlight(palette) {
  const group = new THREE.Group();
  group.visible = false;

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(24 * 2 * 3), 3));
  const lineMat = new THREE.LineBasicMaterial({ color: palette.accent2, transparent: true, depthTest: false, toneMapped: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.renderOrder = 20;

  const fillMat = new THREE.MeshBasicMaterial({
    color: palette.accent2, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false, toneMapped: false
  });
  const fill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), fillMat);
  fill.renderOrder = 19;
  group.add(fill, lines);

  const pos = lineGeo.attributes.position;
  function set(box) {
    const pad = 0.07;
    const min = box.min.clone().subScalar(pad);
    const max = box.max.clone().addScalar(pad);
    const size = max.clone().sub(min);
    const len = [Math.min(0.28, size.x * 0.3), Math.min(0.28, size.y * 0.3), Math.min(0.28, size.z * 0.3)];
    let n = 0;
    for (const x of [min.x, max.x]) {
      for (const y of [min.y, max.y]) {
        for (const z of [min.z, max.z]) {
          const dx = x === min.x ? 1 : -1;
          const dy = y === min.y ? 1 : -1;
          const dz = z === min.z ? 1 : -1;
          [[dx * len[0], 0, 0], [0, dy * len[1], 0], [0, 0, dz * len[2]]].forEach((d) => {
            pos.setXYZ(n++, x, y, z);
            pos.setXYZ(n++, x + d[0], y + d[1], z + d[2]);
          });
        }
      }
    }
    pos.needsUpdate = true;
    fill.position.copy(min).add(max).multiplyScalar(0.5);
    fill.scale.copy(size);
  }

  return {
    group,
    set,
    pulse(t) { fillMat.opacity = 0.07 + 0.04 * Math.sin(t * 5); },
    dispose() {
      lineGeo.dispose();
      lineMat.dispose();
      fill.geometry.dispose();
      fillMat.dispose();
    }
  };
}

export function createHeroModel({ palette, lite }) {
  const group = new THREE.Group();
  const highlight = createHighlight(palette);
  let kit = null;
  let edge = null;
  let pickables = [];

  function buildProcedural() {
    kit = createKit({ palette, lite });
    group.add(kit.root, highlight.group);
    // Cada bloque va por separado: si uno fallara en algún equipo, el resto del PC se sigue viendo
    const step = (name, fn) => { try { return fn(); } catch (err) { console.error("[3D] PC: falló " + name, err); } };
    step("carcasa", () => { edge = buildCase(kit).edge; });
    step("plataforma", () => buildPedestal(kit));
    step("interior", () => buildInside(kit));
    pickables = kit.finalize();
    // Se dibuja con pocas mallas fusionadas; las originales quedan ocultas y siguen sirviendo para señalar
    if (BATCH_ENABLED) step("fusión", () => batchStatic(kit.root, { ticks: [(t) => kit.update(t)] }));
  }

  // .glb propio (Draco opcional). Se centra y se escala a la altura del PC.
  async function loadGlb(url) {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const { DRACOLoader } = await import("three/addons/loaders/DRACOLoader.js");
    const draco = new DRACOLoader().setDecoderPath(DRACO_DECODER);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const gltf = await loader.loadAsync(url);
    draco.dispose();
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    model.position.sub(bounds.getCenter(new THREE.Vector3()));
    const holder = new THREE.Group();
    holder.add(model);
    holder.scale.setScalar(H / Math.max(size.y, 0.0001));
    return holder;
  }

  const ready = (async () => {
    if (MODEL_URL) {
      try {
        group.add(await loadGlb(MODEL_URL));
        return;
      } catch (err) {
        console.warn("[3D] No se pudo cargar", MODEL_URL, "→ se usa el PC procedural", err);
      }
    }
    buildProcedural();
  })();

  const tmp = new THREE.Vector3();
  let active = null;

  return {
    group,
    ready,
    // id de la pieza bajo el rayo (o null)
    pick(raycaster) {
      if (!pickables.length) return null;
      const hits = raycaster.intersectObjects(pickables, false);
      return hits.length ? hits[0].object.userData.part : null;
    },
    // Marca una pieza (o quita la marca con null)
    highlight(id) {
      active = id && kit && kit.parts.get(id) ? id : null;
      highlight.group.visible = !!active;
      if (active) highlight.set(kit.parts.get(active).box);
    },
    // Punto del espacio donde colocar la etiqueta de una pieza: el centro de su cara superior
    partAnchor(id, target) {
      const p = kit && kit.parts.get(id);
      if (!p) return target.set(0, 0, 0);
      tmp.set((p.box.min.x + p.box.max.x) / 2, p.box.max.y, (p.box.min.z + p.box.max.z) / 2);
      return group.localToWorld(target.copy(tmp));
    },
    update(t) {
      if (!kit) return;
      kit.update(t);
      if (edge) edge.color.copy(palette.accent).lerp(palette.accent2, 0.5 + 0.5 * Math.sin(t * 0.5));
      if (active) highlight.pulse(t);
    },
    dispose() {
      if (kit) kit.dispose();
      highlight.dispose();
    }
  };
}
