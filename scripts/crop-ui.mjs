import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const read = fn => page.evaluate(fn);
async function advance(seconds) {
  await page.evaluate(seconds => { for (let t = 0; t < seconds; t += 0.05) window.ecoGame.state.update(0.05); }, seconds);
  await page.waitForTimeout(150);
}
async function plot(id) {
  const p = await page.evaluate(i => window.ecoGame.world.projectPlot(i), id);
  await page.mouse.click(p.x, p.y);
}
const tool = name => page.locator(`[data-tool="${name}"]`).click();
const shot = name => page.screenshot({ path: `test-results/${name}.png` });
try {
  await page.goto(`${process.env.GAME_URL ?? 'http://localhost:5174'}/?test`, { waitUntil: 'networkidle' });
  await page.locator('#skip').click(); await page.locator('#learn').click();
  await tool('leaf'); await plot(0); await tool('water'); await plot(0);
  await advance(6.1);
  assert.equal(await read(() => window.ecoGame.state.tutorial), 'harvest');
  assert.match(await page.locator('#crop-label-0').textContent(), /달빛 상추.*수확 가능/s);
  assert.equal(await page.locator('#crop-label-0').getAttribute('data-crop'), 'leaf');
  await shot('crop-tutorial-ready');
  await tool('harvest'); await plot(0);
  assert.ok(await read(() => window.ecoGame.world.harvestInFlight > 0));
  assert.equal(await page.locator('#inventory-leaf').textContent(), '1');
  assert.equal(await page.locator('#inventory-bean').textContent(), '0');
  assert.equal(await read(() => window.ecoGame.state.delivered), 0);
  await page.waitForTimeout(450); await shot('crop-harvest-flight');
  await page.locator('#pause').click();
  const flightAge = await read(() => window.ecoGame.world.harvestFlights.map(f => f.age));
  await page.waitForTimeout(250);
  assert.deepEqual(await read(() => window.ecoGame.world.harvestFlights.map(f => f.age)), flightAge);
  await page.locator('#resume').click();
  await page.waitForFunction(() => window.ecoGame.world.harvestInFlight === 0);
  await page.locator('#deliver').click(); await page.locator('#start-mission').click();
  assert.equal(await page.locator('#inventory-leaf').textContent(), '0');
  assert.equal(await read(() => window.ecoGame.world.harvestInFlight), 0);
  console.log('PASS: tutorial identity, harvest flight, typed inventory, pause/resume, separate delivery and reset');

  await tool('leaf'); for (const i of [0, 1, 3]) await plot(i);
  await tool('bean'); for (const i of [2, 4, 5]) await plot(i);
  await advance(45.1);
  for (const id of [0, 1, 2, 3, 4, 5]) {
    assert.match(await page.locator(`#crop-label-${id}`).textContent(), /수확 가능/);
    assert.equal(await page.locator(`#crop-label-${id}`).isVisible(), true);
  }
  assert.match(await page.locator('#crop-identity').textContent(), /보랏빛 꼬투리/);
  await page.waitForTimeout(3500); // Let the mission-start toast expire before layout captures.
  await shot('crop-mission-distinct');
  for (const [width, height] of [[1024, 768], [768, 1024], [844, 390], [667, 683], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(150);
    for (const selector of ['.top-hud', '.action-bar', '#supply-label', ...[0, 1, 2, 3, 4, 5].map(i => `#crop-label-${i}`)]) {
      const b = await page.locator(selector).boundingBox();
      assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height, `${selector} must fit ${width}×${height}: ${JSON.stringify(b)}`);
    }
    const boxes = await page.locator('.crop-label').evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON()));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, `crop labels ${i}, ${j} overlap at ${width}×${height}`);
    }
    assert.equal(await read(() => document.documentElement.scrollHeight > innerHeight), false);
    await shot(`crop-layout-${width}x${height}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  // Contextual harvest uses the same event and flight as the field tool.
  await page.locator('#apply-action').click();
  assert.equal(await page.locator('#inventory-bean').textContent(), '1');
  assert.ok(await read(() => window.ecoGame.world.harvestFlights.every(f => f.kind === 'bean')));
  await tool('harvest'); await plot(0); await plot(1);
  assert.equal(await page.locator('#inventory-leaf').textContent(), '2');
  assert.equal(await read(() => window.ecoGame.state.harvested), 3);
  assert.equal(await read(() => window.ecoGame.state.delivered), 0);
  await plot(0); // Repeating a harvest on an empty plot creates no extra produce.
  assert.equal(await read(() => window.ecoGame.state.harvested), 3);
  await page.waitForFunction(() => window.ecoGame.world.harvestInFlight === 0);
  assert.equal(await page.locator('#crop-label-0').isHidden(), true);
  await page.locator('#deliver').click();
  assert.equal(await page.locator('#inventory-leaf').textContent(), '0');
  assert.equal(await page.locator('#inventory-bean').textContent(), '0');
  assert.equal(await read(() => window.ecoGame.state.delivered), 3);
  console.log('PASS: actual mission, both crop silhouettes and ready labels, contextual/field/concurrent harvests, counts, duplicate protection and delivery');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await plot(2);
  assert.ok(await read(() => window.ecoGame.world.harvestInFlight <= 1));
  await page.waitForFunction(() => window.ecoGame.world.harvestInFlight === 0);
  assert.equal(await page.locator('#inventory-bean').textContent(), '1');
  assert.deepEqual(errors, []);
  console.log('PASS: desktop/tablet/phone labels and tools fit, no scrolling/runtime errors, reduced-motion harvest');
} finally {
  await browser.close();
}
