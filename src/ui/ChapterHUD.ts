import { CHAPTER_LABELS, ChapterOne, type ChapterTarget } from '../game/ChapterOne';
import type { GameHUD } from './GameHUD';
import { ARRIVAL, arrivalPhase } from '../game/Arrival';

export class ChapterHUD {
  onDialogue = () => {};
  onReset = () => {};
  onLegacy = () => {};
  onResumeChapter = () => {};
  constructor(private hud: GameHUD) {
    hud.root.insertAdjacentHTML('beforeend', `
      <aside id="chapter-mission" class="chapter-mission" aria-label="현재 챕터 미션" hidden>
        <small>CHAPTER 01 <span>초록 행성 복구율 <b id="restoration">0%</b></span></small>
        <h1 id="chapter-title">초록 행성 탐색</h1><p id="chapter-objective"></p>
        <div class="chapter-progress"><i id="chapter-meter"></i></div>
        <div class="chapter-count"><span id="chapter-caption">육지 길을 따라 이동하세요</span><b id="chapter-count"></b></div>
        <p id="chapter-lesson"></p><small id="chapter-save-status"></small>
      </aside>
      <button id="chapter-dialogue" class="chapter-dialogue" aria-label="우주선 AI 대화 다음으로" hidden><small>✦ 우주선 AI <span id="chapter-dialogue-count"></span></small><span id="chapter-dialogue-text" aria-live="polite"></span><em>터치 / 클릭 · Enter / Space 다음 ▸</em></button>
      <div id="chapter-clear" class="chapter-clear" role="status" hidden><small>CHAPTER 01 CLEAR</small><b>농경지 복구 완료!</b><span>CHAPTER 02 — 메마른 농장 · 다음 이야기</span></div>
      <div id="chapter-waypoint" class="plot-guide" hidden><span id="chapter-waypoint-text"></span><b>▼</b></div><div id="arrival-fade" class="arrival-fade" hidden></div>`);
    hud.el('pause-screen').querySelector('.small-modal')!.insertAdjacentHTML('beforeend', `
      <div class="chapter-menu" hidden><p>WASD / 방향키 · 왼쪽 조이스틱 이동<br>E / 오른쪽 행동 버튼으로 가까운 대상 작업<br>대화는 터치 · Enter · Space로 진행</p><button id="reset-chapter" class="text-button">챕터 1 초기화</button><div id="chapter-reset-confirm" hidden><p>제거한 잡초·운반한 돌·일군 밭이 초기화됩니다.</p><button id="confirm-chapter-reset" class="primary-button">초기화하고 처음부터 시작</button><button id="cancel-chapter-reset" class="text-button">취소</button></div><button id="legacy-practice" class="text-button">기존 재배 연습 모드</button></div>
      <button id="resume-chapter" class="text-button" hidden>CHAPTER 01 계속하기</button>`);
    const click = (id: string, action: () => void) => hud.bindButton(hud.el(id) as HTMLButtonElement, action);
    click('chapter-dialogue', () => this.onDialogue());
    click('reset-chapter', () => { hud.el('chapter-reset-confirm').hidden = false; });
    click('cancel-chapter-reset', () => { hud.el('chapter-reset-confirm').hidden = true; });
    click('confirm-chapter-reset', () => { hud.el('chapter-reset-confirm').hidden = true; this.onReset(); });
    click('legacy-practice', () => this.onLegacy());
    click('resume-chapter', () => this.onResumeChapter());
  }
  update(c: ChapterOne | null, target: ChapterTarget | null, paused: boolean, introTime: number) {
    const h = this.hud;
    h.root.dataset.chapter = c ? c.stage : '';
    h.el('chapter-mission').hidden = !c || c.stage === 'INTRO';
    h.el('chapter-dialogue').hidden = !c?.dialogue.length || paused;
    h.root.dataset.dialogue = String(!!c?.dialogue.length);
    h.el('chapter-clear').hidden = !c?.complete || paused;
    h.el('arrival-fade').hidden = c?.stage !== 'INTRO';
    (h.el('pause-screen').querySelector('.chapter-menu') as HTMLElement).hidden = !c;
    h.el('resume-chapter').hidden = !!c;
    if (!c) { h.el('chapter-waypoint').hidden = true; return; }
    const text = (id: string, value: string) => { if (h.el(id).textContent !== value) h.el(id).textContent = value; };
    text('chapter-title', c.discovered ? '버려진 농장 복구' : '초록 행성 탐색');
    text('chapter-caption', c.discovered ? '첫 번째 농경지를 복구하라!' : '물가를 뒤로하고 육지 길을 따라 이동');
    text('chapter-objective', c.objective); text('chapter-count', c.progress);
    text('chapter-lesson', c.lesson); text('restoration', `${c.restoration}%`);
    text('chapter-save-status', c.storageFailed ? '이 브라우저에서는 저장이 제한돼요. 현재 플레이는 계속할 수 있어요.' : '진행 자동 저장');
    const all = c.weeds.filter(Boolean).length + c.rocks.filter(Boolean).length + c.soils.filter(Boolean).length;
    h.el('chapter-meter').style.width = `${all / 11 * 100}%`;
    if (c.dialogue.length) { text('chapter-dialogue-text', c.dialogue[0]); text('chapter-dialogue-count', `남은 안내 ${c.dialogue.length}`); }
    const action = target ? CHAPTER_LABELS[target.kind] : c.carrying !== null ? '수거 장소로 이동' : c.complete ? '복구 완료' : '가까이 이동';
    const short = target ? { inspect: '조사하기', weed: '잡초 제거', rock: '돌 들기', deposit: '돌 내려놓기', soil: '괭이질' }[target.kind] : action;
    (h.el('interact') as HTMLButtonElement).disabled = !target || c.busy || !!c.dialogue.length || paused;
    h.root.classList.toggle('has-target', !!target);
    text('interact-name', c.busy ? '작업 중…' : short);
    text('interact-detail', c.carrying !== null ? '돌 운반 중' : '가까운 대상과 상호작용');
    text('interaction-prompt', c.carrying !== null ? '돌을 들고 빛나는 수거 장소로 이동하세요' : target ? `${h.root.dataset.touch === 'true' ? '' : '[E] '}${action}` : c.objective);
    h.el('player-label').hidden = !target || !!c.dialogue.length || c.stage === 'INTRO';
    text('player-label', c.busy ? '작업 중…' : `${h.root.dataset.touch === 'true' ? '' : '[E] '}${action}`);
    if (c.stage === 'INTRO') {
      const phase = arrivalPhase(introTime);
      h.root.dataset.arrival = phase;
      text('intro-step', { SPACE_FLIGHT: '01 / SPACE FLIGHT', PLANET_APPROACH: '02 / GREEN PLANET', LANDING: '03 / LANDING', DOOR_OPEN: '04 / HATCH OPEN', DISEMBARK: '05 / FIRST STEPS' }[phase]);
      text('intro-message', { SPACE_FLIGHT: '초록 행성을 향하여', PLANET_APPROACH: '흙과 물, 생명이 있는 행성', LANDING: '물가 옆 육지에 착륙합니다.', DOOR_OPEN: '착륙 완료. 출입문을 엽니다.', DISEMBARK: '이제 직접 걸어서 탐색해 볼까요?' }[phase]);
      text('intro-sub', phase === 'SPACE_FLIGHT' ? 'ECO FARM — 초록 행성' : phase === 'PLANET_APPROACH' ? '갈색 흙 · 파란 물 · 초록 식물' : 'WASD / 방향키 · 왼쪽 조이스틱으로 이동');
      h.el('intro-meter').style.width = `${Math.min(100, introTime / ARRIVAL.duration * 100)}%`;
      h.el('arrival-fade').style.opacity = String(Math.max(0, 1 - Math.abs(introTime - ARRIVAL.surfaceAt) / 0.42));
    }
    text('pause-menu', '챕터 계속하기');
  }
  waypoint(position: { x: number; y: number } | null, label: string) {
    const h = this.hud, el = h.el('chapter-waypoint');
    el.hidden = !position; if (!position) return;
    const x = Math.max(95, Math.min(window.innerWidth - 95, position.x));
    const y = Math.max(160, Math.min(window.innerHeight - 180, position.y - 25));
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    h.el('chapter-waypoint-text').textContent = label;
    const off = Math.abs(x - position.x) > 5 || Math.abs(y - position.y + 25) > 5;
    el.classList.toggle('offscreen', off);
    el.querySelector('b')!.style.transform = off ? `rotate(${Math.atan2(position.y - y, position.x - x) - Math.PI / 2}rad)` : '';
  }
}
