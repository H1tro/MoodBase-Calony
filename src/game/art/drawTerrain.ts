import type Phaser from 'phaser';
import { MAP_SIZE } from '../config/balance';
import type { Terrain, TileKind } from '../systems/terrain';
import { BORDER, HH, HW, mix, shade, tileTop } from './iso';
import { makeRng } from '../../utils/rng';

/** Rover patrol loop in tile coordinates, just outside the buildable map. */
export const ROVER_LOOP: [number, number][] = [[-2.2, -2.2], [MAP_SIZE + 1.8, -2.2], [MAP_SIZE + 1.8, MAP_SIZE + 1.8], [-2.2, MAP_SIZE + 1.8]];

/** The first landing site, left on the plain west of the base. */
export const LANDER_TILE = { x: -3.2, y: 11.5 };

const BASE: Record<TileKind, number> = {
  ground: 0x8e919b,
  crater: 0x7b7f8a,
  boulder: 0x8e919b,
  ice: 0xa7d8f2,
  ore: 0xa8775c,
};

function diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, w = HW, h = HH) {
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w, y + h);
  g.lineTo(x, y + h * 2);
  g.lineTo(x - w, y + h);
  g.closePath();
}

/** Isometric ellipse for a circle of radius r tiles centred at tile coords (cx, cy). */
function isoCircle(cx: number, cy: number, r: number) {
  const c = tileTop(cx, cy);
  return { x: c.x, y: c.y, rx: r * HW * 1.414, ry: r * HH * 1.414 };
}

function crater(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, depth = 1) {
  const e = isoCircle(cx, cy, r);
  // Outer ejecta halo
  g.fillStyle(0xb4b6bd, 0.35 * depth);
  g.fillEllipse(e.x, e.y, e.rx * 2.5, e.ry * 2.5);
  // Lit rim
  g.fillStyle(0xc3c5cc, 0.9);
  g.fillEllipse(e.x, e.y, e.rx * 2.15, e.ry * 2.15);
  // Bowl
  g.fillStyle(0x5f636e, 1);
  g.fillEllipse(e.x, e.y + e.ry * 0.08, e.rx * 1.85, e.ry * 1.85);
  // Shadowed upper half (sun from upper-left → shadow inside on the upper-left wall)
  g.fillStyle(0x464a55, 1);
  g.fillEllipse(e.x - e.rx * 0.12, e.y - e.ry * 0.05, e.rx * 1.55, e.ry * 1.45);
  // Floor
  g.fillStyle(0x6c707b, 1);
  g.fillEllipse(e.x + e.rx * 0.12, e.y + e.ry * 0.22, e.rx * 1.2, e.ry * 1.05);
  if (depth >= 1) {
    g.fillStyle(0x7d818c, 1);
    g.fillEllipse(e.x + e.rx * 0.3, e.y + e.ry * 0.35, e.rx * 0.5, e.ry * 0.4);
  }
}

/** The outline of the whole ground plateau (playable map + border), for masks. */
export function groundOutline() {
  const lo = -BORDER;
  const hi = MAP_SIZE + BORDER;
  return [tileTop(lo, lo), tileTop(hi, lo), tileTop(hi, hi), tileTop(lo, hi)];
}

/**
 * Jagged mountain ridges along the far edges, so the plateau reads as a
 * horizon instead of a floating island. Two layers: far (dark) and near.
 */
export function drawRidges(g: Phaser.GameObjects.Graphics, seed: number) {
  const rng = makeRng(seed + 7);
  const lo = -BORDER;
  const hi = MAP_SIZE + BORDER;
  const L = tileTop(lo, hi);
  const T = tileTop(lo, lo);
  const R = tileTop(hi, lo);
  for (const layer of [0, 1]) {
    const pts: { x: number; y: number }[] = [];
    const along = (a: { x: number; y: number }, b: { x: number; y: number }, n: number) => {
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const base = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const big = layer === 0 ? 140 : 80;
        const h = (layer === 0 ? 70 : 25) + rng() * big + Math.sin(t * Math.PI) * (layer === 0 ? 90 : 40);
        pts.push({ x: base.x + (rng() - 0.5) * 30, y: base.y - h - (layer === 0 ? 40 : 0) });
      }
    };
    along(L, T, 22);
    along(T, R, 22);
    const baseCol = layer === 0 ? 0x3f434d : 0x6a6e79;
    // Silhouette body
    g.fillStyle(baseCol, 1);
    g.fillPoints([{ x: L.x, y: L.y + 30 }, ...pts, { x: R.x, y: R.y + 30 }, { x: T.x, y: T.y + 60 }], true);
    // Faces: slopes facing the upper-left sun are lit, the others in deep shadow.
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const rising = b.y < a.y;
      const foot = Math.max(a.y, b.y) + 70;
      g.fillStyle(rising ? shade(baseCol, 1.45) : shade(baseCol, 0.7), 1);
      g.fillTriangle(a.x, a.y, b.x, b.y, rising ? a.x : b.x, foot);
      // Bright sunlit crest line
      if (rising) {
        g.lineStyle(2, shade(baseCol, 1.9), 0.8);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }
}

/** Draw the whole lunar surface into one Graphics object (static). */
export function drawTerrain(g: Phaser.GameObjects.Graphics, t: Terrain, seed: number) {
  const rng = makeRng(seed + 99);
  const lo = -BORDER;
  const hi = MAP_SIZE + BORDER;

  // Cliff skirt under the outer ground so the plateau has thickness.
  const L = tileTop(lo, hi);
  const B = tileTop(hi, hi);
  const R = tileTop(hi, lo);
  g.fillStyle(0x2e313a, 1);
  g.fillPoints([{ x: L.x, y: L.y }, { x: B.x, y: B.y }, { x: B.x, y: B.y + 90 }, { x: L.x, y: L.y + 90 }], true);
  g.fillStyle(0x23262e, 1);
  g.fillPoints([{ x: B.x, y: B.y }, { x: R.x, y: R.y }, { x: R.x, y: R.y + 90 }, { x: B.x, y: B.y + 90 }], true);

  // Outer ground tiles (not buildable), slightly darker.
  for (let y = lo; y < hi; y++)
    for (let x = lo; x < hi; x++) {
      if (x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE) continue;
      const p = tileTop(x, y);
      const n = 0.86 + rng() * 0.08 + 0.04 * Math.sin(x * 0.7) * Math.cos(y * 0.5);
      g.fillStyle(shade(0x767a85, n), 1);
      diamond(g, p.x, p.y);
      g.fillPath();
    }

  // Playable tiles
  for (let y = 0; y < MAP_SIZE; y++)
    for (let x = 0; x < MAP_SIZE; x++) {
      const kind = t.tiles[y * MAP_SIZE + x];
      const p = tileTop(x, y);
      const warm = 0.5 + 0.5 * Math.sin(x * 0.45 + 1) * Math.cos(y * 0.38);
      let c = mix(BASE[kind], kind === 'ground' || kind === 'boulder' ? 0x9a948a : BASE[kind], warm * 0.6);
      c = shade(c, 0.93 + rng() * 0.12);
      g.fillStyle(c, 1);
      diamond(g, p.x, p.y);
      g.fillPath();
      // Light grid line for placement readability
      g.lineStyle(1, 0x2b2f3a, 0.16);
      diamond(g, p.x, p.y);
      g.strokePath();
      if (kind === 'ice') {
        for (let i = 0; i < 3; i++) {
          const sx = p.x + (rng() - 0.5) * HW;
          const sy = p.y + HH + (rng() - 0.5) * HH;
          g.fillStyle(0xffffff, 0.9);
          g.fillRect(sx - 3, sy - 0.75, 6, 1.5);
          g.fillRect(sx - 0.75, sy - 3, 1.5, 6);
        }
        g.fillStyle(0xe6f7ff, 0.5);
        g.fillEllipse(p.x + (rng() - 0.5) * 30, p.y + HH, 40, 14);
      } else if (kind === 'ore') {
        for (let i = 0; i < 6; i++) {
          g.fillStyle(rng() < 0.5 ? 0x7a4a33 : 0xd09a6a, 0.9);
          g.fillCircle(p.x + (rng() - 0.5) * HW, p.y + HH + (rng() - 0.5) * HH * 0.9, 2 + rng() * 3);
        }
      }
    }

  // Bright ejecta rays from two young craters (like Tycho or Copernicus, at small scale)
  for (const [cx, cy, r] of [[-3.5, 6, 1.9], [16, 23.5, 1.6]] as const) {
    const c = tileTop(cx, cy);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + rng() * 0.3;
      const len = (r * 3 + rng() * r * 4) * HW;
      const w = 0.05 + rng() * 0.05;
      g.fillStyle(0xdfe1e7, 0.13 + rng() * 0.08);
      g.fillTriangle(
        c.x + Math.cos(a - w) * r * HW, c.y + Math.sin(a - w) * r * HH,
        c.x + Math.cos(a + w) * r * HW, c.y + Math.sin(a + w) * r * HH,
        c.x + Math.cos(a) * len, c.y + Math.sin(a) * len * 0.5,
      );
    }
    crater(g, cx, cy, r, 1);
  }

  // Outer decorative craters
  for (let i = 0; i < 18; i++) {
    const side = Math.floor(rng() * 4);
    const a = lo + rng() * (hi - lo);
    const b = side < 2 ? lo + rng() * (BORDER - 1) : MAP_SIZE + 1 + rng() * (BORDER - 2);
    const [cx, cy] = side % 2 === 0 ? [a, b] : [b, a];
    crater(g, cx, cy, 0.5 + rng() * 1.6, 0.8);
  }
  for (const c of t.smallCraters) crater(g, c.x, c.y, c.r, 0.5);
  for (const c of t.craters) {
    crater(g, c.x, c.y, c.r, 1);
    // Blocks of rock thrown out onto the rim
    for (let k = 0; k < 10; k++) {
      const a = rng() * Math.PI * 2;
      const d = c.r * (1.05 + rng() * 0.35);
      const p = tileTop(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d);
      const s = 2 + rng() * 4;
      g.fillStyle(0x2e313a, 0.45).fillEllipse(p.x + s * 0.8, p.y + s * 0.4, s * 2.6, s * 1.1);
      g.fillStyle(0x9a9da6, 1).fillEllipse(p.x, p.y, s * 2, s * 1.3);
      g.fillStyle(0xc9ccd3, 1).fillEllipse(p.x - s * 0.3, p.y - s * 0.3, s, s * 0.6);
    }
  }

  // Pebbles with tiny shadows
  for (const p of t.pebbles) {
    const s = tileTop(p.x, p.y);
    g.fillStyle(0x3b3e47, 0.35);
    g.fillEllipse(s.x + 2, s.y + 2, p.s * 3, p.s * 1.5);
    g.fillStyle(0xb9bcc4, 1);
    g.fillEllipse(s.x, s.y, p.s * 2.4, p.s * 1.6);
  }
  // Outer pebbles
  for (let i = 0; i < 160; i++) {
    const x = lo + rng() * (hi - lo);
    const y = lo + rng() * (hi - lo);
    if (x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE) continue;
    const s = tileTop(x, y);
    g.fillStyle(0xa3a6ae, 1);
    g.fillEllipse(s.x, s.y, 4, 2.5);
  }
  // Rover tracks along its patrol loop (tracks on the Moon last for decades)
  const loop = ROVER_LOOP.map(([x, y]) => tileTop(x, y));
  for (const off of [-5, 5]) {
    g.lineStyle(2, 0x5f626b, 0.5);
    g.strokePoints(loop.map((p) => ({ x: p.x + off, y: p.y + off * 0.5 })), true);
  }

  // Playable-area border
  const T = tileTop(0, 0);
  const Rr = tileTop(MAP_SIZE, 0);
  const Bb = tileTop(MAP_SIZE, MAP_SIZE);
  const Ll = tileTop(0, MAP_SIZE);
  g.lineStyle(3, 0x7fe3ff, 0.35);
  g.strokePoints([T, Rr, Bb, Ll], true);
}
