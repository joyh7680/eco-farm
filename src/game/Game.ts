import { GameState } from './GameState';
import { FarmScene } from './FarmScene';
import { GameAudio } from './Audio';
import { GameHUD } from '../ui/GameHUD';
import { CONFIG, type Action, type CropKind } from './GameConfig';
import { TUTORIAL_PLOT } from './Tutorial';
import { FARM_TARGETS, Player, type FarmTarget } from './Player';

export class Game {
  readonly state = new GameState();
  readonly world: FarmScene;
  readonly hud: GameHUD;
  readonly audio = new GameAudio();
  readonly player = new Player();
  seed: CropKind = 'leaf';
  get target() { return this.player.nearby(); }
  private lastTime = 0;
  private accumulator = 0;
  private introTime = 0;
  private landed = false;
  private frames = 0;
  private fpsTime = 0;
  private fps = 0;
  private hudTime = 0;
  private hiddenPaused = false;
  private helpResume = false;

  constructor(container: HTMLElement) {
    this.world = new FarmScene(container);
    this.hud = new GameHUD(container);
    this.hud.onContinue = () => this.beginTutorial();
    this.hud.onStartMission = () => this.beginFarming();
    this.hud.onHelp = () => this.openHelp();
    this.hud.onCloseHelp = () => this.closeHelp();
    this.hud.onReplayTutorial = () => this.beginTutorial();
    this.hud.onRetry = () => this.start();
    this.hud.onSkip = () => this.finishIntro();
    this.hud.onMenu = () => this.start();
    this.hud.onAction = action => this.selectTool(action);
    this.hud.onApply = () => this.applySelected();
    this.hud.onDeliver = () => this.deliver();
    this.hud.onInteract = () => this.interact();
    this.hud.onUse = action => this.interact(action === 'leaf' ? this.seed : action);
    this.hud.onMove = (x, y) => this.player.stick(x, y);
    this.hud.onPause = () => this.pause();
    this.hud.onMute = () => { this.audio.muted = !this.audio.muted; this.hud.mute(this.audio.muted); };
    this.hud.onQuality = () => { const high = this.world.toggleQuality(); this.hud.el('quality').textContent = high ? 'HD' : 'SD'; };
    this.world.renderer.domElement.addEventListener('pointerdown', e => {
      if (this.state.phase !== 'playing' || e.button > 0) return;
      const target = this.world.hit(e.clientX, e.clientY);
      const facility = target?.delivery ? FARM_TARGETS.find(t => t.kind === 'supply') : target?.tank ? FARM_TARGETS.find(t => t.kind === 'tank') : target?.plot !== undefined ? FARM_TARGETS[target.plot] : null;
      if (facility) this.interact(undefined, facility);
    });
    this.world.renderer.domElement.addEventListener('pointermove', e => {
      if (this.state.phase !== 'playing') return;
      const hit = this.world.hit(e.clientX, e.clientY);
      const target = hit?.plot !== undefined ? FARM_TARGETS[hit.plot] : hit?.delivery ? FARM_TARGETS[7] : hit?.tank ? FARM_TARGETS[6] : null;
      this.world.renderer.domElement.style.cursor = target && this.player.inReach(target) ? 'pointer' : 'default';
    });
    window.addEventListener('resize', () => this.world.resize());
    // Autoplay is visual only; sound unlocks on the first real user interaction.
    document.addEventListener('pointerdown', () => this.audio.start(), { once: true, capture: true });
    document.addEventListener('keydown', () => this.audio.start(), { once: true, capture: true });
    const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
    window.addEventListener('keyup', e => this.player.key(e.code, false));
    window.addEventListener('blur', () => this.clearInput());
    window.addEventListener('keydown', e => {
      if (movement.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (this.state.phase === 'playing' && !this.hud.helpOpen) this.player.key(e.code, true);
        return;
      }
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLButtonElement && ['Space', 'Enter'].includes(e.code)) return;
      if (this.hud.helpOpen) { if (e.code === 'Escape') { e.preventDefault(); this.closeHelp(); } return; }
      if (this.state.phase === 'briefing') { if (e.code === 'Enter') { e.preventDefault(); this.beginTutorial(); } return; }
      if (e.code === 'F3') { e.preventDefault(); this.hud.el('debug').hidden = !this.hud.el('debug').hidden; }
      if (e.code === 'KeyQ') this.hud.onQuality();
      if (e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); if (this.state.phase === 'intro') this.finishIntro(); else this.pause(); }
      if (this.state.phase !== 'playing') return;
      const keys: Record<string, Action> = { Digit1: this.seed, Digit2: 'water', Digit3: 'harvest' };
      if (keys[e.code]) { e.preventDefault(); this.interact(keys[e.code]); }
      if (e.code === 'KeyE') { e.preventDefault(); this.interact(); }
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
    this.resetPlayer();
    this.hud.resetTransient(); this.hiddenPaused = false; this.helpResume = false;
    this.introTime = 0; this.landed = false; this.accumulator = 0;
    this.hud.update(this.state);
  }

  finishIntro() {
    if (this.state.phase !== 'intro') return;
    this.introTime = CONFIG.introDuration; this.state.phase = 'briefing'; this.accumulator = 0;
    this.world.burst(-1, 'land'); this.hud.update(this.state);
  }

  beginFarming() {
    if (this.state.phase !== 'briefing' && !this.state.tutorial) return;
    this.state.reset('playing'); this.world.resetEffects(); this.hud.resetTransient(); this.accumulator = 0;
    this.resetPlayer();
    this.hud.update(this.state);
    this.hud.toast('임무 시작! WASD / 조이스틱으로 이동 · 밭 근처에서 E / 행동 버튼. 물탱크에서 물을 채우세요.', 5000);
  }

  beginTutorial() {
    this.state.beginTutorial(); this.world.resetEffects(); this.hud.resetTransient();
    this.resetPlayer();
    this.accumulator = 0; this.hiddenPaused = false; this.helpResume = false;
    this.hud.update(this.state);
  }

  openHelp() {
    if (this.hud.helpOpen || !['playing', 'paused'].includes(this.state.phase)) return;
    this.helpResume = this.state.phase === 'playing';
    this.clearInput();
    this.state.phase = 'paused'; this.accumulator = 0;
    this.hud.showHelp(true); this.hud.update(this.state);
  }

  closeHelp() {
    this.hud.showHelp(false);
    if (this.helpResume && this.state.phase === 'paused') this.state.phase = 'playing';
    this.helpResume = false; this.accumulator = 0; this.hud.update(this.state);
  }

  pause() {
    if (this.hud.helpOpen) return;
    this.clearInput();
    if (this.state.phase === 'playing') this.state.phase = 'paused';
    else if (this.state.phase === 'paused') { this.state.phase = 'playing'; this.audio.start(); }
    this.accumulator = 0; this.hud.update(this.state);
  }

  selectTool(action: Action) {
    const message = this.state.selectTool(action);
    if (message) this.hud.toast(message);
    else this.audio.play('click');
    if (!message && (action === 'leaf' || action === 'bean')) this.seed = action;
    this.hud.update(this.state);
  }

  applySelected() {
    this.interact();
  }

  deliver() {
    const target = FARM_TARGETS.find(t => t.kind === 'supply')!;
    this.interact(undefined, target);
  }

  private clearInput() { this.player.clearInput(); this.hud.resetJoystick(); }
  private resetPlayer() { this.player.reset(); this.seed = 'leaf'; this.hud.resetJoystick(); }

  contextAction(target = this.target): Action | 'refill' | 'deliver' | null {
    if (!target) return null;
    if (target.kind === 'tank') return 'refill';
    if (target.kind === 'supply') return 'deliver';
    const crop = this.state.plots[target.id].crop;
    if (this.state.tutorial === 'grow' && target.id === TUTORIAL_PLOT) return null;
    return crop?.dead || crop?.growth === 1 ? 'harvest' : crop ? 'water' : this.seed;
  }

  interact(action?: Action, target = this.target) {
    if (this.state.phase !== 'playing' || this.hud.helpOpen || this.player.actionTime > 0) return;
    if (!target || !this.player.inReach(target)) { this.hud.toast('대상 가까이 이동하세요. WASD / 방향키 또는 왼쪽 조이스틱을 사용해요.', 2200); return; }
    if (action && target.kind !== 'plot') { this.hud.toast('시설은 E 또는 큰 행동 버튼으로 이용하세요.'); return; }
    const chosen = action ?? this.contextAction(target);
    if (!chosen) return;
    if (chosen === 'deliver') { this.deliverAtStation(target); return; }
    if (chosen === 'refill') {
      const message = this.state.refillWater();
      if (message) this.hud.toast(message);
      else { this.player.perform('refill', target); this.hud.toast(`물뿌리개 ${this.state.canWater}/${CONFIG.canCapacity} 충전 · 탱크 잔량 ${this.state.water - this.state.canWater}`); }
    } else {
      const selection = this.state.selectTool(chosen);
      const message = selection ?? this.state.act(target.id, chosen);
      if (message) this.hud.toast(message);
      else this.player.perform(chosen, target);
    }
    this.processEvents(); this.hud.update(this.state);
  }

  private deliverAtStation(target: FarmTarget) {
    const amount = this.state.inventory.length;
    const message = this.state.deliver();
    if (message) this.hud.toast(message);
    else if (amount) { this.player.perform('deliver', target); this.hud.toast(`보급 기지에 ${amount}개 납품 완료! 다음 초록을 키워보세요.`); }
    this.processEvents(); this.hud.update(this.state);
  }

  private processEvents() {
    for (const event of this.state.events.splice(0)) {
      this.audio.play(event.type);
      if (event.type === 'harvest') {
        this.world.harvest(event.plot, event.kind);
        this.hud.toast(`${CONFIG.crops[event.kind].name} 수확! → 보급 기지 보관함`, 2200);
      }
      else if (event.plot !== undefined) this.world.burst(event.plot, event.type);
      else if (event.type === 'drought') this.hud.drought();
      else if (event.type === 'deliver') this.world.burst(-1, 'deliver');
      else if (event.type === 'refill') this.world.refillEffect();
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
    }
    if (this.state.phase === 'playing') {
      this.player.update(dt);
      this.state.selected = this.target?.kind === 'plot' ? this.target.id : -1;
      this.accumulator += dt;
      while (this.accumulator >= 0.05) { this.state.update(0.05); this.accumulator -= 0.05; }
      this.processEvents();
    }
    this.hudTime += dt;
    if (this.hudTime >= 0.1) {
      this.hud.update(this.state);
      this.hud.updateInteraction(this.state, this.target, this.contextAction(), this.seed, this.player.actionTime > 0);
      if (this.state.tutorial) this.hud.positionGuide(this.state.tutorial === 'deliver' ? this.world.projectTarget(FARM_TARGETS[7]) : this.world.projectPlot(TUTORIAL_PLOT));
      this.hud.positionCrops(this.state, this.world);
      this.hudTime = 0;
    }
    this.world.updatePlayer(this.player, this.state.phase === 'playing' ? this.target : null);
    this.world.render(this.state, dt, this.state.phase === 'intro' ? this.introTime : -1);
    this.hud.positionPlayer(this.world.projectPlayer(this.player));
    this.frames++; this.fpsTime += dt;
    if (this.fpsTime >= 1) { this.fps = Math.round(this.frames / this.fpsTime); this.frames = 0; this.fpsTime = 0; }
    if (!this.hud.el('debug').hidden) this.hud.el('debug').textContent = `${this.fps} FPS · ${this.world.stats}`;
    requestAnimationFrame(this.frame);
  };
}
