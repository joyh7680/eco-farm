import { describe, expect, it } from 'vitest';
import { CHAPTER_SAVE_KEY, ChapterOne, DEPOSIT, INSPECT, ROCKS, SOILS, WEEDS, type ChapterTarget } from './ChapterOne';
import { Player } from './Player';

const storage = () => { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } }; };
function setup() { const c = new ChapterOne(storage()), p = new Player(); c.finishIntro(p); while (c.dialogue.length) c.nextDialogue(p); return { c, p }; }
function work(c: ChapterOne, p: Player, t: ChapterTarget) { p.x = t.x; p.z = t.hz > 1 ? t.z + t.hz + 0.4 : t.z; expect(c.begin(p, t)).toBe(true); p.update(0.5); c.finishWork(p); }
function dismiss(c: ChapterOne, p: Player) { while (c.dialogue.length) c.nextDialogue(p); }
function inspect(c: ChapterOne, p: Player) { work(c, p, INSPECT); expect(c.stage).toBe('INSPECT_FARM'); dismiss(c, p); }

describe('Chapter 01 restoration', () => {
  it('guards distance, order, dialogue and duplicate work; commits after animation', () => {
    const { c, p } = setup();
    expect(c.begin(p, INSPECT)).toBe(false);
    p.x = INSPECT.x; p.z = 1.4;
    expect(c.begin(p, ROCKS[0])).toBe(false);
    expect(c.begin(p, INSPECT)).toBe(true);
    expect(c.stage).toBe('EXPLORE'); expect(c.finishWork(p)).toBeNull();
    expect(c.begin(p, INSPECT)).toBe(false);
    p.update(0.5); c.finishWork(p);
    expect(c.begin(p, WEEDS[0])).toBe(false);
    dismiss(c, p); expect(c.stage).toBe('CLEAR_WEEDS');
    p.x = WEEDS[0].x; p.z = WEEDS[0].z;
    c.begin(p); expect(c.weeds[0]).toBe(false);
    p.update(0.5); c.finishWork(p); expect(c.weeds[0]).toBe(true);
  });
  it('requires all three carried rocks to be deposited and all three soils to be worked', () => {
    const { c, p } = setup(); inspect(c, p);
    WEEDS.forEach(t => work(c, p, t)); expect(c.stage).toBe('REMOVE_ROCKS'); dismiss(c, p);
    ROCKS.forEach((t, i) => {
      work(c, p, t); expect(c.carrying).toBe(i); expect(c.rocks[i]).toBe(false);
      expect(c.begin(p, SOILS[0])).toBe(false);
      const before = p.x; p.key('KeyD', true); p.update(0.1); p.clearInput(); expect(p.x).not.toBe(before);
      expect(c.begin(p, DEPOSIT)).toBe(false);
      work(c, p, DEPOSIT); expect(c.rocks[i]).toBe(true); expect(c.carrying).toBeNull();
    });
    expect(c.stage).toBe('TILL_SOIL'); dismiss(c, p);
    SOILS.forEach(t => work(c, p, t)); expect(c.complete).toBe(true); expect(c.restoration).toBe(12);
    expect(c.dialogue.at(-1)).toContain('물탱크'); expect(c.targets()).toEqual([]);
  });
  it('restores a carried rock and interrupted dialogue without completing unfinished work', () => {
    const s = storage(), { c, p } = setup(); inspect(c, p); WEEDS.forEach(t => work(c, p, t)); dismiss(c, p);
    work(c, p, ROCKS[0]);
    const saved = JSON.stringify({ version: 1, stage: c.stage, weeds: c.weeds, rocks: c.rocks, soils: c.soils, carrying: c.carrying, dialogue: c.dialogue, x: p.x, z: p.z }); s.setItem(CHAPTER_SAVE_KEY, saved);
    const loaded = new ChapterOne(s), p2 = new Player(); expect(loaded.load(p2)).toBe(true);
    expect(loaded.carrying).toBe(0); expect(loaded.rocks).toEqual([false, false, false]);
    expect(loaded.targets()).toEqual([DEPOSIT]); expect(p2.x).toBe(p.x);
    work(loaded, p2, DEPOSIT);
    const resumed = new ChapterOne(s); expect(resumed.load(p2)).toBe(true); expect(resumed.rocks[0]).toBe(true);
  });
  it('resumes inspection dialogue and tolerates blocked or corrupt storage', () => {
    const s = storage(), c = new ChapterOne(s), p = new Player(); c.finishIntro(p); dismiss(c, p); work(c, p, INSPECT); c.nextDialogue(p);
    const loaded = new ChapterOne(s); expect(loaded.load(p)).toBe(true); expect(loaded.dialogue.length).toBe(2); dismiss(loaded, p); expect(loaded.stage).toBe('CLEAR_WEEDS');
    s.setItem(CHAPTER_SAVE_KEY, '{broken'); expect(new ChapterOne(s).load(p)).toBe(false);
    const blocked = new ChapterOne({ getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('quota'); } });
    expect(blocked.load(p)).toBe(false); expect(() => blocked.save(p)).not.toThrow(); expect(blocked.storageFailed).toBe(true);
  });
  it('rejects fabricated completed stages and unavailable object IDs in saves', () => {
    const s = storage(), c = new ChapterOne(s), p = new Player(); c.finishIntro(p); c.save(p);
    const d = JSON.parse(s.getItem(CHAPTER_SAVE_KEY)!); d.stage = 'CHAPTER_COMPLETE'; s.setItem(CHAPTER_SAVE_KEY, JSON.stringify(d));
    expect(new ChapterOne(s).load(p)).toBe(false);
    d.stage = 'REMOVE_ROCKS'; d.weeds.fill(true); d.carrying = 8; s.setItem(CHAPTER_SAVE_KEY, JSON.stringify(d));
    expect(new ChapterOne(s).load(p)).toBe(false);
  });
});
