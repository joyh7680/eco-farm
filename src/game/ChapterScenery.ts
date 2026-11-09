import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ChapterOne, DEPOSIT, ROCKS, WEEDS, type ChapterTarget } from './ChapterOne';
import { PLOT_POSITIONS, type Player } from './Player';

const cube = new THREE.BoxGeometry(1, 1, 1);
const stone = new THREE.IcosahedronGeometry(1, 0);
const leaf = new THREE.ConeGeometry(0.14, 0.8, 4);
const colors = new Map<string, THREE.MeshLambertMaterial>();
function add(root: THREE.Object3D, geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx) {
  if (!colors.has(color)) colors.set(color, new THREE.MeshLambertMaterial({ color }));
  const m = new THREE.Mesh(geo, colors.get(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); root.add(m); return m;
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
  readonly door = new THREE.Group();
  private weeds: THREE.Group[] = [];
  private rocks: THREE.Mesh[] = [];
  private deposited: THREE.Mesh[] = [];
  private rough: THREE.Group[] = [];
  private rings: THREE.Mesh[] = [];
  private carried: THREE.Mesh;
  private hoe = new THREE.Group();
  private glow: THREE.Mesh;

  constructor(scene: THREE.Scene, ship: THREE.Group, body: THREE.Group, arm: THREE.Group) {
    scene.add(this.root);
    WEEDS.forEach((t, i) => {
      const g = new THREE.Group(); g.position.set(t.x, 0.25, t.z); this.root.add(g);
      for (let j = 0; j < 9; j++) {
        const angle = j * 2.4, r = j ? 0.12 + j * 0.025 : 0;
        const m = add(g, leaf, j % 3 ? '#66804b' : '#a1a058', Math.cos(angle) * r, 0.32, Math.sin(angle) * r, 1, 0.7 + (j % 4) * 0.2, 1);
        m.rotation.z = Math.sin(angle) * 0.5;
      }
      // A matching patch on the field disappears with its reachable edge clump.
      for (let j = 0; j < 6; j++) add(g, leaf, '#758c50', Math.sin(j * 4 + i) * 0.4, 0.52, 1 + (j % 3) * 0.35, 0.9, 0.9, 0.9);
      batch(g); this.weeds.push(g);
    });
    ROCKS.forEach(t => {
      const m = add(this.root, stone, '#7c8379', t.x, 0.55, t.z, 0.52, 0.36, 0.42); m.rotation.y = t.id * 0.7; this.rocks.push(m);
      this.deposited.push(add(this.root, stone, '#7c8379', DEPOSIT.x + (t.id - 1) * 0.4, 0.48 + (t.id === 1 ? 0.25 : 0), DEPOSIT.z, 0.42, 0.3, 0.35));
    });
    PLOT_POSITIONS.forEach(([x, z], i) => {
      const g = new THREE.Group(); g.position.set(x, 0.53, z); this.root.add(g);
      add(g, cube, '#9c916e', 0, 0, 0, 3.43, 0.08, 3.16);
      for (let j = 0; j < 9; j++) {
        const m = add(g, stone, j % 2 ? '#aa9b78' : '#8b805f', Math.sin(j * 5 + i) * 1.35, 0.05, Math.cos(j * 3 + i) * 1.2, 0.38, 0.09 + (j % 3) * 0.03, 0.26);
        m.rotation.y = j;
      }
      batch(g); this.rough.push(g);
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
  }
  update(chapter: ChapterOne | null, player: Player, elapsed: number, introTime: number) {
    this.root.visible = !!chapter; this.door.visible = !!chapter;
    this.carried.visible = !!chapter && chapter.carrying !== null;
    this.hoe.visible = !!chapter && player.action === 'soil' && player.actionTime > 0;
    if (!chapter) return;
    this.door.rotation.y = -Math.PI * 0.65 * (introTime < 0 ? 1 : THREE.MathUtils.clamp((introTime - 3.7) / 0.8, 0, 1));
    this.weeds.forEach((g, i) => { g.visible = !chapter.weeds[i]; g.scale.y = chapter.pending?.kind === 'weed' && chapter.pending.id === i ? Math.max(0.1, player.actionTime / 0.48) : 1; });
    this.rocks.forEach((m, i) => { m.visible = !chapter.rocks[i] && chapter.carrying !== i; });
    this.deposited.forEach((m, i) => { m.visible = chapter.rocks[i]; });
    this.rough.forEach((g, i) => { g.visible = i >= 3 || !chapter.soils[i]; });
    this.glow.visible = chapter.complete;
    const targets = chapter.targets();
    this.rings.forEach((m, i) => {
      m.visible = !!targets[i] || chapter.complete && i < 3;
      const t: ChapterTarget | undefined = targets[i];
      if (t) { m.position.set(t.x, t.kind === 'soil' || t.kind === 'inspect' ? 0.64 : 0.26, t.z); m.scale.setScalar((t.kind === 'soil' || t.kind === 'inspect' ? 2.4 : 1.5) + Math.sin(elapsed * 3) * 0.07); }
      else if (chapter.complete && i < 3) { m.position.set(PLOT_POSITIONS[i][0], 0.6, -0.9); m.scale.setScalar(2.4 + Math.sin(elapsed * 2) * 0.07); }
    });
  }
}
