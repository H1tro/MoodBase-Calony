import { MAP_SIZE } from '../config/balance';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type DifficultyId } from '../config/difficulty';
import { makeRng } from '../../utils/rng';

export type TileKind = 'ground' | 'crater' | 'ice' | 'ore' | 'boulder';

export interface Terrain {
  tiles: TileKind[]; // index = y * MAP_SIZE + x
  craters: { x: number; y: number; r: number }[]; // blocking craters, tile units
  smallCraters: { x: number; y: number; r: number }[]; // decorative only
  pebbles: { x: number; y: number; s: number }[];
}

export const CC_POS = { x: 9, y: 9 };

const cache = new Map<string, Terrain>();

/**
 * Candidate deposit sites in priority order. A difficulty takes the first N of
 * each list, so harder levels keep the deposits nearest the base and lose the
 * outlying ones. (Medium uses the first 4 of each = the original layout.)
 */
const ICE_SITES: [number, number, number][] = [[4.5, 14, 1.4], [14, 4, 1.3], [5, 6, 1.1], [18, 14, 1.2], [11, 1.5, 1.2], [1.5, 18, 1.3]];
const ORE_SITES: [number, number, number][] = [[14.5, 10.5, 1.4], [3, 3, 1.3], [9, 16, 1.2], [17.5, 1.5, 1.2], [6.5, 10.5, 1.1], [15, 15, 1.2]];

/** Deterministic terrain from a seed and difficulty. Shared by the simulation (placement rules) and the art. */
export function getTerrain(seed: number, difficulty: DifficultyId = DEFAULT_DIFFICULTY): Terrain {
  const key = `${seed}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const dep = DIFFICULTIES[difficulty].deposits;
  const rng = makeRng(seed);
  const tiles: TileKind[] = new Array(MAP_SIZE * MAP_SIZE).fill('ground');
  const jitter = () => Math.round(rng() * 2 - 1);
  const inCore = (x: number, y: number) => x >= CC_POS.x - 2 && x <= CC_POS.x + 4 && y >= CC_POS.y - 2 && y <= CC_POS.y + 4;
  const paint = (cx: number, cy: number, r: number, kind: TileKind) => {
    for (let y = 0; y < MAP_SIZE; y++)
      for (let x = 0; x < MAP_SIZE; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r && !inCore(x, y) && tiles[y * MAP_SIZE + x] === 'ground') tiles[y * MAP_SIZE + x] = kind;
      }
  };

  const craters: Terrain['craters'] = [];
  for (const [cx, cy, r] of [[2, 9, 1.5], [12, 16.5, 1.3], [17, 7.5, 1.6], [8, 2.5, 1.2], [16.5, 17, 1.1]] as const) {
    const c = { x: cx + jitter() * 0.5, y: cy + jitter() * 0.5, r };
    craters.push(c);
    paint(c.x, c.y, c.r, 'crater');
  }
  // Ice sits near crater rims (cold traps); one patch is close to the base.
  for (const [cx, cy, r] of ICE_SITES.slice(0, dep.ice)) paint(cx + jitter(), cy + jitter(), r * dep.size, 'ice');
  for (const [cx, cy, r] of ORE_SITES.slice(0, dep.ore)) paint(cx + jitter(), cy + jitter(), r * dep.size, 'ore');

  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rng() * MAP_SIZE);
    const y = Math.floor(rng() * MAP_SIZE);
    if (!inCore(x, y) && tiles[y * MAP_SIZE + x] === 'ground') tiles[y * MAP_SIZE + x] = 'boulder';
  }

  const smallCraters: Terrain['smallCraters'] = [];
  for (let i = 0; i < 40; i++) smallCraters.push({ x: rng() * MAP_SIZE, y: rng() * MAP_SIZE, r: 0.12 + rng() * 0.35 });
  const pebbles: Terrain['pebbles'] = [];
  for (let i = 0; i < 260; i++) pebbles.push({ x: rng() * MAP_SIZE, y: rng() * MAP_SIZE, s: 0.6 + rng() * 1.8 });

  const t = { tiles, craters, smallCraters, pebbles };
  cache.set(key, t);
  return t;
}

export function tileAt(t: Terrain, x: number, y: number): TileKind | null {
  if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return null;
  return t.tiles[y * MAP_SIZE + x];
}
