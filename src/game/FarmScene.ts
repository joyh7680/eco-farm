import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Crop, GameState } from './GameState';
import type { CropKind } from './GameConfig';
import { TUTORIAL_PLOT } from './Tutorial';

const C = {
  grass: '#427d54', grassLight: '#75a75c', dark: '#193f37', soil: '#674b36',
  wood: '#a98959', cream: '#e8dec1', teal: '#347d70', orange: '#e8aa4d',
  leaf: '#7eae46', pink: '#e5a0b4', blue: '#8edcdb', metal: '#546b5e',
};
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
const coneGeo = new THREE.ConeGeometry(1, 1, 7);
const rockGeo = new THREE.IcosahedronGeometry(1, 0);
const sphereGeo = new THREE.SphereGeometry(1, 8, 6);
const shadowGeo = new THREE.CircleGeometry(1, 12);
const moonShape = new THREE.Shape();
moonShape.absarc(0, 0, 0.16, Math.PI * 0.28, Math.PI * 1.72, false);
moonShape.quadraticCurveTo(-0.05, 0, Math.cos(Math.PI * 0.28) * 0.16, Math.sin(Math.PI * 0.28) * 0.16);
const moonGeo = new THREE.ShapeGeometry(moonShape);
const starShape = new THREE.Shape();
for (let i = 0; i < 10; i++) {
  const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? 0.085 : 0.19;
  if (i === 0) starShape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  else starShape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
}
starShape.closePath();
const starGeo = new THREE.ShapeGeometry(starShape);
const moonMaterial = new THREE.MeshBasicMaterial({ color: '#fff8c1', side: THREE.DoubleSide });
const starMaterial = new THREE.MeshBasicMaterial({ color: '#ffe49b', side: THREE.DoubleSide });
const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#173e2b', transparent: true, opacity: 0.16, depthWrite: false });
const materials = new Map<string, THREE.MeshLambertMaterial>();
function mat(color: string) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  return materials.get(color)!;
}
function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string | THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const object = new THREE.Mesh(geometry, typeof color === 'string' ? mat(color) : color);
  object.position.set(x, y, z); object.scale.set(sx, sy, sz); parent.add(object); return object;
}
function box(parent: THREE.Object3D, color: string | THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  return mesh(parent, boxGeo, color, x, y, z, sx, sy, sz);
}
function cylinder(parent: THREE.Object3D, color: string, x: number, y: number, z: number, radius: number, height: number) {
  return mesh(parent, cylinderGeo, color, x, y, z, radius, height, radius);
}
function orb(parent: THREE.Object3D, color: string | THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) {
  return mesh(parent, rockGeo, color, x, y, z, sx, sy, sz);
}
function group(parent: THREE.Object3D, x: number, y: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
}
// The same silhouettes appear in the soil and in the harvest flight.
function cropPlant(parent: THREE.Object3D, kind: CropKind, material: THREE.MeshLambertMaterial, x: number, z: number) {
  const plant = group(parent, x, 0, z);
  if (kind === 'leaf') {
    for (let k = 0; k < 7; k++) {
      const angle = k * Math.PI * 2 / 7;
      const petal = orb(plant, material, Math.cos(angle) * 0.23, 0.22, Math.sin(angle) * 0.23, 0.32, 0.19, 0.25);
      petal.rotation.set(Math.sin(angle) * 0.25, angle, -Math.cos(angle) * 0.25);
    }
    orb(plant, '#bceac3', 0, 0.35, 0, 0.29, 0.25, 0.29);
    orb(plant, '#e3f6ce', 0, 0.48, 0, 0.18, 0.15, 0.18);
    mesh(plant, moonGeo, moonMaterial, 0, 0.73, 0, 1, 1, 1).rotation.y = Math.PI / 4;
  } else {
    cylinder(plant, '#baa37a', 0.04, 0.79, -0.06, 0.035, 1.58);
    cylinder(plant, '#487c71', -0.03, 0.7, 0, 0.055, 1.4);
    for (let k = 0; k < 4; k++) {
      const side = k % 2 ? -1 : 1, y = 0.35 + k * 0.26;
      const lv = orb(plant, material, side * 0.2, y, -0.03, 0.25, 0.11, 0.18); lv.rotation.z = side * 0.3;
      const pod = orb(plant, '#a58ad5', side * 0.22, y - 0.07, 0.17, 0.11, 0.24, 0.1); pod.rotation.z = side * 0.25;
      for (let n = 0; n < 3; n++) orb(plant, '#d9c9f4', side * 0.22, y - 0.2 + n * 0.12, 0.245, 0.065);
    }
    mesh(plant, starGeo, starMaterial, 0, 1.65, 0, 1, 1, 1).rotation.y = Math.PI / 4;
  }
  return plant;
}
// Bake stationary meshes by shared material. Detailed scenery remains cheap to render.
function bake(root: THREE.Object3D, exclude: THREE.Object3D[] = []) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map<THREE.Material, { geometries: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
  function visit(node: THREE.Object3D) {
    if (exclude.includes(node) || node instanceof THREE.InstancedMesh) return;
    if (node instanceof THREE.Mesh && !Array.isArray(node.material)) {
      const material = node.material as THREE.Material;
      const batch = batches.get(material) ?? { geometries: [], meshes: [] };
      const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld));
      // All procedural source primitives provide position, normal and UV attributes.
      batch.geometries.push(geometry); batch.meshes.push(node); batches.set(material, batch);
    }
    [...node.children].forEach(visit);
  }
  [...root.children].forEach(visit);
  for (const [material, batch] of batches) {
    const geometry = mergeGeometries(batch.geometries);
    if (geometry) {
      root.add(new THREE.Mesh(geometry, material));
      batch.meshes.forEach(m => m.removeFromParent());
    }
    batch.geometries.forEach(g => g.dispose());
  }
}
function sign(parent: THREE.Object3D, text: string, x: number, y: number, z: number, width: number, height = 0.55, background = '#183e36') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#f4e9c9'; ctx.font = 'bold 54px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 67);
  const texture = new THREE.CanvasTexture(canvas); texture.magFilter = THREE.NearestFilter; texture.colorSpace = THREE.SRGBColorSpace;
  return mesh(parent, new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texture }), x, y, z, width, height, 1);
}
let seed = 73;
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function groundTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = C.grass; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1300; i++) {
    ctx.fillStyle = ['#477f53', '#4c8757', '#3b754e', '#568b57', '#618f59'][i % 5];
    ctx.fillRect(Math.floor(random() * 128), Math.floor(random() * 128), 1 + Math.floor(random() * 2), 1);
  }
  const tex = new THREE.CanvasTexture(canvas); tex.magFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 5); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface PlotVisual {
  root: THREE.Group; leaf: THREE.Group; bean: THREE.Group; seeds: THREE.Group;
  soil: THREE.Mesh; highlight: THREE.Group; marker: THREE.Mesh;
  leafMaterial: THREE.MeshLambertMaterial; beanMaterial: THREE.MeshLambertMaterial;
}
interface Particle { active: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: THREE.Color; size: number }
interface HarvestFlight { root: THREE.Group; start: THREE.Vector3; control: THREE.Vector3; age: number; duration: number; kind: CropKind }

export class FarmScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-19, 19, 11, -11, 0.1, 180);
  readonly renderer: THREE.WebGLRenderer;
  readonly targets: THREE.Object3D[] = [];
  readonly plots: PlotVisual[] = [];
  readonly ship: THREE.Group;
  readonly space = new THREE.Scene();
  readonly spaceCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  private planet: THREE.Group;
  private travelShip: THREE.Group;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private groundMaterial: THREE.MeshLambertMaterial;
  private sun: THREE.DirectionalLight;
  private particles: Particle[] = [];
  private particleMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private waterLevel: THREE.Mesh;
  private beacon: THREE.Mesh;
  private harvestTemplates: Record<CropKind, THREE.Group>;
  private harvestFlights: HarvestFlight[] = [];
  private supplyIntake = new THREE.Vector3(9.6, 1.38, 1.9);
  private supplyPulse: THREE.Mesh;
  private supplyPulseTime = 0;
  private dryBlend = 0;
  private elapsed = 0;
  private height = 360;
  private width = 640;
  private highQuality = false;
  private readyColor = new THREE.Color('#e9cd69');
  private dryColor = new THREE.Color('#a69a59');
  private leafColor = new THREE.Color('#79c5a1');
  private beanColor = new THREE.Color('#537f92');
  private wiltColor = new THREE.Color('#b6a35a');
  private deadColor = new THREE.Color('#746345');
  private warningColor = new THREE.Color('#e69a5a');
  private drySunColor = new THREE.Color('#ffd391');
  private previewCrops: Crop[] = Array.from({ length: 6 }, (_, i) => ({ kind: i % 3 === 1 ? 'bean' : 'leaf', growth: [1, 0.8, 0.5, 0.7, 1, 0.9][i], moisture: 65, dryTime: 0, dead: false }));

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor('#638e7e');
    this.renderer.domElement.id = 'world';
    this.renderer.domElement.setAttribute('aria-label', '밭과 보급 기지를 클릭해 조작하는 3D 농장');
    container.append(this.renderer.domElement);
    this.scene.background = new THREE.Color('#719d88');
    this.scene.fog = new THREE.Fog('#719d88', 48, 105);
    this.scene.add(new THREE.HemisphereLight('#f6f0c9', '#385b48', 2.35));
    this.sun = new THREE.DirectionalLight('#fff1d0', 2.6); this.sun.position.set(-12, 24, 10); this.scene.add(this.sun);
    this.camera.position.set(27, 31, 36); this.camera.lookAt(0, 0, 0);
    this.groundMaterial = new THREE.MeshLambertMaterial({ map: groundTexture(), color: '#ffffff' });
    this.terrain();
    this.researchBase(-7.4, -6.5);
    this.waterLevel = this.waterTank(-10, -0.3);
    this.deliveryStation(9.6, 1.2);
    this.ship = this.spaceship(this.scene, 7.4, 0.1, -7.2);
    this.landingPad(7.4, -7.2);
    this.greenhouse(-6.9, 7.1);
    this.plots = this.makePlots();
    this.harvestTemplates = { leaf: new THREE.Group(), bean: new THREE.Group() };
    for (const kind of ['leaf', 'bean'] as const) {
      cropPlant(this.harvestTemplates[kind], kind, mat(kind === 'leaf' ? '#79c5a1' : '#537f92'), 0, 0);
      bake(this.harvestTemplates[kind]);
    }
    this.supplyPulse = mesh(this.scene, new THREE.RingGeometry(0.5, 0.6, 24), new THREE.MeshBasicMaterial({ color: '#d9f4bd', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), 9.6, 1.4, 2.02, 1, 1, 1);
    this.supplyPulse.rotation.y = Math.PI / 4;
    this.beacon = orb(this.scene, '#e8bb5a', 10, 2.7, 1.2, 0.18);
    this.decorations();
    this.plots.forEach(p => {
      bake(p.leaf); bake(p.bean); bake(p.seeds); bake(p.highlight);
      bake(p.root, [p.leaf, p.bean, p.seeds, p.highlight, p.marker, p.soil, ...this.targets]);
    });
    bake(this.scene, [this.ship, this.waterLevel, this.beacon, this.supplyPulse, ...this.plots.map(p => p.root), ...this.targets]);
    this.planet = this.makeSpace();
    this.travelShip = this.spaceship(this.space, -4, -2, 3);
    this.travelShip.scale.setScalar(0.28); this.travelShip.rotation.z = -0.55;
    this.particleMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ vertexColors: false }), 128);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < 128; i++) {
      this.particles.push({ active: false, x: 0, y: -20, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, color: new THREE.Color(), size: 0.1 });
      this.dummy.scale.setScalar(0); this.dummy.updateMatrix(); this.particleMesh.setMatrixAt(i, this.dummy.matrix);
      this.particleMesh.setColorAt(i, new THREE.Color('#ffffff'));
    }
    this.scene.add(this.particleMesh);
    this.resize();
  }

  private terrain() {
    box(this.scene, '#3a6c51', 0, -0.9, 0, 31.8, 1.7, 25.2);
    box(this.scene, '#836f4b', 0, -0.25, 0, 32.2, 0.45, 25.6);
    box(this.scene, this.groundMaterial, 0, 0, 0, 32, 0.32, 25.4);
    box(this.scene, '#4e7f65', 0, -1.92, 0, 300, 0.5, 300);
    // Walkways are real geometry, with irregular inset paving stones.
    box(this.scene, '#b7a877', 0.2, 0.175, -4.15, 22, 0.08, 1.3);
    box(this.scene, '#b7a877', 0.4, 0.177, 1.4, 1.3, 0.08, 12.3);
    box(this.scene, '#b7a877', 3.3, 0.18, 6.35, 14.6, 0.08, 1.2);
    for (const [x, z, width, depth] of [[-6.7, -6, 4.3, 2.4], [-9.5, 0.2, 1.6, 1.6], [10, 1.5, 2.3, 2], [7.6, -7, 1.5, 1.6]]) {
      const shadow = mesh(this.scene, shadowGeo, shadowMaterial, x, 0.27, z, width, depth, 1);
      shadow.rotation.x = -Math.PI / 2;
    }
    for (let i = 0; i < 29; i++) {
      const x = -10.2 + i * 0.75;
      box(this.scene, i % 3 === 0 ? '#c9bc8c' : '#ab9c71', x, 0.225, -4.15 + (random() - 0.5) * 0.12, 0.65, 0.04, 0.92);
    }
    for (let i = 0; i < 15; i++) box(this.scene, '#c5b786', 0.4, 0.232, -3.7 + i * 0.7, 1.05, 0.035, 0.57);
    for (let i = 0; i < 5; i++) {
      const m = orb(this.scene, '#658571', -30 + i * 12, -0.6, -30 - random() * 8, 7 + random() * 4, 5 + random() * 7, 6);
      m.rotation.y = random() * 5;
    }
    // Fence around the farm; the foreground entrance stays open.
    for (let x = -13; x <= 13; x += 2) {
      this.fence(x, -10.5, false);
      if (Math.abs(x) > 3) this.fence(x, 10.8, false);
    }
    for (let z = -9; z <= 9; z += 2) { this.fence(-14, z, true); this.fence(14, z, true); }
    sign(this.scene, 'AGRIA / 07', -11.7, 1.65, 10.95, 2.3);
  }

  private fence(x: number, z: number, vertical: boolean) {
    const g = group(this.scene, x, 0.2, z); if (vertical) g.rotation.y = Math.PI / 2;
    box(g, C.cream, -0.9, 0.65, 0, 0.18, 1.3, 0.18);
    box(g, C.wood, -0.9, 1.32, 0, 0.28, 0.1, 0.28);
    box(g, '#cfbf93', 0, 0.48, 0, 1.8, 0.18, 0.1);
    box(g, '#cfbf93', 0, 0.98, 0, 1.8, 0.18, 0.1);
  }

  private researchBase(x: number, z: number) {
    const g = group(this.scene, x, 0.2, z);
    box(g, '#345d50', 0, 0.15, 0, 6.7, 0.3, 4.6);
    box(g, C.teal, 0, 0.85, 0, 6.2, 1.4, 4.1);
    box(g, C.cream, 0, 2.1, 0, 6.2, 1.8, 4.1);
    box(g, '#baad84', 0, 3.05, 0, 6.5, 0.18, 4.4);
    box(g, C.teal, 0, 3.3, -0.25, 5.8, 0.35, 3.45);
    box(g, '#508e77', -1.7, 3.56, -0.3, 1.4, 0.2, 2.6);
    // Solar panel and raised vents.
    const solar = group(g, 1.15, 3.7, -0.1); solar.rotation.x = -0.13;
    box(solar, C.metal, 0, 0, 0, 2.1, 0.1, 2.7);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) box(solar, '#314e5b', -0.65 + a * 0.65, 0.07, -0.95 + b * 0.63, 0.58, 0.04, 0.55);
    for (const wx of [-2.05, -0.5, 2.05]) {
      const ring = cylinder(g, '#7e795d', wx, 2.2, 2.1, 0.5, 0.12); ring.rotation.x = Math.PI / 2;
      const window = cylinder(g, '#203f40', wx, 2.2, 2.18, 0.38, 0.13); window.rotation.x = Math.PI / 2;
      box(g, '#84bdb0', wx - 0.08, 2.31, 2.27, 0.35, 0.07, 0.035);
    }
    box(g, '#284b41', 0.8, 1.15, 2.13, 1.2, 2.3, 0.17);
    box(g, '#b8b590', 0.8, 1.18, 2.24, 0.91, 2, 0.1);
    box(g, C.teal, 0.8, 1.6, 2.31, 0.63, 0.7, 0.05);
    box(g, C.orange, 1.12, 1.05, 2.34, 0.08, 0.23, 0.05);
    for (let i = 0; i < 3; i++) box(g, '#af936b', 0.8, 0.15 + i * 0.16, 3.2 - i * 0.3, 1.65, 0.23, 0.7);
    sign(g, 'ECO RESEARCH', -0.9, 2.92, 2.22, 2.75, 0.32);
    cylinder(g, '#9caa8b', -2.3, 4.1, -0.7, 0.055, 1.4);
    const dish = mesh(g, sphereGeo, C.cream, -2.3, 4.75, -0.7, 0.65, 0.15, 0.65); dish.rotation.z = -0.5;
    orb(g, C.orange, -2.55, 4.98, -0.7, 0.1);
    for (let i = 0; i < 3; i++) this.crate(x - 3.6 + i * 0.7, z + 2.8, i % 2 === 0);
    this.flowerBed(x - 1.8, z + 3.5);
  }

  private waterTank(x: number, z: number) {
    const g = group(this.scene, x, 0.2, z);
    box(g, '#6f7a5d', 0, 0.1, 0, 3.2, 0.2, 3.1);
    for (const dx of [-0.8, 0.8]) for (const dz of [-0.7, 0.7]) box(g, '#68765b', dx, 0.7, dz, 0.17, 1.4, 0.17);
    cylinder(g, C.cream, 0, 2.05, 0, 1.25, 2.3);
    cylinder(g, '#327f77', 0, 1.72, 0, 1.27, 0.6);
    cylinder(g, '#97bcb0', 0, 3.25, 0, 1.29, 0.16);
    cylinder(g, '#576f57', 0, 3.42, 0, 0.25, 0.2);
    box(g, '#3c6659', 0.55, 2.05, 1.19, 0.37, 1.5, 0.16);
    const level = box(g, C.blue, 0.55, 2.05, 1.29, 0.19, 1.25, 0.05);
    sign(g, 'H₂O', -0.3, 2.6, 1.24, 1, 0.44);
    cylinder(g, '#a5aa85', 1.4, 0.55, 0.25, 0.12, 0.9);
    const pipe = cylinder(g, '#a5aa85', 0.8, 0.9, 0.25, 0.12, 1.3); pipe.rotation.z = Math.PI / 2;
    orb(g, C.orange, 1.42, 0.98, 0.25, 0.2);
    return level;
  }

  private deliveryStation(x: number, z: number) {
    const g = group(this.scene, x, 0.2, z);
    box(g, '#697a5f', 0, 0.1, 0, 4.2, 0.2, 3.5);
    box(g, C.teal, 0, 1.1, -0.4, 2.7, 1.9, 1.7);
    box(g, C.cream, 0, 2.1, -0.4, 3, 0.3, 2);
    box(g, '#254e42', 0, 1.2, 0.49, 1.7, 0.85, 0.1);
    box(g, '#f3c15d', -0.3, 1.22, 0.56, 0.65, 0.5, 0.05);
    box(g, '#b3d9ae', 0.45, 1.28, 0.56, 0.4, 0.08, 0.05);
    box(g, '#b3d9ae', 0.45, 1.1, 0.56, 0.4, 0.06, 0.05);
    box(g, '#bcaa80', 0, 0.6, 1.1, 2.5, 0.7, 1.1);
    for (let i = 0; i < 7; i++) {
      const roller = cylinder(g, '#647464', -1 + i * 0.33, 0.99, 1.1, 0.09, 0.95); roller.rotation.x = Math.PI / 2;
    }
    sign(g, 'SUPPLY ↗', 0, 2.22, 0.63, 2.45, 0.47);
    this.crate(x + 1.7, z + 1.2, true); this.crate(x + 2.2, z - 0.2, false);
    const hit = box(g, new THREE.MeshBasicMaterial({ visible: false }), 0, 1.3, 0, 4.3, 3, 3.5);
    hit.userData = { delivery: true }; this.targets.push(hit);
  }

  private spaceship(parent: THREE.Object3D, x: number, y: number, z: number) {
    const g = group(parent, x, y, z);
    cylinder(g, '#c4b99b', 0, 1.85, 0, 0.85, 2.7);
    cylinder(g, C.orange, 0, 1.1, 0, 0.88, 0.7);
    mesh(g, coneGeo, C.teal, 0, 3.85, 0, 0.86, 1.45, 0.86);
    cylinder(g, '#8d8d72', 0, 0.43, 0, 0.56, 0.4);
    const window = cylinder(g, '#315b60', 0, 2.4, 0.83, 0.36, 0.1); window.rotation.x = Math.PI / 2;
    const glint = cylinder(g, '#80c6be', -0.06, 2.47, 0.9, 0.2, 0.12); glint.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const leg = group(g, 0, 0, 0); leg.rotation.y = i * Math.PI * 2 / 3;
      const fin = box(leg, C.teal, 0.84, 0.75, 0, 0.45, 1.5, 0.3); fin.rotation.z = -0.25;
      box(leg, '#54745d', 1.05, 0.08, 0, 0.65, 0.16, 0.6);
    }
    sign(g, '07', 0, 1.5, 0.9, 0.6, 0.4, '#c19442');
    return g;
  }

  private landingPad(x: number, z: number) {
    cylinder(this.scene, '#747f64', x, 0.2, z, 2.6, 0.16);
    cylinder(this.scene, '#a8a27a', x, 0.29, z, 2.25, 0.04);
    box(this.scene, '#d7cc9f', x, 0.32, z, 0.3, 0.02, 2.1);
    box(this.scene, '#d7cc9f', x, 0.32, z, 1.8, 0.02, 0.3);
    for (let i = 0; i < 8; i++) orb(this.scene, i % 2 ? C.orange : '#c3e5ba', x + Math.cos(i * Math.PI / 4) * 2.35, 0.35, z + Math.sin(i * Math.PI / 4) * 2.35, 0.12);
  }

  private greenhouse(x: number, z: number) {
    const g = group(this.scene, x, 0.2, z);
    box(g, '#b1a37b', 0, 0.12, 0, 5.5, 0.24, 3.1);
    box(g, '#675b3f', 0, 0.3, 0, 5.1, 0.2, 2.8);
    for (let i = 0; i < 4; i++) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.065, 4, 12, Math.PI), mat(C.cream));
      arch.rotation.y = Math.PI / 2; arch.position.set(-2.4 + i * 1.6, 0.45, 0); g.add(arch);
    }
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 5, 12, 1, true, 0, Math.PI), new THREE.MeshLambertMaterial({ color: '#b0c9ab', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
    glass.rotation.z = Math.PI / 2; glass.rotation.x = Math.PI / 2; glass.position.y = 0.45; g.add(glass);
    box(g, C.cream, 0, 0.45, 1.4, 5.3, 0.12, 0.12); box(g, C.cream, 0, 0.45, -1.4, 5.3, 0.12, 0.12);
    for (let i = 0; i < 10; i++) {
      const px = -2 + (i % 5) * 0.95, pz = -0.6 + Math.floor(i / 5) * 1.2;
      orb(g, '#76a54d', px, 0.65, pz, 0.43, 0.4, 0.43);
      orb(g, i % 2 ? '#d69ba5' : '#d5b554', px, 0.98, pz, 0.12);
    }
  }

  private makePlots() {
    const plots: PlotVisual[] = [];
    // Three columns, two rows; central path leaves generous separation between plots.
    const positions = [[-4.8, -0.9], [-0.3, -0.9], [4.2, -0.9], [-4.8, 3.6], [-0.3, 3.6], [4.2, 3.6]];
    for (let i = 0; i < positions.length; i++) {
      const [x, z] = positions[i];
      const root = group(this.scene, x, 0.23, z);
      box(root, '#beaa78', 0, 0.05, 0, 3.72, 0.2, 3.42);
      const soil = box(root, mat(C.soil).clone(), 0, 0.18, 0, 3.4, 0.18, 3.12);
      for (let r = 0; r < 5; r++) box(root, '#745339', 0, 0.29, -1.2 + r * 0.6, 3.2, 0.07, 0.14);
      const hit = box(root, new THREE.MeshBasicMaterial({ visible: false }), 0, 0.32, 0, 3.75, 0.45, 3.4);
      hit.userData = { plot: i }; this.targets.push(hit);
      const highlight = group(root, 0, 0.3, 0);
      for (const s of [-1, 1]) {
        box(highlight, '#f4dd8a', 0, 0, s * 1.67, 3.75, 0.07, 0.07);
        box(highlight, '#f4dd8a', s * 1.83, 0, 0, 0.07, 0.07, 3.4);
        for (const t of [-1, 1]) box(highlight, '#fff0ac', s * 1.83, 0.17, t * 1.67, 0.14, 0.35, 0.14);
      }
      highlight.visible = false;
      const seeds = group(root, 0, 0, 0), leaf = group(root, 0, 0.26, 0), bean = group(root, 0, 0.26, 0);
      const leafMaterial = mat('#79c5a1').clone(), beanMaterial = mat('#537f92').clone();
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const px = (a - 1) * 0.98, pz = (b - 1) * 0.92;
        orb(seeds, '#dac28a', px, 0.33, pz, 0.09, 0.065, 0.09);
        cropPlant(leaf, 'leaf', leafMaterial, px, pz);
        cropPlant(bean, 'bean', beanMaterial, px, pz);
      }
      const marker = mesh(root, coneGeo, '#f6d57e', 0, 2.15, 0, 0.17, 0.3, 0.17);
      marker.material = (marker.material as THREE.MeshLambertMaterial).clone();
      marker.rotation.z = Math.PI; marker.visible = false;
      sign(root, `0${i + 1}`, 1.35, 0.65, 1.8, 0.45, 0.3);
      box(root, C.wood, 1.35, 0.35, 1.75, 0.09, 0.7, 0.09);
      plots.push({ root, soil, highlight, seeds, leaf, bean, marker, leafMaterial, beanMaterial });
    }
    return plots;
  }

  private crate(x: number, z: number, tall: boolean) {
    const y = tall ? 0.7 : 0.45;
    box(this.scene, '#ac8654', x, y, z, 0.68, tall ? 1 : 0.55, 0.68);
    box(this.scene, '#d8b472', x, y, z + 0.35, 0.69, 0.08, 0.03);
    for (const dx of [-0.25, 0.25]) box(this.scene, '#775f40', x + dx, y, z + 0.36, 0.07, tall ? 0.95 : 0.5, 0.035);
  }

  private flowerBed(x: number, z: number) {
    box(this.scene, C.cream, x, 0.4, z, 2.3, 0.5, 0.65);
    box(this.scene, C.soil, x, 0.67, z, 2.1, 0.05, 0.5);
    for (let i = 0; i < 5; i++) {
      cylinder(this.scene, '#667d40', x - 0.85 + i * 0.42, 0.95, z, 0.035, 0.65);
      orb(this.scene, i % 2 ? C.pink : '#e9cc71', x - 0.85 + i * 0.42, 1.25, z, 0.15, 0.13, 0.15);
    }
  }

  private tree(x: number, z: number, scale: number, pink: boolean) {
    const shadow = mesh(this.scene, shadowGeo, shadowMaterial, x + 0.5 * scale, 0.26, z + 0.3 * scale, 1.6 * scale, 1.1 * scale, 1);
    shadow.rotation.x = -Math.PI / 2;
    const g = group(this.scene, x, 0.2, z); g.scale.setScalar(scale);
    const trunk = cylinder(g, '#857650', 0, 1.5, 0, 0.19, 3); trunk.rotation.z = -0.08;
    for (let i = 0; i < 4; i++) {
      const angle = i * 2.4;
      const branch = cylinder(g, '#857650', Math.cos(angle) * 0.35, 2.3 + i * 0.2, Math.sin(angle) * 0.35, 0.08, 1.3);
      branch.rotation.z = Math.cos(angle) * 0.8; branch.rotation.x = Math.sin(angle) * 0.8;
      orb(g, pink ? ['#cf8f9b', '#e0aaad'][i % 2] : ['#649951', '#79a856', '#508d50'][i % 3], Math.cos(angle) * 0.7, 3.15 + i * 0.24, Math.sin(angle) * 0.7, 1.05, 0.62, 0.9);
    }
    orb(g, pink ? '#e7b7b5' : '#90b46a', 0, 4, 0, 0.9, 0.65, 0.8);
  }

  private decorations() {
    this.tree(12.1, -6, 1, false); this.tree(-12.3, -7.8, 0.85, false);
    this.tree(10.8, 7.9, 1.2, false); this.tree(-12.4, 6.8, 1.08, true);
    this.tree(2.3, -9, 0.9, true); this.tree(-1.8, -10, 0.7, false);
    // Batched ground vegetation and pebbles: hundreds of details in four draw calls.
    const batches = ['#668e4d', '#81a65a', '#c7bd83', '#a2c1ad'].map(color => new THREE.InstancedMesh(rockGeo, mat(color), 300));
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 1100; i++) {
      const x = (random() - 0.5) * 31, z = (random() - 0.5) * 24;
      const edge = Math.abs(x) > 12 || Math.abs(z) > 9;
      if (!edge && !(x < -9 && z > 3) && !(x > 7 && z > 6)) continue;
      const b = i % 4; if (counts[b] >= 300) continue;
      this.dummy.position.set(x, 0.25, z);
      this.dummy.scale.set(0.06 + random() * 0.12, 0.08 + random() * (b < 2 ? 0.4 : 0.1), 0.07 + random() * 0.1);
      this.dummy.rotation.set(0, random() * 6, (random() - 0.5) * 0.2); this.dummy.updateMatrix();
      batches[b].setMatrixAt(counts[b]++, this.dummy.matrix);
    }
    batches.forEach((batch, i) => { batch.count = counts[i]; this.scene.add(batch); });
    for (let i = 0; i < 16; i++) {
      const x = -15 + i * 1.9, z = i % 2 ? 11.7 : -11.5;
      orb(this.scene, '#73816a', x, 0.35, z, 0.3 + random() * 0.4, 0.35 + random() * 0.3, 0.4);
    }
    // Alien mushrooms, luminous ground plants, and small utility lamps.
    for (const [x, z] of [[-11, 4], [12, 5], [11, -2.5], [-3, -9.5], [-10, 9]]) {
      for (let i = 0; i < 3; i++) {
        const px = x + i * 0.36;
        cylinder(this.scene, '#bbba8b', px, 0.46 + i * 0.04, z, 0.06, 0.5 + i * 0.08);
        orb(this.scene, i % 2 ? '#b29bc3' : '#90c7bb', px, 0.76 + i * 0.08, z, 0.3, 0.15, 0.3);
      }
    }
    for (const [x, z] of [[-7, -3.6], [6.8, 5.9], [-0.8, 7], [10, -3.5]]) {
      cylinder(this.scene, '#85977a', x, 0.95, z, 0.07, 1.6);
      cylinder(this.scene, '#315f52', x, 1.8, z, 0.36, 0.12);
      cylinder(this.scene, '#c4e5b8', x, 1.72, z, 0.24, 0.12);
    }
    this.flowerBed(3, -5.8);
    // A tiny rover parked beside the landing pad.
    const rover = group(this.scene, 10.5, 0.45, -4.5);
    box(rover, '#c3b58a', 0, 0.55, 0, 1.45, 0.65, 1.7);
    box(rover, '#d6a84c', 0, 1.1, -0.15, 1.25, 0.55, 0.9);
    box(rover, '#345e54', 0, 1.15, 0.33, 1, 0.3, 0.05);
    for (const x of [-0.78, 0.78]) for (const z of [-0.55, 0.55]) {
      const wheel = cylinder(rover, '#344939', x, 0.12, z, 0.34, 0.25); wheel.rotation.z = Math.PI / 2;
    }
    cylinder(rover, '#b5b699', 0.4, 1.8, -0.6, 0.025, 1.2);
  }

  private makeSpace() {
    this.space.background = new THREE.Color('#0e252d');
    this.space.add(new THREE.HemisphereLight('#d5eac8', '#172c3a', 1.9));
    const light = new THREE.DirectionalLight('#ffe7ad', 3); light.position.set(-8, 10, 8); this.space.add(light);
    this.spaceCamera.position.set(0, 1, 19); this.spaceCamera.lookAt(0, 0, 0);
    const p = group(this.space, 2, 0, -5);
    orb(p, '#548e7d', 0, 0, 0, 4.5);
    for (let i = 0; i < 28; i++) {
      const phi = random() * Math.PI * 2, theta = random() * Math.PI;
      orb(p, ['#8aa66e', '#699961', '#9ca776'][i % 3], Math.sin(theta) * Math.cos(phi) * 4.25, Math.cos(theta) * 4.25, Math.sin(theta) * Math.sin(phi) * 4.25, 0.65 + random() * 0.5, 0.5, 0.65);
    }
    const stars = new Float32Array(180 * 3);
    for (let i = 0; i < stars.length; i += 3) { stars[i] = (random() - 0.5) * 70; stars[i + 1] = (random() - 0.5) * 45; stars[i + 2] = -15 - random() * 25; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.space.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#eadfbb', size: 0.07 })));
    orb(this.space, '#c8c4a0', -7, 3.5, -9, 0.9);
    return p;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const aspect = w / h;
    this.height = this.highQuality ? 540 : 360;
    this.width = Math.round(this.height * aspect);
    this.renderer.setSize(this.width, this.height, false);
    const vertical = aspect < 1.3 ? 33 / aspect : 25.5;
    this.camera.left = -vertical * aspect / 2; this.camera.right = vertical * aspect / 2;
    this.camera.top = vertical / 2; this.camera.bottom = -vertical / 2;
    this.camera.updateProjectionMatrix();
    this.spaceCamera.aspect = aspect; this.spaceCamera.updateProjectionMatrix();
  }

  toggleQuality() { this.highQuality = !this.highQuality; this.resize(); return this.highQuality; }

  hit(clientX: number, clientY: number): { plot?: number; delivery?: boolean } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.targets, false);
    return hits[0]?.object.userData ?? null;
  }

  // Also used by the end-to-end playtest to click the actual projected 3D objects.
  projectPlot(id: number) {
    const position = this.plots[id].root.position.clone(); position.y += 0.45; position.project(this.camera);
    return { x: (position.x + 1) * window.innerWidth / 2, y: (1 - position.y) * window.innerHeight / 2 };
  }

  projectCrop(id: number, kind: CropKind) {
    const position = this.plots[id].root.position.clone();
    position.y += kind === 'bean' ? 2.25 : 1.35;
    return this.projectPosition(position);
  }

  projectSupply() { return this.projectPosition(new THREE.Vector3(9.6, 3.05, 1.2)); }

  private projectPosition(position: THREE.Vector3) {
    position.project(this.camera);
    return { x: (position.x + 1) * window.innerWidth / 2, y: (1 - position.y) * window.innerHeight / 2 };
  }

  harvest(id: number, kind: CropKind) {
    const origin = this.plots[id].root.position;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (let i = 0; i < (reduced ? 1 : 9); i++) {
      const root = group(this.scene, 0, 0, 0);
      root.add(this.harvestTemplates[kind].clone(true));
      const start = new THREE.Vector3(origin.x + (i % 3 - 1) * 0.98, origin.y + 0.26, origin.z + (Math.floor(i / 3) - 1) * 0.92);
      const control = start.clone().lerp(this.supplyIntake, 0.45); control.y += 4 + (i % 3) * 0.3;
      root.position.copy(start); root.visible = !reduced;
      // Shared primitives/materials keep repeated and simultaneous harvests bounded.
      if (!reduced) for (let j = 0; j < 3; j++) orb(root, kind === 'leaf' ? moonMaterial : starMaterial, -0.14 * j, 0.3, 0.15 * j, 0.07 - j * 0.015);
      this.harvestFlights.push({ root, start, control, age: -i * 0.045, duration: reduced ? 0.18 : 1.05, kind });
    }
    this.burst(id, 'harvest');
  }

  private updateHarvest(dt: number) {
    for (let i = this.harvestFlights.length - 1; i >= 0; i--) {
      const flight = this.harvestFlights[i]; flight.age += dt;
      const t = THREE.MathUtils.clamp(flight.age / flight.duration, 0, 1);
      const u = t * t;
      flight.root.position.copy(flight.start).multiplyScalar((1 - u) ** 2)
        .addScaledVector(flight.control, 2 * (1 - u) * u).addScaledVector(this.supplyIntake, u * u);
      flight.root.rotation.set(0, t * 2, -Math.sin(t * Math.PI) * 0.45);
      flight.root.scale.setScalar((1 + Math.sin(t * Math.PI) * 0.2) * Math.min(1, (1 - t) * 5));
      if (t >= 1) {
        flight.root.removeFromParent(); this.harvestFlights.splice(i, 1);
        this.supplyPulseTime = 0.45;
        (this.supplyPulse.material as THREE.MeshBasicMaterial).color.set(flight.kind === 'leaf' ? '#c6f8d5' : '#dfcbff');
      }
    }
    this.supplyPulseTime = Math.max(0, this.supplyPulseTime - dt);
    (this.supplyPulse.material as THREE.MeshBasicMaterial).opacity = this.supplyPulseTime * 1.8;
    this.supplyPulse.scale.setScalar(1 + (1 - this.supplyPulseTime / 0.45) * 2.5);
  }

  get harvestInFlight() { return this.harvestFlights.length; }

  burst(id: number, kind: string) {
    const origin = id >= 0 ? this.plots[id].root.position : kind === 'land' ? this.ship.position : new THREE.Vector3(9.6, 1, 1.2);
    const n = kind === 'water' ? 24 : kind === 'won' ? 80 : 22;
    let used = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      const angle = random() * Math.PI * 2;
      p.active = true; p.x = origin.x + (random() - 0.5) * 2.2; p.z = origin.z + (random() - 0.5) * 2.2;
      p.y = kind === 'water' ? 3 + random() : 0.5;
      p.vx = Math.cos(angle) * (kind === 'land' ? 3 : 1.2); p.vz = Math.sin(angle) * (kind === 'land' ? 3 : 1.2);
      p.vy = kind === 'water' ? -2 : 2 + random() * 3;
      p.max = p.life = 0.6 + random() * 0.65;
      p.size = kind === 'water' ? 0.09 : 0.12;
      p.color.set(kind === 'water' ? '#a7efef' : kind === 'plant' ? '#c3de81' : kind === 'land' ? '#d9cb9d' : ['#f7d572', '#e7a8b8', '#b7d783'][used % 3]);
      if (++used >= n) break;
    }
  }

  private updateCrop(v: PlotVisual, crop: Crop | null, t: number) {
    v.seeds.visible = !!crop && crop.growth < 0.13 && !crop.dead;
    v.leaf.visible = !!crop && crop.kind === 'leaf' && crop.growth >= 0.07;
    v.bean.visible = !!crop && crop.kind === 'bean' && crop.growth >= 0.07;
    v.marker.visible = !!crop && (crop.growth >= 1 || crop.moisture < 15 || crop.dead);
    if (!crop) return;
    const scale = 0.18 + crop.growth * 0.82;
    v.leaf.scale.set(scale, scale * (crop.dead ? 0.25 : crop.dryTime > 0 ? 0.65 : 1), scale);
    v.bean.scale.set(scale, scale * (crop.dead ? 0.3 : crop.dryTime > 0 ? 0.6 : 1), scale);
    v.bean.rotation.z = crop.dead ? 0.25 : Math.sin(t * 1.6 + v.root.position.x) * 0.025;
    v.leaf.rotation.y = Math.sin(t * 1.5 + v.root.position.z) * 0.025;
    const wilt = crop.dead ? 1 : Math.max(0, (25 - crop.moisture) / 25) * 0.7;
    v.leafMaterial.color.copy(this.leafColor).lerp(crop.dead ? this.deadColor : this.wiltColor, wilt);
    v.beanMaterial.color.copy(this.beanColor).lerp(crop.dead ? this.deadColor : this.wiltColor, wilt);
    (v.soil.material as THREE.MeshLambertMaterial).color.set(crop.moisture > 50 ? '#514334' : crop.moisture < 15 ? '#a88b59' : C.soil);
    v.marker.position.y = (crop.kind === 'bean' ? 2.15 : 1.25) + Math.sin(t * 3) * 0.13;
    (v.marker.material as THREE.MeshLambertMaterial).color.copy(crop.moisture < 15 || crop.dead ? this.warningColor : this.readyColor);
  }

  render(state: GameState, dt: number, introTime = -1) {
    this.elapsed += dt;
    this.updateHarvest(state.phase === 'playing' ? dt : 0);
    this.dryBlend += ((state.drought ? 1 : 0) - this.dryBlend) * Math.min(1, dt * 0.8);
    this.groundMaterial.color.set('#ffffff').lerp(this.dryColor, this.dryBlend * 0.45);
    this.sun.color.set('#fff1d0').lerp(this.drySunColor, this.dryBlend);
    this.waterLevel.scale.y = Math.max(0.01, state.water / 100) * 1.25;
    this.waterLevel.position.y = 1.425 + state.water / 100 * 0.625;
    this.beacon.scale.setScalar(0.15 + Math.sin(this.elapsed * 3) * 0.03);
    this.plots.forEach((v, i) => {
      const guided = !!state.tutorial && !['deliver', 'complete'].includes(state.tutorial) && i === TUTORIAL_PLOT;
      v.highlight.visible = guided || !state.tutorial && state.selected === i;
      v.highlight.scale.setScalar(guided ? 1.03 + Math.sin(this.elapsed * 4) * 0.025 : 1);
      this.updateCrop(v, state.phase === 'menu' ? this.previewCrops[i] : state.plots[i].crop, this.elapsed);
      if (state.phase === 'menu') v.marker.visible = false;
      if (!state.plots[i].crop) (v.soil.material as THREE.MeshLambertMaterial).color.set(C.soil).lerp(this.dryColor, this.dryBlend * 0.45);
    });
    this.particles.forEach((p, i) => {
      if (p.active) {
        p.life -= dt; p.active = p.life > 0;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 4 * dt;
        this.dummy.position.set(p.x, Math.max(0.3, p.y), p.z);
        this.dummy.scale.setScalar(p.active ? p.size * Math.min(1, p.life * 4) : 0);
        this.dummy.rotation.set(this.elapsed * 2, i, 0);
        this.particleMesh.setColorAt(i, p.color);
      } else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix(); this.particleMesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.particleMesh.instanceColor!.needsUpdate = true;
    if (introTime >= 0 && introTime < 4.2) {
      const t = introTime / 4.2;
      this.planet.rotation.y = this.elapsed * 0.04;
      this.planet.scale.setScalar(0.8 + t * 0.5);
      this.travelShip.position.set(-5 + t * 6, -1.7 + t * 1.8, 3 - t * 7);
      this.spaceCamera.position.z = 19 - t * 5;
      this.renderer.render(this.space, this.spaceCamera);
    } else {
      this.ship.position.y = introTime >= 4.2 ? 0.2 + Math.pow(Math.max(0, 1 - (introTime - 4.2) / 2.8), 2) * 13 : 0.2;
      if (introTime >= 4.2) {
        const t = Math.min(1, (introTime - 4.2) / 3.3);
        this.camera.zoom = 1.15 - t * 0.15; this.camera.updateProjectionMatrix();
      } else if (this.camera.zoom !== 1) { this.camera.zoom = 1; this.camera.updateProjectionMatrix(); }
      this.renderer.render(this.scene, this.camera);
    }
  }

  resetEffects() {
    this.particles.forEach(p => { p.active = false; }); this.dryBlend = 0;
    this.harvestFlights.forEach(flight => flight.root.removeFromParent()); this.harvestFlights = [];
    this.supplyPulseTime = 0;
  }
  get stats() { return `${this.width} × ${this.height} · ${this.renderer.info.render.calls} calls · ${this.renderer.info.render.triangles.toLocaleString()} tris`; }
}
