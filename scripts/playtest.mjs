import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.GAME_URL ?? 'http://localhost:5173';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const report = { desktop: {}, tablet: {}, errors };
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
const read = fn => page.evaluate(fn);
const shot = name => page.screenshot({ path: `test-results/${name}.png` });
async function plot(id) {
  const p = await page.evaluate(i => window.ecoGame.world.projectPlot(i), id);
  await page.mouse.click(p.x, p.y);
}
async function tool(name) { await page.locator(`[data-tool="${name}"]`).click(); }

try {
  await page.goto(`${base}/?test`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.ecoGame);
  assert.equal(await page.locator('#start').count(), 0);
  assert.equal(await read(() => window.ecoGame.state.phase), 'intro');
  await page.waitForTimeout(1800); await shot('02-space');
  assert.equal(await read(() => window.ecoGame.state.phase), 'intro');
  await page.waitForTimeout(4100); await shot('03-landing');
  await page.waitForSelector('#start-screen:not([hidden])');
  assert.equal(await read(() => window.ecoGame.state.phase), 'briefing');
  assert.equal(await read(() => window.ecoGame.state.time), 0);
  assert.equal(await page.locator('#start-screen button').count(), 0);
  await shot('01-briefing');
  await page.waitForTimeout(1000);
  assert.equal(await read(() => window.ecoGame.state.time), 0);
  await page.waitForFunction(() => window.ecoGame.state.phase === 'playing');
  console.log('PASS: page open → automatic space approach → 3D landing → button-free briefing (timer frozen) → automatic gameplay');

  await tool('leaf'); for (const i of [0, 1, 2]) await plot(i);
  await tool('bean'); for (const i of [3, 4, 5]) await plot(i);
  assert.equal(await read(() => window.ecoGame.state.plots.filter(p => p.crop).length), 6);
  assert.equal(await read(() => window.ecoGame.state.money), 180);
  await tool('water'); await plot(0);
  assert.equal(await read(() => window.ecoGame.state.water), 90);
  assert.equal(await read(() => window.ecoGame.state.selected), 0);
  await page.locator('#pause').click();
  const pausedTime = await read(() => window.ecoGame.state.time);
  await page.waitForTimeout(700);
  assert.equal(await read(() => window.ecoGame.state.time), pausedTime);
  await page.locator('#resume').click();
  await page.keyboard.press('F3');
  await page.waitForTimeout(1000);
  report.desktop.renderer = await page.locator('#debug').textContent();
  await page.keyboard.press('F3');
  console.log('PASS: raycast planting ×6, distinct crop types, resource costs, watering, pause');
  await page.waitForFunction(() => window.ecoGame.state.time >= 17, undefined, { timeout: 25000 });
  await shot('04-growing');
  await page.waitForFunction(() => window.ecoGame.state.plots[0].crop.growth === 1, undefined, { timeout: 25000 });
  await tool('harvest'); await plot(0); await plot(1);
  assert.equal(await read(() => window.ecoGame.state.inventory.length), 2);
  assert.equal(await read(() => window.ecoGame.state.plots[0].crop), null);
  await page.locator('#deliver').click();
  assert.equal(await read(() => window.ecoGame.state.delivered), 2);
  assert.equal(await read(() => window.ecoGame.state.phase), 'playing');
  console.log('PASS: real-time growth → visible crop removal → inventory → delivery');

  await page.waitForFunction(() => window.ecoGame.state.drought, undefined, { timeout: 60000 });
  await page.waitForTimeout(2000); await shot('05-drought');
  assert.match(await page.locator('#weather').textContent(), /가뭄/);
  const before = await read(() => window.ecoGame.state.plots[2].crop.moisture);
  await tool('water'); await plot(2);
  assert.ok(await read(() => window.ecoGame.state.plots[2].crop.moisture) > before);
  await tool('harvest'); await plot(2); await plot(3);
  await page.locator('#deliver').click();
  await page.waitForSelector('#result-screen:not([hidden])');
  assert.equal(await read(() => window.ecoGame.state.phase), 'won');
  assert.equal(await read(() => window.ecoGame.state.droughtDelivered), 2);
  assert.equal(await read(() => window.ecoGame.state.waterUsed), 20);
  await shot('06-success');
  report.desktop.mission = await read(() => ({ time: window.ecoGame.state.time, harvested: window.ecoGame.state.harvested, delivered: window.ecoGame.state.delivered, droughtDelivered: window.ecoGame.state.droughtDelivered, waterUsed: window.ecoGame.state.waterUsed }));
  console.log('PASS: drought triggers after 70 seconds, watering restores soil, post-drought goal → success');

  await page.locator('#retry').click(); await page.locator('#skip').click();
  await page.waitForSelector('#start-screen:not([hidden])');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.ecoGame.state.phase === 'playing');
  assert.equal(await read(() => window.ecoGame.state.money), 300);
  assert.equal(await read(() => window.ecoGame.state.water), 100);
  assert.equal(await read(() => window.ecoGame.state.delivered), 0);
  assert.equal(await read(() => window.ecoGame.state.drought), false);
  assert.ok(await read(() => window.ecoGame.state.plots.every(p => p.crop === null)));
  // Only the timeout failure is accelerated; the successful mission above ran in wall time.
  await page.evaluate(() => { for (let i = 0; i < 9601; i++) window.ecoGame.state.update(0.05); });
  await page.waitForSelector('#result-screen:not([hidden])');
  assert.equal(await read(() => window.ecoGame.state.phase), 'lost');
  assert.match(await page.locator('#result-description').textContent(), /시간/);
  await shot('07-failure');
  await page.locator('#main-menu').click(); await page.waitForSelector('#intro-screen:not([hidden])');
  console.log('PASS: clean restart, intro skip, keyboard briefing dismissal, accelerated timeout failure, return to opening');

  const tablet = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 2, isMobile: true });
  const touch = await tablet.newPage();
  touch.on('pageerror', e => errors.push(`tablet: ${e.message}`));
  await touch.goto(`${base}/?test`, { waitUntil: 'networkidle' });
  await touch.locator('#skip').tap(); await touch.locator('.start-panel').tap();
  await touch.locator('[data-tool="bean"]').tap();
  const coord = await touch.evaluate(() => window.ecoGame.world.projectPlot(4));
  await touch.touchscreen.tap(coord.x, coord.y);
  assert.equal(await touch.evaluate(() => window.ecoGame.state.plots[4].crop.kind), 'bean');
  await touch.locator('[data-tool="water"]').tap(); await touch.touchscreen.tap(coord.x, coord.y);
  assert.equal(await touch.evaluate(() => window.ecoGame.state.water), 90);
  assert.equal(await touch.evaluate(() => document.documentElement.scrollHeight > innerHeight), false);
  const buttons = await touch.locator('.tool').evaluateAll(els => els.map(e => { const b = e.getBoundingClientRect(); return { width: b.width, height: b.height, onscreen: b.x >= 0 && b.right <= innerWidth && b.y >= 0 && b.bottom <= innerHeight }; }));
  assert.ok(buttons.every(b => b.onscreen && b.width >= 44 && b.height >= 44));
  await touch.screenshot({ path: 'test-results/08-tablet.png' });
  await touch.setViewportSize({ width: 844, height: 390 }); await touch.waitForTimeout(500);
  await touch.screenshot({ path: 'test-results/09-small-landscape.png' });
  report.tablet = { viewport: '1024×768, touch, DPR 2 emulated', planted: true, watered: true, noScrolling: true, tools: buttons };
  await tablet.close();
  console.log('PASS: tablet touch raycasting, planting, watering, touch target bounds, no scrolling, landscape resize');
  assert.deepEqual(errors, []);
  await writeFile('test-results/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
