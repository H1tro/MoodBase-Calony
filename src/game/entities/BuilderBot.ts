import Phaser from 'phaser';

/** A builder robot that drives to construction sites and works there. */
export class BuilderBot {
  sprite: Phaser.GameObjects.Image;
  sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  x: number;
  y: number;
  private phase = Math.random() * 10;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.sprite = scene.add.image(x, y, 'bot').setOrigin(0.5, 50 / 64);
    this.sparks = scene.add.particles(0, 0, 'dot', {
      tint: [0xffd23f, 0xffffff, 0x7fe3ff], speed: { min: 40, max: 120 }, angle: { min: 200, max: 340 },
      lifespan: 350, scale: { start: 0.45, end: 0 }, gravityY: 300, frequency: 90, blendMode: 'ADD', emitting: false,
    });
  }

  /** Move toward (tx, ty). `working` = at a job site. Returns true when arrived. */
  update(tx: number, ty: number, working: boolean, dt: number, now: number): boolean {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    const speed = 170;
    const arrived = dist < 4;
    if (!arrived) {
      const step = Math.min(dist, speed * dt);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.sprite.setFlipX(dx < 0);
    }
    const bob = arrived && working ? Math.abs(Math.sin(now / 120 + this.phase)) * 6 : arrived ? Math.sin(now / 600 + this.phase) * 1.5 : Math.abs(Math.sin(now / 80)) * 2;
    this.sprite.setPosition(this.x, this.y - bob).setDepth(this.y + 1);
    const doSparks = arrived && working;
    this.sparks.setPosition(this.x + (this.sprite.flipX ? -12 : 12), this.y - 28).setDepth(this.y + 2);
    if (doSparks && !this.sparks.emitting) this.sparks.start();
    if (!doSparks && this.sparks.emitting) this.sparks.stop();
    return arrived;
  }

  destroy() {
    this.sprite.destroy();
    this.sparks.destroy();
  }
}
