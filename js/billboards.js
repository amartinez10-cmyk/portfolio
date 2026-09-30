/*
 * Muchos cuadrados que miran siempre a la cámara (iconos, resplandores, chispas) dibujados en una
 * sola llamada. Hace lo mismo que THREE.Sprite pero para todo un grupo a la vez: cada uno lleva su
 * posición, tamaño, color, opacidad y la casilla que dibuja de un atlas de texturas.
 *
 * El tamaño se mide como en un Sprite: en unidades locales, multiplicado por la escala del padre.
 * Con 'sorted' se dibujan de atrás hacia delante (hace falta si se mezclan con transparencia normal;
 * con mezcla aditiva el orden da igual).
 */
import * as THREE from "three";

const VERTEX = /* glsl */ `
  attribute vec3 aPos;
  attribute vec4 aColor;
  attribute vec2 aSizeTile;
  uniform vec2 uGrid;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    float col = mod(aSizeTile.y, uGrid.x);
    float row = floor(aSizeTile.y / uGrid.x);
    vUv = (vec2(col, uGrid.y - 1.0 - row) + uv) / uGrid;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
    mv.xy += position.xy * aSizeTile.x * length(modelMatrix[0].xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vec4 t = texture2D(map, vUv);
    gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a);
    #include <colorspace_fragment>
  }
`;

const _p = new THREE.Vector3();

// map: textura (o atlas de columnas × filas casillas) · capacity: cuántos como máximo
export function createBillboards({ map, capacity, grid = [1, 1], additive = false, renderOrder = 0, sorted = false }) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute("position", base.attributes.position);
  geometry.setAttribute("uv", base.attributes.uv);
  const pos = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const color = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  const sizeTile = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
  [pos, color, sizeTile].forEach((a) => a.setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aPos", pos);
  geometry.setAttribute("aColor", color);
  geometry.setAttribute("aSizeTile", sizeTile);
  geometry.instanceCount = 0;

  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uGrid: { value: new THREE.Vector2(grid[0], grid[1]) } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  mesh.raycast = () => {};

  // Datos por casilla, en el orden en que se han dado de alta (el orden de dibujo puede cambiar)
  const items = [];
  let dirty = true;

  function write(slot, item) {
    pos.setXYZ(slot, item.x, item.y, item.z);
    color.setXYZW(slot, item.r, item.g, item.b, item.a);
    sizeTile.setXY(slot, item.size, item.tile);
  }

  function commit() {
    for (let i = 0; i < items.length; i++) write(i, items[i]);
    geometry.instanceCount = items.length;
    pos.needsUpdate = color.needsUpdate = sizeTile.needsUpdate = true;
    dirty = false;
  }

  if (sorted) {
    // De atrás hacia delante respecto a la cámara que va a dibujar
    mesh.onBeforeRender = (renderer, scene, camera) => {
      if (items.length < 2) { if (dirty) commit(); return; }
      const view = camera.matrixWorldInverse;
      const m = mesh.matrixWorld;
      items.forEach((it) => { it.depth = _p.set(it.x, it.y, it.z).applyMatrix4(m).applyMatrix4(view).z; });
      const order = items.slice().sort((a, b) => a.depth - b.depth);
      order.forEach((it, i) => write(i, it));
      geometry.instanceCount = items.length;
      pos.needsUpdate = color.needsUpdate = sizeTile.needsUpdate = true;
      dirty = false;
    };
  } else {
    mesh.onBeforeRender = () => { if (dirty) commit(); };
  }

  return {
    mesh,
    get count() { return items.length; },
    // Da de alta un cuadrado y devuelve su ficha (se cambia con set())
    add(x = 0, y = 0, z = 0, size = 1, r = 1, g = 1, b = 1, a = 1, tile = 0) {
      const item = { x, y, z, size, r, g, b, a, tile, depth: 0 };
      if (items.length < capacity) items.push(item);      // pasada la capacidad la ficha no se dibuja (no se sale del buffer)
      dirty = true;
      return item;
    },
    // Tras cambiar campos de alguna ficha (item.x, item.a…), avisa de que hay que volver a subirlos
    touch() { dirty = true; },
    clear() {
      items.length = 0;
      geometry.instanceCount = 0;
      dirty = true;
    },
    dispose() {
      geometry.dispose();
      base.dispose();
      material.dispose();
    }
  };
}
