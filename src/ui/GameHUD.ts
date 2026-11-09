import { CONFIG, type Action } from '../game/GameConfig';
import type { GameState } from '../game/GameState';
import { icon } from './icons';

export class GameHUD {
  readonly root: HTMLElement;
  private lastPhase = '';
  private toastUntil = 0;
  private lastSelected = -2;
  private lastAction = '';
  private lastValues = new Map<string, string>();
  onContinue = () => {};
  onSkip = () => {};
  onRetry = () => {};
  onMenu = () => {};
  onPause = () => {};
  onMute = () => {};
  onQuality = () => {};
  onDeliver = () => {};
  onAction = (_action: Action) => {};
  onApply = () => {};

  constructor(container: HTMLElement) {
    this.root = document.createElement('div'); this.root.id = 'ui'; container.append(this.root);
    this.root.innerHTML = `
      <div class="vignette"></div>
      <header class="top-hud">
        <div class="brand"><span class="brand-icon">${icon('sprout')}</span><div><b>ECO FARM<span class="brand-dot">®</span></b><small>AGRIA–7 · FARM RESTORATION</small></div></div>
        <div class="resource-group">
          <div class="resource water-resource">${icon('drop')}<div><small>물 보유량</small><strong><span id="water">100</span><em> / 100</em></strong></div><div class="resource-track"><i id="water-meter"></i></div></div>
          <div class="resource">${icon('coin')}<div><small>보유 자금</small><strong><span id="money">300</span><em> G</em></strong></div></div>
          <div class="resource cargo-resource">${icon('delivery')}<div><small>수확물</small><strong><span id="inventory">0</span><em> 개</em></strong></div></div>
        </div>
        <div class="time-resource"><span class="live-dot"></span><div><small>남은 임무 시간</small><strong id="timer">08:00</strong></div></div>
      </header>

      <section class="mission-widget play-only" aria-label="미션 목표">
        <div class="eyebrow"><span class="tiny-square"></span> MISSION 01 <span class="mission-status" id="mission-status">진행 중</span></div>
        <h2>가뭄 속 첫 수확</h2>
        <div class="objective"><span>보급 기지에 작물 납품</span><b><span id="delivered">0</span><em> / 4</em></b></div>
        <div class="mission-progress"><i id="delivery-meter"></i><span></span><span></span><span></span></div>
        <div class="sub-objective"><span id="drought-check">◇</span> 가뭄 이후 수확·납품 <b><span id="dry-delivered">0</span> / 2</b></div>
      </section>

      <div class="world-status play-only"><span class="weather-symbol">${icon('sun')}</span><div><small>아그리아–7 기상 관측</small><b id="weather">맑음 · 생육에 적합</b><span id="weather-sub">건조 전선 접근 중</span></div></div>
      <div class="world-caption play-only"><i></i> AGRIA–7 <span>35° 07′ N / SECTOR 01</span></div>
      <div class="map-label play-only"><span>농업 복구 구역</span><b>THE GREEN FRONTIER</b></div>
      <div class="drought-alert" id="drought-alert" role="alert"><span>!</span><div><b>환경 경고 · 가뭄 발생</b><p>수분이 더 빠르게 감소합니다. 남은 물로 작물을 지켜주세요.</p></div></div>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>

      <aside class="plot-info play-only" id="plot-info" hidden>
        <div class="plot-title"><span id="plot-number">PLOT 01</span><b id="crop-name">빈 밭</b><span id="crop-status" class="state-pill">파종 가능</span></div>
        <div id="crop-details"><div class="plot-meter"><span>성장</span><div><i id="growth-meter"></i></div><b id="growth-value">0%</b></div><div class="plot-meter moisture"><span>수분</span><div><i id="moisture-meter"></i></div><b id="moisture-value">0%</b></div></div>
        <button id="apply-action" class="context-button">선택한 도구 사용 ↗</button>
      </aside>

      <div class="bottom-hud play-only">
        <div class="tool-hint"><span class="mouse-icon"></span><div><b id="tool-hint">씨앗을 선택하고 밭을 눌러 심으세요</b><small>1–4 도구 선택 · 5 납품 · SPACE 일시정지</small></div></div>
        <nav class="action-bar" aria-label="농장 도구">
          <div class="toolbar-caption">FARMING KIT <span>도구를 고른 뒤 밭을 클릭하세요</span></div>
          <button class="tool active" data-tool="leaf" aria-label="달빛 상추 심기" aria-pressed="true"><kbd>1</kbd>${icon('leaf')}<b>달빛 상추</b><small>15G · 30초</small></button>
          <button class="tool" data-tool="bean" aria-label="별빛 콩 심기" aria-pressed="false"><kbd>2</kbd>${icon('bean')}<b>별빛 콩</b><small>25G · 45초</small></button>
          <span class="toolbar-separator"></span>
          <button class="tool" data-tool="water" aria-label="물주기" aria-pressed="false"><kbd>3</kbd>${icon('water')}<b>물주기</b><small>물 −10</small></button>
          <button class="tool" data-tool="harvest" aria-label="수확" aria-pressed="false"><kbd>4</kbd>${icon('harvest')}<b>수확</b><small>익은 작물</small></button>
          <span class="toolbar-separator"></span>
          <button class="tool delivery-tool" id="deliver" aria-label="수확물 납품"><kbd>5</kbd>${icon('delivery')}<b>납품하기</b><small id="cargo-label">보관함 비어 있음</small><span class="cargo-badge" id="cargo-badge" hidden>0</span></button>
        </nav>
      </div>
      <div class="utility-bar"><button id="pause" title="일시정지 (Space)" aria-label="일시정지">${icon('pause')}</button><button id="mute" title="음소거" aria-label="음소거" aria-pressed="false">${icon('sound')}</button><button id="quality" title="렌더링 품질 전환 (Q)" aria-label="렌더링 품질 전환">SD</button><button id="fullscreen" title="전체 화면" aria-label="전체 화면">${icon('expand')}</button></div>
      <div id="debug" hidden></div>

      <section class="overlay start-overlay briefing-overlay" id="start-screen" role="dialog" aria-modal="true" aria-labelledby="briefing-title" hidden>
        <div class="start-panel"><div class="transmission"><i></i> INCOMING TRANSMISSION <span>07</span></div>
          <p class="start-kicker">작은 농장, 새로운 시작</p><h1>ECO<br><span>FARM</span><sup>✳</sup></h1><div class="title-rule"></div><h2 id="briefing-title">잃어버린 초록 행성</h2>
          <p class="story">아그리아–7에서 복구 신호가 수신되었습니다.<br>남은 씨앗과 물로, 이 행성에 초록을 되돌려주세요.</p>
          <div class="mission-preview"><span>첫 번째 임무</span><b>가뭄 속에서 작물 4개 납품하기</b><small>그중 2개는 가뭄 이후 수확 · 제한 시간 8분</small></div>
          <p class="start-controls">${icon('water')} 클릭 또는 터치로 가꾸는 작은 우주 농장</p>
          <p class="briefing-countdown"><span id="briefing-countdown">5초 후 농장으로 이동합니다</span><small>클릭·터치 또는 Enter로 바로 시작</small></p>
          <div class="briefing-progress"><i id="briefing-meter"></i></div>
        </div><div class="start-coordinate">AGRICULTURAL RECOVERY PROGRAM<br><b>AGRIA–7 / EST. 2186</b></div>
      </section>

      <section class="overlay intro-overlay" id="intro-screen" hidden><div class="cinema-top"><span>ECO FARM / FLIGHT 007</span><button id="skip">오프닝 건너뛰기 ↗</button></div><div class="intro-caption"><small id="intro-step">01 / DEEP SPACE</small><h2 id="intro-message">AGRIA–7 접근 중...</h2><p id="intro-sub">농업 기지의 물 공급량이 부족합니다.</p><div class="intro-progress"><i id="intro-meter"></i></div></div></section>

      <section class="overlay modal-overlay" id="pause-screen" hidden><div class="modal small-modal"><span class="eyebrow">TAKE A BREATH</span><h2>잠시 쉬어가요</h2><p>농장과 임무 시간이 멈춰 있습니다.</p><button class="primary-button" id="resume">계속 가꾸기 <span>↗</span></button><button class="text-button" id="pause-menu">메인 화면으로</button></div></section>

      <section class="overlay modal-overlay" id="result-screen" hidden><div class="modal result-modal"><span class="eyebrow" id="result-kicker">MISSION COMPLETE</span><div class="result-seal" id="result-seal">S</div><h2 id="result-title">다시, 초록빛으로.</h2><p id="result-description">아그리아–7 첫 번째 농장 복구 성공!</p><div class="result-stats" id="result-stats"></div><p class="learning-message">작물의 수분을 확인하고 필요한 만큼만 물을 주면,<br>작은 물탱크로도 더 많은 생명을 키울 수 있어요.</p><button class="primary-button" id="retry">다시 도전하기 <span>↻</span></button><button class="text-button" id="main-menu">메인 화면으로</button></div></section>
      <div class="portrait-hint">↻ 가로 화면에서 농장을 더 넓게 볼 수 있어요.</div>`;
    const click = (id: string, fn: () => void) => this.el(id).addEventListener('click', fn);
    click('start-screen', () => this.onContinue()); click('skip', () => this.onSkip());
    click('retry', () => this.onRetry()); click('main-menu', () => this.onMenu()); click('pause-menu', () => this.onMenu());
    click('pause', () => this.onPause()); click('resume', () => this.onPause());
    click('mute', () => this.onMute()); click('quality', () => this.onQuality());
    click('deliver', () => this.onDeliver()); click('apply-action', () => this.onApply());
    click('fullscreen', () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => this.toast('이 브라우저에서는 전체 화면을 지원하지 않아요.')); });
    this.root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => b.addEventListener('click', () => this.onAction(b.dataset.tool as Action)));
  }

  el(id: string) { return this.root.querySelector<HTMLElement>(`#${id}`)!; }
  private set(id: string, value: string) { if (this.lastValues.get(id) !== value) { this.el(id).textContent = value; this.lastValues.set(id, value); } }
  private meter(id: string, value: number) { const v = `${Math.round(value)}%`; if (this.lastValues.get(id) !== v) { this.el(id).style.width = v; this.lastValues.set(id, v); } }
  toast(message: string, duration = 3000) { this.el('toast').textContent = message; this.el('toast').classList.add('visible'); this.toastUntil = performance.now() + duration; }
  drought() { this.el('drought-alert').classList.add('visible'); window.setTimeout(() => this.el('drought-alert').classList.remove('visible'), 6500); }
  mute(muted: boolean) { this.el('mute').innerHTML = icon(muted ? 'mute' : 'sound'); this.el('mute').setAttribute('aria-pressed', String(muted)); this.el('mute').setAttribute('aria-label', muted ? '소리 켜기' : '음소거'); }

  update(state: GameState) {
    const playing = state.phase === 'playing';
    if (state.phase !== this.lastPhase) {
      this.root.dataset.phase = state.phase;
      this.el('start-screen').hidden = state.phase !== 'briefing'; this.el('intro-screen').hidden = state.phase !== 'intro';
      this.el('pause-screen').hidden = state.phase !== 'paused'; this.el('result-screen').hidden = !['won', 'lost'].includes(state.phase);
      if (state.phase === 'won' || state.phase === 'lost') this.result(state);
      if (!playing) { this.el('drought-alert').classList.remove('visible'); this.el('toast').classList.remove('visible'); }
      this.lastPhase = state.phase;
    }
    this.set('water', String(state.water)); this.meter('water-meter', state.water);
    this.set('money', String(state.money)); this.set('inventory', String(state.inventory.length));
    const seconds = Math.ceil(state.remaining);
    this.set('timer', `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
    this.el('timer').classList.toggle('urgent', seconds < 60);
    this.set('delivered', String(state.delivered)); this.set('dry-delivered', String(state.droughtDelivered));
    this.meter('delivery-meter', Math.min(100, state.delivered / CONFIG.deliveryGoal * 100));
    this.set('drought-check', state.droughtDelivered >= CONFIG.droughtGoal ? '◆' : '◇');
    this.set('weather', state.drought ? '가뭄 · 수분 관리 필요' : '맑음 · 생육에 적합');
    this.set('weather-sub', state.drought ? '토양의 수분 감소 ×2.25' : `건조 전선 ${Math.max(0, Math.ceil(CONFIG.droughtAt - state.time))}초 후 도착`);
    this.root.classList.toggle('dry', state.drought);
    this.set('cargo-label', state.inventory.length ? `${state.inventory.length}개 납품 가능 ↗` : '보관함 비어 있음');
    this.set('cargo-badge', String(state.inventory.length)); this.el('cargo-badge').hidden = !state.inventory.length;
    this.el('deliver').classList.toggle('has-cargo', !!state.inventory.length);
    if (state.action !== this.lastAction) {
      this.root.querySelectorAll<HTMLElement>('[data-tool]').forEach(b => { const active = b.dataset.tool === state.action; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
      const hints: Record<Action, string> = { leaf: '빈 밭을 눌러 달빛 상추를 심으세요', bean: '빈 밭을 눌러 물을 아끼는 별빛 콩을 심으세요', water: '작물이 자라는 밭을 눌러 물을 주세요', harvest: '반짝이는 작물을 눌러 수확하세요' };
      this.set('tool-hint', hints[state.action]); this.lastAction = state.action;
    }
    if (state.selected !== this.lastSelected) { this.el('plot-info').hidden = state.selected < 0; this.lastSelected = state.selected; }
    if (state.selected >= 0) {
      const crop = state.plots[state.selected].crop;
      this.set('plot-number', `PLOT 0${state.selected + 1}`);
      this.set('crop-name', crop ? CONFIG.crops[crop.kind].name : '빈 밭');
      this.el('crop-details').hidden = !crop;
      this.set('crop-status', !crop ? '파종 가능' : crop.dead ? '고사 · 정리 필요' : crop.moisture < 15 ? '물 부족' : crop.growth >= 1 ? '수확 가능' : crop.growth < 0.13 ? '씨앗' : crop.growth < 0.4 ? '새싹' : '자라는 중');
      this.el('crop-status').classList.toggle('warning', !!crop && (crop.moisture < 15 || crop.dead));
      if (crop) {
        this.meter('growth-meter', crop.growth * 100); this.meter('moisture-meter', crop.moisture);
        this.set('growth-value', `${Math.floor(crop.growth * 100)}%`); this.set('moisture-value', `${Math.floor(crop.moisture)}%`);
      }
      this.set('apply-action', crop?.dead ? '마른 작물 정리하기 ↗' : crop?.growth === 1 ? '이 밭 수확하기 ↗' : crop ? '이 밭에 물주기 −10 ↗' : `${CONFIG.crops[state.action === 'bean' ? 'bean' : 'leaf'].name} 심기 ↗`);
    }
    if (this.toastUntil && performance.now() > this.toastUntil) { this.el('toast').classList.remove('visible'); this.toastUntil = 0; }
  }

  intro(time: number) {
    this.set('intro-step', time < 4.2 ? '01 / APPROACHING AGRIA–7' : '02 / LANDING SEQUENCE');
    this.set('intro-message', time < 4.2 ? 'AGRIA–7 접근 중...' : time < 7 ? '농업 기지에 착륙합니다.' : '다시 초록을 키울 시간입니다.');
    this.set('intro-sub', time < 4.2 ? '농업 기지의 물 공급량이 부족합니다.' : '첫 번째 농장 복구 임무를 시작하세요.');
    this.meter('intro-meter', time / CONFIG.introDuration * 100);
  }

  briefing(time: number) {
    this.set('briefing-countdown', `${Math.max(0, Math.ceil(CONFIG.briefingDuration - time))}초 후 농장으로 이동합니다`);
    this.meter('briefing-meter', Math.min(100, time / CONFIG.briefingDuration * 100));
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
