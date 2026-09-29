/*
 * Punto de entrada del paquete js/3d.bundle.js.
 *
 * Al abrir index.html con doble clic (file://), Chrome no deja cargar módulos ES ni el CDN de
 * Three.js como módulo, así que en ese caso js/boot3d.js carga este paquete ya montado (Three.js
 * y todo el 3D en un solo archivo, sin módulos). Con un servidor o en GitHub Pages se usan los
 * módulos de siempre y este archivo no interviene.
 *
 * Después de cambiar cualquier archivo del 3D hay que regenerar el paquete:
 *     npm install        (solo la primera vez)
 *     npm run build:3d
 */
import { start } from "./scene3d.js";

window.Portfolio3D = { start };
