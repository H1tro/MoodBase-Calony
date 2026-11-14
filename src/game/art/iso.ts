import { MAP_SIZE } from '../config/balance';

export const TW = 128;
export const TH = 64;
export const HW = TW / 2;
export const HH = TH / 2;
/** Extra ground drawn around the playable map. */
export const BORDER = 7;
export const ORIGIN_X = (MAP_SIZE + BORDER) * HW + 200;
export const ORIGIN_Y = BORDER * TH + 260;
export const WORLD_W = ORIGIN_X * 2;
export const WORLD_H = ORIGIN_Y + (MAP_SIZE + BORDER) * TH + 200;

/** Screen position of the top corner of tile (x, y). Works for fractional tiles. */
export function tileTop(x: number, y: number) {
  return { x: ORIGIN_X + (x - y) * HW, y: ORIGIN_Y + (x + y) * HH };
}

/** Screen position of the centre of a size×size footprint starting at (x, y). */
export function footprintCenter(x: number, y: number, size: number) {
  const t = tileTop(x, y);
  return { x: t.x, y: t.y + size * HH };
}

export function worldToTile(wx: number, wy: number) {
  const dx = (wx - ORIGIN_X) / HW;
  const dy = (wy - ORIGIN_Y) / HH;
  return { x: Math.floor((dy + dx) / 2), y: Math.floor((dy - dx) / 2) };
}

// ---- colour helpers ----
export function shade(color: number, k: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((color & 255) * k)));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
