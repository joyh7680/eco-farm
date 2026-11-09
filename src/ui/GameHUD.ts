import { CONFIG, type Action, type CropKind } from '../game/GameConfig';
import type { FarmTarget } from '../game/Player';
import type { GameState } from '../game/GameState';
import type { FarmScene } from '../game/FarmScene';
import { icon } from './icons';
import { TUTORIAL } from '../game/Tutorial';

export class GameHUD {
  readonly root: HTMLElement;
  private lastPhase = '';
  private toastUntil = 0;
  private lastSelected = -2;
  private lastAction = '';
  private lastValues = new Map<string, string>();
  private lastTutorial = '';
  private focusBeforeHelp: HTMLElement | null = null;
  helpOpen = false;
  onContinue = () => {};
  onStartMission = () => {};
  onHelp = () => {};
  onCloseHelp = () => {};
  onReplayTutorial = () => {};
  onSkip = () => {};
  onRetry = () => {};
  onMenu = () => {};
  onPause = () => {};
  onMute = () => {};
  onQuality = () => {};
  onView = () => {};
  onDeliver = () => {};
  onAction = (_action: Action) => {};
  onApply = () => {};
  onInteract = () => {};
  onUse = (_action: Action) => {};
  onMove = (_x: number, _y: number) => {};
  private stickPointer: number | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div'); this.root.id = 'ui'; container.append(this.root);
    this.root.dataset.touch = String(navigator.maxTouchPoints > 0);
    this.root.innerHTML = `
      <div class="vignette"></div>
      <header class="top-hud">
        <div class="brand">${icon('sprout')}<b>ECO FARM</b><span>작은 초록을 가꾸는 하루</span></div>
        <div class="resource-group">
          <details class="pocket water-resource"><summary aria-label="물뿌리개와 물탱크 잔량">${icon('water')}<div><strong><span id="can-water">20</span><em>/30</em></strong><small>전체 물 <b id="water">100</b></small></div></summary><div class="pocket-content"><b>물탱크 <span id="tank-water">80</span></b><p>가까이 가서 물을 채워요.<br>전체 물은 한정되어 있어요.</p><div class="resource-track"><i id="water-meter"></i></div></div></details>
          <div class="pocket money-resource">${icon('coin')}<strong><span id="money">300</span><em>G</em></strong></div>
          <details class="pocket cargo-resource"><summary aria-label="보급 기지 보관함">${icon('delivery')}<strong id="inventory">0</strong></summary><div class="pocket-content"><b>보급 기지 보관함</b><div class="crop-cargo"><span data-crop="leaf">${icon('leaf')}달빛 상추 <b id="inventory-leaf">0</b></span><span data-crop="bean">${icon('bean')}별빛 콩 <b id="inventory-bean">0</b></span></div><p>기지에 방문해 납품하세요.</p></div></details>
        </div>
      </header>
      <details class="mission-widget play-only" aria-label="미션 목표">
        <summary><span class="mission-leaf">${icon('sprout')}</span><div><small>오늘의 작은 임무</small><b>첫 수확 <span id="delivered">0</span><em>/4</em></b></div><span class="time-resource" id="timer">08:00</span><span class="disclosure">⌄</span></summary>
        <div class="mission-body"><div class="eyebrow">가뭄 속 첫 수확 <span id="mission-status">진행 중</span></div><div class="mission-progress"><i id="delivery-meter"></i></div><div class="sub-objective"><span id="drought-check">◇</span> 가뭄 이후 수확·납품 <b><span id="dry-delivered">0</span> / 2</b></div><small id="mission-weather">가뭄까지 70초</small></div>
      </details>
      <div hidden><span id="weather"></span><span id="weather-sub"></span></div>
      <div class="drought-alert" id="drought-alert" role="alert"><span>!</span><div><b>환경 경고 · 가뭄 발생</b><p>수분이 더 빠르게 감소합니다. 남은 물로 작물을 지켜주세요.</p></div></div>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>

      <aside class="plot-info play-only" id="plot-info" hidden>
        <div class="plot-title"><span id="plot-number">PLOT 01</span><span class="crop-portrait" id="crop-portrait" aria-hidden="true"></span><b id="crop-name">빈 밭</b><span id="crop-status" class="state-pill">파종 가능</span></div>
        <p class="crop-identity" id="crop-identity" hidden></p>
        <div id="crop-details"><div class="plot-meter"><span>성장</span><div><i id="growth-meter"></i></div><b id="growth-value">0%</b></div><div class="plot-meter moisture"><span>수분</span><div><i id="moisture-meter"></i></div><b id="moisture-value">0%</b></div></div>
        <button id="apply-action" class="context-button">선택한 도구 사용 ↗</button>
      </aside>

      <div class="bottom-hud play-only">
        <div class="tool-hint"><div><b id="tool-hint">밭 가까이 이동하세요</b><small>WASD / 방향키 이동 · E 행동 · ESC 메뉴</small></div></div>
        <nav class="action-bar" aria-label="심을 씨앗 선택">
          <div class="toolbar-caption">SEED POUCH <span>심을 씨앗</span></div>
          <button class="tool active" data-tool="leaf" aria-label="달빛 상추 씨앗 선택" aria-pressed="true">${icon('leaf')}<b>달빛 상추</b><small>15G · 30초</small></button>
          <button class="tool" data-tool="bean" aria-label="별빛 콩 씨앗 선택" aria-pressed="false">${icon('bean')}<b>별빛 콩</b><small>25G · 45초</small></button>
        </nav>
      </div>
      <div class="movement-control play-only"><div id="joystick" role="group" aria-label="캐릭터 이동 조이스틱"><span class="stick-arrows">↑<br>←　 →<br>↓</span><i id="joystick-knob"></i></div><small>살짝 밀어서 걸어요</small></div><div class="desktop-movement play-only"><span>W A S D</span> / 방향키로 산책 <i>·</i> E 행동 <i>·</i> M 전체 보기</div>
      <div class="character-actions play-only">
        <div class="interaction-prompt" id="interaction-prompt" role="status">밭이나 시설 가까이 이동하세요</div>
        <button id="interact" class="interact-button" disabled><kbd>E</kbd><span id="interact-icon">${icon('sprout')}</span><b id="interact-name">가까이 이동</b><small id="interact-detail">대상 자동 선택</small></button>
        <div class="quick-actions"><button data-use="leaf" aria-label="씨앗 심기"><kbd>1</kbd>${icon('leaf')}<span>심기</span></button><button data-use="water" aria-label="물주기"><kbd>2</kbd>${icon('drop')}<span>물주기</span></button><button data-use="harvest" aria-label="수확하기"><kbd>3</kbd>${icon('harvest')}<span>수확</span></button></div>
      </div>
      <div id="player-label" class="player-label play-only" aria-hidden="true"></div>
      <div class="utility-bar"><button id="view-toggle" title="농장 전체 보기 (M)" aria-label="농장 전체 보기" aria-pressed="false">${icon('map')}</button><button id="pause" title="메뉴 (Esc)" aria-label="일시정지">${icon('menu')}</button></div>
      <div id="debug" hidden></div>

      <section class="overlay start-overlay briefing-overlay" id="start-screen" role="dialog" aria-modal="true" aria-labelledby="briefing-title" hidden>
        <div class="start-panel mission-brief"><div class="transmission">${icon('sprout')} 아그리아–7에서 온 편지</div>
          <p class="start-kicker">ECO FARM · AGRIA–7</p><h2 id="briefing-title"><small>MISSION 01</small>가뭄 속 첫 수확</h2>
          <p class="story">작은 씨앗과 물뿌리개 하나.<br>우리의 농장에 다시 초록을 채워볼까요?</p>
          <ul class="brief-objectives"><li>제한시간 <b>8분</b></li><li>목표 <b>농작물 4개 납품</b></li><li>추가 조건 <b>최소 2개는 가뭄 이후 수확</b></li><li>주의사항 <b>물 자원은 제한되어 있음</b></li></ul>
          <p class="practice-note">직접 심고 가꾸는 5단계 연습 · 연습 중 임무 시간 정지</p>
          <button class="primary-button" id="learn">농장 운영 배우기 <span>↗</span></button>
          <button class="text-button" id="skip-tutorial">튜토리얼 건너뛰고 임무 시작</button>
        </div>
      </section>

      <aside class="tutorial-window play-only" id="tutorial-window" aria-label="인터랙티브 튜토리얼" hidden>
        <div class="tutorial-heading"><span class="guide-avatar">${icon('sprout')}</span><b>새싹 안내소</b><span id="tutorial-step">01 / 05</span><button id="tutorial-more" aria-label="자세한 연습 안내" aria-expanded="false">?</button></div>
        <div class="tutorial-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <div aria-live="polite" aria-atomic="true"><p id="tutorial-feedback" class="tutorial-feedback"></p><h2 id="tutorial-title"></h2><p id="tutorial-description"></p><p id="tutorial-instruction" class="tutorial-instruction"></p></div>
        <p class="tutorial-clock">Ⅱ 임무 · 가뭄 타이머 정지</p>
        <p id="tutorial-reset-note" hidden>연습 기록은 초기화됩니다.<br>물 100 · 300G · 빈 밭 6칸 · 납품 0/4 · 08:00</p>
        <button class="primary-button" id="start-mission" hidden>본격적인 임무 시작 <span>↗</span></button>
        <button class="text-button" id="end-practice">연습 건너뛰기 ↗</button>
      </aside>
      <div class="plot-guide" id="plot-guide" aria-hidden="true" hidden><span id="plot-guide-text">1번 밭</span><b>▼</b></div>
      <div class="crop-labels play-only" id="crop-labels"><svg class="crop-leaders" aria-hidden="true"><line id="supply-leader" visibility="hidden"/>${Array.from({ length: 6 }, (_, i) => `<line id="crop-leader-${i}" stroke="#bce5c5" visibility="hidden"/>`).join('')}</svg>${Array.from({ length: 6 }, (_, i) => `<div class="crop-label" id="crop-label-${i}" hidden><span class="crop-label-icon"></span><div><b id="crop-label-name-${i}"></b><small id="crop-label-state-${i}"></small></div></div>`).join('')}</div>
      <div class="supply-label play-only" id="supply-label">${icon('delivery')}<span>보급 기지<small>수확물 보관 → 납품</small></span></div>

      <section class="overlay modal-overlay" id="help-screen" role="dialog" aria-modal="true" aria-labelledby="help-title" hidden>
        <div class="modal help-modal"><span class="eyebrow">FARM FIELD GUIDE</span><h2 id="help-title" tabindex="-1">게임 방법 / 튜토리얼</h2>
          <div id="help-controls"><p>우주 캐릭터를 직접 움직여 밭과 시설에 접근하세요.</p><dl><dt>WASD · 방향키</dt><dd>화면 방향으로 이동 · 태블릿은 왼쪽 조이스틱</dd><dt>1 · 씨앗 심기</dt><dd>하단에서 씨앗 선택 · 빈 밭 가까이 접근</dd><dt>2 · 물주기</dt><dd>물뿌리개 물 10 사용 · 수분 +55</dd><dt>3 · 수확하기</dt><dd>익은 작물 수확 · 고사 작물 정리</dd><dt>E · 자동 행동</dt><dd>근처 밭 상태에 맞게 심기·물주기·수확<br>물탱크: 물뿌리개 채우기 (최대 30)<br>SUPPLY: 보관함 수확물 납품</dd></dl><p>태블릿: 오른쪽 큰 버튼이 대상에 따라 바뀌어요.<br>전체 물 100은 한정되어 있어요. 충전 시 총량은 늘지 않아요.<br>70초 후 가뭄 · 수분 감소 ×2.25<br>8분 안에 4개 납품, 그중 2개는 가뭄 이후 수확하세요.<br>Esc / Space: 메뉴 · Q: 화질 · F3: FPS</p><p class="practice-note">도움말을 보는 동안 농장은 정지해요.<br>닫으면 기존 진행 상황을 그대로 이어갑니다.</p><button class="primary-button" id="replay-tutorial">튜토리얼 다시 연습하기 <span>↻</span></button></div>
          <div id="replay-confirm" hidden><p>튜토리얼을 다시 시작하면 현재 임무의 작물, 자원, 납품량과 시간이 초기화됩니다.</p><p>연습을 마친 후 새 임무를 시작합니다. 현재 진행 상황을 초기화하고 연습할까요?</p><button class="primary-button" id="confirm-replay">초기화하고 연습 시작</button><button class="text-button" id="cancel-replay">취소 · 도움말로 돌아가기</button></div>
          <button class="text-button" id="close-help">닫고 돌아가기</button>
        </div>
      </section>

      <section class="overlay intro-overlay" id="intro-screen" hidden><div class="cinema-top"><span>ECO FARM / FLIGHT 007</span><button id="skip">오프닝 건너뛰기 ↗</button></div><div class="intro-caption"><small id="intro-step">01 / DEEP SPACE</small><h2 id="intro-message">AGRIA–7 접근 중...</h2><p id="intro-sub">농업 기지의 물 공급량이 부족합니다.</p><div class="intro-progress"><i id="intro-meter"></i></div></div></section>

      <section class="overlay modal-overlay" id="pause-screen" hidden><div class="modal small-modal"><span class="eyebrow">천천히, 쉬어 가요</span><h2>잠시 쉬어가요</h2><p>농장과 임무 시간이 멈춰 있습니다.</p><button class="primary-button" id="resume">계속 가꾸기 <span>↗</span></button><button class="text-button" id="pause-help">게임 방법 / 튜토리얼</button><br><button class="text-button" id="pause-menu">메인 화면으로</button><div class="pause-settings"><button id="help" aria-label="게임 방법 / 튜토리얼">?</button><button id="mute" aria-label="음소거" aria-pressed="false">${icon('sound')}</button><button id="quality" aria-label="렌더링 품질 전환">자동</button><button id="fullscreen" aria-label="전체 화면">${icon('expand')}</button></div></div></section>

      <section class="overlay modal-overlay" id="result-screen" hidden><div class="modal result-modal"><span class="eyebrow" id="result-kicker">MISSION COMPLETE</span><div class="result-seal" id="result-seal">S</div><h2 id="result-title">다시, 초록빛으로.</h2><p id="result-description">아그리아–7 첫 번째 농장 복구 성공!</p><div class="result-stats" id="result-stats"></div><p class="learning-message">작물의 수분을 확인하고 필요한 만큼만 물을 주면,<br>작은 물탱크로도 더 많은 생명을 키울 수 있어요.</p><button class="primary-button" id="retry">다시 도전하기 <span>↻</span></button><button class="text-button" id="main-menu">메인 화면으로</button></div></section>
      <div class="portrait-hint">↻ 가로 화면에서 농장을 더 넓게 볼 수 있어요.</div>`;
    const click = (id: string, fn: () => void) => this.bindButton(this.el(id) as HTMLButtonElement, fn);
    click('learn', () => this.onContinue()); click('skip', () => this.onSkip());
    click('skip-tutorial', () => this.onStartMission()); click('end-practice', () => this.onStartMission()); click('start-mission', () => this.onStartMission());
    click('help', () => this.onHelp()); click('pause-help', () => this.onHelp()); click('close-help', () => this.onCloseHelp());
    click('replay-tutorial', () => this.confirmReplay(true)); click('cancel-replay', () => this.confirmReplay(false));
    click('confirm-replay', () => this.onReplayTutorial());
    this.el('help-screen').addEventListener('keydown', e => this.trapFocus(e));
    this.el('start-screen').addEventListener('keydown', e => this.trapFocus(e));
    click('retry', () => this.onRetry()); click('main-menu', () => this.onMenu()); click('pause-menu', () => this.onMenu());
    click('pause', () => this.onPause()); click('resume', () => this.onPause());
    click('view-toggle', () => this.onView());
    click('tutorial-more', () => { const expanded = this.el('tutorial-more').getAttribute('aria-expanded') !== 'true'; this.el('tutorial-more').setAttribute('aria-expanded', String(expanded)); this.el('tutorial-window').classList.toggle('expanded', expanded); });
    click('mute', () => this.onMute()); click('quality', () => this.onQuality());
    click('apply-action', () => this.onApply()); click('interact', () => this.onInteract());
    click('fullscreen', () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => this.toast('이 브라우저에서는 전체 화면을 지원하지 않아요.')); });
    this.root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => this.bindButton(b, () => this.onAction(b.dataset.tool as Action)));
    this.root.querySelectorAll<HTMLButtonElement>('[data-use]').forEach(b => this.bindButton(b, () => this.onUse(b.dataset.use as Action)));
    const stick = this.el('joystick');
    const move = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointer) return;
      const rect = stick.getBoundingClientRect(), radius = rect.width * 0.3;
      let x = (e.clientX - rect.left - rect.width / 2) / radius, y = (e.clientY - rect.top - rect.height / 2) / radius;
      const distance = Math.hypot(x, y);
      if (distance > 1) { x /= distance; y /= distance; }
      this.el('joystick-knob').style.transform = `translate(${x * radius}px, ${y * radius}px)`;
      const force = distance > 0.16 ? Math.min(1, (distance - 0.16) / 0.84) : 0;
      this.onMove(distance ? x / Math.min(1, distance) * force : 0, distance ? y / Math.min(1, distance) * force : 0);
    };
    stick.addEventListener('pointerdown', e => {
      if (e.button !== 0 || this.stickPointer !== null || this.root.dataset.phase !== 'playing') return;
      e.preventDefault(); this.stickPointer = e.pointerId; stick.setPointerCapture(e.pointerId); move(e);
    });
    stick.addEventListener('pointermove', move);
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(event, e => { if ((e as PointerEvent).pointerId === this.stickPointer) this.resetJoystick(); });
    window.addEventListener('resize', () => this.resetJoystick());
  }

  bindButton(button: HTMLButtonElement, activate: () => void) {
    let touchAt = -Infinity;
    button.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || button.disabled) return;
      // Secondary fingers do not consistently synthesize click on tablet browsers.
      e.preventDefault(); touchAt = performance.now(); activate();
    });
    button.addEventListener('click', e => {
      if (button.disabled || (e as PointerEvent).pointerType === 'touch' || e.detail > 0 && performance.now() - touchAt < 700) return;
      activate();
    });
  }

  resetJoystick() {
    const id = this.stickPointer; this.stickPointer = null;
    const stick = this.el('joystick');
    if (id !== null && stick.hasPointerCapture(id)) stick.releasePointerCapture(id);
    this.el('joystick-knob').style.transform = ''; this.onMove(0, 0);
  }

  positionPlayer(position: { x: number; y: number }) {
    this.el('player-label').style.transform = `translate(${position.x}px, ${position.y}px) translate(-50%, -100%)`;
  }

  updateInteraction(state: GameState, target: FarmTarget | null, action: Action | 'refill' | 'deliver' | null, seed: CropKind, busy: boolean) {
    const plot = target?.kind === 'plot' ? state.plots[target.id] : null;
    const allowed = !state.tutorial || target?.kind === 'tank' || state.tutorial === 'deliver' && target?.kind === 'supply' || plot?.id === 0 && TUTORIAL[state.tutorial].action === action;
    const enabled = state.phase === 'playing' && !!target && !!action && allowed && !busy;
    (this.el('interact') as HTMLButtonElement).disabled = !enabled;
    const text: Record<string, [string, string, Parameters<typeof icon>[0]]> = {
      leaf: ['달빛 상추 심기', '15G · 성장 30초', 'leaf'], bean: ['별빛 콩 심기', '25G · 성장 45초', 'bean'],
      water: ['물주기', `휴대 ${state.canWater}/30 · 물 −10`, 'drop'],
      harvest: [plot?.crop?.dead ? '마른 작물 정리' : '수확하기', '수확물 → 보급 기지 보관함', 'harvest'],
      refill: ['물 채우기', `물뿌리개 ${state.canWater}/30 · 탱크 ${state.water - state.canWater}`, 'water'],
      deliver: ['납품하기', `보관함 ${state.inventory.length}개 · 판매하고 목표 달성`, 'delivery'],
    };
    const info = action ? text[action] : null;
    this.root.classList.toggle('has-target', !!target);
    this.el('player-label').hidden = !target;
    this.set('player-label', busy ? '가꾸는 중…' : info ? `${this.root.dataset.touch === 'true' ? '' : 'E · '}${info[0]}` : '조금씩 자라고 있어요');
    this.set('interact-name', busy ? '작업 중…' : info?.[0] ?? (plot ? '자라는 중' : '가까이 이동'));
    this.set('interact-detail', info?.[1] ?? (plot?.crop ? `성장 ${Math.floor(plot.crop.growth * 100)}%` : '대상 자동 선택'));
    const glyph = info?.[2] ?? 'sprout';
    if (this.el('interact-icon').dataset.icon !== glyph) { this.el('interact-icon').dataset.icon = glyph; this.el('interact-icon').innerHTML = icon(glyph); }
    this.set('interaction-prompt', !target ? '밭 · 물탱크 · 보급 기지에 접근하세요' : target.kind === 'tank' ? '물탱크 · 유한한 물을 나눠 사용해요' : target.kind === 'supply' ? '보급 기지 · 수확물 납품' : `${target.id + 1}번 밭 · ${plot?.crop ? CONFIG.crops[plot.crop.kind].name : '빈 밭'}`);
    this.root.querySelectorAll<HTMLButtonElement>('[data-use]').forEach(button => {
      const use = button.dataset.use === 'leaf' ? seed : button.dataset.use;
      const tutorialAllowed = !state.tutorial || plot?.id === 0 && use === TUTORIAL[state.tutorial].action;
      button.disabled = state.phase !== 'playing' || !plot || busy || !tutorialAllowed;
      button.classList.toggle('suggested', use === action && enabled);
    });
    this.root.querySelectorAll<HTMLElement>('[data-tool]').forEach(b => {
      const active = b.dataset.tool === seed;
      b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active));
    });
  }

  el(id: string) { return this.root.querySelector<HTMLElement>(`#${id}`)!; }
  private set(id: string, value: string) { if (this.lastValues.get(id) !== value) { this.el(id).textContent = value; this.lastValues.set(id, value); } }
  private meter(id: string, value: number) { const v = `${Math.round(value)}%`; if (this.lastValues.get(id) !== v) { this.el(id).style.width = v; this.lastValues.set(id, v); } }
  toast(message: string, duration = 3000) { this.el('toast').textContent = message; this.el('toast').classList.add('visible'); this.toastUntil = performance.now() + duration; }
  drought() { this.el('drought-alert').classList.add('visible'); window.setTimeout(() => this.el('drought-alert').classList.remove('visible'), 6500); }
  mute(muted: boolean) { this.el('mute').innerHTML = icon(muted ? 'mute' : 'sound'); this.el('mute').setAttribute('aria-pressed', String(muted)); this.el('mute').setAttribute('aria-label', muted ? '소리 켜기' : '음소거'); }

  resetTransient() {
    this.lastValues.clear(); this.lastAction = ''; this.lastSelected = -2;
    this.showHelp(false); this.toastUntil = 0;
    this.root.querySelectorAll('details[open]').forEach(el => el.removeAttribute('open'));
    this.el('tutorial-window').classList.remove('expanded');
    this.el('tutorial-more').setAttribute('aria-expanded', 'false');
    this.el('toast').classList.remove('visible'); this.el('drought-alert').classList.remove('visible');
  }

  showHelp(open: boolean) {
    if (open) this.focusBeforeHelp = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.helpOpen = open; this.el('help-screen').hidden = !open;
    this.confirmReplay(false);
    if (open) this.el('help-title').focus();
    else { this.focusBeforeHelp?.focus(); this.focusBeforeHelp = null; }
  }

  private confirmReplay(confirm: boolean) {
    this.el('help-controls').hidden = confirm; this.el('replay-confirm').hidden = !confirm;
    if (this.helpOpen) this.el(confirm ? 'confirm-replay' : 'help-title').focus();
  }

  private trapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const dialog = e.currentTarget as HTMLElement;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')].filter(b => !b.disabled && b.getClientRects().length > 0);
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (e.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement as HTMLButtonElement))) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }

  positionGuide(position: { x: number; y: number }) {
    const x = Math.max(120, Math.min(window.innerWidth - 120, position.x));
    const y = Math.max(120, Math.min(window.innerHeight - 160, position.y - 45));
    this.el('plot-guide').style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    const offscreen = Math.abs(x - position.x) > 1 || Math.abs(y - position.y + 45) > 1;
    this.el('plot-guide').classList.toggle('offscreen', offscreen);
    this.el('plot-guide').querySelector('b')!.style.transform = offscreen ? `rotate(${Math.atan2(position.y - y, position.x - x) - Math.PI / 2}rad)` : '';
  }

  positionCrops(state: GameState, world: FarmScene, hero: { x: number; y: number }) {
    // Only the nearby field gets a small bubble; no permanent field labels or leader lines.
    const label = this.el('plot-info');
    const plot = state.plots[state.selected];
    if (!plot || label.hidden) return;
    const anchor = world.projectCrop(plot.id, plot.crop?.kind ?? 'leaf');
    const width = window.innerHeight < 580 ? 184 : 210;
    const side = hero.x < anchor.x ? 1 : -1;
    const x = Math.max(width / 2 + 12, Math.min(window.innerWidth - width / 2 - 12, anchor.x + side * width * 0.6));
    let y = Math.max(115, Math.min(window.innerHeight - 220, anchor.y - 12));
    if (Math.abs(x - hero.x) < width / 2 + 65 && Math.abs(y - hero.y) < 100) y = Math.max(115, hero.y - 45);
    label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  private cropLabels(state: GameState) {
    for (const plot of state.plots) {
      const label = this.el(`crop-label-${plot.id}`), crop = plot.crop;
      label.hidden = true;
      if (!crop) continue;
      if (label.dataset.crop !== crop.kind) {
        label.dataset.crop = crop.kind;
        label.querySelector('.crop-label-icon')!.innerHTML = icon(crop.kind);
      }
      const ready = crop.growth >= 1 && !crop.dead;
      label.classList.toggle('ready', ready);
      label.classList.toggle('warning', crop.dead || crop.moisture < 15);
      this.set(`crop-label-name-${plot.id}`, CONFIG.crops[crop.kind].name);
      this.set(`crop-label-state-${plot.id}`, `${plot.id + 1}번 밭 · ${crop.dead ? '고사 · 정리 필요' : ready ? '✓ 수확 가능' : crop.moisture < 15 ? '물 부족' : `성장 ${Math.floor(crop.growth * 100)}%`}`);
    }
  }

  private tutorial(state: GameState) {
    const step = state.tutorial;
    this.root.dataset.tutorial = step ?? '';
    this.el('tutorial-window').hidden = !step;
    this.el('plot-guide').hidden = !step || !['plant', 'deliver'].includes(step) || state.phase !== 'playing';
    const key = `${step}:${state.tutorialToolReady}:${state.phase}`;
    if (key === this.lastTutorial) return;
    this.lastTutorial = key;
    const info = step ? TUTORIAL[step] : null;
    this.root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(button => {
      button.disabled = state.phase !== 'playing' || !!step && button.dataset.tool !== 'leaf';
      button.classList.toggle('tutorial-highlight', step === 'plant' && button.dataset.tool === 'leaf');
    });
    this.el('apply-action').hidden = !!step;
    this.el('crop-details').classList.toggle('tutorial-highlight', step === 'grow');
    this.root.querySelector('.cargo-resource')!.classList.toggle('tutorial-highlight', step === 'deliver');
    if (!info) return;
    this.set('tutorial-step', step === 'complete' ? '준비 완료' : `0${info.number} / 05`);
    this.set('tutorial-title', info.title); this.set('tutorial-description', info.description);
    this.set('tutorial-instruction', info.instruction); this.set('tutorial-feedback', info.feedback);
    this.set('plot-guide-text', step === 'deliver' ? '보급 기지로 이동하세요' : step === 'grow' ? '성장 관찰 중' : '1번 밭 가까이 이동하세요');
    this.el('start-mission').hidden = step !== 'complete';
    this.el('tutorial-reset-note').hidden = step !== 'complete';
    this.el('end-practice').hidden = step === 'complete';
    this.root.querySelectorAll<HTMLElement>('.tutorial-dots i').forEach((dot, i) => {
      dot.classList.toggle('done', i < info.number - 1 || step === 'complete'); dot.classList.toggle('current', i === info.number - 1);
    });
  }

  update(state: GameState) {
    const playing = state.phase === 'playing';
    if (state.phase !== this.lastPhase) {
      this.root.dataset.phase = state.phase;
      this.el('start-screen').hidden = state.phase !== 'briefing'; this.el('intro-screen').hidden = state.phase !== 'intro';
      this.el('pause-screen').hidden = state.phase !== 'paused'; this.el('result-screen').hidden = !['won', 'lost'].includes(state.phase);
      if (state.phase === 'won' || state.phase === 'lost') this.result(state);
      if (state.phase === 'briefing') this.el('learn').focus();
      if (!playing) { this.el('drought-alert').classList.remove('visible'); this.el('toast').classList.remove('visible'); }
      this.lastPhase = state.phase;
    }
    this.el('pause-screen').hidden = state.phase !== 'paused' || this.helpOpen;
    this.tutorial(state);
    this.cropLabels(state);
    this.set('mission-status', state.tutorial ? '연습 중' : '진행 중');
    this.set('water', String(state.water)); this.meter('water-meter', state.water);
    this.set('can-water', String(state.canWater)); this.set('tank-water', String(state.water - state.canWater));
    this.set('money', String(state.money)); this.set('inventory', String(state.inventory.length));
    this.set('inventory-leaf', String(state.inventory.filter(item => item.kind === 'leaf').length));
    this.set('inventory-bean', String(state.inventory.filter(item => item.kind === 'bean').length));
    const seconds = Math.ceil(state.remaining);
    this.set('timer', `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
    this.el('timer').classList.toggle('urgent', seconds < 60);
    this.set('delivered', String(state.delivered)); this.set('dry-delivered', String(state.droughtDelivered));
    this.meter('delivery-meter', Math.min(100, state.delivered / CONFIG.deliveryGoal * 100));
    this.set('drought-check', state.droughtDelivered >= CONFIG.droughtGoal ? '◆' : '◇');
    this.set('weather', state.drought ? '가뭄 · 수분 관리 필요' : '맑음 · 생육에 적합');
    this.set('weather-sub', state.tutorial ? '연습 중 · 가뭄 카운트다운 정지' : state.drought ? '토양의 수분 감소 ×2.25' : `건조 전선 ${Math.max(0, Math.ceil(CONFIG.droughtAt - state.time))}초 후 도착`);
    this.set('mission-weather', state.drought ? '가뭄 진행 중 · 수분 감소 ×2.25' : `가뭄까지 ${Math.max(0, Math.ceil(CONFIG.droughtAt - state.time))}초 · 물을 아껴주세요`);
    this.root.classList.toggle('dry', state.drought);
    if (state.action !== this.lastAction) {
      this.root.querySelectorAll<HTMLElement>('[data-tool]').forEach(b => { const active = b.dataset.tool === state.action; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
      const hints: Record<Action, string> = { leaf: '빈 밭 근처에서 심기', bean: '빈 밭 근처에서 심기', water: '물탱크에서 물을 채워 가꾸세요', harvest: '보급 기지에 접근해 납품하세요' };
      this.set('tool-hint', hints[state.action]); this.lastAction = state.action;
    }
    if (state.selected !== this.lastSelected) { this.el('plot-info').hidden = state.selected < 0; this.lastSelected = state.selected; }
    if (state.selected >= 0) {
      const crop = state.plots[state.selected].crop;
      this.set('plot-number', `PLOT 0${state.selected + 1}`);
      this.set('crop-name', crop ? CONFIG.crops[crop.kind].name : '빈 밭');
      const portrait = this.el('crop-portrait');
      const kind = crop?.kind ?? '';
      if (portrait.dataset.crop !== kind) { portrait.dataset.crop = kind; portrait.innerHTML = crop ? icon(crop.kind) : ''; }
      this.el('plot-info').dataset.crop = kind;
      this.el('crop-identity').hidden = !crop;
      this.set('crop-identity', crop?.kind === 'leaf' ? '초승달 · 둥근 민트빛 상추' : '별 · 보랏빛 꼬투리 콩');
      this.el('crop-details').hidden = !crop;
      this.set('crop-status', !crop ? '파종 가능' : crop.dead ? '고사 · 정리 필요' : crop.moisture < 15 ? '물 부족' : crop.growth >= 1 ? '수확 가능' : crop.growth < 0.13 ? '씨앗' : crop.growth < 0.4 ? '새싹' : '자라는 중');
      this.el('crop-status').classList.toggle('warning', !!crop && (crop.moisture < 15 || crop.dead));
      if (crop) {
        this.meter('growth-meter', crop.growth * 100); this.meter('moisture-meter', crop.moisture);
        this.set('growth-value', `${Math.floor(crop.growth * 100)}%`); this.set('moisture-value', `${Math.floor(crop.moisture)}%`);
      }
      this.set('apply-action', crop?.dead ? '마른 작물 정리하기 ↗' : crop?.growth === 1 ? `${CONFIG.crops[crop.kind].name} 수확 → 보급 기지 ↗` : crop ? '이 밭에 물주기 −10 ↗' : `${CONFIG.crops[state.action === 'bean' ? 'bean' : 'leaf'].name} 심기 ↗`);
    }
    if (this.toastUntil && performance.now() > this.toastUntil) { this.el('toast').classList.remove('visible'); this.toastUntil = 0; }
  }

  intro(time: number) {
    this.set('intro-step', time < 4.2 ? '01 / APPROACHING AGRIA–7' : '02 / LANDING SEQUENCE');
    this.set('intro-message', time < 4.2 ? 'AGRIA–7 접근 중...' : time < 7 ? '농업 기지에 착륙합니다.' : '다시 초록을 키울 시간입니다.');
    this.set('intro-sub', time < 4.2 ? '농업 기지의 물 공급량이 부족합니다.' : '첫 번째 농장 복구 임무를 시작하세요.');
    this.meter('intro-meter', time / CONFIG.introDuration * 100);
  }

  private result(state: GameState) {
    const won = state.phase === 'won';
    this.set('result-kicker', won ? 'MISSION COMPLETE' : 'MISSION ENDED');
    this.set('result-title', won ? '다시, 초록빛으로.' : '다음 계절을 기다리며.');
    this.set('result-description', won ? '아그리아–7 첫 번째 농장 복구 성공!' : state.failureReason);
    this.set('result-seal', won ? state.score >= 90 ? 'S' : state.score >= 75 ? 'A' : 'B' : '↻');
    this.el('result-stats').innerHTML = [['총 수확량', `${state.harvested}개`], ['총 납품량', `${state.delivered}개`], ['판매 수익', `${state.revenue}G`], ['사용한 물', `${state.waterUsed}`], ['남은 물', `${state.water}`], ['환경관리 점수', `${state.score}점`]].map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('');
  }
}
