// Supplementary production smoke test. Time advances through the real simulation;
// actions still enter through the visible toolbar and raycast-selected objects.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
const requests = new Set();
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => requests.add(new URL(r.url()).hostname));
async function advance(seconds) {
  await page.evaluate(seconds => { for (let t = 0; t < seconds - 0.0001; t += 0.05) window.ecoGame.state.update(0.05); }, seconds);
  await page.waitForTimeout(150);
}
async function plot(i) { const p = await page.evaluate(i => window.ecoGame.world.projectPlot(i), i); await page.mouse.click(p.x, p.y); }
try {
  await page.goto(`${process.env.GAME_URL ?? 'http://localhost:4173'}/?test`, { waitUntil: 'networkidle' });
  await page.locator('#skip').click(); await page.locator('#skip-tutorial').click();
  await advance(70);
  await page.locator('[data-tool="leaf"]').click(); await plot(0); await plot(1);
  await advance(31);
  assert.ok(await page.evaluate(() => window.ecoGame.state.plots[0].crop.dryTime > 0));
  assert.equal(await page.evaluate(() => window.ecoGame.state.plots[0].crop.dead), false);
  const wiltColor = await page.evaluate(() => window.ecoGame.world.plots[0].leafMaterial.color.getHex());
  await page.locator('[data-tool="water"]').click(); await plot(0);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.ecoGame.state.plots[0].crop.dryTime), 0);
  assert.notEqual(await page.evaluate(() => window.ecoGame.world.plots[0].leafMaterial.color.getHex()), wiltColor);
  await advance(6.3);
  assert.equal(await page.evaluate(() => window.ecoGame.state.plots[0].crop.growth), 1);
  await page.locator('[data-tool="harvest"]').click(); await plot(0);
  const supply = await page.evaluate(() => {
    const game = window.ecoGame;
    const object = game.world.targets.find(o => o.userData.delivery);
    const p = object.position.clone().set(0, 0, 0); object.localToWorld(p); p.project(game.world.camera);
    return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
  });
  await page.mouse.click(supply.x, supply.y);
  assert.equal(await page.evaluate(() => window.ecoGame.state.delivered), 1);
  assert.equal(await page.evaluate(() => window.ecoGame.state.droughtDelivered), 1);
  await advance(15);
  assert.equal(await page.evaluate(() => window.ecoGame.state.plots[1].crop.dead), true);
  await plot(1);
  assert.equal(await page.evaluate(() => window.ecoGame.state.plots[1].crop), null);
  assert.equal(await page.evaluate(() => window.ecoGame.state.harvested), 1);
  assert.deepEqual(errors, []);
  assert.deepEqual([...requests], ['localhost']);
  console.log('PASS: production build, natural drought wilt, 3D color recovery after watering, resumed growth, raycast SUPPLY delivery, permanent death and clearing, no external requests or runtime errors');
} finally { await browser.close(); }
