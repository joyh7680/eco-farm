import { CONFIG, type Action, type CropKind } from './GameConfig';
import { TUTORIAL, TUTORIAL_GROWTH_SECONDS, TUTORIAL_PLOT, type TutorialStep } from './Tutorial';

export type Phase = 'menu' | 'intro' | 'briefing' | 'playing' | 'paused' | 'won' | 'lost';
export interface Crop {
  kind: CropKind; growth: number; moisture: number; dryTime: number; dead: boolean;
}
export interface Produce { kind: CropKind; afterDrought: boolean }
export interface Plot { id: number; crop: Crop | null }
export type GameEvent = { type: 'plant' | 'water' | 'harvest' | 'clear'; plot: number } |
  { type: 'drought' | 'deliver' | 'won' | 'lost'; plot?: never };

export class GameState {
  phase: Phase = 'menu';
  time = 0;
  water: number = CONFIG.startingWater;
  money: number = CONFIG.startingMoney;
  waterUsed = 0;
  harvested = 0;
  delivered = 0;
  droughtDelivered = 0;
  revenue = 0;
  drought = false;
  selected = -1;
  action: Action = 'leaf';
  inventory: Produce[] = [];
  plots: Plot[] = Array.from({ length: 6 }, (_, id) => ({ id, crop: null }));
  events: GameEvent[] = [];
  failureReason = '';
  tutorial: TutorialStep | null = null;
  tutorialToolReady = false;

  beginTutorial() {
    this.reset('playing');
    this.tutorial = 'plant';
    this.selected = TUTORIAL_PLOT;
  }

  selectTool(action: Action): string | null {
    if (this.phase !== 'playing') return null;
    if (this.tutorial && TUTORIAL[this.tutorial].action !== action) return '빛나는 도구로 현재 연습을 완료해 주세요.';
    this.action = action;
    this.tutorialToolReady = true;
    return null;
  }

  private nextTutorial(step: TutorialStep) {
    this.tutorial = step;
    this.tutorialToolReady = false;
  }

  reset(phase: Phase = 'intro') {
    Object.assign(this, new GameState());
    this.phase = phase;
  }

  act(id: number, action: Action = this.action): string | null {
    if (this.phase !== 'playing') return null;
    const plot = this.plots[id];
    if (!plot) return null;
    if (this.tutorial && (id !== TUTORIAL_PLOT || action !== TUTORIAL[this.tutorial].action || !this.tutorialToolReady)) {
      return '안내된 도구를 먼저 선택한 뒤 빛나는 1번 밭을 눌러주세요.';
    }
    this.selected = id;
    const crop = plot.crop;
    if (action === 'leaf' || action === 'bean') {
      if (crop) return crop.dead ? '마른 작물을 수확 도구로 정리하세요.' : '이미 작물이 자라는 밭이에요.';
      const spec = CONFIG.crops[action];
      if (this.money < spec.cost) return '씨앗을 구입할 자금이 부족해요.';
      this.money -= spec.cost;
      plot.crop = { kind: action, growth: 0, moisture: CONFIG.initialMoisture, dryTime: 0, dead: false };
      this.events.push({ type: 'plant', plot: id });
    } else if (action === 'water') {
      if (!crop) return '먼저 이 밭에 씨앗을 심어주세요.';
      if (crop.dead) return '고사한 작물은 회복할 수 없어요. 밭을 정리하세요.';
      if (this.water < CONFIG.wateringCost) return '물탱크의 물이 부족해요.';
      this.water -= CONFIG.wateringCost;
      this.waterUsed += CONFIG.wateringCost;
      crop.moisture = Math.min(100, crop.moisture + CONFIG.wateringAmount);
      crop.dryTime = 0;
      this.events.push({ type: 'water', plot: id });
    } else {
      if (!crop) return '수확할 작물이 없어요.';
      if (crop.dead) {
        plot.crop = null;
        this.events.push({ type: 'clear', plot: id });
      } else {
        if (crop.growth < 1) return '아직 자라고 있어요. 조금만 기다려주세요.';
        this.inventory.push({ kind: crop.kind, afterDrought: this.drought });
        this.harvested++;
        plot.crop = null;
        this.events.push({ type: 'harvest', plot: id });
      }
    }
    if (this.tutorial === 'plant') this.nextTutorial('water');
    else if (this.tutorial === 'water') this.nextTutorial('grow');
    else if (this.tutorial === 'harvest') this.nextTutorial('deliver');
    this.checkMission();
    return null;
  }

  deliver(): string | null {
    if (this.phase !== 'playing') return null;
    if (this.tutorial && this.tutorial !== 'deliver') return '먼저 현재 연습 단계를 완료해 주세요.';
    if (!this.inventory.length) return '수확한 작물을 보급 기지에 납품할 수 있어요.';
    for (const item of this.inventory) {
      const price = CONFIG.crops[item.kind].price;
      this.money += price;
      this.revenue += price;
      this.delivered++;
      if (item.afterDrought) this.droughtDelivered++;
    }
    this.inventory = [];
    this.events.push({ type: 'deliver' });
    if (this.tutorial === 'deliver') this.nextTutorial('complete');
    this.checkMission();
    return null;
  }

  update(dt: number) {
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    // Practice advances only this crop, never the mission or drought clock.
    if (this.tutorial) {
      if (this.tutorial === 'grow') {
        const crop = this.plots[TUTORIAL_PLOT].crop;
        if (crop) {
          crop.growth = Math.min(1, crop.growth + dt / TUTORIAL_GROWTH_SECONDS);
          crop.moisture = Math.max(0, crop.moisture - CONFIG.crops[crop.kind].drain * dt);
          if (crop.growth >= 1) this.nextTutorial('harvest');
        }
      }
      return;
    }
    // A fixed, small simulation step keeps drought and recovery independent of rendering FPS.
    this.time = Math.min(CONFIG.duration, this.time + dt);
    if (!this.drought && this.time >= CONFIG.droughtAt) {
      this.drought = true;
      this.events.push({ type: 'drought' });
    }
    for (const plot of this.plots) {
      const crop = plot.crop;
      if (!crop || crop.dead) continue;
      const spec = CONFIG.crops[crop.kind];
      crop.moisture = Math.max(0, crop.moisture - spec.drain * dt * (this.drought ? CONFIG.droughtMultiplier : 1) * (crop.growth >= 1 ? 0.25 : 1));
      if (crop.moisture <= 0) crop.dryTime += dt;
      else crop.dryTime = Math.max(0, crop.dryTime - dt * 2);
      if (crop.dryTime >= CONFIG.deathAfter) crop.dead = true;
      if (!crop.dead) crop.growth = Math.min(1, crop.growth + dt / spec.duration * (crop.moisture < 15 ? 0.22 : 1));
    }
    this.checkMission();
  }

  checkMission() {
    if (this.phase !== 'playing' || this.tutorial) return;
    if (this.delivered >= CONFIG.deliveryGoal && this.droughtDelivered >= CONFIG.droughtGoal) {
      this.phase = 'won';
      this.events.push({ type: 'won' });
      return;
    }
    const live = this.plots.filter(p => p.crop && !p.crop.dead).length;
    const future = this.inventory.length + live + Math.floor(this.money / CONFIG.crops.leaf.cost);
    const dryInventory = this.inventory.filter(p => p.afterDrought).length;
    if (this.time >= CONFIG.duration || this.delivered + future < CONFIG.deliveryGoal || this.droughtDelivered + dryInventory + live + Math.floor(this.money / CONFIG.crops.leaf.cost) < CONFIG.droughtGoal) {
      this.failureReason = this.time >= CONFIG.duration ? '제한 시간이 종료되었습니다.' : '남은 자원으로 목표 수확량을 달성할 수 없습니다.';
      this.phase = 'lost';
      this.events.push({ type: 'lost' });
    }
  }

  get remaining() { return Math.max(0, CONFIG.duration - this.time); }
  get score() { return Math.max(0, Math.min(100, Math.round(60 + this.water * 0.4 - this.plots.filter(p => p.crop?.dead).length * 8))); }
}
