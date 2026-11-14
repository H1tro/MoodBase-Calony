import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyId } from '../config/difficulty';
import { DAY_NIGHT, MAP_SIZE } from '../config/balance';
import { timeFor, type BuildingType } from '../config/buildings';
import { createInitialState, type GameState } from './state';
import { advance, tick } from './simulation';
import { startBuild, startUpgrade } from './construction';
import { buildTimeMult, checkPlacement, dayLength, freeBuilder, isDay, sunlight } from './selectors';
import { getTerrain } from './terrain';
import { deserialize, serialize } from './save';

const SEED = 20261114;

function spot(s: GameState, type: BuildingType) {
  let first: { x: number; y: number } | null = null;
  for (let y = 0; y < MAP_SIZE; y++)
    for (let x = 0; x < MAP_SIZE; x++) {
      if (!checkPlacement(s, type, x, y).ok) continue;
      first ??= { x, y };
      // A careful player puts mines on ore-rich ground.
      if (type !== 'mine') return first;
      const terrain = getTerrain(s.seed, s.difficulty);
      const ore = [0, 1].flatMap((dy) => [0, 1].map((dx) => terrain.tiles[(y + dy) * MAP_SIZE + x + dx])).filter((k) => k === 'ore').length;
      if (ore >= 2) return { x, y };
    }
  return first;
}

const count = (id: DifficultyId, kind: 'ice' | 'ore') => getTerrain(SEED, id).tiles.filter((t) => t === kind).length;

describe('difficulty: resource generation', () => {
  it('deposits shrink from Easy to Impossible, but every mineral type stays available', () => {
    const ice = DIFFICULTY_ORDER.map((d) => count(d, 'ice'));
    const ore = DIFFICULTY_ORDER.map((d) => count(d, 'ore'));
    for (let i = 1; i < 4; i++) {
      expect(ice[i]).toBeLessThan(ice[i - 1]);
      expect(ore[i]).toBeLessThan(ore[i - 1]);
    }
    for (const d of DIFFICULTY_ORDER) {
      expect(count(d, 'ice')).toBeGreaterThan(0);
      expect(count(d, 'ore')).toBeGreaterThan(0);
      expect(spot(createInitialState(SEED, d), 'ice')).not.toBeNull(); // ice is always reachable
    }
  });

  it('Medium keeps the original map layout', () => {
    expect(getTerrain(SEED)).toBe(getTerrain(SEED, 'medium'));
  });

  it('yields are per resource, not one flat multiplier (rare titanium scales hardest)', () => {
    expect(DIFFICULTIES.easy.yields.titanium).toBeGreaterThan(DIFFICULTIES.easy.yields.ice);
    expect(DIFFICULTIES.impossible.yields.titanium).toBeLessThan(DIFFICULTIES.impossible.yields.ice);
  });

  it('starting materials fall from Easy to Impossible', () => {
    const r = DIFFICULTY_ORDER.map((d) => createInitialState(SEED, d).res.regolith);
    expect(r).toEqual([...r].sort((a, b) => b - a));
  });
});

describe('difficulty: day and night', () => {
  const expected: Record<DifficultyId, number> = { easy: 0.7, medium: 0.55, hard: 0.5, impossible: 0.35 };
  for (const d of DIFFICULTY_ORDER) {
    it(`${d}: daylight is ${Math.round(expected[d] * 100)}% of the cycle, with smooth dusk`, () => {
      const s = createInitialState(SEED, d);
      expect(dayLength(s) / DAY_NIGHT.cycle).toBeCloseTo(expected[d]);
      let dayTicks = 0;
      const steps = DAY_NIGHT.cycle * 4;
      for (let i = 0; i < steps; i++) {
        s.time = i / 4;
        if (isDay(s)) dayTicks++;
      }
      expect(dayTicks / steps).toBeCloseTo(expected[d], 2);
      s.time = dayLength(s) - 3;
      expect(sunlight(s)).toBeGreaterThan(0);
      expect(sunlight(s)).toBeLessThan(1);
    });
  }
});

describe('difficulty: build and upgrade speed', () => {
  const durations: Record<DifficultyId, number> = { easy: 66.7, medium: 100, hard: 133.3, impossible: 153.8 };
  for (const d of DIFFICULTY_ORDER) {
    it(`${d}: a 100 s job takes about ${durations[d]} s`, () => {
      const s = createInitialState(SEED, d);
      expect(100 * buildTimeMult(s)).toBeCloseTo(durations[d], 0);
      s.res = { regolith: 5000, titanium: 500, ice: 500, credits: 5000 };
      const cc = s.buildings[0];
      expect(startUpgrade(s, cc.id).ok).toBe(true);
      expect(cc.job!.end - cc.job!.start).toBeCloseTo(timeFor('command', 2) / DIFFICULTIES[d].upgradeSpeed, 5);
    });
  }
});

describe('difficulty: solar', () => {
  it('Impossible solar farms produce exactly 1.20× the Medium output', () => {
    const out: Record<string, number> = {};
    for (const d of ['medium', 'impossible'] as DifficultyId[]) {
      const s = createInitialState(SEED, d);
      s.res.regolith = 1000;
      const p = spot(s, 'solar')!;
      startBuild(s, 'solar', p.x, p.y);
      advance(s, 25, 0.25);
      s.time = DAY_NIGHT.cycle + 60; // full daylight on every difficulty
      // Compare clean, undamaged panels so only the difficulty multiplier differs.
      for (const b of s.buildings) { b.dust = 0; b.condition = 100; }
      tick(s, 0.25);
      out[d] = s.flows.powerProd;
    }
    expect(out.medium).toBeGreaterThan(0);
    expect(out.impossible / out.medium).toBeCloseTo(1.2, 5);
  });
});

describe('difficulty: saving', () => {
  it('difficulty survives save and load', () => {
    for (const d of DIFFICULTY_ORDER) expect(deserialize(serialize(createInitialState(SEED, d)))!.difficulty).toBe(d);
  });

  it('old saves without a difficulty load as Medium', () => {
    const raw = JSON.parse(serialize(createInitialState(SEED, 'hard')));
    delete raw.difficulty;
    expect(deserialize(JSON.stringify(raw))!.difficulty).toBe('medium');
  });

  it('an unknown difficulty value falls back to Medium', () => {
    const raw = JSON.parse(serialize(createInitialState(SEED, 'easy')));
    raw.difficulty = 'nightmare';
    expect(deserialize(JSON.stringify(raw))!.difficulty).toBe('medium');
  });
});

/** A careful player: power, storage and life support first; non-essentials off at night. */
function playFirstNight(d: DifficultyId, order: BuildingType[]) {
  const s = createInitialState(SEED, d);
  s.scienceQueue = [];
  const queue = [...order];
  let minBattery = Infinity;
  while (s.time < DAY_NIGHT.cycle + 30 && !s.failed) {
    const next = queue[0];
    if (next && freeBuilder(s) !== null) {
      const p = spot(s, next);
      if (p && startBuild(s, next, p.x, p.y).ok) queue.shift();
    }
    const night = !isDay(s);
    for (const b of s.buildings) {
      if (b.level === 0) continue;
      if (b.type === 'mine' || b.type === 'ice' || b.type === 'greenhouse') b.enabled = !night;
      if (b.type === 'oxygen') b.enabled = !night || s.life.o2 < 15;
    }
    tick(s, 0.25);
    if (night) minBattery = Math.min(minBattery, s.battery);
  }
  return { s, minBattery };
}

describe('difficulty: survival balance', () => {
  // Storage before the first night; the starting O₂ reserve covers the crew until the generator is running.
  const order: BuildingType[] = ['mine', 'solar', 'battery', 'solar', 'ice', 'oxygen', 'battery', 'solar', 'habitat', 'greenhouse'];
  const results = Object.fromEntries(DIFFICULTY_ORDER.map((d) => [d, playFirstNight(d, order)]));
  for (const d of DIFFICULTY_ORDER) {
    it(`${d}: a careful player survives the first night`, () => {
      const { s } = results[d];
      expect(s.failed).toBeNull();
      expect(s.stats.nightsSurvived).toBe(1);
    });
  }
  it('the long Impossible night drains the batteries much deeper than Easy', () => {
    expect(results.impossible.minBattery).toBeLessThan(results.easy.minBattery);
  });
});
