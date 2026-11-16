import Phaser from 'phaser';
import { makeRng } from '../../utils/rng';
import { store } from '../store';
import { cyclePos, dayLength } from '../systems/selectors';
import { skinOf } from '../config/skins';
import { mix } from '../art/iso';

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
    // The sky depends on the surface skin: black where there is no air, coloured where dust or haze scatters light.
    const skin = skinOf(store.profile.settings.skin);
    const top = mix(skin.skyNight[0], skin.skyDay[0], sun);
    const bottom = mix(skin.skyNight[1], skin.skyDay[1], sun);
    g.fillGradientStyle(top, top, bottom, bottom, 1);
    g.fillRect(0, 0, w, h);
    // The bright sunlit ground washes out faint stars, as in Apollo photos; an atmosphere hides them completely.
    const starAlpha = Math.max(0, 1 - sun * skin.starFade) * (skin.sky === 'saturn' ? 0.15 : 1);
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
      const r = Math.max(4, Math.min(w, h) * 0.022 * skin.sun);
      for (const [k, a] of [[5, 0.05], [3, 0.08], [1.8, 0.18]] as const) {
        g.fillStyle(0xfff6d8, a);
        g.fillCircle(sx, sy, r * k);
      }
      g.fillStyle(0xffffff, 1);
      g.fillCircle(sx, sy, r);
    }

    const ex = w * 0.86;
    const ey = h * 0.17;
    const r = Math.max(26, Math.min(w, h) * 0.06);
    if (skin.sky !== 'earth') {
      this.drawSkyBody(skin.sky, ex, ey, r);
      return;
    }
    // Earth with a thin blue atmosphere rim; its phase is opposite to the Moon's.
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

  /** What hangs in the sky on the other skins. */
  private drawSkyBody(kind: 'moons' | 'jupiter' | 'saturn', ex: number, ey: number, r: number) {
    const g = this.g;
    if (kind === 'moons') {
      // Phobos and Deimos: small, dark and lumpy.
      g.fillStyle(0xb8a898, 1).fillEllipse(ex, ey, r * 0.34, r * 0.27);
      g.fillStyle(0x8f8072, 1).fillCircle(ex - r * 0.04, ey - r * 0.02, r * 0.05);
      g.fillStyle(0xc9bcae, 1).fillEllipse(ex - r * 2.6, ey + r * 0.5, r * 0.14, r * 0.12);
      return;
    }
    if (kind === 'jupiter') {
      const R = r * 2.6;
      g.fillStyle(0xd9b38c, 0.08).fillCircle(ex, ey, R * 1.12);
      g.fillStyle(0xd8b48e, 1).fillCircle(ex, ey, R);
      for (const [dy, hh, c] of [[-0.62, 0.16, 0xb98a63], [-0.3, 0.12, 0xead2b4], [-0.05, 0.2, 0xb07a52], [0.28, 0.14, 0xe6c9a6], [0.55, 0.18, 0xa9764f]] as const) {
        const half = Math.sqrt(Math.max(0, 1 - dy * dy)) * R;
        g.fillStyle(c, 0.9).fillEllipse(ex, ey + dy * R, half * 2, hh * R);
      }
      // The Great Red Spot
      g.fillStyle(0xc0563a, 1).fillEllipse(ex + R * 0.3, ey + R * 0.22, R * 0.32, R * 0.16);
      g.fillStyle(0x02040a, 0.45);
      g.slice(ex, ey, R, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(90), true);
      g.fillPath();
      return;
    }
    // Saturn, dim through Titan's haze.
    const R = r * 1.5;
    g.lineStyle(R * 0.18, 0xe9d3a0, 0.3).strokeEllipse(ex, ey, R * 4.2, R * 1.1);
    g.fillStyle(0xe6cf9a, 0.5).fillCircle(ex, ey, R);
    g.fillStyle(0xcfb37a, 0.4).fillEllipse(ex, ey - R * 0.25, R * 1.8, R * 0.22);
  }
}
