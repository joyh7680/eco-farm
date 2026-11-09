import { describe, expect, it } from 'vitest';
import { GameState } from './GameState';
import { CONFIG } from './GameConfig';

function game() { const s = new GameState(); s.reset('playing'); return s; }
function advance(s: GameState, seconds: number) { for (let t = 0; t < seconds - 0.0001; t += 0.05) s.update(0.05); }

describe('farm simulation', () => {
  it('pays for real seeds and grows the two crops at different speeds', () => {
    const s = game(); s.act(0, 'leaf'); s.act(1, 'bean');
    expect(s.money).toBe(260); expect(s.plots[0].crop?.growth).toBe(0);
    advance(s, 30.1);
    expect(s.plots[0].crop?.growth).toBe(1);
    expect(s.plots[1].crop?.growth).toBeCloseTo(30.1 / 45, 2);
    expect(s.plots[0].crop!.moisture).toBeLessThan(s.plots[1].crop!.moisture);
  });
  it('makes watering consume resources even if soil is already wet', () => {
    const s = game(); s.act(0, 'leaf'); s.act(0, 'water'); s.act(0, 'water');
    expect(s.water).toBe(80); expect(s.waterUsed).toBe(20); expect(s.plots[0].crop?.moisture).toBe(100);
  });
  it('increases dehydration during drought and recovers a wilted crop', () => {
    const s = game(); advance(s, CONFIG.droughtAt); s.act(0, 'leaf');
    s.plots[0].crop!.moisture = 1; advance(s, 3);
    expect(s.drought).toBe(true); expect(s.plots[0].crop!.dryTime).toBeGreaterThan(0);
    const slowGrowth = s.plots[0].crop!.growth;
    expect(slowGrowth).toBeLessThan(3 / 30);
    s.act(0, 'water'); expect(s.plots[0].crop!.dryTime).toBe(0);
    advance(s, 1); expect(s.plots[0].crop!.growth - slowGrowth).toBeCloseTo(1 / 30, 4);
  });
  it('permanently kills an unwatered crop, prevents harvest and allows clearing', () => {
    const s = game(); s.act(0, 'leaf'); s.plots[0].crop!.moisture = 0;
    advance(s, 23); expect(s.plots[0].crop!.dead).toBe(true);
    expect(s.act(0, 'water')).toContain('고사'); s.act(0, 'harvest');
    expect(s.inventory).toHaveLength(0); expect(s.plots[0].crop).toBeNull();
  });
  it('requires drought harvests, delivers produce, and completes the mission', () => {
    const s = game();
    for (let i = 0; i < 4; i++) s.act(i, 'leaf');
    advance(s, 30.1); for (let i = 0; i < 4; i++) s.act(i, 'harvest'); s.deliver();
    expect(s.delivered).toBe(4); expect(s.phase).toBe('playing'); expect(s.revenue).toBe(120);
    advance(s, 40); for (let i = 0; i < 2; i++) s.act(i, 'bean');
    advance(s, 45.1); for (let i = 0; i < 2; i++) s.act(i, 'harvest');
    expect(s.phase).toBe('playing'); s.deliver();
    expect(s.phase).toBe('won'); expect(s.droughtDelivered).toBe(2); expect(s.harvested).toBe(6);
    expect(s.inventory).toHaveLength(0); expect(s.plots[0].crop).toBeNull();
  });
  it('fails on time or insufficient remaining means', () => {
    const s = game(); advance(s, 481); expect(s.phase).toBe('lost'); expect(s.failureReason).toContain('시간');
    const poor = game(); poor.money = 0; poor.checkMission(); expect(poor.phase).toBe('lost');
  });
  it('pauses simulation and resets every mutable state', () => {
    const s = game(); s.act(0, 'bean'); advance(s, 2); s.phase = 'paused'; advance(s, 100);
    expect(s.time).toBeCloseTo(2); s.reset();
    expect(s.phase).toBe('intro'); expect(s.time).toBe(0); expect(s.water).toBe(100); expect(s.money).toBe(300);
    expect(s.drought).toBe(false); expect(s.inventory).toHaveLength(0); expect(s.events).toHaveLength(0);
    expect(s.plots.every(p => p.crop === null)).toBe(true); expect(s.selected).toBe(-1);
  });
  it('rejects invalid operations without duplicating produce or spending resources', () => {
    const s = game(); expect(s.act(99)).toBeNull(); s.act(0, 'leaf'); const money = s.money;
    s.act(0, 'leaf'); expect(s.money).toBe(money); s.act(0, 'harvest'); expect(s.harvested).toBe(0);
    s.water = 0; expect(s.act(0, 'water')).toContain('부족'); expect(s.water).toBe(0);
    s.phase = 'menu'; s.act(1, 'bean'); expect(s.plots[1].crop).toBeNull();
  });
});
