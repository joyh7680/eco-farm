import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ChapterOne, DEPOSIT, ROCKS, WEEDS, type ChapterTarget } from './ChapterOne';
import { CHAPTER_PLOT_POSITIONS, edgeDistance, type Player } from './Player';
import { ARRIVAL, LANDING_SITE, SHORE_WATER } from './Arrival';

const cube = new THREE.BoxGeometry(1, 1, 1);
const stone = new THREE.IcosahedronGeometry(1, 0);
const leaf = new THREE.ConeGeometry(0.14, 0.8, 4);
const colors = new Map<string, THREE.MeshLambertMaterial>();
function add(root: THREE.Object3D, geo: THREE.BufferGeometry, color: string | THREE.Material, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx) {
  if (typeof color === 'string' && !colors.has(color)) colors.set(color, new THREE.MeshLambertMaterial({ color }));
  const m = new THREE.Mesh(geo, typeof color === 'string' ? colors.get(color) : color); m.position.set(x, y, z); m.scale.set(sx, sy, sz); root.add(m); return m;
}
function dryTexture(soil: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  let seed = soil ? 257 : 411;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = soil ? '#978266' : '#b9a88c'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = i % 2 ? '#66594212' : '#f1dfb91a';
    ctx.beginPath(); ctx.ellipse(rand() * 512, rand() * 512, 1 + rand() * 10, 1 + rand() * 4, rand() * 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = soil ? '#5d503c65' : '#77675035'; ctx.lineWidth = soil ? 1.6 : 1.1;
  for (let i = 0; i < (soil ? 22 : 15); i++) {
    let x = rand() * 512, y = rand() * 512;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) { x += (rand() - 0.5) * 40; y += 8 + rand() * 17; ctx.lineTo(x, y); }
    ctx.moveTo(x, y); ctx.lineTo(x + 12 + rand() * 14, y - 8); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  if (!soil) texture.repeat.set(24, 24);
  return texture;
}
function batch(g: THREE.Group) {
  g.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const inv = g.matrixWorld.clone().invert();
  for (const child of [...g.children]) if (child instanceof THREE.Mesh) {
    const geo = child.geometry.clone().applyMatrix4(inv.clone().multiply(child.matrixWorld));
    const arr = byMat.get(child.material) ?? []; arr.push(geo); byMat.set(child.material, arr); child.removeFromParent();
  }
  for (const [material, arr] of byMat) { const geo = mergeGeometries(arr); if (geo) g.add(new THREE.Mesh(geo, material)); arr.forEach(x => x.dispose()); }
}

/** Lightweight additions to the same farm scene; the camera and astronaut stay intact. */
export class ChapterScenery {
  readonly root = new THREE.Group();
  readonly farm = new THREE.Group();
  readonly door = new THREE.Group();
  private weeds: THREE.Group[] = [];
  private rocks: THREE.Mesh[] = [];
  private deposited: THREE.Mesh[] = [];
  private rough: THREE.Group[] = [];
  private tilled: THREE.Group[] = [];
  readonly plotCount = CHAPTER_PLOT_POSITIONS.length;
  private groundMaterial = new THREE.MeshLambertMaterial({ map: dryTexture(false) });
  private rings: THREE.Mesh[] = [];
  private carried: THREE.Mesh;
  private hoe = new THREE.Group();
  private glow: THREE.Mesh;

  constructor(scene: THREE.Scene, ship: THREE.Group, body: THREE.Group, arm: THREE.Group) {
    scene.add(this.root);
    this.makeWasteland();
    this.makeShore();
    const landscape = new Set(this.root.children);
    WEEDS.forEach((t, i) => {
      const g = new THREE.Group(); g.position.set(t.x, 0.25, t.z); this.root.add(g);
      for (let j = 0; j < 9; j++) {
        const angle = j * 2.4, r = j ? 0.12 + j * 0.025 : 0;
        const m = add(g, leaf, j % 3 ? '#7b7b50' : '#a19463', Math.cos(angle) * r, 0.32, Math.sin(angle) * r, 1, 0.7 + (j % 4) * 0.2, 1);
        m.rotation.z = Math.sin(angle) * 0.5;
      }
      // A matching patch on the field disappears with its reachable edge clump.
      for (let j = 0; j < 6; j++) add(g, leaf, '#85845a', Math.sin(j * 4 + i) * 0.4, 0.35, 1 + (j % 3) * 0.35, 0.9, 0.8, 0.9);
      batch(g); this.weeds.push(g);
    });
    ROCKS.forEach(t => {
      const m = add(this.root, stone, '#7c8379', t.x, 0.55, t.z, 0.52, 0.36, 0.42); m.rotation.y = t.id * 0.7; this.rocks.push(m);
      this.deposited.push(add(this.root, stone, '#7c8379', DEPOSIT.x + (t.id - 1) * 0.4, 0.48 + (t.id === 1 ? 0.25 : 0), DEPOSIT.z, 0.42, 0.3, 0.35));
    });
    const roughMaterial = new THREE.MeshLambertMaterial({ map: dryTexture(true) });
    CHAPTER_PLOT_POSITIONS.forEach(([x, z], i) => {
      const border = new THREE.Group(); border.position.set(x, 0.2, z); this.root.add(border);
      add(border, cube, '#81715a', 0, 0, 0, 3.72, 0.12, 3.42);
      for (const side of [-1, 1]) {
        add(border, cube, '#71654f', side * 1.76, 0.08, -0.22 * side, 0.1, 0.09, 2.85);
        const plank = add(border, cube, '#938064', side * 0.3, 0.08, side * 1.63, 2.8, 0.09, 0.1); plank.rotation.y = side * 0.025;
      }
      batch(border);
      const g = new THREE.Group(); g.position.set(x, 0.32, z); this.root.add(g);
      add(g, cube, roughMaterial, 0, 0, 0, 3.43, 0.08, 3.16);
      for (let j = 0; j < 9; j++) {
        const m = add(g, stone, j % 2 ? '#a38e6e' : '#807158', Math.sin(j * 5 + i) * 1.35, 0.05, Math.cos(j * 3 + i) * 1.2, 0.27, 0.07 + (j % 3) * 0.02, 0.2);
        m.rotation.y = j;
      }
      batch(g); this.rough.push(g);
      if (i < 3) {
        const tilled = new THREE.Group(); tilled.position.set(x, 0.32, z); this.root.add(tilled);
        add(tilled, cube, '#8c6447', 0, 0, 0, 3.43, 0.08, 3.16);
        for (let row = 0; row < 5; row++) add(tilled, cube, '#604735', 0, 0.07, -1.2 + row * 0.6, 3.2, 0.07, 0.14);
        batch(tilled); this.tilled.push(tilled);
      }
    });
    // Collection marker, old hoe, broken solar panel and a visibly disconnected tank pipe.
    const props = new THREE.Group(); this.root.add(props);
    for (const dx of [-0.85, 0.85]) add(props, cube, '#b49a70', DEPOSIT.x + dx, 0.38, DEPOSIT.z, 0.12, 0.35, 1.8);
    for (const dz of [-0.85, 0.85]) add(props, cube, '#b49a70', DEPOSIT.x, 0.38, DEPOSIT.z + dz, 1.8, 0.35, 0.12);
    const oldHoe = add(props, cube, '#897357', -6.95, 0.5, -2.7, 0.1, 1.3, 0.1); oldHoe.rotation.z = -0.5;
    add(props, cube, '#776d5d', -7.25, 1.09, -2.7, 0.5, 0.12, 0.2);
    const panel = add(props, cube, '#526b65', -7.7, 0.5, -3.4, 1.1, 0.12, 0.7); panel.rotation.z = -0.25;
    add(props, cube, '#cfa16b', -7.7, 0.58, -3.4, 0.08, 0.04, 0.8).rotation.y = 0.7;
    add(props, cube, '#8e7866', -8.35, 0.4, 0.3, 0.45, 0.25, 0.35).rotation.z = 0.4;
    add(props, cube, '#a47750', -8.2, 0.35, 0.3, 0.25, 0.2, 0.25);
    batch(props);
    // Door opens on the original ship in the original scene.
    add(ship, cube, '#254f4a', 0, 0.85, 0.86, 0.68, 1.1, 0.13);
    this.door.position.set(-0.34, 0.3, 0.96); ship.add(this.door);
    add(this.door, cube, '#99bba5', 0.34, 0.55, 0, 0.68, 1.1, 0.12);
    add(this.door, cube, '#edc47a', 0.53, 0.55, 0.08, 0.08, 0.12, 0.05); batch(this.door);
    this.carried = add(body, stone, '#838d83', 0, 1.05, 0.62, 0.43, 0.31, 0.35);
    arm.add(this.hoe);
    add(this.hoe, cube, '#b38a58', 0, -0.9, 0.2, 0.08, 1.15, 0.08);
    add(this.hoe, cube, '#829588', 0, -1.46, 0.34, 0.5, 0.09, 0.35); batch(this.hoe);
    const ringGeo = new THREE.RingGeometry(0.46, 0.53, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffe9a6', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(ringGeo, ringMat); m.rotation.x = -Math.PI / 2; this.root.add(m); this.rings.push(m); }
    this.glow = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshBasicMaterial({ color: '#d3f0a0', transparent: true, opacity: 0.09, depthWrite: false }));
    this.glow.rotation.x = -Math.PI / 2; this.glow.position.set(-0.3, 0.2, -0.9); this.root.add(this.glow);
    for (const child of [...this.root.children]) if (!landscape.has(child)) this.farm.add(child);
    this.root.add(this.farm);
  }
  private makeShore() {
    const shore = new THREE.Group(); this.root.add(shore);
    const oval = (x: number, z: number, rx: number, rz: number, color: string, y: number) => {
      const patch = add(shore, new THREE.CircleGeometry(1, 40), color, x, y, z, rx, rz, 1);
      patch.rotation.x = -Math.PI / 2; return patch;
    };
    oval(17, 10, 6.3, 7.3, '#8d9e65', 0.17);
    oval(17.2, 10.6, 5.3, 6.5, '#9fa773', 0.175);
    oval(LANDING_SITE.x, LANDING_SITE.z, 2.4, 2.1, '#a38a64', 0.185);
    oval(SHORE_WATER.x, SHORE_WATER.z, 3.3, 4.7, '#c2b083', 0.18);
    oval(SHORE_WATER.x, SHORE_WATER.z, SHORE_WATER.rx, SHORE_WATER.rz, '#5b9fae', 0.19);
    oval(20.4, 4.1, 2, 3.1, '#428bac', 0.195);
    for (let i = 0; i < 34; i++) {
      const angle = i * 2.4;
      const x = 17 + Math.cos(angle) * (4.7 + (i % 3) * 0.25), z = 10 + Math.sin(angle) * (5.7 + (i % 4) * 0.3);
      if (((x - SHORE_WATER.x) / 3.3) ** 2 + ((z - SHORE_WATER.z) / 4.7) ** 2 < 1) continue;
      for (let j = 0; j < 3; j++) add(shore, leaf, j % 2 ? '#6a8b4f' : '#829958', x + j * 0.13, 0.39, z, 0.7, 0.6 + j * 0.15, 0.7).rotation.z = (j - 1) * 0.25;
    }
    // Worn ground markers lead inland, with no maintained paths or buildings.
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      add(shore, stone, '#9d8b69', 15.5 - t * 7.1, 0.22, 13 - t * 6, 0.18, 0.06, 0.12);
    }
    batch(shore);
  }
  private makeWasteland() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), this.groundMaterial);
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.16; this.root.add(floor);
    const debris = new THREE.Group(); this.root.add(debris);
    let seed = 701;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 230; i++) {
      const x = (random() - 0.5) * 28, z = (random() - 0.5) * 21;
      if (CHAPTER_PLOT_POSITIONS.some(([px, pz]) => edgeDistance(x, z, { x: px, z: pz, hx: 2, hz: 1.85 }) < 0.3) || Math.hypot(x - 7.4, z + 7.2) < 3 || Math.hypot(x - DEPOSIT.x, z - DEPOSIT.z) < 1.8) continue;
      if (i % 3) {
        for (let j = 0; j < 3; j++) {
          const stem = add(debris, cube, i % 2 ? '#8e805c' : '#9b8c66', x + j * 0.08, 0.3, z, 0.035, 0.2 + j * 0.1, 0.035);
          stem.rotation.z = (j - 1) * 0.42;
        }
      } else add(debris, stone, i % 2 ? '#9b907c' : '#867d6c', x, 0.24, z, 0.12 + i % 4 * 0.06, 0.09, 0.16);
    }
    // Splintered fence remnants, rather than a maintained enclosure.
    for (const [x, z, angle] of [[-9.5, -8.5, 0.2], [-7.5, 7.7, -0.4], [9.5, 7, 0.6], [-11, 3, 1.2]]) {
      const rail = add(debris, cube, '#8c795d', x, 0.23, z, 1.7, 0.12, 0.13); rail.rotation.y = angle;
      const post = add(debris, cube, '#78684e', x + 0.5, 0.38, z - 0.1, 0.13, 0.55, 0.14); post.rotation.z = 0.45;
    }
    batch(debris);
  }
  update(chapter: ChapterOne | null, player: Player, elapsed: number, introTime: number) {
    this.root.visible = !!chapter; this.door.visible = !!chapter;
    this.carried.visible = !!chapter && chapter.carrying !== null;
    this.hoe.visible = !!chapter && player.action === 'soil' && player.actionTime > 0;
    if (!chapter) return;
    // Reveal the distant farm only while approaching it on foot.
    this.farm.visible = introTime < 0 && (chapter.discovered || edgeDistance(player.x, player.z, { x: -0.3, z: -0.9, hx: 6.5, hz: 6.7 }) < 4.5);
    this.groundMaterial.color.set(chapter.complete ? '#f1ecdc' : '#ffffff');
    this.door.rotation.y = -Math.PI * 0.65 * (introTime < 0 ? 1 : THREE.MathUtils.clamp((introTime - ARRIVAL.doorAt) / (ARRIVAL.exitAt - ARRIVAL.doorAt), 0, 1));
    this.weeds.forEach((g, i) => { g.visible = !chapter.weeds[i]; g.scale.y = chapter.pending?.kind === 'weed' && chapter.pending.id === i ? Math.max(0.1, player.actionTime / 0.48) : 1; });
    this.rocks.forEach((m, i) => { m.visible = !chapter.rocks[i] && chapter.carrying !== i; });
    this.deposited.forEach((m, i) => { m.visible = chapter.rocks[i]; });
    this.rough.forEach((g, i) => { g.visible = i >= 3 || !chapter.soils[i]; });
    this.tilled.forEach((g, i) => { g.visible = chapter.soils[i]; });
    this.glow.visible = chapter.complete;
    const targets = chapter.targets();
    this.rings.forEach((m, i) => {
      m.visible = !!targets[i] || chapter.complete && i < 3;
      const t: ChapterTarget | undefined = targets[i];
      if (t) { m.position.set(t.x, t.kind === 'soil' || t.kind === 'inspect' ? 0.4 : 0.26, t.z); m.scale.setScalar((t.kind === 'soil' || t.kind === 'inspect' ? 2.4 : 1.5) + Math.sin(elapsed * 3) * 0.07); }
      else if (chapter.complete && i < 3) { m.position.set(CHAPTER_PLOT_POSITIONS[i][0], 0.46, -0.9); m.scale.setScalar(2.4 + Math.sin(elapsed * 2) * 0.07); }
    });
  }
}
