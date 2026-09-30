/*
 * Escenas de los niveles que no llevan el PC: Currículum, Certificados, Proyectos, 7 HHEP y
 * Contacto. Cada una es una sala con su tema (oficina, sala de premios, taller, escalera de
 * los siete hábitos, salón de contacto). Coordenadas: el interior va de -7 a 7; las paredes
 * están en X = -7 (izquierda de la pantalla) y en Z = -7 (derecha).
 */
import * as THREE from "three";
import { createProps2 } from "./journey-props2.js";
import { rng } from "./journey-kit.js";

export function buildExtras({ kit, props }) {
  const { C, grp, rbox, cyl, ball, glow, mat } = kit;
  const { P } = props;
  const Q = createProps2(kit, props);
  const TAU = Math.PI * 2;

  // Coloca un objeto (posición y giro) dentro de la sala
  const place = (root, o, x, y, z, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };

  // Como place(), pero un objeto suelto (planta, lámpara, globo…) se desplaza hacia dentro si sus hojas,
  // su pantalla o su base atravesaran una pared
  const stand = (root, o, x, y, z, ry = 0) => {
    kit.fit(o, x, y, z, ry);
    root.add(o);
    return o;
  };

  // Cuelga un cuadro, reloj o diploma en la pared del fondo sin que llegue al borde ni a la esquina
  const hangOn = (root, o, x, y, z = -6.86) => {
    kit.hang(o, x, y, z);
    root.add(o);
    return o;
  };

  // Objetos que dan vueltas en el aire (sobres, aviones de papel…): { obj, radius, height, speed, phase }
  function orbiters(root, cx, cz, list) {
    const g = grp(cx, 0, cz, root);
    g.userData.noHover = true;
    list.forEach((it) => g.add(it.obj));
    g.userData.tick = (t) => {
      list.forEach((it, i) => {
        const a = t * it.speed + it.phase;
        it.obj.position.set(Math.cos(a) * it.radius, it.height + Math.sin(t * 1.2 + i * 2) * 0.35, Math.sin(a) * it.radius);
        it.obj.rotation.y = -a + (it.face || 0);
        if (it.bank) it.obj.rotation.z = it.bank;
      });
    };
    return g;
  }

  /* ---------- 02 · Currículum: la oficina ---------- */

  function resume({ root }) {
    hangOn(root, Q.corkboard({ w: 6.4, h: 3.8 }), -2.4, 5.7);
    hangOn(root, P.clock({ r: 1.05, rim: C.pink }), 2.3, 6.9, -6.82);
    hangOn(root, Q.photoFrame({ w: 2.7 }), 5.0, 6.5);

    const desk = P.desk({ w: 6.4, d: 3, accent: C.blue, top: C.wood });
    place(root, desk, 3.7, 0, -5.4);
    const top = 2.7;
    place(root, P.laptop({ seed: 9, color: C.white }), 3.1, top, -5.3);
    place(root, P.mug({ color: C.pink }), 1.3, top, -4.8);
    stand(root, P.deskLamp({ color: C.teal }), 5.9, top, -6.1, -0.5);
    stand(root, P.plants.succulent({ size: 0.8, pot: C.pink }), 1.2, top, -6.2);
    place(root, P.chair({ color: C.blue, trim: C.white, gaming: false }), 4.2, 0, -2.2, Math.PI + 0.45);

    place(root, P.rug({ w: 7, round: true, color: C.blue, border: C.white }), -1.8, 0, 2.6);
    place(root, Q.cvEasel(), -1.8, 0, 2.6, 0.75);
    place(root, Q.cabinet({ color: C.white, drawers: 2 }), -5.4, 0, 4.2, Math.PI / 2);
    place(root, P.books({ n: 5, seed: 6 }), -5.4, 3.4, 4.2, 0.3);       // los libros, sobre el archivador
    stand(root, P.plants.fiddle({ size: 1.05, pot: C.white }), -5.8, 0, -1.6);
    stand(root, P.plants.bush({ size: 0.85, pot: C.blue }), 6.0, 0, 3.6);

    // Cajas de archivo apiladas
    place(root, P.crate({ s: 1.5, color: C.white, band: C.blue }), -0.5, 0, -5.9, 0.1);
    place(root, P.crate({ s: 1.5, color: C.white, band: C.pink }), -0.5, 1.5, -5.9, -0.15);
    place(root, P.crate({ s: 1.5, color: C.white, band: C.yellow }), -2.3, 0, -5.9, 0.05);

    // Aviones de papel sobre la mesa de trabajo
    const planes = [0, 1, 2].map((i) => ({ obj: Q.paperPlane({ color: [C.white, C.pink, C.yellow][i] }), radius: 4 + i * 1.2, height: 5.6 + i * 0.7, speed: 0.4 + i * 0.07, phase: i * 2.1, face: -Math.PI / 2, bank: 0.25 }));
    orbiters(root, 0.5, 0.5, planes);
  }

  /* ---------- 03 · Certificados: la sala de premios ---------- */

  function certificates({ root }) {
    // Podio con el trofeo grande, una estrella y una alfombra roja
    const podiumG = grp(0.4, 0, 0.2, root, 0.75);
    podiumG.add(Q.podium());
    const trophy = Q.trophy({ s: 1.05 });
    trophy.position.set(0, 3.2, 0);
    podiumG.add(trophy);
    const small = Q.trophy({ s: 0.45, color: 0xd9d9f0 });
    small.position.set(-2.3, 2.15, 0);
    podiumG.add(small);
    const bronze = Q.trophy({ s: 0.4, color: C.orange });
    bronze.position.set(2.3, 1.55, 0);
    podiumG.add(bronze);
    const carpet = grp(0.4, 0, 0.2, root, 0.75);
    rbox(3.4, 0.08, 6.4, C.red, 0, 0.04, 4.6, carpet, 0.03).castShadow = false;
    [-1, 1].forEach((sx) => rbox(0.16, 0.1, 6.4, C.gold, sx * 1.6, 0.05, 4.6, carpet, 0.03));
    const star = place(root, Q.star({ r: 1.25 }), 0.4, 8.0, 0.2);
    star.scale.setScalar(0.9);

    // Diplomas enmarcados en la pared derecha
    [[-3.6, 1], [0.4, 2], [4.4, 3]].forEach(([x, seed]) => hangOn(root, Q.cert({ w: 3.4, h: 2.5, seed, frame: seed % 2 ? C.navy : C.plum }), x, 6.0));
    hangOn(root, Q.cert({ w: 2.4, h: 1.8, seed: 5, frame: C.white }), -1.6, 3.9);
    hangOn(root, Q.cert({ w: 2.4, h: 1.8, seed: 6, frame: C.white }), 2.4, 3.9);

    place(root, Q.trophyShelf({ w: 6.2, h: 4.2 }), -6.2, 0, -1.5);
    stand(root, P.plants.bush({ size: 0.95, pot: C.pink }), -5.7, 0, 5.0);
    stand(root, P.floorLamp({ shade: C.pink, h: 5.6 }), -6.1, 0, -5.65);

    // Globos atados
    [[6.3, -2.3, C.pink], [4.6, -4.3, C.sky], [6.4, -5.4, C.orange]].forEach(([x, z, color], i) => {
      stand(root, Q.balloon({ color, len: 4.2 }), x, 5.4 + i * 0.7, z);
    });

    // Lluvia de confeti
    const N = 70;
    const confettiGeo = new THREE.PlaneGeometry(0.28, 0.16);
    const confetti = new THREE.InstancedMesh(confettiGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), N);
    const cols = [C.pink, C.sky, C.white, C.red, C.violet, C.mint];
    const r = rng(41);
    const seeds = [];
    const color = new THREE.Color();
    for (let i = 0; i < N; i++) {
      seeds.push({ x: (r() - 0.5) * 12, z: (r() - 0.5) * 12, y: r() * 9, speed: 0.6 + r() * 0.9, phase: r() * 6.3, spin: 1 + r() * 3 });
      confetti.setColorAt(i, color.set(cols[i % cols.length]));
    }
    confetti.frustumCulled = false;
    confetti.userData.noHover = true;
    root.add(confetti);
    const dummy = new THREE.Object3D();
    return {
      tick(t) {
        for (let i = 0; i < N; i++) {
          const s = seeds[i];
          const y = 9 - ((s.y + t * s.speed) % 9);
          dummy.position.set(s.x + Math.sin(t * 0.8 + s.phase) * 0.6, y, s.z + Math.cos(t * 0.6 + s.phase) * 0.6);
          dummy.rotation.set(t * s.spin, t * s.spin * 0.7, s.phase);
          dummy.updateMatrix();
          confetti.setMatrixAt(i, dummy.matrix);
        }
        confetti.instanceMatrix.needsUpdate = true;
      },
      dispose() { confettiGeo.dispose(); confetti.material.dispose(); }
    };
  }

  /* ---------- 04 · Proyectos: el taller ---------- */

  function projects({ root }) {
    // Mesa de trabajo con la impresora 3D, un portátil y un monitor con código
    place(root, P.desk({ w: 7.4, d: 3, body: C.white, top: C.wood, accent: C.mint }), 3.2, 0, -5.4);
    const top = 2.7;
    const printer = Q.printer3d();
    printer.scale.setScalar(0.72);
    place(root, printer, 1.95, top, -5.3);
    place(root, P.monitor({ seed: 15, w: 3.1, h: 1.85 }), 5.15, top, -6.12, -0.15);
    place(root, P.deskMat({ w: 4.4, d: 2, color: C.navy, edge: C.teal }), 4.65, top, -5.0);
    place(root, P.keyboard({ color: C.white }), 4.85, top + 0.05, -4.8);
    place(root, P.mouse({ accent: C.teal }), 6.5, top + 0.05, -4.7);
    place(root, P.mug({ color: C.coral }), -0.1, top, -4.6);
    place(root, P.chair({ color: C.teal, trim: C.white }), 4.5, 0, -2.3, Math.PI + 0.5);

    // Pizarra kanban
    stand(root, Q.whiteboard({ w: 6.2, h: 3.8 }), -3.8, 0, -6.1);

    // Zona de aterrizaje y dron
    place(root, Q.landingPad({ s: 5 }), -0.2, 0, 2.6);
    place(root, Q.drone(), -0.2, 5.0, 2.6);

    // Cajas y torre de cubos de colores
    place(root, P.crate({ s: 1.7, color: C.wood, band: C.woodDark }), -5.7, 0, 4.9, 0.2);
    place(root, P.crate({ s: 1.4, color: C.wood, band: C.woodDark }), -5.6, 1.7, 4.9, -0.2);
    place(root, P.crate({ s: 1.5, color: C.wood, band: C.woodDark }), -3.9, 0, 5.6, 0.1);
    place(root, Q.cubeTower(), -5.5, 0, 0.6, 0.4);
    stand(root, P.plants.cactus({ size: 1, pot: C.white }), 6.0, 0, 3.4);
    stand(root, P.plants.succulent({ size: 0.9, pot: C.mint }), -5.6, 3.1, 4.9);      // sobre las cajas
    stand(root, P.floorLamp({ shade: C.yellow, h: 5.4 }), 6.1, 0, 1.0);
    place(root, P.rug({ w: 5, d: 3.2, color: C.teal, border: C.white }), 4.5, 0, -2.4);
  }

  /* ---------- 05 · 7 HHEP: la escalera de los siete hábitos ---------- */

  function hhep({ root }) {
    const numTex = (n) => kit.canvasTex(128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.font = '800 96px "Outfit", "Avenir Next", system-ui, sans-serif';
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "rgba(20,8,70,0.3)";
      c.fillText(String(n), 66, 70);
      c.fillStyle = "#fff";
      c.fillText(String(n), 64, 66);
    });
    const cols = [0x5aa8ff, 0x7b8cff, 0x9b7bff, 0xc27bff, 0xff7eb6, 0xff9a6b, 0xffc247];
    let topH = 0;
    cols.forEach((color, i) => {
      const h = 0.6 + i * 0.62;
      const x = -5.7 + i * 1.85;
      rbox(1.8, h, 4.2, color, x, h / 2, -4.3, root, 0.14);
      const d = kit.decal(numTex(i + 1), 1.2, 1.2, x, h + 0.03, -3.4, root);
      d.rotation.x = -Math.PI / 2;
      topH = h;
    });
    place(root, Q.flag({ color: C.red }), 5.35, topH, -4.3);

    // Portal a una galaxia y un telescopio apuntando hacia él
    hangOn(root, Q.porthole({ r: 2.1 }), -2.4, 6.0, -6.8);
    place(root, Q.telescope(), -2.8, 0, -0.4, 0.15);

    // Brújula y siete esferas de luz, una por hábito
    place(root, Q.compass({ r: 2.7 }), 2.4, 0, 3.4);
    const orbs = grp(2.4, 0, 3.4, root);
    orbs.userData.flying = true;          // giran dentro de la brújula (la revisión de colocación las ignora)
    const hues = [0x5aa8ff, 0x7b8cff, 0x9b7bff, 0xc27bff, 0xff7eb6, 0xff9a6b, 0xffc247];
    const balls = hues.map((c) => {
      const o = ball(0.36, mat(c, { emissive: c, emissiveIntensity: 0.55, rough: 0.35 }), 0, 0, 0, orbs);
      kit.halo(c, 2.4, 0, 0, 0, o, 0.5);
      return o;
    });
    orbs.userData.tick = (t) => {
      balls.forEach((o, i) => {
        const a = t * 0.5 + (i / 7) * TAU;
        o.position.set(Math.cos(a) * 2.5, 4.4 + Math.sin(t * 1.1 + i) * 0.45, Math.sin(a) * 2.5);
      });
    };

    stand(root, P.floorLamp({ shade: C.cream, h: 5.8 }), -5.9, 0, -0.9);
    stand(root, P.plants.fiddle({ size: 1.1, pot: C.white }), -5.7, 0, 5.2);
    place(root, P.books({ n: 5, seed: 4 }), -5.5, 0, 2.4, 0.4);
    place(root, P.rug({ w: 6.4, round: true, color: C.violet, border: C.lilac }), 2.4, 0, 3.4);
  }

  /* ---------- 06 · Contacto: el salón ---------- */

  function contact({ root }) {
    place(root, P.rug({ w: 8, d: 5.4, color: C.sky, border: C.white }), 1.6, 0, -2.6);
    place(root, P.sofa({ w: 7.6, color: C.orange, cushions: [C.blue, C.pink, C.white] }), 1.6, 0, -5.2);
    hangOn(root, Q.neonAt({ w: 4.2 }), 1.6, 6.5, -6.84);
    hangOn(root, P.frame({ w: 2, h: 2.6, seed: 31, palette: [C.pink, C.yellow, C.white, C.sky] }), -3.0, 5.6);
    hangOn(root, P.frame({ w: 2, h: 2.6, seed: 32, palette: [C.blue, C.pink, C.yellow, C.white] }), 5.0, 5.6);

    const table = P.table({ w: 4.8, d: 2.4, h: 1.3, top: C.white, legs: C.violet });
    place(root, table, 1.6, 0, -1.7);
    place(root, P.laptop({ seed: 20, color: C.white }), 0.95, 1.3, -1.7, 0.25);
    place(root, P.mug({ color: C.pink }), 3.4, 1.3, -0.95);
    place(root, P.books({ n: 3, seed: 8 }), 3.2, 1.3, -2.25, 0.1);

    stand(root, Q.mailbox({ color: C.red }), -5.4, 0, 4.6, 0.7);
    stand(root, Q.dish(), -5.5, 0, -5.4, 0.75);
    stand(root, Q.globe({ r: 1.25 }), 5.9, 0, 3.6);
    stand(root, P.floorLamp({ shade: C.yellow, h: 5.8 }), 6.0, 0, -5.3);
    stand(root, P.plants.monstera({ size: 1.0, pot: C.white }), -5.9, 0, -0.8);

    // Sobres, aviones de papel y un móvil dando vueltas
    const phone = P.phone({ seed: 33 });
    const flyers = [
      { obj: Q.envelope({ color: C.white }), radius: 3.6, height: 5.4, speed: 0.5, phase: 0 },
      { obj: Q.envelope({ color: C.yellow }), radius: 3.9, height: 6.2, speed: 0.44, phase: 2.1 },
      { obj: Q.envelope({ color: C.pink }), radius: 3.3, height: 4.6, speed: 0.56, phase: 4.2 },
      { obj: Q.paperPlane({ color: C.white }), radius: 5.6, height: 7.0, speed: 0.36, phase: 1, face: -Math.PI / 2, bank: 0.3 },
      { obj: Q.paperPlane({ color: C.sky }), radius: 5.0, height: 3.6, speed: 0.3, phase: 3.4, face: -Math.PI / 2, bank: 0.3 },
      { obj: phone, radius: 2.4, height: 6.6, speed: 0.6, phase: 3 }
    ];
    orbiters(root, 1.6, -1.7, flyers);
  }

  return { resume, certificates, projects, hhep, contact };
}
