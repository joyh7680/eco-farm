import { describe, expect, it } from 'vitest';
import { GameState } from './GameState';
import { CONFIG } from './GameConfig';

function game() { const s = new GameState(); s.reset('playing'); return s; }
function advance(s: GameState, seconds: number) { for (let t = 0; t < seconds - 0.0001; t += 0.05) s.update(0.05); }

describe('farm simulation', () => {
  it('keeps crop identity on harvest events after the plot is emptied and emits no harvest for dead crops', () => {
    const s = game(); s.act(0, 'leaf'); s.act(1, 'bean'); s.act(2, 'leaf');
    advance(s, 45.1); s.plots[2].crop!.dead = true;
    s.events = [];
    s.act(0, 'harvest'); s.act(1, 'harvest'); s.act(2, 'harvest');
    expect(s.events).toEqual([{ type: 'harvest', plot: 0, kind: 'leaf' }, { type: 'harvest', plot: 1, kind: 'bean' }, { type: 'clear', plot: 2 }]);
    expect(s.inventory.map(item => item.kind)).toEqual(['leaf', 'bean']);
    expect(s.plots.slice(0, 3).every(plot => !plot.crop)).toBe(true);
  });
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

describe('interactive practice', () => {
  function practice() { const s = game(); s.beginTutorial(); return s; }
  function plantAndWater(s: GameState) {
    s.selectTool('leaf'); s.act(0); s.selectTool('water'); s.act(0);
  }

  it('requires the correct tool selection and plot; wrong inputs never advance or spend resources', () => {
    const s = practice();
    expect(s.act(0)).toContain('먼저');
    expect(s.selectTool('bean')).toContain('현재 연습');
    s.selectTool('leaf'); expect(s.act(1)).toContain('1번');
    expect(s.deliver()).toContain('현재 연습');
    expect(s.tutorial).toBe('plant'); expect(s.money).toBe(300);
    expect(s.plots.every(p => !p.crop)).toBe(true);
    s.act(0); expect(s.tutorial).toBe('water');
    expect(s.money).toBe(285); expect(s.events).toContainEqual({ type: 'plant', plot: 0 });
    expect(s.act(0, 'water')).toContain('먼저'); expect(s.water).toBe(100);
    s.selectTool('water'); s.act(0);
    expect(s.tutorial).toBe('grow'); expect(s.water).toBe(90); expect(s.waterUsed).toBe(10);
    expect(s.act(0, 'water')).toContain('먼저'); expect(s.water).toBe(90);
  });

  it('freezes both mission clocks at every step including completion, and only grows after watering', () => {
    const s = practice(); advance(s, 500);
    expect(s.tutorial).toBe('plant'); expect(s.time).toBe(0);
    s.selectTool('leaf'); s.act(0); advance(s, 500);
    expect(s.plots[0].crop!.growth).toBe(0); expect(s.tutorial).toBe('water');
    s.selectTool('water'); s.act(0); advance(s, 3);
    expect(s.plots[0].crop!.growth).toBeCloseTo(0.5, 2);
    advance(s, 3.1); expect(s.tutorial).toBe('harvest');
    advance(s, 500); expect(s.plots[0].crop!.dead).toBe(false);
    s.selectTool('harvest'); s.act(0); advance(s, 500);
    expect(s.tutorial).toBe('deliver'); s.deliver(); advance(s, 500);
    expect(s.tutorial).toBe('complete'); expect(s.phase).toBe('playing');
    expect(s.time).toBe(0); expect(s.remaining).toBe(480); expect(s.drought).toBe(false);
    expect(s.events.some(e => ['drought', 'won', 'lost'].includes(e.type))).toBe(false);
  });

  it('uses real harvest, inventory, delivery, and rewards in practice', () => {
    const s = practice(); plantAndWater(s); advance(s, 6.1);
    s.selectTool('harvest'); s.act(0);
    expect(s.tutorial).toBe('deliver'); expect(s.inventory).toEqual([{ kind: 'leaf', afterDrought: false }]);
    expect(s.harvested).toBe(1); expect(s.plots[0].crop).toBeNull();
    s.deliver(); expect(s.tutorial).toBe('complete'); expect(s.money).toBe(315);
    expect(s.delivered).toBe(1); expect(s.revenue).toBe(30); expect(s.inventory).toHaveLength(0);
    expect(s.deliver()).toContain('현재 연습'); expect(s.delivered).toBe(1);
  });

  it('pauses practice growth and resumes the same step', () => {
    const s = practice(); plantAndWater(s); advance(s, 2);
    const growth = s.plots[0].crop!.growth;
    s.phase = 'paused'; advance(s, 100); s.selectTool('harvest'); s.act(0); s.deliver();
    expect(s.plots[0].crop!.growth).toBe(growth); expect(s.tutorial).toBe('grow');
    s.phase = 'playing'; advance(s, 4.1); expect(s.tutorial).toBe('harvest');
  });

  it('discards practice state on completion or skipping at any stage, preserving normal speed and drought', () => {
    for (const stage of ['plant', 'water', 'grow', 'harvest', 'deliver', 'complete']) {
      const s = practice();
      if (stage !== 'plant') { s.selectTool('leaf'); s.act(0); }
      if (!['plant', 'water'].includes(stage)) { s.selectTool('water'); s.act(0); }
      if (['harvest', 'deliver', 'complete'].includes(stage)) advance(s, 6.1);
      if (['deliver', 'complete'].includes(stage)) { s.selectTool('harvest'); s.act(0); }
      if (stage === 'complete') s.deliver();
      expect(s.tutorial).toBe(stage);
      s.reset('playing');
      expect(s).toMatchObject({ tutorial: null, tutorialToolReady: false, time: 0, water: 100, money: 300, delivered: 0, droughtDelivered: 0, harvested: 0, revenue: 0, waterUsed: 0, drought: false, selected: -1, failureReason: '' });
      expect(s.inventory).toHaveLength(0); expect(s.events).toHaveLength(0); expect(s.plots.every(p => !p.crop)).toBe(true);
      s.act(0, 'leaf'); advance(s, 6);
      expect(s.plots[0].crop!.growth).toBeCloseTo(0.2, 3);
      advance(s, 64.1); expect(s.drought).toBe(true);
    }
  });

  it('can replay from an active game and retry after results without stale practice state', () => {
    const s = game(); s.act(1, 'bean'); advance(s, 80); s.beginTutorial();
    expect(s.tutorial).toBe('plant'); expect(s.time).toBe(0); expect(s.drought).toBe(false);
    expect(s.plots.every(p => !p.crop)).toBe(true);
    s.reset('playing'); advance(s, 481); expect(s.phase).toBe('lost');
    s.reset(); expect(s.tutorial).toBeNull(); expect(s.phase).toBe('intro');
    s.beginTutorial(); plantAndWater(s); advance(s, 6.1); expect(s.tutorial).toBe('harvest');
  });
});
