import Phaser from 'phaser';

type Pt = { x: number; y: number };

/**
 * A crew member on EVA. In 1/6 g, astronauts move in long, slow "bunny hops"
 * (as Apollo crews did), leaving footprints wherever they land.
 */
export class Astronaut {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  target: Pt | null = null;
  inside = true;
  private hop: { fx: number; fy: number; tx: number; ty: number; t: number; dur: number } | null = null;
  private rest = Math.random() * 2;

  constructor(scene: Phaser.Scene, home: Pt) {
    this.x = home.x;
    this.y = home.y;
    this.sprite = scene.add.image(home.x, home.y, 'astro').setOrigin(0.5, 37 / 40).setAlpha(0);
  }

  /** Returns a landing point when a hop finishes (for footprints). */
  update(dt: number, wantOutside: boolean, home: Pt, pickTarget: () => Pt): Pt | null {
    if (wantOutside && this.inside) {
      this.inside = false;
      this.x = home.x;
      this.y = home.y;
      this.target = pickTarget();
    }
    if (!wantOutside && !this.inside) this.target = home;

    let landed: Pt | null = null;
    if (this.hop) {
      const h = this.hop;
      h.t += dt;
      const p = Math.min(1, h.t / h.dur);
      this.x = h.fx + (h.tx - h.fx) * p;
      this.y = h.fy + (h.ty - h.fy) * p;
      const lift = Math.sin(p * Math.PI) * 15;
      this.sprite.setPosition(this.x, this.y - lift);
      if (p >= 1) {
        this.hop = null;
        this.rest = 0.12 + Math.random() * 0.1;
        landed = { x: this.x, y: this.y };
      }
    } else if (this.target) {
      this.rest -= dt;
      if (this.rest <= 0) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d < 6) {
          if (!wantOutside) {
            this.inside = true;
            this.target = null;
          } else {
            // Look around for a moment, then wander somewhere else.
            this.rest = 1.5 + Math.random() * 3;
            this.target = pickTarget();
          }
        } else {
          const step = Math.min(d, 34);
          this.hop = { fx: this.x, fy: this.y, tx: this.x + (dx / d) * step, ty: this.y + (dy / d) * step, t: 0, dur: 0.6 };
          this.sprite.setFlipX(dx < 0);
        }
      }
      this.sprite.setPosition(this.x, this.y);
    }
    const a = this.sprite.alpha;
    this.sprite.setAlpha(Phaser.Math.Linear(a, this.inside ? 0 : 1, Math.min(1, dt * 6)));
    this.sprite.setDepth(this.y + 1);
    return landed;
  }

  destroy() {
    this.sprite.destroy();
  }
}
