import { edgeDistance, Player, type Footprint } from './Player';

export type ChapterStage = 'INTRO' | 'EXPLORE' | 'INSPECT_FARM' | 'CLEAR_WEEDS' | 'REMOVE_ROCKS' | 'TILL_SOIL' | 'CHAPTER_COMPLETE';
export interface ChapterTarget extends Footprint { kind: 'inspect' | 'weed' | 'rock' | 'deposit' | 'soil'; id: number }
const point = (kind: ChapterTarget['kind'], id: number, x: number, z: number): ChapterTarget => ({ kind, id, x, z, hx: 0.3, hz: 0.3 });
export const WEEDS = [[-5.9, -3.1], [-3.5, -3.1], [-1.1, -3.1], [1, -3.1], [4.4, -3.1]].map(([x, z], i) => point('weed', i, x, z));
export const ROCKS = [[-5.7, 1.4], [-0.3, 1.4], [4.2, 1.4]].map(([x, z], i) => point('rock', i, x, z));
export const SOILS = [-4.8, -0.3, 4.2].map((x, i) => ({ ...point('soil', i, x, -0.9), hx: 1.86, hz: 1.71 }));
export const INSPECT: ChapterTarget = { ...SOILS[1], kind: 'inspect', id: 0 };
export const DEPOSIT: ChapterTarget = { ...point('deposit', 0, 7.25, 4.65), hx: 0.65, hz: 0.65 };
export const CHAPTER_SAVE_KEY = 'eco-farm.chapter-01.v1';
export const CHAPTER_LABELS = { inspect: '농경지 조사하기', weed: '잡초 제거하기', rock: '돌 들어 올리기', deposit: '돌 내려놓기', soil: '괭이질하기' };
export const CHAPTER_INTRO = [
  '초록 행성에 도착했습니다!',
  '이곳은 한때 풍요로운 농장이었지만, 오랫동안 관리되지 않았어요.',
  '농장을 다시 되살려 볼까요? 우선 주변을 조사해 보세요!',
];
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface SaveData { version: 1; stage: ChapterStage; weeds: boolean[]; rocks: boolean[]; soils: boolean[]; carrying: number | null; dialogue: string[]; x: number; z: number }

/** Chapter progress is independent of the existing crop/drought simulation. */
export class ChapterOne {
  stage: ChapterStage = 'INTRO';
  weeds = WEEDS.map(() => false);
  rocks = ROCKS.map(() => false);
  soils = SOILS.map(() => false);
  carrying: number | null = null;
  dialogue: string[] = [];
  pending: ChapterTarget | null = null;
  storageFailed = false;
  private storage?: StorageLike;
  private savedPosition = { x: 7.4, z: -4.95 };

  constructor(storage?: StorageLike) { this.storage = storage; }
  get complete() { return this.stage === 'CHAPTER_COMPLETE'; }
  get busy() { return !!this.pending; }
  get restoration() { return this.complete ? 12 : 0; }
  get progress() {
    if (this.stage === 'CLEAR_WEEDS') return `${this.weeds.filter(Boolean).length} / 5`;
    if (this.stage === 'REMOVE_ROCKS') return `${this.rocks.filter(Boolean).length} / 3`;
    if (this.stage === 'TILL_SOIL') return `${this.soils.filter(Boolean).length} / 3`;
    return this.complete ? '3 / 3' : '—';
  }
  get objective() {
    return { INTRO: '초록 행성에 착륙하기', EXPLORE: '빛나는 버려진 농경지 조사하기', INSPECT_FARM: 'AI와 농경지 상태 살펴보기', CLEAR_WEEDS: '잡초 5개 제거하기', REMOVE_ROCKS: this.carrying === null ? '돌 3개를 수거 장소로 운반하기' : '들고 있는 돌을 수거 장소에 내려놓기', TILL_SOIL: '괭이로 밭 3칸 일구기', CHAPTER_COMPLETE: '농경지 복구 완료!' }[this.stage];
  }
  get lesson() {
    return { INTRO: 'ECO FARM — 초록 행성', EXPLORE: 'WASD / 방향키 또는 왼쪽 조이스틱으로 이동하세요.', INSPECT_FARM: '농경지의 상태를 먼저 살펴봐요.', CLEAR_WEEDS: '잡초는 작물과 물·영양분·빛을 두고 경쟁할 수 있어요.', REMOVE_ROCKS: '돌을 정리하면 작업 중 방해 요소를 줄이고 안전하게 밭을 준비할 수 있어요.', TILL_SOIL: '흙 상태·배수·작물 간격을 살펴봐요. 경운 방법과 필요성은 토양에 따라 달라요.', CHAPTER_COMPLETE: '다음 목표: 고장 난 물탱크를 복구하고 물을 확보하세요!' }[this.stage];
  }
  targets(): ChapterTarget[] {
    if (this.stage === 'EXPLORE') return [INSPECT];
    if (this.stage === 'CLEAR_WEEDS') return WEEDS.filter(t => !this.weeds[t.id]);
    if (this.stage === 'REMOVE_ROCKS') return this.carrying !== null ? [DEPOSIT] : ROCKS.filter(t => !this.rocks[t.id]);
    if (this.stage === 'TILL_SOIL') return SOILS.filter(t => !this.soils[t.id]);
    return [];
  }
  nearby(player: Player) {
    return this.targets().filter(t => player.inReach(t)).sort((a, b) => edgeDistance(player.x, player.z, a) - edgeDistance(player.x, player.z, b))[0] ?? null;
  }
  finishIntro(player: Player) {
    if (this.stage !== 'INTRO') return;
    this.stage = 'EXPLORE'; this.dialogue = [...CHAPTER_INTRO]; this.save(player);
  }
  nextDialogue(player: Player) {
    this.dialogue.shift();
    if (!this.dialogue.length && this.stage === 'INSPECT_FARM') this.stage = 'CLEAR_WEEDS';
    this.save(player);
  }
  begin(player: Player, target = this.nearby(player)) {
    if (this.busy || this.dialogue.length || !target || !player.inReach(target) || !this.targets().some(t => t.kind === target.kind && t.id === target.id)) return false;
    this.pending = { ...target }; player.perform(target.kind, target); return true;
  }
  /** Commit only after the character's work animation has finished. */
  finishWork(player: Player): ChapterTarget | null {
    const t = this.pending;
    if (!t || player.actionTime > 0) return null;
    this.pending = null;
    if (t.kind === 'inspect') {
      this.stage = 'INSPECT_FARM';
      this.dialogue = ['이곳은 예전에 작물을 재배하던 농경지예요.', '하지만 잡초와 돌이 많아 지금은 작물을 심기 어려워요.', '먼저 땅을 깨끗하게 정리해 봅시다!'];
    } else if (t.kind === 'weed') {
      this.weeds[t.id] = true;
      if (this.weeds.every(Boolean)) { this.stage = 'REMOVE_ROCKS'; this.dialogue = ['좋아요! 잡초를 제거하니 농경지가 훨씬 깨끗해졌어요.', '이제 큰 돌들을 치워 볼까요? 돌을 들어 수거 장소까지 직접 운반해 주세요.']; }
    } else if (t.kind === 'rock') this.carrying = t.id;
    else if (t.kind === 'deposit' && this.carrying !== null) {
      this.rocks[this.carrying] = true; this.carrying = null;
      if (this.rocks.every(Boolean)) { this.stage = 'TILL_SOIL'; this.dialogue = ['농경지 정리가 끝났어요!', '이제 괭이로 땅을 고르게 만들어 봅시다. 흙 상태와 배수, 작물이 자랄 공간을 살펴봐요.', '토양에 따라 경운 방법과 필요성이 달라요. 모든 땅을 깊게 갈 필요는 없답니다.']; }
    } else if (t.kind === 'soil') {
      this.soils[t.id] = true;
      if (this.soils.every(Boolean)) {
        this.stage = 'CHAPTER_COMPLETE';
        this.dialogue = ['첫 번째 농경지가 완성됐어요!', '이제 이곳에 새로운 작물을 심을 수 있습니다.', '축하합니다! 버려진 농경지를 복구했어요.', '작물을 키우기 위한 첫 번째 준비가 끝났습니다.', '하지만 이곳은 오랫동안 비가 내리지 않아 물이 부족한 상태예요.', '다음 목표: 고장 난 물탱크를 복구하고 물을 확보하세요!'];
      }
    }
    this.save(player); return t;
  }
  save(player: Player) {
    const data: SaveData = { version: 1, stage: this.stage, weeds: this.weeds, rocks: this.rocks, soils: this.soils, carrying: this.carrying, dialogue: this.dialogue, x: player.x, z: player.z };
    try { this.storage?.setItem(CHAPTER_SAVE_KEY, JSON.stringify(data)); this.storageFailed = !this.storage; }
    catch { this.storageFailed = true; }
  }
  load(player: Player) {
    try {
      const raw = this.storage?.getItem(CHAPTER_SAVE_KEY); if (!raw) return false;
      const d = JSON.parse(raw) as SaveData;
      const bools = (v: unknown, n: number): v is boolean[] => Array.isArray(v) && v.length === n && v.every(x => typeof x === 'boolean');
      const stages: ChapterStage[] = ['INTRO', 'EXPLORE', 'INSPECT_FARM', 'CLEAR_WEEDS', 'REMOVE_ROCKS', 'TILL_SOIL', 'CHAPTER_COMPLETE'];
      if (d.version !== 1 || !stages.includes(d.stage) || !bools(d.weeds, 5) || !bools(d.rocks, 3) || !bools(d.soils, 3) || !Array.isArray(d.dialogue) || !d.dialogue.every(s => typeof s === 'string' && s.length < 500) || d.dialogue.length > 10) return false;
      if (d.carrying !== null && (!Number.isInteger(d.carrying) || d.carrying < 0 || d.carrying > 2 || d.rocks[d.carrying])) return false;
      // Reject inconsistent saves, including later tasks unlocked before earlier work.
      if (['REMOVE_ROCKS', 'TILL_SOIL', 'CHAPTER_COMPLETE'].includes(d.stage) && !d.weeds.every(Boolean)) return false;
      if (['TILL_SOIL', 'CHAPTER_COMPLETE'].includes(d.stage) && !d.rocks.every(Boolean)) return false;
      if (d.stage === 'CHAPTER_COMPLETE' && !d.soils.every(Boolean)) return false;
      if (d.stage !== 'REMOVE_ROCKS' && d.carrying !== null) return false;
      const derived = d.soils.every(Boolean) ? 'CHAPTER_COMPLETE' : d.rocks.every(Boolean) ? 'TILL_SOIL' : d.weeds.every(Boolean) ? 'REMOVE_ROCKS' : d.weeds.some(Boolean) ? 'CLEAR_WEEDS' : null;
      if (derived && d.stage !== derived) return false;
      if (!['TILL_SOIL', 'CHAPTER_COMPLETE'].includes(d.stage) && d.soils.some(Boolean) || !['REMOVE_ROCKS', 'TILL_SOIL', 'CHAPTER_COMPLETE'].includes(d.stage) && d.rocks.some(Boolean)) return false;
      this.stage = d.stage; this.weeds = d.weeds; this.rocks = d.rocks; this.soils = d.soils; this.carrying = d.carrying; this.dialogue = d.dialogue;
      if (this.stage === 'INSPECT_FARM' && !this.dialogue.length) this.stage = 'CLEAR_WEEDS';
      if (Number.isFinite(d.x) && Number.isFinite(d.z) && player.canStand(d.x, d.z)) { player.x = d.x; player.z = d.z; }
      else { player.x = this.savedPosition.x; player.z = this.savedPosition.z; }
      return true;
    } catch { this.storageFailed = true; return false; }
  }
}
