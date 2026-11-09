import { OrthographicCamera, Vector3 } from 'three';

// Fixed azimuth keeps keyboard/touch directions predictable while the framing follows.
export class FollowCamera {
  overview = false;
  private focus = new Vector3(0, 0.5, 0);
  private destination = new Vector3();
  private offset = new Vector3(27, 31, 36);
  private vertical = 25.5;
  private aspect = 1.6;
  constructor(readonly camera: OrthographicCamera, private reducedMotion = false) {}
  resize(aspect: number) { this.aspect = aspect; }
  reset() { this.overview = false; }
  toggle() { this.overview = !this.overview; return this.overview; }
  update(player: { x: number; z: number }, inWorld: boolean, dt: number) {
    const wide = this.overview || !inWorld;
    this.destination.set(wide ? 0 : player.x, 0.5, wide ? 0 : player.z - 1.3);
    const height = wide ? Math.max(25.5, 33 / this.aspect) : Math.max(16.5, 17 / this.aspect);
    const blend = this.reducedMotion || !inWorld ? 1 : 1 - Math.exp(-5 * Math.max(0, dt));
    this.focus.lerp(this.destination, blend);
    this.vertical += (height - this.vertical) * blend;
    this.camera.position.copy(this.focus).add(this.offset);
    this.camera.lookAt(this.focus);
    this.camera.left = -this.vertical * this.aspect / 2;
    this.camera.right = this.vertical * this.aspect / 2;
    this.camera.top = this.vertical / 2; this.camera.bottom = -this.vertical / 2;
    this.camera.updateProjectionMatrix();
    // Screen-space UI and raycasts consume the current frame, before renderer.render.
    this.camera.updateMatrixWorld();
  }
}
