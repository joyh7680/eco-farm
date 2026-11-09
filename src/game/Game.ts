import { GameState } from './GameState';
import { FarmScene } from './FarmScene';
import { GameAudio } from './Audio';
import { GameHUD } from '../ui/GameHUD';
import { CONFIG, type Action } from './GameConfig';

export class Game {
  readonly state = new GameState();
  readonly world: FarmScene;
  readonly hud: GameHUD;
  readonly audio = new GameAudio();
  private lastTime = 0;
  private accumulator = 0;
  private introTime = 0;
  private briefingTime = 0;
  private landed = false;
  private frames = 0;
  private fpsTime = 0;
  private fps = 0;
  private hudTime = 0;
  private hiddenPaused = false;

  constructor(container: HTMLElement) {
    this.world = new FarmScene(container);
    this.hud = new GameHUD(container);
    this.hud.onContinue = () => this.beginFarming();
    this.hud.onRetry = () => this.start();
    this.hud.onSkip = () => this.finishIntro();
    this.hud.onMenu = () => this.start();
    this.hud.onAction = action => this.selectTool(action);
    this.hud.onApply = () => this.applySelected();
    this.hud.onDeliver = () => this.deliver();
    this.hud.onPause = () => this.pause();
    this.hud.onMute = () => { this.audio.muted = !this.audio.muted; this.hud.mute(this.audio.muted); };
    this.hud.onQuality = () => { const high = this.world.toggleQuality(); this.hud.el('quality').textContent = high ? 'HD' : 'SD'; };
    this.world.renderer.domElement.addEventListener('pointerdown', e => {
      if (this.state.phase !== 'playing' || e.button > 0) return;
      const target = this.world.hit(e.clientX, e.clientY);
      if (target?.delivery) this.deliver();
      else if (target?.plot !== undefined) {
        const message = this.state.act(target.plot);
        if (message) this.hud.toast(message);
        this.processEvents(); this.hud.update(this.state);
      } else { this.state.selected = -1; this.hud.update(this.state); }
    });
    this.world.renderer.domElement.addEventListener('pointermove', e => {
      if (this.state.phase !== 'playing') return;
      this.world.renderer.domElement.style.cursor = this.world.hit(e.clientX, e.clientY) ? 'pointer' : 'default';
    });
    window.addEventListener('resize', () => this.world.resize());
    // Autoplay is visual only; sound unlocks on the first real user interaction.
    document.addEventListener('pointerdown', () => this.audio.start(), { once: true, capture: true });
    document.addEventListener('keydown', () => this.audio.start(), { once: true, capture: true });
    window.addEventListener('keydown', e => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (this.state.phase === 'briefing' && ['Enter', 'Space', 'Escape'].includes(e.code)) { e.preventDefault(); this.beginFarming(); return; }
      if (e.target instanceof HTMLButtonElement && ['Space', 'Enter'].includes(e.code)) return;
      if (e.code === 'F3') { e.preventDefault(); this.hud.el('debug').hidden = !this.hud.el('debug').hidden; }
      if (e.code === 'KeyQ') this.hud.onQuality();
      if (e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); if (this.state.phase === 'intro') this.finishIntro(); else this.pause(); }
      if (this.state.phase !== 'playing') return;
      const keys: Record<string, Action> = { Digit1: 'leaf', Digit2: 'bean', Digit3: 'water', Digit4: 'harvest' };
      if (keys[e.code]) this.selectTool(keys[e.code]);
      if (e.code === 'Digit5') this.deliver();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state.phase === 'playing') { this.hiddenPaused = true; this.pause(); }
      if (!document.hidden) { this.lastTime = 0; if (this.hiddenPaused) { this.hiddenPaused = false; this.hud.toast('탭을 비운 동안 농장을 일시정지했어요. 계속 가꾸기를 눌러주세요.'); } }
    });
    this.start();
    this.world.render(this.state, 0, 0);
    requestAnimationFrame(this.frame);
  }

  start() {
    this.state.reset('intro'); this.world.resetEffects();
    this.introTime = 0; this.briefingTime = 0; this.landed = false; this.accumulator = 0;
    this.hud.update(this.state);
  }

  finishIntro() {
    if (this.state.phase !== 'intro') return;
    this.introTime = CONFIG.introDuration; this.state.phase = 'briefing'; this.briefingTime = 0; this.accumulator = 0;
    this.world.burst(-1, 'land'); this.hud.update(this.state);
    this.hud.briefing(0);
  }

  beginFarming() {
    if (this.state.phase !== 'briefing') return;
    this.state.phase = 'playing'; this.accumulator = 0;
    this.hud.update(this.state);
    this.hud.toast('착륙 완료! 도구를 고른 뒤, 번호가 있는 밭을 눌러 씨앗을 심으세요.', 5000);
  }

  pause() {
    if (this.state.phase === 'playing') this.state.phase = 'paused';
    else if (this.state.phase === 'paused') { this.state.phase = 'playing'; this.audio.start(); }
    this.accumulator = 0; this.hud.update(this.state);
  }

  selectTool(action: Action) {
    this.state.action = action; this.audio.play('click'); this.hud.update(this.state);
  }

  applySelected() {
    const plot = this.state.plots[this.state.selected]; if (!plot) return;
    const action = plot.crop?.dead || plot.crop?.growth === 1 ? 'harvest' : plot.crop ? 'water' : this.state.action === 'bean' ? 'bean' : 'leaf';
    const message = this.state.act(plot.id, action); if (message) this.hud.toast(message);
    this.processEvents(); this.hud.update(this.state);
  }

  deliver() {
    const amount = this.state.inventory.length;
    const message = this.state.deliver();
    if (message) this.hud.toast(message);
    else if (amount) this.hud.toast(`보급 기지에 ${amount}개 납품 완료! 다음 초록을 키워보세요.`);
    this.processEvents(); this.hud.update(this.state);
  }

  private processEvents() {
    for (const event of this.state.events.splice(0)) {
      this.audio.play(event.type);
      if (event.plot !== undefined) this.world.burst(event.plot, event.type);
      else if (event.type === 'drought') this.hud.drought();
      else if (event.type === 'deliver') this.world.burst(-1, 'deliver');
      else if (event.type === 'won') { for (let i = 0; i < 6; i++) this.world.burst(i, 'won'); }
    }
  }

  private frame = (now: number) => {
    const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.25) : 0;
    this.lastTime = now;
    if (this.state.phase === 'intro') {
      if (!document.hidden) this.introTime += dt;
      this.hud.intro(this.introTime);
      if (this.introTime >= 7 && !this.landed) { this.landed = true; this.world.burst(-1, 'land'); this.audio.play('deliver'); }
      if (this.introTime >= CONFIG.introDuration) this.finishIntro();
    } else if (this.state.phase === 'briefing') {
      if (!document.hidden) this.briefingTime += dt;
      this.hud.briefing(this.briefingTime);
      if (this.briefingTime >= CONFIG.briefingDuration) this.beginFarming();
    }
    if (this.state.phase === 'playing') {
      this.accumulator += dt;
      while (this.accumulator >= 0.05) { this.state.update(0.05); this.accumulator -= 0.05; }
      this.processEvents();
    }
    this.hudTime += dt;
    if (this.hudTime >= 0.1) { this.hud.update(this.state); this.hudTime = 0; }
    this.world.render(this.state, dt, this.state.phase === 'intro' ? this.introTime : -1);
    this.frames++; this.fpsTime += dt;
    if (this.fpsTime >= 1) { this.fps = Math.round(this.frames / this.fpsTime); this.frames = 0; this.fpsTime = 0; }
    if (!this.hud.el('debug').hidden) this.hud.el('debug').textContent = `${this.fps} FPS · ${this.world.stats}`;
    requestAnimationFrame(this.frame);
  };
}
