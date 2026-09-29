/*
 * Entorno de luz generado por código: un cielo con degradado lila y unas cajas de luz de colores.
 * Da la luz ambiente suave de las maquetas y los reflejos del cristal, el metal y los dorados.
 * No se descarga nada.
 */
import * as THREE from "three";

export function createStudioEnv(renderer) {
  const scene = new THREE.Scene();
  const disposables = [];

  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.33, "#e6deff");
  grad.addColorStop(0.5, "#cdbfff");
  grad.addColorStop(0.56, "#a08cf0");
  grad.addColorStop(1, "#5a45b0");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide }));
  scene.add(dome);
  disposables.push(skyTex, dome.geometry, dome.material);

  // Cajas de luz: colores por encima de 1 para que reflejen con intensidad
  function light(w, h, color, intensity, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
    disposables.push(m.geometry, m.material);
  }

  light(12, 8, 0xfff1dd, 5, 9, 11, 7);         // sol cálido
  light(4, 14, 0xff9ac0, 2.6, -12, 4, 6);       // rosa, a la izquierda
  light(8, 4, 0x9fd0ff, 2.6, 3, 3, -12);        // azul, detrás
  light(10, 3, 0xffffff, 1.6, 10, 1, 10);       // relleno frontal

  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0.03);
  generator.dispose();
  disposables.forEach((d) => d.dispose());
  return target;
}
