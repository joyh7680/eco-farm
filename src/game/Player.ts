// World-space footprints shared by rendering, collision and interaction.
import { LANDING_SITE, SHORE_WATER } from './Arrival';
export interface Footprint { x: number; z: number; hx: number; hz: number }
export interface FarmTarget extends Footprint { kind: 'plot' | 'tank' | 'supply'; id: number }
export const PLOT_POSITIONS = [[-4.8, -0.9], [-0.3, -0.9], [4.2, -0.9], [-4.8, 3.6], [-0.3, 3.6], [4.2, 3.6]] as const;
// Keep legacy plot IDs and saved chapter work stable; extend the abandoned farm northward.
export const CHAPTER_PLOT_POSITIONS = [...PLOT_POSITIONS, [-4.8, -5.4], [-0.3, -5.4], [4.2, -5.4]] as const;
const CHAPTER_OBSTACLES: Footprint[] = [
  ...CHAPTER_PLOT_POSITIONS.map(([x, z]) => ({ x, z, hx: 1.86, hz: 1.71 })),
  LANDING_SITE,
];
export const FARM_TARGETS: FarmTarget[] = [
  ...PLOT_POSITIONS.map(([x, z], id) => ({ kind: 'plot' as const, id, x, z, hx: 1.86, hz: 1.71 })),
  { kind: 'tank', id: -1, x: -10, z: -0.3, hx: 1.6, hz: 1.55 },
  { kind: 'supply', id: -1, x: 9.6, z: 1.2, hx: 2.1, hz: 1.75 },
];
const OBSTACLES: Footprint[] = [
  ...FARM_TARGETS,
  { x: -7.4, z: -6.5, hx: 3.5, hz: 2.3 }, // research base
  { x: -6.9, z: 7.1, hx: 2.75, hz: 1.55 }, // greenhouse
  { x: 7.4, z: -7.2, hx: 1.45, hz: 1.45 }, // landed ship
  { x: 10.5, z: -4.5, hx: 1.1, hz: 1.15 }, // rover
  { x: 12.1, z: -6, hx: 0.4, hz: 0.4 },
  { x: -12.3, z: -7.8, hx: 0.4, hz: 0.4 },
  { x: 10.8, z: 7.9, hx: 0.5, hz: 0.5 },
  { x: -12.4, z: 6.8, hx: 0.5, hz: 0.5 },
  { x: 2.3, z: -9, hx: 0.4, hz: 0.4 },
  { x: -1.8, z: -10, hx: 0.3, hz: 0.3 },
  { x: -10.3, z: -3.7, hx: 1.1, hz: 0.45 }, // base crates
  { x: 11.55, z: 1.7, hx: 0.7, hz: 1 }, // supply crates
];
export function edgeDistance(x: number, z: number, rect: Footprint) {
  return Math.hypot(Math.max(0, Math.abs(x - rect.x) - rect.hx), Math.max(0, Math.abs(z - rect.z) - rect.hz));
}

export class Player {
  static readonly radius = 0.27;
  static readonly reach = 1.05;
  x = 0;
  z = 7.4;
  angle = 0.65;
  moving = false;
  walkTime = 0;
  actionTime = 0;
  action = '';
  chapterMap = false;
  private keys = new Set<string>();
  private stickX = 0;
  private stickY = 0;

  reset() {
    this.x = 0; this.z = 7.4; this.angle = 0.65;
    this.moving = false; this.walkTime = 0; this.actionTime = 0; this.action = '';
    this.clearInput();
  }
  key(code: string, down: boolean) { if (down) this.keys.add(code); else this.keys.delete(code); }
  stick(x: number, y: number) { this.stickX = x; this.stickY = y; }
  clearInput() { this.keys.clear(); this.stickX = this.stickY = 0; this.moving = false; }
  canStand(x: number, z: number) {
    const obstacles = this.chapterMap ? CHAPTER_OBSTACLES : OBSTACLES;
    const inside = this.chapterMap ? x >= -14 && x <= 23.5 && z >= -10 && z <= 18 : Math.abs(x) <= 13.4 && z >= -10 && z <= 10.25;
    const water = this.chapterMap && (((x - SHORE_WATER.x) / (SHORE_WATER.rx + Player.radius)) ** 2 + ((z - SHORE_WATER.z) / (SHORE_WATER.rz + Player.radius)) ** 2 < 1);
    return inside && !water && obstacles.every(rect => edgeDistance(x, z, rect) >= Player.radius);
  }
  nearby(): FarmTarget | null {
    let closest: FarmTarget | null = null, distance = Player.reach;
    for (const target of FARM_TARGETS) {
      const d = edgeDistance(this.x, this.z, target);
      if (d < distance) { closest = target; distance = d; }
    }
    return closest;
  }
  inReach(target: Footprint) { return edgeDistance(this.x, this.z, target) < Player.reach; }
  perform(action: string, target: Footprint) {
    this.action = action; this.actionTime = 0.48;
    this.angle = Math.atan2(target.x - this.x, target.z - this.z);
  }
  update(dt: number) {
    this.actionTime = Math.max(0, this.actionTime - dt);
    const has = (a: string, b: string) => Number(this.keys.has(a) || this.keys.has(b));
    let sx = has('KeyD', 'ArrowRight') - has('KeyA', 'ArrowLeft') + this.stickX;
    let sy = has('KeyS', 'ArrowDown') - has('KeyW', 'ArrowUp') + this.stickY;
    const length = Math.hypot(sx, sy);
    if (length > 1) { sx /= length; sy /= length; }
    this.moving = length > 0.08 && this.actionTime === 0;
    if (!this.moving) return;
    // Match the fixed camera (27,31,36): right and up remain screen-relative.
    const dx = (sx * 0.8 + sy * 0.6) * 4.6 * dt;
    const dz = (-sx * 0.6 + sy * 0.8) * 4.6 * dt;
    // Substeps prevent tunnelling during a slow frame; axis sliding keeps paths natural.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
    const beforeX = this.x, beforeZ = this.z;
    for (let i = 0; i < steps; i++) {
      if (this.canStand(this.x + dx / steps, this.z)) this.x += dx / steps;
      if (this.canStand(this.x, this.z + dz / steps)) this.z += dz / steps;
    }
    this.moving = Math.hypot(this.x - beforeX, this.z - beforeZ) > 0.001;
    if (this.moving) {
      this.angle = Math.atan2(dx, dz);
      this.walkTime += dt * Math.min(1, length) * 11;
    }
  }
}
