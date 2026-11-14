import Phaser from 'phaser';
import { makeRng } from '../../utils/rng';
import { store } from '../store';
import { cyclePos, dayLength } from '../systems/selectors';

/**
 * Fixed space backdrop: black sky (no atmosphere, even at noon), stars,
 * the Sun crossing the sky during the lunar day, and Earth hanging still
 * (from the Moon's near side, Earth barely moves in the sky).
 */
export class BackgroundScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private stars: { x: number; y: number; r: number; tw: number }[] = [];

  constructor() {
    super('background');
  }

  create() {
    const rng = makeRng(7);
    for (let i = 0; i < 320; i++) this.stars.push({ x: rng(), y: rng(), r: 0.4 + rng() * 1.4, tw: rng() * 6 });
    this.g = this.add.graphics();
  }

  update(time: number) {
    const w = this.scale.width;
    const h = this.scale.height;
    const g = this.g;
    const s = store.state;
    const sun = s.flows.sunlight;
    g.clear();
    g.fillGradientStyle(0x010208, 0x010208, 0x070b1c, 0x070b1c, 1);
    g.fillRect(0, 0, w, h);
    // The bright sunlit ground washes out faint stars, as in Apollo photos.
    const starAlpha = 1 - sun * 0.55;
    for (const st of this.stars) {
      const a = (0.45 + 0.55 * Math.abs(Math.sin(time / 1300 + st.tw))) * starAlpha;
      g.fillStyle(0xffffff, a);
      g.fillCircle(st.x * w, st.y * h, st.r);
    }

    // Sun: a hard white disc with a tight glow (no air to scatter light into a blue sky).
    const p = cyclePos(s) / dayLength(s);
    if (p <= 1) {
      const sx = w * (0.08 + 0.84 * p);
      const sy = h * (0.2 - 0.12 * Math.sin(p * Math.PI));
      const r = Math.max(12, Math.min(w, h) * 0.022);
      for (const [k, a] of [[5, 0.05], [3, 0.08], [1.8, 0.18]] as const) {
        g.fillStyle(0xfff6d8, a);
        g.fillCircle(sx, sy, r * k);
      }
      g.fillStyle(0xffffff, 1);
      g.fillCircle(sx, sy, r);
    }

    // Earth with a thin blue atmosphere rim; its phase is opposite to the Moon's.
    const ex = w * 0.86;
    const ey = h * 0.17;
    const r = Math.max(26, Math.min(w, h) * 0.06);
    g.fillStyle(0x4aa3ff, 0.08);
    g.fillCircle(ex, ey, r * 1.7);
    g.fillStyle(0x4aa3ff, 0.18);
    g.fillCircle(ex, ey, r * 1.15);
    g.fillStyle(0x1f6fd1, 1);
    g.fillCircle(ex, ey, r);
    g.fillStyle(0x3fbf6b, 1);
    g.fillEllipse(ex - r * 0.3, ey - r * 0.2, r * 0.7, r * 0.5);
    g.fillEllipse(ex + r * 0.35, ey + r * 0.3, r * 0.5, r * 0.6);
    g.fillStyle(0xd9b36a, 1);
    g.fillEllipse(ex + r * 0.05, ey - r * 0.05, r * 0.3, r * 0.25);
    g.fillStyle(0xffffff, 0.8);
    g.fillEllipse(ex + r * 0.1, ey - r * 0.55, r * 0.9, r * 0.18);
    g.fillEllipse(ex - r * 0.2, ey + r * 0.6, r * 0.7, r * 0.14);
    // Night side of Earth: "full Earth" during lunar night, "new Earth" at lunar noon.
    const phase = p <= 1 ? Math.sin(p * Math.PI) : 0;
    g.fillStyle(0x02040a, 0.15 + 0.6 * phase);
    g.slice(ex, ey, r, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(90), true);
    g.fillPath();
  }
}
