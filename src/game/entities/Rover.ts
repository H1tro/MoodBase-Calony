import Phaser from 'phaser';

type Pt = { x: number; y: number };

/**
 * A rover patrolling the outskirts. With no air on the Moon, the dust its
 * wheels kick up flies in clean ballistic arcs and falls straight back down
 * (slowly, in 1/6 g); it never hangs in a cloud.
 */
export class Rover {
  sprite: Phaser.GameObjects.Image;
  dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private seg = 0;
  private t = 0;

  constructor(scene: Phaser.Scene, private path: Pt[]) {
    this.sprite = scene.add.image(path[0].x, path[0].y, 'rover').setOrigin(0.5, 46 / 60);
    this.dust = scene.add.particles(0, 0, 'dot', {
      tint: [0xb4b6bd, 0x8e919b],
      speed: { min: 30, max: 75 },
      angle: { min: 225, max: 315 },
      gravityY: 70, // low lunar gravity: slow, tall arcs
      lifespan: 1300,
      frequency: 45,
      scale: { start: 0.35, end: 0.2 },
      alpha: { start: 0.8, end: 0 },
    });
  }

  update(dt: number, moving: boolean) {
    if (!moving) {
      this.dust.stop();
      return;
    }
    if (!this.dust.emitting) this.dust.start();
    const a = this.path[this.seg];
    const b = this.path[(this.seg + 1) % this.path.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    this.t += (55 * dt) / Math.max(1, len);
    if (this.t >= 1) {
      this.t = 0;
      this.seg = (this.seg + 1) % this.path.length;
    }
    const x = a.x + (b.x - a.x) * this.t;
    const y = a.y + (b.y - a.y) * this.t;
    const bump = Math.sin(performance.now() / 90) * 0.8;
    this.sprite.setPosition(x, y + bump).setFlipX(b.x < a.x).setDepth(y);
    const back = b.x < a.x ? 18 : -18;
    this.dust.setPosition(x + back, y - 4).setDepth(y - 0.5);
  }

  destroy() {
    this.sprite.destroy();
    this.dust.destroy();
  }
}
