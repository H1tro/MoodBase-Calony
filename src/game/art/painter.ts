import type Phaser from 'phaser';
import { HH, HW, shade } from './iso';

export type Pt = [number, number];
export interface Light { x: number; y: number; color: number; r: number }

const OUTLINE = 0x141826;
/** Light comes from the upper-left of the screen. */
const LIGHT_ANGLE = Math.PI * 0.8;

/**
 * Low-poly isometric painter. Coordinates: u, v in tiles relative to the
 * footprint centre (u → screen lower-right, v → screen lower-left), z in px up.
 */
export class Painter {
  lights: Light[] = [];
  constructor(public g: Phaser.GameObjects.Graphics, public ox: number, public oy: number) {}

  p(u: number, v: number, z = 0): Pt {
    return [this.ox + (u - v) * HW, this.oy + (u + v) * HH - z];
  }

  poly(pts: Pt[], color: number, alpha = 1, line = 0.55, lineColor = OUTLINE, lineW = 1.5) {
    const g = this.g;
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillPath();
    if (line > 0) {
      g.lineStyle(lineW, lineColor, line);
      g.strokePath();
    }
  }

  /** Flat diamond/rectangle lying at height z. */
  flat(u: number, v: number, a: number, b: number, z: number, color: number, alpha = 1, line = 0.4) {
    this.poly([this.p(u - a / 2, v - b / 2, z), this.p(u + a / 2, v - b / 2, z), this.p(u + a / 2, v + b / 2, z), this.p(u - a / 2, v + b / 2, z)], color, alpha, line);
  }

  /** Iso box: extent a along u, b along v, height h, base elevation z. */
  box(u: number, v: number, a: number, b: number, h: number, color: number, z = 0, topColor?: number) {
    const W = (zz: number) => this.p(u - a / 2, v + b / 2, zz);
    const S = (zz: number) => this.p(u + a / 2, v + b / 2, zz);
    const E = (zz: number) => this.p(u + a / 2, v - b / 2, zz);
    const N = (zz: number) => this.p(u - a / 2, v - b / 2, zz);
    this.poly([W(z), S(z), S(z + h), W(z + h)], color, 1, 0.7);
    this.poly([S(z), E(z), E(z + h), S(z + h)], shade(color, 0.7), 1, 0.7);
    this.poly([N(z + h), E(z + h), S(z + h), W(z + h)], topColor ?? shade(color, 1.22), 1, 0.7);
  }

  /** Quad on the left (v+) face of a box: s along the face 0..1, t height in px. */
  faceL(u: number, v: number, a: number, b: number, s0: number, s1: number, t0: number, t1: number, color: number, alpha = 1) {
    const at = (s: number, t: number) => this.p(u - a / 2 + a * s, v + b / 2, t);
    this.poly([at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)], color, alpha, 0.35);
  }

  /** Quad on the right (u+) face of a box. */
  faceR(u: number, v: number, a: number, b: number, s0: number, s1: number, t0: number, t1: number, color: number, alpha = 1) {
    const at = (s: number, t: number) => this.p(u + a / 2, v + b / 2 - b * s, t);
    this.poly([at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)], color, alpha, 0.35);
  }

  /** Window on a face that also glows at night. */
  windowL(u: number, v: number, a: number, b: number, s0: number, s1: number, t0: number, t1: number, color = 0x9be7ff) {
    this.faceL(u, v, a, b, s0, s1, t0, t1, color);
    const c = this.p(u - a / 2 + a * (s0 + s1) / 2, v + b / 2, (t0 + t1) / 2);
    this.lights.push({ x: c[0] - this.ox, y: c[1] - this.oy, color, r: 26 });
  }

  windowR(u: number, v: number, a: number, b: number, s0: number, s1: number, t0: number, t1: number, color = 0x9be7ff) {
    this.faceR(u, v, a, b, s0, s1, t0, t1, color);
    const c = this.p(u + a / 2, v + b / 2 - b * (s0 + s1) / 2, (t0 + t1) / 2);
    this.lights.push({ x: c[0] - this.ox, y: c[1] - this.oy, color, r: 26 });
  }

  /**
   * Faceted solid of revolution (low-poly domes, tanks, cones).
   * rings: [radiusPx, heightPx] from bottom to top.
   */
  lathe(u: number, v: number, rings: [number, number][], color: number, z = 0, segments = 12, colors?: number[]) {
    const [cx, cy] = this.p(u, v, z);
    const pt = (r: number, h: number, th: number): Pt => [cx + r * Math.cos(th), cy + 0.5 * r * Math.sin(th) - h];
    const back: { pts: Pt[]; c: number }[] = [];
    const front: { pts: Pt[]; c: number }[] = [];
    for (let i = 0; i < rings.length - 1; i++) {
      const [r0, h0] = rings[i];
      const [r1, h1] = rings[i + 1];
      const base = colors?.[i] ?? color;
      // Slope: flatter facets face the sky and get brighter.
      const slope = Math.atan2(r0 - r1, Math.max(1, h1 - h0)) / (Math.PI / 2);
      for (let k = 0; k < segments; k++) {
        const t0 = (k / segments) * Math.PI * 2;
        const t1 = ((k + 1) / segments) * Math.PI * 2;
        const mid = (t0 + t1) / 2;
        const diffuse = Math.max(0, Math.cos(mid - LIGHT_ANGLE));
        const k2 = 0.62 + 0.42 * diffuse + 0.28 * Math.max(0, slope);
        const pts = [pt(r0, h0, t0), pt(r0, h0, t1), pt(r1, h1, t1), pt(r1, h1, t0)];
        (Math.sin(mid) < 0 ? back : front).push({ pts, c: shade(base, k2) });
      }
    }
    for (const f of back) this.poly(f.pts, f.c, 1, 0.25);
    for (const f of front) this.poly(f.pts, f.c, 1, 0.3);
    // Flat top cap if the last ring has a radius.
    const [rt, ht] = rings[rings.length - 1];
    if (rt > 0.5) {
      const cap: Pt[] = [];
      for (let k = 0; k < segments; k++) cap.push(pt(rt, ht, (k / segments) * Math.PI * 2));
      this.poly(cap, shade(colors?.[rings.length - 1] ?? color, 1.25), 1, 0.5);
    }
  }

  cylinder(u: number, v: number, r: number, h: number, color: number, z = 0, segments = 10) {
    this.lathe(u, v, [[r, 0], [r, h]], color, z, segments);
  }

  dome(u: number, v: number, r: number, h: number, color: number, z = 0, segments = 12) {
    this.lathe(u, v, [[r, 0], [r * 0.93, h * 0.38], [r * 0.72, h * 0.72], [r * 0.38, h * 0.95], [0, h]], color, z, segments);
  }

  ellipse(u: number, v: number, rx: number, ry: number, color: number, alpha = 1, z = 0) {
    const [x, y] = this.p(u, v, z);
    this.g.fillStyle(color, alpha);
    this.g.fillEllipse(x, y, rx * 2, ry * 2);
  }

  line(a: Pt, b: Pt, color: number, w = 2, alpha = 1) {
    this.g.lineStyle(w, color, alpha);
    this.g.lineBetween(a[0], a[1], b[0], b[1]);
  }

  light(u: number, v: number, z: number, color: number, r = 30) {
    const [x, y] = this.p(u, v, z);
    this.lights.push({ x: x - this.ox, y: y - this.oy, color, r });
  }

  /** Ground pad under a building, trimmed with the level colour. */
  pad(n: number, trim: number) {
    const a = n - 0.12;
    this.ellipse(0.25, 0.25, n * 62, n * 31, 0x000000, 0.28);
    this.box(0, 0, a, a, 7, 0x4b5366, 0, 0x6b7487);
    const half = a / 2 - 0.06;
    const pts: Pt[] = [this.p(-half, -half, 7), this.p(half, -half, 7), this.p(half, half, 7), this.p(-half, half, 7)];
    this.g.lineStyle(3, trim, 0.95);
    this.g.beginPath();
    this.g.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts.slice(1)) this.g.lineTo(q[0], q[1]);
    this.g.closePath();
    this.g.strokePath();
  }
}
