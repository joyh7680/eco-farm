import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.GAME_URL ?? 'http://localhost:5174';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true });
await mkdir('test-results', { recursive: true });
const report = [], errors = [], external = new Set();

async function session(width, height, touch) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!['localhost', '127.0.0.1'].includes(new URL(r.url()).hostname)) external.add(r.url()); });
  // Run real requestAnimationFrame, physics, animation and crop updates on a controlled clock.
  await page.clock.install({ time: new Date('2026-11-09T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-09T00:00:01Z'));
  await page.goto(`${url}/?test`, { waitUntil: 'networkidle' });
  const pump = ms => page.clock.runFor(ms);
  const read = () => page.evaluate(() => {
    const g = window.ecoGame;
    return { x: g.player.x, z: g.player.z, phase: g.state.phase, time: g.state.time, tutorial: g.state.tutorial, water: g.state.water, can: g.state.canWater, money: g.state.money, inventory: g.state.inventory, delivered: g.state.delivered, dry: g.state.droughtDelivered, crops: g.state.plots.map(p => p.crop), target: g.target, action: g.contextAction() };
  });
  const cdp = await context.newCDPSession(page);
  let held = [], finger = null;
  async function stick(sx, sy) {
    if (!touch) {
      const next = [];
      const angle = Math.atan2(sy, sx), octant = Math.round(angle / (Math.PI / 4));
      const dirs = [['KeyD'], ['KeyD', 'KeyS'], ['KeyS'], ['KeyS', 'KeyA'], ['KeyA'], ['KeyA', 'KeyW'], ['KeyW'], ['KeyW', 'KeyD']];
      if (Math.hypot(sx, sy) > 0.01) next.push(...dirs[(octant + 8) % 8]);
      for (const key of held) if (!next.includes(key)) await page.keyboard.up(key);
      for (const key of next) if (!held.includes(key)) await page.keyboard.down(key);
      held = next; return;
    }
    if (!sx && !sy) {
      if (finger) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      finger = null; return;
    }
    const rect = await page.locator('#joystick').boundingBox();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2, radius = rect.width * 0.3;
    if (!finger) {
      finger = { x, y, id: 1 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] });
    }
    finger = { x: x + sx * radius, y: y + sy * radius, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [finger] });
  }
  async function walk(x, z) {
    const path = await page.evaluate(({ x, z }) => {
      const p = window.ecoGame.player, grid = 0.25;
      const start = [Math.round(p.x / grid), Math.round(p.z / grid)], end = [Math.round(x / grid), Math.round(z / grid)];
      const key = v => v.join(','), queue = [start], previous = new Map([[key(start), null]]);
      for (let i = 0; i < queue.length && !previous.has(key(end)); i++) {
        const v = queue[i];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const next = [v[0] + dx, v[1] + dz];
          if (!previous.has(key(next)) && p.canStand(next[0] * grid, next[1] * grid)) { previous.set(key(next), v); queue.push(next); }
        }
      }
      if (!previous.has(key(end))) throw Error(`No walkable route to ${x},${z}`);
      const route = []; let v = end;
      while (v) { route.unshift(v); v = previous.get(key(v)); }
      return route.filter((v, i) => i === 0 || i === route.length - 1 || (v[0] - route[i - 1][0]) !== (route[i + 1][0] - v[0]) || (v[1] - route[i - 1][1]) !== (route[i + 1][1] - v[1])).map(v => [v[0] * grid, v[1] * grid]);
    }, { x, z });
    for (const [wx, wz] of path) {
      let arrived = false;
      for (let i = 0; i < 450; i++) {
        const p = await read(), distance = Math.hypot(wx - p.x, wz - p.z);
        if (distance < 0.075) { arrived = true; break; }
        // A short look-ahead keeps discrete keyboard directions centered in narrow paths.
        const dx = Math.max(-0.16, Math.min(0.16, wx - p.x)), dz = Math.max(-0.16, Math.min(0.16, wz - p.z));
        const aim = Math.hypot(dx, dz);
        assert.equal(p.phase, 'playing', 'Movement unexpectedly left play');
        await stick((dx * 0.8 - dz * 0.6) / aim, (dx * 0.6 + dz * 0.8) / aim);
        await pump(16);
      }
      if (!arrived) throw Error(`Stuck en route to ${wx},${wz}: ${JSON.stringify(await read())}`);
    }
    await stick(0, 0); await pump(150);
  }
  async function click(selector) {
    if (touch && finger) {
      const rect = await page.locator(selector).boundingBox();
      const second = { id: 2, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger, second] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [finger] });
    } else if (touch) await page.locator(selector).tap();
    else await page.locator(selector).click();
    await pump(150);
  }
  async function cancelTouch() {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); finger = null;
  }
  async function act(code = 'KeyE') {
    if (touch) await click('#interact'); else { await page.keyboard.press(code); await pump(150); }
    await pump(500);
  }
  async function advance(seconds) {
    // Speed up only crop/mission time; all locomotion still enters through real inputs.
    await page.evaluate(seconds => { for (let t = 0; t < seconds; t += 0.05) window.ecoGame.state.update(0.05); }, seconds);
    await pump(150);
  }
  await click('#skip');
  return { context, page, pump, read, stick, walk, click, act, advance, cdp, cancelTouch };
}

async function play(width, height, touch) {
  const s = await session(width, height, touch), { context, page, pump, read, stick, walk, click, act, advance, cdp } = s;
  try {
    await click('#learn');
    // Remote world clicks and action hotkeys cannot farm without walking.
    const plot = await page.evaluate(() => window.ecoGame.world.projectPlot(0));
    if (touch) await page.touchscreen.tap(plot.x, plot.y); else await page.mouse.click(plot.x, plot.y);
    if (!touch) await page.keyboard.press('Digit1');
    await pump(200); assert.equal((await read()).money, 300);
    await walk(-4.75, 1.25); assert.equal((await read()).target.id, 0);
    if (touch) {
      // Keep the movement thumb down while a second finger presses the action.
      const j = await page.locator('#joystick').boundingBox(), a = await page.locator('#interact').boundingBox();
      const thumb = { id: 1, x: j.x + j.width / 2, y: j.y + j.height / 2 };
      const actionFinger = { id: 2, x: a.x + a.width / 2, y: a.y + a.height / 2 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [thumb] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [thumb, actionFinger] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [thumb] });
      await pump(200);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await pump(500);
    } else await act('Digit1');
    assert.equal((await read()).tutorial, 'water');
    await act('Digit2'); assert.equal((await read()).tutorial, 'grow');
    assert.equal((await read()).water, 90); assert.equal((await read()).can, 10);
    // Refill by visiting the actual tank during practice; total water stays finite.
    await walk(-7.75, -0.25); assert.equal((await read()).target.kind, 'tank');
    await act(); assert.equal((await read()).can, 30); assert.equal((await read()).water, 90);
    await walk(-4.75, 1.25); await pump(6500);
    assert.equal((await read()).tutorial, 'harvest');
    await page.screenshot({ path: `test-results/character-${width}-harvest.png` });
    await act('Digit3'); assert.equal((await read()).tutorial, 'deliver');
    await page.evaluate(() => window.ecoGame.deliver()); assert.equal((await read()).delivered, 0);
    await walk(9.5, 3.5); assert.equal((await read()).target.kind, 'supply');
    await act(); assert.equal((await read()).tutorial, 'complete'); assert.equal((await read()).money, 315);
    assert.equal((await read()).time, 0);
    await click('#start-mission');
    assert.equal((await read()).money, 300); assert.equal((await read()).water, 100); assert.equal((await read()).can, 20);
    const resetPosition = await read(); assert.equal(resetPosition.x, 0); assert.equal(resetPosition.z, 7.4);

    // Pause with active movement, then resume without a stuck key or joystick.
    await stick(0.8, 0.6); await pump(250);
    await click('#pause'); const paused = await read(); await pump(1500);
    assert.equal((await read()).x, paused.x); assert.equal((await read()).time, paused.time);
    await stick(0, 0); await click('#resume'); const resumed = await read(); await pump(500);
    assert.equal((await read()).x, resumed.x);
    if (touch) {
      await stick(0.8, 0.6); await pump(100);
      await s.cancelTouch();
      const p = await read(); await pump(300); assert.equal((await read()).x, p.x);
      await stick(0, 0);
    } else {
      await page.keyboard.down('ArrowRight'); await pump(150); await page.keyboard.up('ArrowRight');
      await page.keyboard.down('KeyD'); await pump(100); await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      const p = await read(); await pump(300); assert.equal((await read()).x, p.x); await page.keyboard.up('KeyD');
    }

    // Complete the unchanged mission using two crop kinds and real walking routes.
    await walk(-4.75, 1.5); await act('Digit1');
    await walk(-0.25, 5.9); await click('[data-tool="bean"]'); await act('Digit1');
    await advance(46);
    await walk(-4.75, 1.5); await act('Digit3');
    await walk(-0.25, 5.9); await act('Digit3');
    assert.deepEqual((await read()).inventory.map(p => p.kind).sort(), ['bean', 'leaf']);
    await walk(9.5, 3.5); await act(); assert.equal((await read()).delivered, 2);
    await advance(Math.max(0, 70.1 - (await read()).time));
    await walk(-4.75, 1.5); await act('Digit1');
    await walk(-0.25, 5.9); await act('Digit1');
    await advance(46);
    await walk(-4.75, 1.5); await act('Digit3');
    await walk(-0.25, 5.9); await act('Digit3');
    await walk(9.5, 3.5); await act();
    const result = await read(); assert.equal(result.phase, 'won'); assert.equal(result.delivered, 4); assert.equal(result.dry, 2);
    await page.screenshot({ path: `test-results/character-${width}-won.png` });
    report.push({ width, height, touch, tutorial: 'complete', mission: result.phase, delivered: result.delivered, droughtDelivered: result.dry, stats: await page.evaluate(() => window.ecoGame.world.stats) });
    console.log(`PASS ${width}x${height}: ${touch ? 'touch only' : 'keyboard'} tutorial, tank, pause/cancel, two crops, drought mission`);
  } catch (error) {
    await page.screenshot({ path: `test-results/character-${width}-failure.png` });
    throw error;
  } finally { await context.close(); }
}

async function layout(width, height) {
  const s = await session(width, height, true);
  try {
    await s.click('#learn');
    for (const selector of ['#joystick', '#interact', '.quick-actions', '.action-bar', '#tutorial-window', '.utility-bar']) {
      const rect = await s.page.locator(selector).boundingBox();
      assert.ok(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width + 1 && rect.y + rect.height <= height + 1, `${selector} outside ${width}x${height}`);
    }
    await s.stick(0.8, 0.6); await s.pump(400); await s.stick(0, 0);
    assert.ok((await s.read()).x > 1, 'Touch joystick must move on this layout');
    const position = await s.read(); await s.pump(500); assert.equal((await s.read()).x, position.x);
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollHeight > innerHeight), false);
    await s.page.screenshot({ path: `test-results/character-layout-${width}.png` });
    report.push({ width, height, touch: true, layout: 'passed', joystick: 'passed' });
  } finally { await s.context.close(); }
}

try {
  await play(1280, 800, false);
  await play(1024, 768, true);
  await layout(768, 1024);
  await layout(844, 390);
  assert.deepEqual(errors, []); assert.equal(external.size, 0);
  await writeFile('test-results/character-report.json', JSON.stringify({ report, errors, external: [...external] }, null, 2));
  console.log('PASS no runtime errors or external asset requests');
} finally { await browser.close(); }

