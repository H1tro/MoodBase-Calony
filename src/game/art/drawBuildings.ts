import type Phaser from 'phaser';
import { BUILDINGS, maxLevelOf, type BuildingType } from '../config/buildings';
import { Painter, type Light, type Pt } from './painter';
import { shade } from './iso';

/** Pad trim colour per level: bronze → silver → gold → cyan → magenta. */
export const LEVEL_TRIM = [0xcd7f32, 0xc9d3e6, 0xffc93c, 0x3de1ff, 0xff5bd6];

/** Pixels reserved above the footprint centre for each building's height. */
const TOP: Record<BuildingType, number> = {
  command: 340, solar: 170, battery: 170, mine: 270, refinery: 260, ice: 230, oxygen: 210,
  greenhouse: 200, habitat: 200, storage: 220, builderStation: 210, lab: 230, spaceport: 230, opscenter: 280, monitor: 210,
};

export interface TexInfo { key: string; originY: number; top: number; lights: Light[] }
export const TEX = new Map<string, TexInfo>();

export const texKey = (type: BuildingType, level: number, shield = 0) =>
  type === 'habitat' && shield > 0 ? `b_${type}_${level}_s${shield}` : `b_${type}_${level}`;

type Draw = (P: Painter, L: number, trim: number, extra: number) => void;

// ---------------------------------------------------------------------------
// Small props shared by several buildings (decoration only; no gameplay meaning).
const crate = (P: Painter, u: number, v: number, z = 7, c = 0xc48a3a, s = 0.18, h = 12) => {
  P.box(u, v, s, s, h, c, z, shade(c, 1.2));
  P.faceL(u, v, s, s, 0.1, 0.9, z + h * 0.4, z + h * 0.62, shade(c, 0.6));
};
const barrel = (P: Painter, u: number, v: number, c: number, z = 7) => {
  P.cylinder(u, v, 6, 13, c, z, 8);
  P.lathe(u, v, [[6.6, 5], [6.6, 7.5]], 0xf2f5fa, z, 8);
};
const lamp = (P: Painter, u: number, v: number, h: number, color: number, z = 7) => {
  P.line(P.p(u, v, z), P.p(u, v, z + h), 0x8c95a6, 2);
  const [x, y] = P.p(u, v, z + h);
  P.g.fillStyle(0x2b3346, 1).fillCircle(x, y, 4.5);
  P.g.fillStyle(color, 1).fillCircle(x, y, 3);
  P.lights.push({ x: x - P.ox, y: y - P.oy, color, r: 20 });
};
/** A flag held out by a top rod, like the Apollo flags: there is no wind on the Moon. */
const flag = (P: Painter, u: number, v: number, h: number, color: number, z = 7) => {
  const [x, y] = P.p(u, v, z);
  P.line([x, y], [x, y - h], 0xdfe7f2, 2);
  P.line([x, y - h], [x + 20, y - h], 0xdfe7f2, 2);
  P.poly([[x + 1, y - h + 1], [x + 20, y - h + 1], [x + 20, y - h + 13], [x + 1, y - h + 13]], color, 1, 0.5);
  P.poly([[x + 1, y - h + 5], [x + 20, y - h + 5], [x + 20, y - h + 9], [x + 1, y - h + 9]], 0xffffff, 0.9, 0);
};
const rock = (P: Painter, u: number, v: number, r: number, c = 0x8d8a86, z = 7) => {
  P.lathe(u, v, [[r, 0], [r * 0.8, r * 0.5], [r * 0.3, r * 0.85], [0, r * 0.9]], c, z, 6);
};
/** A pipe with a dark outline between two iso points. */
const pipe = (P: Painter, a: Pt, b: Pt, color = 0xc9d3e6, w = 4) => {
  P.line(a, b, 0x141826, w + 2, 0.7);
  P.line(a, b, color, w);
};
const ladder = (P: Painter, x: number, y: number, h: number) => {
  P.line([x - 4, y], [x - 4, y - h], 0xdfe7f2, 1.5);
  P.line([x + 4, y], [x + 4, y - h], 0xdfe7f2, 1.5);
  for (let k = 4; k < h; k += 7) P.line([x - 4, y - k], [x + 4, y - k], 0xdfe7f2, 1.5);
};
/** Glass frame: ribs drawn over the front of a dome (same profile as Painter.dome). */
const domeRibs = (P: Painter, u: number, v: number, r: number, h: number, z: number, color = 0xffffff, alpha = 0.35) => {
  const [cx, cy] = P.p(u, v, z);
  const prof: [number, number][] = [[r, 0], [r * 0.93, h * 0.38], [r * 0.72, h * 0.72], [r * 0.38, h * 0.95], [0, h]];
  for (const th of [0.12, 0.31, 0.5, 0.69, 0.88]) {
    const a = th * Math.PI;
    for (let i = 0; i < prof.length - 1; i++) {
      const [r0, h0] = prof[i];
      const [r1, h1] = prof[i + 1];
      P.line([cx + r0 * Math.cos(a), cy + 0.5 * r0 * Math.sin(a) - h0], [cx + r1 * Math.cos(a), cy + 0.5 * r1 * Math.sin(a) - h1], color, 1.5, alpha);
    }
  }
};
/** Yellow and black warning band on the left face of a box. */
const hazardL = (P: Painter, u: number, v: number, a: number, b: number, s0: number, s1: number, t0: number, t1: number, n = 8) => {
  for (let k = 0; k < n; k++) {
    P.faceL(u, v, a, b, s0 + ((s1 - s0) * k) / n, s0 + ((s1 - s0) * (k + 1)) / n, t0, t1, k % 2 ? 0x1b1f2b : 0xf2b705);
  }
};

// ---------------------------------------------------------------------------
const command: Draw = (P, L, trim) => {
  P.pad(3, trim);
  if (L >= 2) { // back-right wing
    P.box(0.95, -0.85, 0.8, 0.9, 34, 0x35507a);
    P.windowL(0.95, -0.85, 0.8, 0.9, 0.2, 0.45, 12, 24);
    P.windowL(0.95, -0.85, 0.8, 0.9, 0.55, 0.8, 12, 24);
  }
  if (L >= 4) { // back-left wing
    P.box(-0.85, 0.95, 0.9, 0.8, 34, 0x35507a);
    P.windowR(-0.85, 0.95, 0.9, 0.8, 0.3, 0.7, 12, 24);
  }
  if (L >= 3) { // dish on the right wing
    P.cylinder(0.95, -0.85, 4, 30, 0x9aa5b8, 34, 6);
    const [x, y] = P.p(0.95, -0.85, 70);
    P.g.fillStyle(0xdfe7f2, 1);
    P.g.fillEllipse(x, y, 46, 30);
    P.g.lineStyle(2, 0x141826, 0.6);
    P.g.strokeEllipse(x, y, 46, 30);
    P.g.fillStyle(0x9aa5b8, 1);
    P.g.fillEllipse(x, y, 16, 10);
  }
  // Main octagonal hall
  P.lathe(0, 0, [[118, 0], [118, 44], [104, 58]], 0x2f5d9e, 7, 8, [0x2f5d9e, 0x3d74c4, 0x3d74c4]);
  for (const th of [0.18, 0.38, 0.62, 0.82]) {
    const a = th * Math.PI;
    const [cx, cy] = P.p(0, 0, 7);
    const x = cx + 118 * Math.cos(a);
    const y = cy + 59 * Math.sin(a);
    P.poly([[x - 9, y - 34], [x + 9, y - 34], [x + 9, y - 18], [x - 9, y - 18]], 0x9be7ff, 1, 0.5);
    P.lights.push({ x: x - P.ox, y: y - 26 - P.oy, color: 0x9be7ff, r: 30 });
  }
  // Orange trim band
  P.lathe(0, 0, [[106, 0], [106, 8]], 0xf08a24, 63, 8);
  // Central tower grows with level
  const th = 46 + L * 16;
  P.lathe(0, 0, [[40, 0], [40, th]], 0xf08a24, 71, 10);
  for (let i = 0; i < L; i++) {
    const z = 71 + 12 + i * 16;
    const [cx, cy] = P.p(0, 0, z);
    P.poly([[cx - 30, cy + 8], [cx + 30, cy + 8], [cx + 30, cy + 2], [cx - 30, cy + 2]], 0x1b2238, 0.9, 0);
    for (const dx of [-22, -8, 6, 20]) {
      P.poly([[cx + dx, cy + 8], [cx + dx + 6, cy + 8], [cx + dx + 6, cy + 2], [cx + dx, cy + 2]], 0xfff1a8, 1, 0);
    }
    P.lights.push({ x: cx - P.ox, y: cy + 5 - P.oy, color: 0xffe08a, r: 34 });
  }
  P.dome(0, 0, 40, 30, 0x7fe3ff, 71 + th, 10);
  // Antenna + beacon
  const top = 71 + th + 30;
  P.line(P.p(0, 0, top), P.p(0, 0, top + 40 + L * 4), 0xc9d3e6, 3);
  const [bx, by] = P.p(0, 0, top + 42 + L * 4);
  P.g.fillStyle(L >= 5 ? 0xffc93c : 0xff4d4d, 1);
  P.g.fillCircle(bx, by, 5);
  P.lights.push({ x: bx - P.ox, y: by - P.oy, color: L >= 5 ? 0xffc93c : 0xff4d4d, r: 22 });
  // Front entrance module
  // Roof service units in front of the tower
  P.box(0.78, 0.22, 0.2, 0.2, 9, 0x8c95a6, 71);
  P.box(0.22, 0.78, 0.2, 0.2, 9, 0x8c95a6, 71);
  P.box(0.95, 0.95, 0.55, 0.55, 28, 0x35507a, 7);
  P.faceL(0.95, 0.95, 0.55, 0.55, 0.25, 0.75, 7, 28, 0x1b2238);
  hazardL(P, 0.95, 0.95, 0.55, 0.55, 0.2, 0.8, 29, 33, 6);
  P.light(0.95, 1.25, 20, 0x9be7ff, 24);
  // Entrance ramp, supplies and the outpost flag
  P.box(0.95, 1.31, 0.3, 0.16, 3, 0x8c95a6, 7);
  flag(P, 0.3, 1.3, 46, 0x2f6fd6);
  crate(P, 1.3, 0.3);
  crate(P, 1.3, 0.52, 7, 0x5b8fd6);
  crate(P, 1.31, 0.4, 19, 0xc48a3a, 0.16, 10);
  lamp(P, 0.62, 1.32, 22, 0x9be7ff);
  lamp(P, 1.32, 0.68, 22, 0x9be7ff);
};

const solar: Draw = (P, L, trim) => {
  P.pad(2, trim);
  const slots: [number, number][] = [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]];
  const count = Math.min(4, L + 1);
  const panelColor = L >= 5 ? 0x1d3f8f : 0x1b4fa8;
  // Power cables from each panel to the inverter
  slots.slice(0, count).forEach(([su, sv]) => P.line(P.p(su, sv, 8), P.p(0, 0, 8), 0x1b1f2b, 2.5, 0.85));
  slots.forEach(([su, sv], i) => {
    if (i >= count) {
      P.box(su, sv, 0.25, 0.25, 6, 0x5b6274, 7);
      return;
    }
    P.cylinder(su, sv, 4, 20, 0x9aa5b8, 7, 6);
    const h = 7 + 20;
    const pts: Pt[] = [P.p(su - 0.42, sv - 0.4, h + 22), P.p(su + 0.42, sv - 0.4, h + 22), P.p(su + 0.42, sv + 0.4, h - 6), P.p(su - 0.42, sv + 0.4, h - 6)];
    P.poly(pts, panelColor, 1, 0.9, 0x0b1020, 2);
    // Cell grid
    const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (const t of [0.25, 0.5, 0.75]) P.line(lerp(pts[0], pts[1], t), lerp(pts[3], pts[2], t), 0x6fa8ff, 1, 0.7);
    for (const t of [0.33, 0.66]) P.line(lerp(pts[0], pts[3], t), lerp(pts[1], pts[2], t), 0x6fa8ff, 1, 0.7);
    // Glint
    P.poly([lerp(pts[0], pts[1], 0.1), lerp(pts[0], pts[1], 0.35), lerp(pts[3], pts[2], 0.1)], 0xffffff, 0.22, 0);
    // Frame trim in level colour
    P.g.lineStyle(2, L >= 4 ? LEVEL_TRIM[L - 1] : 0xc9d3e6, 0.9);
    P.g.strokePoints(pts.map(([x, y]) => ({ x, y })), true);
  });
  // Inverter box
  P.box(0, 0, 0.32, 0.32, 18 + L * 2, 0x3a4459, 7);
  P.faceL(0, 0, 0.32, 0.32, 0.2, 0.8, 11, 14, 0xf2b705);
  P.light(0, 0.16, 20, 0x7dff9a, 14);
  // Junction box with status LEDs and a spare panel leaning on it
  P.box(0, 0.84, 0.3, 0.14, 12, 0x5b6274, 7);
  for (const [s, c] of [[0.25, 0x7dff9a], [0.5, 0x7dff9a], [0.75, 0xffc93c]] as const) {
    const [x, y] = P.p(-0.15 + 0.3 * s, 0.91, 14);
    P.g.fillStyle(c, 1).fillCircle(x, y, 1.8);
  }
  P.light(0, 0.91, 14, 0x7dff9a, 10);
  P.poly([P.p(0.84, -0.12, 8), P.p(0.84, 0.16, 8), P.p(0.78, 0.16, 24), P.p(0.78, -0.12, 24)], panelColor, 1, 0.8, 0x0b1020, 1.5);
};

const battery: Draw = (P, L, trim) => {
  P.pad(2, trim);
  const cells: [number, number][] = [[-0.5, -0.45], [0.05, -0.45], [-0.5, 0.2], [0.6, -0.45], [0.05, 0.2], [0.6, 0.2]];
  const count = Math.min(6, L + 1);
  cells.forEach(([u, v], i) => {
    if (i >= count) {
      P.box(u, v, 0.42, 0.5, 5, 0x5b6274, 7);
      return;
    }
    const h = 34 + L * 4;
    P.box(u, v, 0.42, 0.5, h, 0x23a35a, 7, 0x3fdc7c);
    P.faceL(u, v, 0.42, 0.5, 0.15, 0.85, 7 + h * 0.35, 7 + h * 0.55, 0x7dff9a);
    P.light(u, v + 0.25, 7 + h * 0.45, 0x7dff9a, 18);
    P.cylinder(u - 0.08, v - 0.08, 4, 6, 0xc9d3e6, 7 + h, 6);
    P.cylinder(u + 0.1, v + 0.06, 4, 6, 0xff5b5b, 7 + h, 6);
  });
  // Bus cable along the front with a feed to every cell row, and a charge gauge
  pipe(P, P.p(-0.72, 0.6, 10), P.p(0.42, 0.6, 10), 0xff8a3d, 3);
  for (const u of [-0.5, 0.05]) P.line(P.p(u, 0.47, 10), P.p(u, 0.6, 10), 0xff8a3d, 3);
  P.box(-0.62, 0.8, 0.34, 0.14, 16, 0x2b3346, 7);
  for (let k = 0; k < 4; k++) P.faceL(-0.62, 0.8, 0.34, 0.14, 0.1 + k * 0.21, 0.26 + k * 0.21, 11, 20, k < Math.min(4, L) ? 0x7dff9a : 0x3a4459);
  P.light(-0.62, 0.87, 16, 0x7dff9a, 12);
  barrel(P, 0.1, 0.82, 0x3a6ea5);
  // Lightning badge
  const [x, y] = P.p(0.7, 0.75, 9);
  P.poly([[x - 4, y - 14], [x + 6, y - 14], [x + 1, y - 6], [x + 7, y - 6], [x - 5, y + 6], [x - 1, y - 3], [x - 7, y - 3]], 0xffd23f, 1, 0.6);
};

const mine: Draw = (P, L, trim) => {
  P.pad(2, trim);
  // Regolith spoil heap
  P.lathe(-0.5, -0.5, [[40, 0], [30, 16], [16, 30], [0, 38 + L * 3]], 0x9a8f84, 7, 9);
  rock(P, 0.78, -0.72, 9);
  rock(P, 0.86, -0.5, 6, 0x7d7a76);
  // Conveyor
  P.box(-0.1, -0.2, 0.7, 0.16, 6, 0x3a4459, 30);
  // Body
  P.box(0.3, 0.3, 1.0, 0.9, 30, 0xf2b705, 7, 0xffd23f);
  for (let i = 0; i < 6; i++) P.faceL(0.3, 0.3, 1.0, 0.9, i / 6, i / 6 + 0.08, 9, 16, 0x1b1f2b);
  P.windowR(0.3, 0.3, 1.0, 0.9, 0.3, 0.6, 18, 28, 0xffe08a);
  // Derrick
  const base = 37;
  const top = base + 70 + L * 12;
  const legs: [number, number][] = [[-0.05, -0.05], [0.65, -0.05], [0.65, 0.65], [-0.05, 0.65]];
  const apex = P.p(0.3, 0.3, top);
  for (const [u, v] of legs) P.line(P.p(u, v, base), apex, 0x2b2f3a, 4);
  for (const t of [0.35, 0.65]) {
    const ring = legs.map(([u, v]) => P.p(u + (0.3 - u) * t, v + (0.3 - v) * t, base + (top - base) * t));
    P.g.lineStyle(2, 0xf2b705, 1);
    P.g.strokePoints(ring.map(([x, y]) => ({ x, y })), true);
  }
  P.cylinder(0.3, 0.3, 9, top - base - 10, 0x8c95a6, base, 8);
  const [ax, ay] = apex;
  P.g.fillStyle(0xff4d4d, 1);
  P.g.fillCircle(ax, ay - 4, 5);
  P.lights.push({ x: ax - P.ox, y: ay - 4 - P.oy, color: 0xff4d4d, r: 22 });
  // Rails with an ore cart, and a work light
  P.line(P.p(-0.86, 0.22, 8), P.p(-0.3, 0.86, 8), 0x2b2f3a, 2);
  P.line(P.p(-0.78, 0.16, 8), P.p(-0.22, 0.8, 8), 0x2b2f3a, 2);
  P.box(-0.58, 0.52, 0.24, 0.2, 10, 0x5b6274, 9, 0x3a4459);
  P.lathe(-0.58, 0.52, [[9, 0], [5, 6], [0, 8]], 0x9a8f84, 19, 7);
  lamp(P, -0.3, 0.86, 26, 0xffe08a);
  hazardL(P, 0.3, 0.3, 1.0, 0.9, 0, 1, 31, 36, 12);
};

const refinery: Draw = (P, L, trim) => {
  P.pad(2, trim);
  P.cylinder(-0.5, -0.5, 26, 52, 0x8c95a6, 7, 10);
  P.dome(-0.5, -0.5, 26, 12, 0xaab3c4, 59, 10);
  P.box(0.15, 0.2, 1.15, 1.0, 40 + L * 3, 0xb5482e, 7, 0xd8643f);
  const h = 47 + L * 3;
  for (const s of [0.12, 0.42, 0.72]) P.windowL(0.15, 0.2, 1.15, 1.0, s, s + 0.16, 18, 30, 0xffa64d);
  P.windowR(0.15, 0.2, 1.15, 1.0, 0.35, 0.65, 18, 30, 0xffa64d);
  const stacks: [number, number][] = L >= 3 ? [[0.0, -0.05], [0.45, 0.3]] : [[0.3, 0.1]];
  if (L >= 5) stacks.push([-0.15, 0.45]);
  for (const [u, v] of stacks) {
    const sh = 50 + L * 10;
    P.cylinder(u, v, 12, sh, 0x5d6270, h, 8);
    P.lathe(u, v, [[14, 0], [14, 6]], 0xff8a3d, h + sh, 8);
    P.light(u, v, h + sh + 4, 0xff8a3d, 30);
  }
  // Pipe to tank
  pipe(P, P.p(-0.5, -0.25, 40), P.p(-0.2, -0.1, 40), 0xc9d3e6, 5);
  // Tank ladder, pipe run along the wall, fuel drums and a stack of hot ingots
  const [tx, ty] = P.p(-0.5, -0.5, 7);
  ladder(P, tx + 6, ty + 12, 50);
  pipe(P, P.p(-0.4, 0.72, 13), P.p(0.7, 0.72, 13), 0xd8643f, 3);
  barrel(P, -0.74, 0.3, 0xe63946);
  barrel(P, -0.74, 0.52, 0xe63946);
  barrel(P, -0.6, 0.78, 0x3a6ea5);
  for (const [u, v, z] of [[0.8, -0.7, 7], [0.8, -0.56, 7], [0.8, -0.63, 13]] as const) P.box(u, v, 0.16, 0.1, 6, 0xffb347, z, 0xffd58a);
  P.light(0.8, -0.63, 16, 0xff8a3d, 22);
};

const ice: Draw = (P, L, trim) => {
  P.pad(2, trim);
  // Ice crystals
  const crystals: [number, number, number][] = [[-0.55, -0.2, 34], [-0.4, -0.55, 26], [-0.7, 0.2, 22], [-0.2, -0.65, 18]];
  for (const [u, v, h] of crystals) {
    const [x, y] = P.p(u, v, 7);
    P.poly([[x - 9, y], [x, y - h - L * 3], [x + 9, y]], 0xbfefff, 1, 0.6, 0x2a6f9e);
    P.poly([[x - 9, y], [x, y - h - L * 3], [x - 2, y]], 0xffffff, 0.8, 0);
  }
  P.lathe(-0.5, 0.55, [[22, 0], [24, 14], [24, 34], [14, 44], [0, 46]], 0x5fc8ff, 7, 10);
  P.box(0.35, 0.05, 0.85, 0.85, 26, 0x2a6f9e, 7, 0x3d8fc4);
  P.windowL(0.35, 0.05, 0.85, 0.85, 0.2, 0.5, 10, 20);
  P.windowR(0.35, 0.05, 0.85, 0.85, 0.5, 0.8, 10, 20);
  const dh = 50 + L * 10;
  P.cylinder(0.35, 0.05, 15, dh, 0x5fc8ff, 33, 8);
  P.lathe(0.35, 0.05, [[20, 0], [20, 8], [10, 16]], 0xc9d3e6, 33 + dh, 8);
  P.light(0.35, 0.05, 33 + dh + 18, 0x7fe3ff, 26);
  // Hose
  P.line(P.p(-0.15, 0.3, 14), P.p(-0.42, 0.52, 30), 0x1b2238, 4);
  // Frost on the pad, cut ice blocks ready for the oxygen plant, loose crystals
  for (const [u, v, rx] of [[0.1, 0.8, 26], [0.7, 0.62, 18], [-0.8, -0.1, 14]] as const) P.ellipse(u, v, rx, rx / 2, 0xffffff, 0.2, 7);
  for (const [u, v, z] of [[0.4, 0.76, 7], [0.62, 0.76, 7], [0.51, 0.76, 19]] as const) {
    P.box(u, v, 0.2, 0.2, 12, 0x9fdcff, z, 0xdff5ff);
    P.faceL(u, v, 0.2, 0.2, 0.15, 0.45, z + 3, z + 9, 0xffffff, 0.6);
  }
  for (const [u, v, h] of [[0.78, -0.7, 16], [0.66, -0.8, 11]] as const) {
    const [x, y] = P.p(u, v, 7);
    P.poly([[x - 6, y], [x, y - h], [x + 6, y]], 0xbfefff, 1, 0.6, 0x2a6f9e);
  }
};

const oxygen: Draw = (P, L, trim) => {
  P.pad(2, trim);
  P.box(0, 0, 1.6, 1.6, 10, 0x3b4558, 7);
  const tanks: [number, number][] = [[-0.45, -0.45], [0.4, -0.5], [-0.5, 0.4]];
  const count = Math.min(3, 1 + Math.ceil(L / 2));
  const th = 64 + L * 6;
  tanks.slice(0, count).forEach(([u, v]) => {
    P.lathe(u, v, [[22, 0], [24, 8], [24, th - 12], [17, th - 2], [0, th + 4]], 0x17b3a3, 17, 10);
    P.lathe(u, v, [[25, th * 0.45], [25, th * 0.55]], 0xf2f5fa, 17, 10);
  });
  // Feed pipes, valve wheels and a rack of oxygen bottles
  tanks.slice(0, count).forEach(([u, v]) => {
    pipe(P, P.p(u + 0.2, v + 0.2, 24), P.p(0.3, 0.3, 24), 0xf2f5fa, 3);
    const [x, y] = P.p(u, v, 17 + th * 0.28);
    P.g.lineStyle(2, 0xe63946, 1).strokeCircle(x, y + 12, 5);
    P.g.fillStyle(0xe63946, 1).fillCircle(x, y + 12, 1.6);
  });
  for (const dv of [-0.3, -0.16, -0.02]) {
    P.cylinder(0.7, dv, 4, 15, 0xf2f5fa, 17, 7);
    P.dome(0.7, dv, 4, 4, 0x17b3a3, 32, 7);
  }
  // Control unit (front)
  P.box(0.4, 0.4, 0.6, 0.6, 34, 0x2b3346, 17, 0x3b4558);
  P.windowL(0.4, 0.4, 0.6, 0.6, 0.2, 0.8, 12, 24, 0x7dfff0);
  P.windowR(0.4, 0.4, 0.6, 0.6, 0.3, 0.7, 12, 24, 0x7dfff0);
  // O₂ bubbles
  for (const [dx, dy, r] of [[0, -8, 6], [8, -18, 4], [-5, -26, 3]] as const) {
    const [x, y] = P.p(0.4, 0.4, 51);
    P.g.fillStyle(0x7dfff0, 0.9);
    P.g.fillCircle(x + dx, y + dy, r);
  }
};

const greenhouse: Draw = (P, L, trim) => {
  P.pad(2, trim);
  if (L >= 3) {
    P.lathe(-0.55, -0.55, [[34, 0], [34, 6]], 0x6b7487, 7, 10);
    P.dome(-0.55, -0.55, 32, 30 + L * 3, 0x45c46a, 13, 10);
  }
  P.lathe(0.1, 0.1, [[78, 0], [78, 10]], 0x6b7487, 7, 12);
  P.dome(0.1, 0.1, 76, 58 + L * 6, 0x45c46a, 17, 12);
  // Glass highlights and plants
  const [cx, cy] = P.p(0.1, 0.1, 17);
  for (const [dx, dy, r, c] of [[-30, -18, 7, 0x2e8b45], [10, -12, 8, 0x2e8b45], [34, -22, 6, 0x9be15d], [-8, -34, 6, 0x9be15d], [22, -44, 5, 0x2e8b45]] as const) {
    P.g.fillStyle(c, 0.9);
    P.g.fillCircle(cx + dx, cy + dy, r);
  }
  P.g.fillStyle(0xffffff, 0.3);
  P.g.fillEllipse(cx - 30, cy - 48 - L * 3, 26, 12);
  P.lights.push({ x: cx - P.ox, y: cy - 28 - P.oy, color: 0xfff2a8, r: 60 });
  if (L >= 5) P.lathe(0.1, 0.1, [[6, 0], [6, 18]], 0xffc93c, 17 + 58 + L * 6, 6);
  // Glass frame, outdoor planters and an airlock door
  domeRibs(P, 0.1, 0.1, 76, 58 + L * 6, 17);
  for (const [u, v] of [[-0.78, 0.55], [0.6, -0.8]] as const) {
    P.box(u, v, 0.22, 0.3, 6, 0x7a5220, 7, 0x4a3a22);
    for (const dv of [-0.08, 0.02, 0.1]) {
      const [x, y] = P.p(u, v + dv, 14);
      P.g.fillStyle(0x58c46a, 1).fillCircle(x, y, 3.2);
    }
  }
  P.box(0.76, 0.76, 0.3, 0.3, 22, 0xe8edf3, 7, 0xffffff);
  P.faceL(0.76, 0.76, 0.3, 0.3, 0.25, 0.75, 7, 24, 0x2b3346);
  P.light(0.76, 0.93, 26, 0x7dff9a, 12);
};

const habitat: Draw = (P, L, trim, shield) => {
  P.pad(2, trim);
  const moundRings: [number, number][][] = [[], [[96, 0], [90, 18], [78, 26]], [[100, 0], [92, 30], [74, 44]], [[104, 0], [96, 42], [68, 62]]];
  const ringsM = moundRings[shield] ?? [];
  const dh = 56 + L * 6;
  // Mound back half (drawn first)
  if (ringsM.length) drawHalfLathe(P, 0, 0, ringsM, 0x8b8378, 7, 'back');
  P.lathe(0, 0, [[76, 0], [76, 16]], 0xff7a29, 7, 12);
  P.dome(0, 0, 74, dh, 0xf1e3c8, 23, 12);
  // Windows
  const [cx, cy] = P.p(0, 0, 23);
  for (const [dx, dy] of [[-40, -12], [-14, -6], [14, -6], [40, -12]] as const) {
    P.poly([[cx + dx - 6, cy + dy - 12], [cx + dx + 6, cy + dy - 12], [cx + dx + 6, cy + dy], [cx + dx - 6, cy + dy]], 0x2b6cb0, 1, 0.6);
    P.poly([[cx + dx - 4, cy + dy - 10], [cx + dx + 4, cy + dy - 10], [cx + dx + 4, cy + dy - 2], [cx + dx - 4, cy + dy - 2]], 0xfff1a8, 1, 0);
    P.lights.push({ x: cx + dx - P.ox, y: cy + dy - 6 - P.oy, color: 0xffe08a, r: 26 });
  }
  // Orange stripe around the dome
  P.lathe(0, 0, [[70, dh * 0.42], [62, dh * 0.56]], 0xff7a29, 23, 12);
  if (L >= 3) {
    P.cylinder(0, 0, 18, 16 + L * 3, 0xd9cdb4, 23 + dh - 4, 8);
    P.dome(0, 0, 18, 12, L >= 5 ? 0xffc93c : 0x7fe3ff, 23 + dh + 12 + L * 3, 8);
  }
  // Airlock
  P.box(0.72, 0.2, 0.45, 0.5, 32, 0xd9cdb4, 7, 0xeee3cc);
  P.faceR(0.72, 0.2, 0.45, 0.5, 0.25, 0.75, 7, 32, 0x2b3346);
  P.light(0.95, 0.2, 34, 0x7dff9a, 14);
  // Hull seams, a flag on the airlock and a whip antenna
  domeRibs(P, 0, 0, 74, dh, 23, 0x8a7a5c, 0.3);
  flag(P, 0.62, 0.3, 30, 0xff7a29, 39);
  P.line(P.p(0.84, 0.06, 39), P.p(0.84, 0.06, 66), 0xc9d3e6, 1.5);
  if (ringsM.length) drawHalfLathe(P, 0, 0, ringsM, 0x8b8378, 7, 'front');
};

/** Half of a lathe (back or front), so mounds can wrap around a building. */
function drawHalfLathe(P: Painter, u: number, v: number, rings: [number, number][], color: number, z: number, half: 'back' | 'front') {
  const [cx, cy] = P.p(u, v, z);
  const seg = 14;
  const pt = (r: number, h: number, th: number): Pt => [cx + r * Math.cos(th), cy + 0.5 * r * Math.sin(th) - h];
  for (let i = 0; i < rings.length - 1; i++) {
    const [r0, h0] = rings[i];
    const [r1, h1] = rings[i + 1];
    for (let k = 0; k < seg; k++) {
      const t0 = (k / seg) * Math.PI * 2;
      const t1 = ((k + 1) / seg) * Math.PI * 2;
      const mid = (t0 + t1) / 2;
      if ((Math.sin(mid) < 0) !== (half === 'back')) continue;
      const k2 = 0.7 + 0.35 * Math.max(0, Math.cos(mid - Math.PI * 0.8)) + (k % 2) * 0.05;
      P.poly([pt(r0, h0, t0), pt(r0, h0, t1), pt(r1, h1, t1), pt(r1, h1, t0)], shade(color, k2), 1, 0.3);
    }
  }
  // Pebbles on the mound
  if (half === 'front') {
    const [r1, h1] = rings[1];
    for (let k = 0; k < 7; k++) {
      const th = 0.2 + (k / 7) * 2.7;
      const [x, y] = pt(r1 * 0.98, h1 * 0.9, th);
      P.g.fillStyle(0x6e675e, 1);
      P.g.fillCircle(x, y, 3);
    }
  }
}

const storage: Draw = (P, L, trim) => {
  P.pad(2, trim);
  const silos: [number, number][] = [[-0.5, -0.5], [0.45, -0.55], [-0.55, 0.4]];
  const n = L >= 5 ? 3 : L >= 3 ? 2 : 1;
  silos.slice(0, n).forEach(([u, v]) => {
    const h = 70 + L * 8;
    P.cylinder(u, v, 26, h, 0x7b4bc4, 7, 10);
    P.lathe(u, v, [[27, 0], [27, 6]], 0xc9d3e6, 7 + h * 0.6, 10);
    P.dome(u, v, 26, 16, 0x9a6ee0, 7 + h, 10);
  });
  const crates: [number, number, number][] = [[0.35, 0.1, 0], [0.55, 0.55, 0], [0.05, 0.55, 0], [0.4, 0.4, 26]];
  crates.slice(0, Math.min(4, 2 + Math.floor(L / 2))).forEach(([u, v, z]) => {
    P.box(u, v, 0.36, 0.36, 26, 0xc48a3a, 7 + z, 0xe0a85a);
    P.faceL(u, v, 0.36, 0.36, 0.1, 0.9, 7 + z + 11, 7 + z + 15, 0x7a5220);
  });
  // Silo ladder, drums and a small cargo loader
  const [sx, sy] = P.p(-0.5, -0.5, 7);
  ladder(P, sx + 8, sy + 12, 60 + L * 8);
  barrel(P, -0.32, 0.84, 0x3a6ea5);
  barrel(P, -0.12, 0.84, 0xe63946);
  P.box(0.8, -0.2, 0.2, 0.3, 9, 0xff8c2a, 10, 0xffb35c);
  P.box(0.8, -0.3, 0.2, 0.08, 14, 0x2b3346, 10);
  for (const dv of [-0.3, -0.1]) {
    const [x, y] = P.p(0.9, dv, 10);
    P.g.fillStyle(0x1b1f2b, 1).fillCircle(x, y, 4);
  }
};

const builderStation: Draw = (P, L, trim) => {
  P.pad(2, trim);
  const h = 38 + L * 4;
  P.box(-0.05, -0.05, 1.5, 1.35, h, 0xff8c2a, 7, 0xffb35c);
  const bays = Math.min(3, 1 + Math.floor(L / 2));
  for (let i = 0; i < bays; i++) {
    const s0 = 0.08 + i * 0.31;
    P.faceL(-0.05, -0.05, 1.5, 1.35, s0, s0 + 0.24, 7, 7 + h * 0.7, 0x2a2f3d);
    for (let k = 1; k < 4; k++) P.faceL(-0.05, -0.05, 1.5, 1.35, s0, s0 + 0.24, 7 + k * h * 0.17, 7 + k * h * 0.17 + 2, 0x4a5366);
    P.light(-0.05 - 0.75 + 1.5 * (s0 + 0.12), 0.63, 7 + h * 0.8, 0xffe08a, 22);
  }
  P.windowR(-0.05, -0.05, 1.5, 1.35, 0.35, 0.65, h * 0.5, h * 0.75, 0xffe08a);
  // Roof crane
  const z = 7 + h;
  P.cylinder(-0.3, -0.3, 7, 44 + L * 4, 0xf2b705, z, 6);
  const top = P.p(-0.3, -0.3, z + 44 + L * 4);
  const tip = P.p(0.55, -0.3, z + 40 + L * 4);
  P.line(top, tip, 0xf2b705, 5);
  P.line(tip, P.p(0.55, -0.3, z + 10), 0x1b2238, 2);
  P.box(0.55, -0.3, 0.14, 0.14, 8, 0x1b2238, z + 4);
  // Robot icon on the wall
  const [x, y] = P.p(0.7, 0.2, 7 + h * 0.6);
  P.g.fillStyle(0x1b2238, 1);
  P.g.fillCircle(x, y, 7);
  P.g.fillStyle(0x7fe3ff, 1);
  P.g.fillCircle(x - 2.5, y - 1, 1.8);
  P.g.fillCircle(x + 2.5, y - 1, 1.8);
  // Warning band over the bays, tool crates, spare wheels and a charging post
  hazardL(P, -0.05, -0.05, 1.5, 1.35, 0.04, 0.96, 7 + h * 0.72, 7 + h * 0.72 + 5, 16);
  crate(P, 0.3, 0.82, 7, 0x3a6ea5);
  crate(P, 0.5, 0.82);
  for (const dv of [0.1, 0.3]) {
    const [wx, wy] = P.p(0.84, dv, 12);
    P.g.fillStyle(0x1b1f2b, 1).fillEllipse(wx, wy, 13, 16);
    P.g.fillStyle(0x8c95a6, 1).fillEllipse(wx, wy, 5, 6);
  }
  lamp(P, -0.66, 0.84, 24, 0x7fe3ff);
};

const lab: Draw = (P, L, trim) => {
  P.pad(2, trim);
  if (L >= 2) {
    // Dish on a mast (back right)
    P.cylinder(0.55, -0.6, 4, 52 + L * 4, 0x9aa5b8, 7, 6);
    const [x, y] = P.p(0.55, -0.6, 62 + L * 4);
    P.g.fillStyle(0xdfe7f2, 1);
    P.g.fillEllipse(x, y, 44, 28);
    P.g.lineStyle(2, 0x141826, 0.6);
    P.g.strokeEllipse(x, y, 44, 28);
    P.line([x, y], [x + 8, y - 18], 0x9aa5b8, 2);
  }
  P.box(0, 0, 1.45, 1.45, 26, 0x3a6ea5, 7, 0x4f8ad0);
  for (const s of [0.15, 0.45, 0.75]) P.windowL(0, 0, 1.45, 1.45, s - 0.08, s + 0.08, 12, 22);
  P.windowR(0, 0, 1.45, 1.45, 0.4, 0.6, 12, 22);
  P.lathe(0, 0, [[64, 0], [64, 6]], 0xc9d3e6, 33, 12);
  P.dome(0, 0, 60, 42 + L * 5, 0x7fe3ff, 39, 12);
  const [cx, cy] = P.p(0, 0, 39);
  P.g.fillStyle(0xffffff, 0.35);
  P.g.fillEllipse(cx - 22, cy - 26 - L * 2, 22, 10);
  P.lights.push({ x: cx - P.ox, y: cy - 20 - P.oy, color: 0x7fe3ff, r: 50 });
  if (L >= 4) {
    P.cylinder(-0.55, 0.55, 8, 30, 0x8c95a6, 33, 6);
    P.line(P.p(-0.55, 0.55, 63), P.p(-0.3, 0.3, 84), 0xc9d3e6, 6);
  }
  // Dome frame, a roof instrument and sample canisters by the door
  domeRibs(P, 0, 0, 60, 42 + L * 5, 39, 0xffffff, 0.3);
  P.box(0.58, 0.58, 0.16, 0.16, 10, 0xe8edf3, 33);
  P.light(0.58, 0.58, 46, 0x7fe3ff, 12);
  for (const [u, c] of [[0.1, 0x7fe3ff], [0.26, 0xff8a3d], [0.42, 0x7dff9a]] as const) {
    P.cylinder(u, 0.85, 5, 12, 0xdfe7f2, 7, 7);
    P.dome(u, 0.85, 5, 4, c, 19, 7);
  }
};

const spaceport: Draw = (P, L, trim) => {
  P.pad(3, trim);
  // Tower (back left) and fuel tank (back right)
  const th = 70 + L * 10;
  P.box(-1.0, -0.9, 0.55, 0.55, th, 0x5b6f8f, 7, 0x7387a8);
  P.windowL(-1.0, -0.9, 0.55, 0.55, 0.1, 0.9, th - 18, th - 6);
  P.windowR(-1.0, -0.9, 0.55, 0.55, 0.1, 0.9, th - 18, th - 6);
  P.cylinder(0.95, -0.95, 24, 60 + L * 5, 0xe8edf3, 7, 10);
  P.lathe(0.95, -0.95, [[25, 18], [25, 26]], 0xe63946, 7, 10);
  P.dome(0.95, -0.95, 24, 12, 0xc9d3e6, 67 + L * 5, 10);
  // Launch pad
  P.lathe(0, 0, [[118, 0], [118, 10]], 0x3a3f4d, 7, 12);
  const [cx, cy] = P.p(0, 0, 17);
  P.g.lineStyle(4, 0xffc93c, 1);
  P.g.strokeEllipse(cx, cy, 170, 85);
  P.g.lineStyle(6, 0xffc93c, 1);
  P.g.lineBetween(cx - 22, cy - 12, cx - 22, cy + 12);
  P.g.lineBetween(cx + 22, cy - 12, cx + 22, cy + 12);
  P.g.lineBetween(cx - 22, cy, cx + 22, cy);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const x = cx + 108 * Math.cos(a);
    const y = cy + 54 * Math.sin(a);
    P.g.fillStyle(0xff8a3d, 1);
    P.g.fillCircle(x, y, 3);
    P.lights.push({ x: x - P.ox, y: y - P.oy, color: 0xff8a3d, r: 14 });
  }
  // Gantry with cross bracing and a service arm
  const gh = 90 + L * 6;
  P.box(-0.45, 0.75, 0.2, 0.2, gh, 0xe63946, 7);
  for (let zz = 12; zz < gh - 14; zz += 18) {
    P.line(P.p(-0.55, 0.85, zz), P.p(-0.35, 0.85, zz + 14), 0xffffff, 1.5, 0.7);
    P.line(P.p(-0.35, 0.85, zz), P.p(-0.55, 0.85, zz + 14), 0xffffff, 1.5, 0.7);
  }
  pipe(P, P.p(-0.4, 0.7, gh - 4), P.p(-0.1, 0.35, gh - 4), 0xe63946, 4);
  // Fuel line, cargo containers and floodlights
  pipe(P, P.p(0.95, -0.72, 12), P.p(0.6, -0.3, 19), 0xf2f5fa, 3);
  P.box(-1.22, 1.12, 0.3, 0.2, 14, 0x3a6ea5, 7, 0x4f8ad0);
  P.box(-0.98, 1.3, 0.3, 0.2, 14, 0xff8c2a, 7, 0xffb35c);
  P.box(-1.1, 1.2, 0.3, 0.2, 12, 0x45c46a, 21, 0x7be08f);
  lamp(P, 1.3, 0.55, 34, 0xffffff);
  lamp(P, 0.55, 1.3, 34, 0xffffff);
  crate(P, 1.28, 1.05, 7, 0xc48a3a, 0.2, 13);
};

/** Lunar Operations Center: control hall with screens; each level adds an antenna system. */
const opscenter: Draw = (P, L, trim) => {
  P.pad(2, trim);
  // Back: comms mast grows with level
  const mh = 50 + L * 22;
  P.cylinder(-0.55, -0.55, 6, mh, 0x9aa5b8, 7, 6);
  for (let i = 0; i < L; i++) P.lathe(-0.55, -0.55, [[12, 0], [12, 3]], 0xc9d3e6, 7 + mh * (0.35 + i * 0.16), 8);
  const [mx, my] = P.p(-0.55, -0.55, 7 + mh + 6);
  P.g.fillStyle(0xff4d4d, 1).fillCircle(mx, my, 4);
  P.lights.push({ x: mx - P.ox, y: my - P.oy, color: 0xff4d4d, r: 18 });
  // Cable run from the mast, and cooling units beside the hall
  P.line(P.p(-0.55, -0.55, 8), P.p(-0.55, 0.1, 8), 0x1b1f2b, 3, 0.85);
  for (const v of [0.2, 0.5]) {
    P.box(-0.8, v, 0.2, 0.22, 14, 0x8c95a6, 7, 0xaab3c4);
    const [fx, fy] = P.p(-0.8, v, 21);
    P.g.fillStyle(0x2b3346, 1).fillEllipse(fx, fy, 12, 6);
  }
  // Control hall
  P.box(0.1, 0.1, 1.5, 1.3, 34, 0x24324f, 7, 0x2f4166);
  // Wall of screens on the left face
  for (let i = 0; i < 4; i++) {
    const s0 = 0.07 + i * 0.23;
    const c = [0x7fe3ff, 0x3fdc7c, 0xffc93c, 0x7fe3ff][i];
    P.windowL(0.1, 0.1, 1.5, 1.3, s0, s0 + 0.18, 14, 30, i < L ? c : 0x1b2238);
  }
  P.windowR(0.1, 0.1, 1.5, 1.3, 0.25, 0.75, 16, 28, 0x7fe3ff);
  // Roof: main dish (all levels), extra dishes from level 2, radome at 3, beacon ring at 4
  const z = 41;
  const dish = (u: number, v: number, r: number, h: number) => {
    P.cylinder(u, v, 4, h, 0x9aa5b8, z, 6);
    const [x, y] = P.p(u, v, z + h);
    P.g.fillStyle(0xdfe7f2, 1).fillEllipse(x, y, r * 2, r * 1.3);
    P.g.lineStyle(2, 0x141826, 0.6).strokeEllipse(x, y, r * 2, r * 1.3);
    P.g.fillStyle(0x9aa5b8, 1).fillEllipse(x, y, r * 0.6, r * 0.4);
    P.line([x, y], [x + r * 0.4, y - r * 0.8], 0x9aa5b8, 2);
  };
  dish(0.35, -0.2, 30, 24);
  if (L >= 2) dish(-0.25, 0.45, 18, 14);
  if (L >= 3) P.dome(0.45, 0.5, 18, 22, 0xe8edf3, z, 10);
  if (L >= 4) {
    // Gold command ring around the roof edge (an outline, so the roof stays visible)
    const [rx, ry] = P.p(0.1, 0.1, z + 2);
    P.g.lineStyle(4, 0xffc93c, 1).strokeEllipse(rx, ry, 150, 75);
    P.lights.push({ x: rx - P.ox, y: ry + 30 - P.oy, color: 0xffc93c, r: 30 });
    dish(-0.55, 0.0, 14, 30);
  }
  P.light(0.1, 0.75, 22, 0x7fe3ff, 40);
  // Status board by the entrance and a marker light
  P.line(P.p(0.5, 0.88, 7), P.p(0.5, 0.88, 20), 0x8c95a6, 2);
  P.box(0.5, 0.88, 0.3, 0.04, 12, 0x1b2238, 20);
  P.faceL(0.5, 0.88, 0.3, 0.04, 0.1, 0.9, 22, 30, 0x7fe3ff);
  P.light(0.5, 0.9, 26, 0x7fe3ff, 14);
  lamp(P, -0.5, 0.86, 20, 0x3fdc7c);
};

/** Lunar Monitoring Station: instrument mast with sensor head; each level adds instruments. */
const monitor: Draw = (P, L, trim) => {
  P.pad(1, trim);
  // Small solar panel on the back
  const pts: [number, number][] = [P.p(-0.35, -0.38, 30), P.p(0.05, -0.38, 30), P.p(0.05, -0.08, 14), P.p(-0.35, -0.08, 14)];
  P.cylinder(-0.15, -0.23, 2, 18, 0x9aa5b8, 7, 5);
  P.poly(pts, 0x1b4fa8, 1, 0.9, 0x0b1020, 1.5);
  // Electronics box
  P.box(0.1, 0.12, 0.38, 0.34, 18, 0xe8edf3, 7, 0xffffff);
  P.faceL(0.1, 0.12, 0.38, 0.34, 0.2, 0.8, 11, 15, 0xff7a29);
  // Mast + sensor head
  const h = 46 + L * 14;
  P.cylinder(0.1, 0.12, 3.5, h, 0x9aa5b8, 25, 6);
  P.lathe(0.1, 0.12, [[10, 0], [10, 6], [6, 12]], 0xf2b705, 25 + h, 8);
  P.dome(0.1, 0.12, 7, 8, 0x7fe3ff, 25 + h + 12, 8);
  const [hx, hy] = P.p(0.1, 0.12, 25 + h + 16);
  P.lights.push({ x: hx - P.ox, y: hy - P.oy, color: 0x7fe3ff, r: 20 });
  // Guy wires hold the mast, with a little rock for scale
  for (const [u, v] of [[-0.36, 0.36], [0.38, 0.38], [0.38, -0.34]] as const) P.line(P.p(0.1, 0.12, 25 + h * 0.8), P.p(u, v, 7), 0xc9d3e6, 1, 0.6);
  rock(P, -0.28, 0.3, 5);
  // Level 2: radiation detector boom; 3: thermometer probe; 4: second antenna
  if (L >= 2) {
    P.line(P.p(0.1, 0.12, 25 + h * 0.6), P.p(0.4, -0.1, 25 + h * 0.6), 0x9aa5b8, 2);
    P.box(0.42, -0.12, 0.12, 0.12, 8, 0xffc93c, 25 + h * 0.6 - 4);
  }
  if (L >= 3) {
    P.line(P.p(0.1, 0.12, 25 + h * 0.35), P.p(-0.2, 0.35, 25 + h * 0.35), 0x9aa5b8, 2);
    P.cylinder(-0.22, 0.37, 3, 10, 0xff4d4d, 25 + h * 0.35 - 5, 5);
  }
  if (L >= 4) {
    P.line(P.p(0.1, 0.12, 25 + h), P.p(0.3, 0.05, 25 + h + 30), 0xc9d3e6, 2);
    const [ax, ay] = P.p(0.3, 0.05, 25 + h + 30);
    P.g.fillStyle(0xffc93c, 1).fillCircle(ax, ay, 3);
  }
};

const DRAW: Record<BuildingType, Draw> = { command, solar, battery, mine, refinery, ice, oxygen, greenhouse, habitat, storage, builderStation, lab, spaceport, opscenter, monitor };

function bake(scene: Phaser.Scene, key: string, n: number, top: number, draw: (P: Painter) => void) {
  const w = n * 128 + 60;
  const bottom = n * 32 + 26;
  const g = scene.add.graphics();
  const P = new Painter(g, w / 2, top);
  draw(P);
  g.generateTexture(key, w, top + bottom);
  g.destroy();
  TEX.set(key, { key, originY: top / (top + bottom), top, lights: P.lights });
}

/** Generate all building textures (13 types × 5 levels + shielded habitats + props). */
export function generateBuildingTextures(scene: Phaser.Scene) {
  for (const type of Object.keys(DRAW) as BuildingType[]) {
    const n = BUILDINGS[type].size;
    for (let L = 1; L <= maxLevelOf(type); L++) {
      bake(scene, texKey(type, L), n, TOP[type], (P) => DRAW[type](P, L, LEVEL_TRIM[L - 1], 0));
      if (type === 'habitat') {
        for (let s = 1; s <= 3; s++) bake(scene, texKey(type, L, s), n, TOP[type], (P) => DRAW[type](P, L, LEVEL_TRIM[L - 1], s));
      }
    }
  }
  for (const n of [1, 2, 3]) {
    // Construction site: dirt pad with scaffolding.
    bake(scene, `site_${n}`, n, 160, (P) => {
      P.ellipse(0.2, 0.2, n * 60, n * 30, 0x000000, 0.25);
      P.box(0, 0, n - 0.12, n - 0.12, 5, 0x6e675e, 0, 0x857c70);
      P.box(-n / 4, n / 4, 0.3, 0.3, 14, 0xc48a3a, 5);
      P.lathe(n / 4, -n / 4, [[18, 0], [10, 10], [0, 16]], 0x9a8f84, 5, 8);
      // Traffic cones
      for (const [u, v] of [[-n / 2 + 0.15, -n / 2 + 0.15], [n / 2 - 0.15, n / 2 - 0.15]] as const) {
        P.lathe(u, v, [[7, 0], [2, 18], [0, 19]], 0xff7a29, 5, 6);
      }
    });
    bake(scene, `scaffold_${n}`, n, 220, (P) => {
      const half = n / 2 - 0.1;
      const h = n === 3 ? 150 : n === 2 ? 110 : 80;
      const corners: [number, number][] = [[-half, -half], [half, -half], [half, half], [-half, half]];
      const ring = (z: number) => corners.map(([u, v]) => P.p(u, v, z));
      for (const [u, v] of corners) P.line(P.p(u, v, 5), P.p(u, v, h), 0xffb000, 4);
      for (const z of [h * 0.33, h * 0.66, h]) {
        P.g.lineStyle(3, 0xffb000, 1);
        P.g.strokePoints(ring(z).map(([x, y]) => ({ x, y })), true);
      }
      P.line(P.p(-half, half, 5), P.p(half, half, h * 0.66), 0xffd23f, 2);
      P.line(P.p(half, half, 5), P.p(half, -half, h * 0.66), 0xffd23f, 2);
      P.flat(0, 0, n - 0.3, n - 0.3, h * 0.66, 0xc48a3a, 0.5, 0.3);
    });
  }
}
