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
    return { chapter: g.chapter && {stage:g.chapter.stage,weeds:g.chapter.weeds,rocks:g.chapter.rocks,soils:g.chapter.soils,carrying:g.chapter.carrying,dialogue:g.chapter.dialogue,busy:g.chapter.busy}, x: g.player.x, z: g.player.z, phase: g.state.phase, time: g.state.time, tutorial: g.state.tutorial, water: g.state.water, can: g.state.canWater, money: g.state.money, inventory: g.state.inventory, delivered: g.state.delivered, dry: g.state.droughtDelivered, crops: g.state.plots.map(p => p.crop), target: g.target, action: g.contextAction() };
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
  return { context, page, pump, read, stick, walk, click, act, advance, cdp, cancelTouch };
}

async function play(width, height, touch) {
  const { context, page, pump, read, walk, click, act, stick, cdp } = await session(width, height, touch);
  const shots = async name => page.screenshot({ path: `test-results/chapter-${width}-${name}.png` });
  async function dialogue() {
    for (let i = 0; i < 12 && (await read()).chapter.dialogue.length; i++) {
      if (touch) await click('#chapter-dialogue'); else { await page.keyboard.press(i % 2 ? 'Space' : 'Enter'); await pump(150); }
    }
    assert.equal((await read()).chapter.dialogue.length, 0);
  }
  async function reload() { await page.reload({ waitUntil: 'networkidle' }); await pump(300); }
  const visuals = () => page.evaluate(() => {
    const s = ecoGame.world.chapterScenery;
    return { weeds: s.weeds.map(g => g.visible), rocks: s.rocks.map(g => g.visible), carried: s.carried.visible, rough: s.rough.map(g => g.visible), deposited: s.deposited.map(g => g.visible) };
  });
  try {
    assert.equal((await read()).chapter.stage, 'INTRO');
    assert.equal(await page.evaluate(() => ecoGame.world.camera.isOrthographicCamera), true);
    const angle = await page.evaluate(() => ecoGame.world.camera.quaternion.toArray());
    await pump(1000); const high = await page.evaluate(() => ecoGame.world.ship.position.y);
    await shots('landing');
    await pump(3600);
    assert.ok(await page.evaluate(() => ecoGame.world.ship.position.y) < high);
    assert.ok(await page.evaluate(() => ecoGame.world.chapterScenery.door.rotation.y) < -1);
    assert.equal(await page.evaluate(() => ecoGame.world.astronaut.visible), true);
    assert.deepEqual(await page.evaluate(() => ecoGame.world.camera.quaternion.toArray()), angle);
    await shots('emerging');
    await pump(2100); assert.equal((await read()).chapter.stage, 'EXPLORE');
    await shots('arrival'); await dialogue();
    if(touch) assert.equal(await page.locator('#interact').isDisabled(),true); else await act();
    assert.equal((await read()).chapter.stage, 'EXPLORE');
    if (!touch) { await page.keyboard.press('Digit1'); await pump(100); }
    assert.equal((await read()).money, 300); assert.equal((await read()).time, 0);
    await walk(-0.25, -3.25); await act(); assert.equal((await read()).chapter.stage, 'INSPECT_FARM');
    await dialogue(); assert.equal((await read()).chapter.stage, 'CLEAR_WEEDS');
    await reload(); assert.equal((await read()).chapter.stage, 'CLEAR_WEEDS');
    for (const [i, [x, z]] of [[-5.9,-3.1],[-3.5,-3.1],[-1.1,-3.1],[1,-3.1],[4.4,-3.1]].entries()) {
      await walk(x, z); await act(); assert.equal((await read()).chapter.weeds.filter(Boolean).length, i+1);
      assert.equal((await visuals()).weeds[i], false);
    }
    await shots('weeds-cleared'); assert.equal((await read()).chapter.stage, 'REMOVE_ROCKS'); await dialogue();
    for (const [i, [x,z]] of [[-5.7,1.4],[-0.3,1.4],[4.2,1.4]].entries()) {
      await walk(x,z); await act(); assert.equal((await read()).chapter.carrying,i);
      assert.equal((await read()).chapter.rocks.filter(Boolean).length,i);
      assert.equal((await visuals()).carried,true);
      if(i===0) {
        await shots('carrying'); await reload();
        assert.equal((await read()).chapter.carrying,0); assert.equal((await visuals()).carried,true);
        if(touch) assert.equal(await page.locator('#interact').isDisabled(),true); else await act();
        assert.equal((await read()).chapter.rocks[0],false);
      }
      await walk(7.25,4.65); await act(); assert.equal((await read()).chapter.rocks.filter(Boolean).length,i+1);
      assert.equal((await visuals()).deposited[i],true);
    }
    assert.equal((await read()).chapter.stage,'TILL_SOIL'); await dialogue();
    await shots('rocks-deposited');
    for (const [i,x] of [-4.8,-0.3,4.2].entries()) {
      await walk(x,1.4); await act(); assert.equal((await read()).chapter.soils[i],true);
      assert.equal((await visuals()).rough[i],false);
    }
    assert.equal((await read()).chapter.stage,'CHAPTER_COMPLETE');
    assert.equal((await read()).time,0); assert.equal((await read()).water,100);
    await shots('clear'); await dialogue();
    assert.equal(await page.locator('#chapter-clear').isVisible(),true);
    assert.equal(await page.locator('#restoration').textContent(),'12%');
    await click('#view-toggle'); await pump(1200); await shots('restored-farm');
    await reload(); assert.equal((await read()).chapter.stage,'CHAPTER_COMPLETE');
    assert.deepEqual((await visuals()).rough.slice(0,3),[false,false,false]);
    await click('#pause'); await click('#reset-chapter'); await click('#cancel-chapter-reset');
    assert.equal((await read()).chapter.stage,'CHAPTER_COMPLETE');
    await click('#reset-chapter'); await click('#confirm-chapter-reset');
    assert.equal((await read()).chapter.stage,'INTRO');
    assert.deepEqual((await read()).chapter.weeds,[false,false,false,false,false]);
    await click('#skip'); await dialogue();
    if (touch) {
      // The original joystick accepts a thumb while a second finger activates the action.
      await walk(-0.25,-3.25);
      const j=await page.locator('#joystick').boundingBox(),a=await page.locator('#interact').boundingBox();
      const thumb={id:1,x:j.x+j.width/2,y:j.y+j.height/2}, second={id:2,x:a.x+a.width/2,y:a.y+a.height/2};
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[thumb]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[thumb,second]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[thumb]});
      await pump(700); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.equal((await read()).chapter.stage,'INSPECT_FARM'); await dialogue();
    }
    await stick(.8,.6); await pump(250); await click('#pause'); const pos=await read(); await pump(1200);
    assert.equal((await read()).x,pos.x); await stick(0,0); await click('#resume');
    await click('#pause'); await click('#legacy-practice'); await click('#learn'); assert.equal((await read()).chapter,null);
    assert.equal((await read()).tutorial,'plant');
    await walk(-4.75,1.25); await act(touch?'KeyE':'Digit1'); assert.equal((await read()).tutorial,'water');
    await click('#pause'); await click('#resume-chapter'); assert.ok((await read()).chapter);
    const render = await page.evaluate(()=>ecoGame.world.stats);
    report.push({width,height,touch,result:'passed',render,checks:['fixed-camera landing and door','original astronaut emergence','inspection','5 weeds visibly removed','3 rocks carried and deposited','carrying reload','3 changed soil textures','clear and preview','save reload and reset','pause and movement','legacy crop regression',...(touch?['touch-only play and simultaneous touches']:[])]});
  } catch(e) { await shots('failure'); throw e; } finally { await context.close(); }
}

try {
  await play(1280,800,false);
  await play(1024,768,true);
  for (const [width,height] of [[768,1024],[844,390],[390,844]]) {
    const {context,page,pump,click,read,walk,act}=await session(width,height,true);
    await click('#skip');
    while((await read()).chapter.dialogue.length) await click('#chapter-dialogue');
    await walk(-0.25,-3.25);await act();
    for(const selector of ['#chapter-mission','.utility-bar','#chapter-dialogue']) {
      const r=await page.locator(selector).boundingBox();
      assert.ok(r&&r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1,`${selector} outside ${width}x${height}`);
    }
    while((await read()).chapter.dialogue.length) await click('#chapter-dialogue');
    for(const selector of ['#joystick','#interact']) {
      const r=await page.locator(selector).boundingBox(); assert.ok(r&&r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1);
    }
    await pump(500);await page.screenshot({path:`test-results/chapter-${width}-layout.png`});
    report.push({width,height,result:'touch inspection, movement and layout passed'});await context.close();
  }
  assert.deepEqual(errors,[]);assert.equal(external.size,0);
  await writeFile('test-results/chapter-report.json',JSON.stringify({report,errors,external:[...external]},null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); }

