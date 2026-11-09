import { describe, expect, it } from 'vitest';
import { OrthographicCamera, Vector3 } from 'three';
import { FollowCamera } from './FollowCamera';

function view(reduced = false) {
  const camera = new OrthographicCamera(-19, 19, 11, -11, 0.1, 180);
  const follow = new FollowCamera(camera, reduced);
  follow.resize(1.6); follow.update({ x: 0, z: 7.4 }, false, 0);
  return { camera, follow };
}

describe('fixed-angle character camera', () => {
  it('follows at the same rate at 30 and 60 FPS without changing movement azimuth', () => {
    const a = view(), b = view(), player = { x: 8, z: 4 };
    for (let i = 0; i < 30; i++) a.follow.update(player, true, 1 / 30);
    for (let i = 0; i < 60; i++) b.follow.update(player, true, 1 / 60);
    expect(a.camera.position.distanceTo(b.camera.position)).toBeLessThan(0.0001);
    expect(a.camera.top).toBeCloseTo(b.camera.top);
    const forward = a.camera.getWorldDirection(new Vector3());
    expect(forward.x / forward.z).toBeCloseTo(27 / 36);
    const hero = new Vector3(player.x, 1.5, player.z).project(a.camera);
    expect(Math.abs(hero.x)).toBeLessThan(0.2); expect(Math.abs(hero.y)).toBeLessThan(0.3);
  });
  it('zooms out for overview and resets to follow for a new mission', () => {
    const { camera, follow } = view(true);
    follow.update({ x: 9, z: 7 }, true, 0.1); const near = camera.top;
    expect(follow.toggle()).toBe(true); follow.update({ x: 9, z: 7 }, true, 0.1);
    expect(camera.top).toBeGreaterThan(near);
    expect(camera.position.x).toBe(27);
    follow.reset(); follow.update({ x: 9, z: 7 }, true, 0.1);
    expect(camera.top).toBe(near); expect(camera.position.x).toBe(36);
  });
  it('preserves usable world width in portrait and supports immediate reduced-motion framing', () => {
    const { camera, follow } = view(true); follow.resize(0.75);
    follow.update({ x: -8, z: -5 }, true, 0);
    expect(camera.right - camera.left).toBeCloseTo(17);
    expect(camera.position.x).toBe(19);
    const hero = new Vector3(-8, 1.5, -5).project(camera);
    expect(Math.abs(hero.x)).toBeLessThan(0.2); expect(Math.abs(hero.y)).toBeLessThan(0.3);
  });
});
