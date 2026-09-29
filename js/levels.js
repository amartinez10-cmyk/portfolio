/*
 * Los seis niveles (uno por sección del menú). Cada nivel es una sala (journey-room.js) con sus
 * objetos. Los niveles se colocan en fila (lo hace scene3d.js) y la cámara viaja de uno a otro.
 *
 * El nivel de "Sobre mí" lleva el PC 3D interactivo (hero-model.js) con la red de habilidades
 * a su alrededor (skills-graph.js); el resto son escenas decorativas (levels-extra.js).
 */
import * as THREE from "three";
import { createKit, C } from "./journey-kit.js";
import { createProps } from "./journey-props.js";
import { buildRoom } from "./journey-room.js";
import { createHeroModel } from "./hero-model.js";
import { createSkillsGraph } from "./skills-graph.js";
import { buildExtras } from "./levels-extra.js";

// Color de las paredes y de la luz del borde de cada nivel (el acento también lo lee el CSS)
export const LEVEL_STYLE = {
  about:        { wall: 0xb8a4f4, accent: 0x8b6cff },
  resume:       { wall: 0x9fb4f8, accent: 0x5c8dff },
  certificates: { wall: 0xf7bd45, accent: 0xffb02e },
  projects:     { wall: 0x7fdccb, accent: 0x2fd0b5 },
  hhep:         { wall: 0x8368e6, accent: 0xb18cff },
  contact:      { wall: 0xffb0c7, accent: 0xff6fa5 }
};

const PC_SCALE = 2.1;
const GRAPH_SCALE = 2.6;

export function createLevels({ palette, lite, order }) {
  const kit = createKit({ lite });
  const props = createProps(kit);
  const { P } = props;
  const items = [];
  let about = null;

  /* ---------- Sobre mí: el puesto de trabajo con el PC ---------- */

  function buildAbout(ctx) {
    const { root } = ctx;
    const { grp } = kit;

    // PC en el centro, sobre su plataforma amarilla, con el cristal mirando a la cámara
    const pc = grp(0.6, 0, 1.6, root);
    const spin = grp(0, PC_SCALE * 1.68, 0, pc, 0.78);
    spin.scale.setScalar(PC_SCALE);
    const model = createHeroModel({ palette, lite });
    spin.add(model.group);

    // Habilidades técnicas: iconos que giran alrededor del PC
    const graphHolder = grp(0, PC_SCALE * 1.68 + 0.6, 0, pc);
    graphHolder.scale.setScalar(GRAPH_SCALE);
    const graph = createSkillsGraph({ palette, lite, touch: window.matchMedia("(pointer: coarse)").matches });
    graphHolder.add(graph.group);

    const rug = P.rug({ w: 9.4, round: true, color: C.pink, border: C.white });
    rug.position.set(0.6, 0, 1.6);
    root.add(rug);

    // Escritorio contra la pared derecha, con dos monitores y de todo un poco
    const desk = P.desk({ w: 8.6, d: 3, accent: C.violet });
    desk.position.set(2.7, 0, -5.4);
    root.add(desk);
    const top = 2.7;
    const m1 = P.monitor({ seed: 5, w: 3.5, h: 2 });
    m1.position.set(1.0, top, -6.3);
    m1.rotation.y = 0.12;
    const m2 = P.monitor({ seed: 8, w: 3.5, h: 2 });
    m2.position.set(4.5, top, -6.3);
    m2.rotation.y = -0.12;
    const kb = P.keyboard();
    kb.position.set(2.7, top, -4.7);
    const mouse = P.mouse();
    mouse.position.set(4.6, top, -4.6);
    const lamp = P.deskLamp({ color: C.coral });
    lamp.position.set(6.55, top, -6.1);
    lamp.rotation.y = -0.5;
    const mug = P.mug({ color: C.yellow });
    mug.position.set(-0.35, top, -4.9);
    const cactus = P.plant({ kind: "cactus", size: 0.55, pot: C.white });
    cactus.position.set(-0.9, top, -6.3);
    const phones = P.headphones({ color: C.pink });
    phones.position.set(6.1, top, -4.5);
    phones.rotation.y = 0.6;
    [m1, m2, kb, mouse, lamp, mug, cactus, phones].forEach((o) => root.add(o));

    const chair = P.chair({ color: C.violet, trim: C.white });
    chair.position.set(4.9, 0, -2.4);
    chair.rotation.y = Math.PI + 0.55;
    root.add(chair);

    // Estantería y lámpara contra la pared izquierda
    const shelfPlant = P.plant({ size: 0.5, pot: C.pink });
    const shelfBooks = P.books({ n: 4, seed: 7 });
    const shelf = P.bookshelf({ w: 6.6, h: 4.2, rows: 3, seed: 3, items: [] });
    shelf.position.set(-6.2, 0, -1.6);
    root.add(shelf);
    shelfPlant.position.set(-6.2, 4.2, 0.9);
    shelfBooks.position.set(-6.2, 4.2, -3.1);
    shelfBooks.rotation.y = Math.PI / 2;
    root.add(shelfPlant, shelfBooks);
    const floorLamp = P.floorLamp({ shade: C.yellow });
    floorLamp.position.set(-5.9, 0, -6.0);
    root.add(floorLamp);
    const bush = P.plant({ size: 1.2, pot: C.white });
    bush.position.set(-5.6, 0, 4.9);
    root.add(bush);

    // Cuadros y reloj en la pared derecha
    const f1 = P.frame({ w: 2.4, h: 3, seed: 3 });
    f1.position.set(0.8, 7.0, -6.82);
    const f2 = P.frame({ w: 2, h: 2, seed: 7, palette: [C.yellow, C.coral, C.sky, C.white] });
    f2.position.set(3.5, 7.4, -6.82);
    const clock = P.clock({ r: 1.05 });
    clock.position.set(6.1, 7.1, -6.8);
    [f1, f2, clock].forEach((o) => root.add(o));

    pc.userData.noHover = true;
    about = { model, graph, pc, graphHolder, pcSpin: spin };
    return about;
  }

  const builders = Object.assign({ about: buildAbout }, buildExtras({ kit, props, palette, lite }));

  order.forEach((id, index) => {
    const style = LEVEL_STYLE[id] || LEVEL_STYLE.about;
    const room = buildRoom(kit, style);
    const root = new THREE.Group();     // los objetos de la sala
    room.group.add(root);
    const holder = new THREE.Group();   // lo que scene3d.js coloca, hace flotar y escala
    holder.add(room.group);
    const build = builders[id];
    let extra = null;
    if (build) {
      try {
        extra = build({ kit, props, room, root, palette, lite, index });
      } catch (err) {
        console.error("[3D] nivel " + id + ": falló al construirse", err);
      }
    }
    const ticks = [];
    root.traverse((o) => { if (o.userData && o.userData.tick) ticks.push(o.userData.tick); });
    if (extra && extra.tick) ticks.push(extra.tick);
    // Objetos que reaccionan al cursor (dan un saltito): los grupos sueltos de la sala
    const hoverables = root.children.filter((o) => o.isGroup && !o.userData.noHover);
    items.push({
      id, index, holder, room, root, extra, style, hoverables,
      update(t, dt) { ticks.forEach((fn) => fn(t, dt)); }
    });
  });

  // Los títulos de las paredes salen del menú, en el idioma actual
  function setTitles(dict) {
    items.forEach((it) => it.room.setTitle(String(it.index + 1).padStart(2, "0"), dict["nav." + it.id] || ""));
  }

  function dispose() {
    items.forEach((it) => { if (it.extra && it.extra.dispose) it.extra.dispose(); });
    if (about) { about.model.dispose(); about.graph.dispose(); }
    kit.dispose();
  }

  return { items, get about() { return about; }, setTitles, dispose, kit, props };
}
