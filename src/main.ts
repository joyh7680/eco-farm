import './styles/main.css';
import { Game } from './game/Game';

const container = document.querySelector<HTMLElement>('#game')!;
try {
  const game = new Game(container);
  // Opt-in local diagnostics; no test controls or globals are exposed in the normal game.
  if (import.meta.url.includes('localhost') && new URLSearchParams(location.search).has('test')) {
    Object.assign(window, { ecoGame: game });
  }
} catch (error) {
  console.error(error);
  container.innerHTML = '<div style="height:100%;display:grid;place-content:center;color:#eee7ce;text-align:center;font-family:sans-serif;padding:24px"><h1>ECO FARM</h1><p>3D 농장을 시작할 수 없습니다.</p><p>WebGL을 지원하는 브라우저에서 하드웨어 가속을 활성화한 뒤 다시 열어주세요.</p><button onclick="location.reload()" style="padding:14px">다시 실행</button></div>';
}
