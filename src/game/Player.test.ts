import { describe, expect, it } from 'vitest';
import { CHAPTER_PLOT_POSITIONS, FARM_TARGETS, Player, edgeDistance } from './Player';
import { LANDING_EXIT, LANDING_SITE, SHORE_WATER } from './Arrival';

describe('character locomotion', () => {
  it('matches the abandoned 3×3 map without invisible building or tree collisions', () => {
    const p = new Player(); p.chapterMap = true;
    expect(CHAPTER_PLOT_POSITIONS).toHaveLength(9);
    for (const [x, z] of [[-7.4, -6.5], [9.6, 1.2], [-10, -0.3], [-6.9, 7.1], [12.1, -6]]) expect(p.canStand(x, z)).toBe(true);
    for (const [x, z] of CHAPTER_PLOT_POSITIONS) expect(p.canStand(x, z)).toBe(false);
    expect(p.canStand(LANDING_SITE.x, LANDING_SITE.z)).toBe(false);
    expect(p.canStand(SHORE_WATER.x, SHORE_WATER.z)).toBe(false);
    const start = [Math.round(LANDING_EXIT.x * 4), Math.round(LANDING_EXIT.z * 4)];
    const step = 0.25, queue = [start], seen = new Set([start.join(',')]), reached = new Set<number>();
    for (let i = 0; i < queue.length; i++) {
      const [gx, gz] = queue[i];
      CHAPTER_PLOT_POSITIONS.forEach(([x, z], id) => { if (edgeDistance(gx * step, gz * step, { x, z, hx: 1.86, hz: 1.71 }) < 0.8) reached.add(id); });
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = gx + dx, nz = gz + dz, key = `${nx},${nz}`;
        if (!seen.has(key) && p.canStand(nx * step, nz * step)) { seen.add(key); queue.push([nx, nz]); }
      }
    }
    expect(reached.size).toBe(9);
    p.chapterMap = false; expect(p.canStand(9.6, 1.2)).toBe(false);
  });
  it('moves in camera-relative directions with normalized diagonals', () => {
    const straight = new Player(), diagonal = new Player();
    straight.key('KeyD', true); diagonal.key('ArrowRight', true); diagonal.key('ArrowDown', true);
    straight.update(0.1); diagonal.update(0.1);
    expect(straight.x).toBeGreaterThan(0); expect(straight.z).toBeLessThan(7.4);
    expect(Math.hypot(straight.x, straight.z - 7.4)).toBeCloseTo(0.46);
    expect(Math.hypot(diagonal.x, diagonal.z - 7.4)).toBeCloseTo(0.46);
  });
  it('uses identical travel speed at 30 and 60 FPS', () => {
    const a = new Player(), b = new Player(); a.key('KeyD', true); b.key('KeyD', true);
    for (let i = 0; i < 15; i++) a.update(1 / 30);
    for (let i = 0; i < 30; i++) b.update(1 / 60);
    expect(a.x).toBeCloseTo(b.x); expect(a.z).toBeCloseTo(b.z);
  });
  it('stops against beds, buildings and fences without tunnelling on a slow frame', () => {
    const p = new Player(); p.x = -4.8; p.z = 1.4;
    p.stick(-0.6, -0.8); p.update(0.25);
    expect(p.z).toBeGreaterThanOrEqual(0.81 + Player.radius);
    expect(p.canStand(-4.8, -0.9)).toBe(false);
    expect(p.canStand(-7.4, -6.5)).toBe(false);
    expect(p.canStand(-10, -0.3)).toBe(false);
    expect(p.canStand(9.6, 1.2)).toBe(false);
    p.x = 13.3; p.z = 8; p.stick(0.8, 0.6); p.update(0.25);
    expect(p.x).toBeLessThanOrEqual(13.4); expect(p.canStand(p.x, p.z)).toBe(true);
  });
  it('can walk along the narrow path between beds', () => {
    const p = new Player(); p.x = -6.8; p.z = 1.35;
    p.stick(0.8, 0.6);
    for (let i = 0; i < 150; i++) { p.update(1 / 60); expect(p.canStand(p.x, p.z)).toBe(true); }
    expect(p.x).toBeGreaterThan(4.6); expect(p.z).toBeCloseTo(1.35);
  });
  it('selects only the nearest reachable target and clears stale input on reset', () => {
    const p = new Player(); expect(p.nearby()).toBeNull(); expect(p.inReach(FARM_TARGETS[0])).toBe(false);
    p.x = -4.8; p.z = 1.2; expect(p.nearby()?.id).toBe(0);
    p.x = -7.8; p.z = -0.3; expect(p.nearby()?.kind).toBe('tank');
    p.x = 9.6; p.z = 3.5; expect(p.nearby()?.kind).toBe('supply');
    p.key('KeyW', true); p.stick(1, 0); p.reset(); p.update(1);
    expect(p.x).toBe(0); expect(p.z).toBe(7.4);
  });
  it('locks movement briefly for an action and resumes only with active input', () => {
    const p = new Player(); p.key('KeyD', true); p.perform('water', FARM_TARGETS[0]);
    p.update(0.2); expect(p.x).toBe(0); expect(p.actionTime).toBeCloseTo(0.28);
    p.clearInput(); p.update(0.4); expect(p.x).toBe(0); expect(p.actionTime).toBe(0);
  });
  it('has a connected walkable route from spawn to every field and facility', () => {
    const p = new Player(), step = 0.25;
    const visited = new Set<string>(), queue = [[0, 30]];
    const reached = new Set<number>();
    for (let i = 0; i < queue.length; i++) {
      const [gx, gz] = queue[i], x = gx * step, z = gz * step;
      FARM_TARGETS.forEach((t, j) => { if (edgeDistance(x, z, t) < 0.8) reached.add(j); });
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = gx + dx, nz = gz + dz, key = `${nx},${nz}`;
        if (!visited.has(key) && p.canStand(nx * step, nz * step)) { visited.add(key); queue.push([nx, nz]); }
      }
    }
    expect(reached.size).toBe(FARM_TARGETS.length);
  });
});
