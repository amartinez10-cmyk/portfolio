/*
 * Estudio de fotografía generado por código: una sala oscura con una caja de luz arriba y
 * tiras de neón en los colores de la web. Sirve de "entorno" para los reflejos del metal y
 * del cristal del PC (es lo que le da aspecto de producto real). No se descarga nada.
 */
import * as THREE from "three";

export function createStudioEnv(renderer, palette) {
  const scene = new THREE.Scene();
  const disposables = [];

  const room = new THREE.Mesh(
    new THREE.BoxGeometry(24, 14, 24),
    new THREE.MeshBasicMaterial({ color: 0x080a14, side: THREE.BackSide })
  );
  scene.add(room);
  disposables.push(room.geometry, room.material);

  // Luces: se ponen con colores por encima de 1 para que reflejen con intensidad
  function light(w, h, color, intensity, x, y, z) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
    disposables.push(mesh.geometry, mesh.material);
  }

  light(11, 3.2, 0xffffff, 7, 0, 8, 2);                  // caja de luz superior
  light(1.3, 10, palette.accent, 6, -9, 0, 2);            // neón azul, a la izquierda
  light(1.3, 10, palette.accent2, 6, 9, 0, 1);            // neón cian, a la derecha
  light(9, 1.5, palette.accent3, 4.5, 0, -1.5, -10);      // franja violeta, detrás
  light(6, 4, 0xdfe8ff, 2.5, 3, 2, 10);                   // luz suave frontal

  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0.02);
  generator.dispose();
  disposables.forEach((d) => d.dispose());
  return target;
}
