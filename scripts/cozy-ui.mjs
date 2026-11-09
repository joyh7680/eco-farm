import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true });
const url = process.env.GAME_URL ?? 'http://localhost:5174';
const report = [], errors = [];
await mkdir('test-results', { recursive: true });
try {
  for (const [width, height, touch] of [[1280, 800, false], [1024, 768, true], [768, 1024, true], [844, 390, true], [390, 844, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.install({ time: new Date('2026-11-09T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-09T00:00:01Z'));
    await page.goto(`${url}/?test`, { waitUntil: 'networkidle' });
    const click = async selector => { if (touch) await page.locator(selector).tap(); else await page.locator(selector).click(); await page.clock.runFor(150); };
    await click('#skip'); await click('#skip-tutorial'); await page.clock.runFor(2000);
    const before = await page.evaluate(() => ({ x: ecoGame.world.camera.position.x, top: ecoGame.world.camera.top }));
    await page.keyboard.down('KeyD'); await page.clock.runFor(350); await page.keyboard.up('KeyD'); await page.clock.runFor(500);
    const following = await page.evaluate(() => ({ x: ecoGame.player.x, cameraX: ecoGame.world.camera.position.x }));
    assert.ok(following.x > 1 && following.cameraX > before.x + 0.5, 'Camera must follow real movement');
    await click('#view-toggle'); await page.clock.runFor(1500);
    assert.equal(await page.locator('#view-toggle').getAttribute('aria-pressed'), 'true');
    assert.ok(await page.evaluate(() => ecoGame.world.camera.top) > before.top + 3);
    await click('#view-toggle'); await page.clock.runFor(1500);
    assert.equal(await page.locator('#view-toggle').getAttribute('aria-pressed'), 'false');
    assert.ok(Math.abs(await page.evaluate(() => ecoGame.world.camera.top) - before.top) < 0.1);
    assert.equal(await page.locator('#world').evaluate(el => getComputedStyle(el).imageRendering), 'auto');
    const render = await page.evaluate(() => {
      const canvas = ecoGame.world.renderer.domElement;
      return { width: canvas.width, height: canvas.height, stats: ecoGame.world.stats };
    });
    assert.ok(render.width * render.height <= 1_053_000, 'Default resolution has a bounded pixel budget');
    assert.ok(render.height > 540, 'Default game must not be a pixel-expanded 360p canvas');
    if (!touch) {
      await page.evaluate(() => { for (let i = 0; i < 180; i++) ecoGame.world.adaptResolution(0.05, true); });
      assert.ok(await page.evaluate(() => ecoGame.world.renderer.domElement.height) < render.height, 'Sustained slow frames reduce pixel cost');
      await page.keyboard.press('KeyQ'); await page.keyboard.press('KeyQ'); await page.clock.runFor(100);
      assert.equal(await page.evaluate(() => ecoGame.world.renderer.domElement.height), render.height);
    }
    for (const selector of ['.top-hud', '.mission-widget', '.action-bar', '#interact', '.quick-actions', '.utility-bar', ...(touch ? ['#joystick'] : [])]) {
      const r = await page.locator(selector).boundingBox();
      assert.ok(r && r.x >= 0 && r.y >= 0 && r.x + r.width <= width + 1 && r.y + r.height <= height + 1, `${selector} outside ${width}x${height}`);
    }
    await click('.mission-widget > summary'); assert.equal(await page.locator('.mission-body').isVisible(), true);
    await click('.mission-widget > summary');
    await click('.cargo-resource > summary'); assert.equal(await page.locator('#inventory-leaf').isVisible(), true);
    await click('.cargo-resource > summary');
    await page.screenshot({ path: `test-results/cozy-play-${width}.png` });
    await click('#pause'); await click('#pause-help'); assert.equal(await page.locator('#help-screen').isVisible(), true);
    await click('#close-help'); assert.equal(await page.locator('#pause-screen').isVisible(), true);
    await click('#quality'); await click('#mute');
    assert.equal(await page.locator('#mute').getAttribute('aria-pressed'), 'true');
    await click('#resume');
    // Returning to practice also resets camera, expanded pockets, and movement.
    await click('#pause'); await click('#pause-help'); await click('#replay-tutorial'); await click('#confirm-replay');
    await page.clock.runFor(1500);
    assert.equal(await page.locator('#view-toggle').getAttribute('aria-pressed'), 'false');
    await page.screenshot({ path: `test-results/cozy-tutorial-${width}.png` });
    const guide = await page.locator('#tutorial-window').boundingBox();
    assert.ok(guide && guide.y >= 0 && guide.y + guide.height <= height, 'Tutorial stays inside viewport');
    report.push({ width, height, touch, camera: 'follow/overview passed', pockets: 'passed', menu: 'passed', render });
    await context.close();
    console.log(`PASS cozy UI ${width}x${height}`);
  }
  // Real wall-clock sample, independent of deterministic gameplay clock tests.
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(`${url}/?test`, { waitUntil: 'networkidle' });
  await page.locator('#skip').tap(); await page.locator('#skip-tutorial').tap();
  await page.evaluate(() => { for (let i = 0; i < 6; i++) ecoGame.state.act(i, i % 2 ? 'bean' : 'leaf'); for (const plot of ecoGame.state.plots) plot.crop.growth = 1; });
  const performanceSample = await page.evaluate(() => new Promise(resolve => {
    const times = []; let previous = performance.now();
    function frame(now) {
      times.push(now - previous); previous = now;
      if (times.length < 151) requestAnimationFrame(frame);
      else { times.shift(); resolve({ fps: Math.round(1000 / (times.reduce((a, b) => a + b, 0) / times.length)), stats: ecoGame.world.stats, note: 'Desktop Chrome touch emulation; not physical tablet performance.' }); }
    }
    requestAnimationFrame(frame);
  }));
  await page.screenshot({ path: 'test-results/cozy-six-crops.png' });
  assert.deepEqual(errors, []);
  await writeFile('test-results/cozy-report.json', JSON.stringify({ report, performanceSample, errors }, null, 2));
  console.log(performanceSample);
} finally { await browser.close(); }
