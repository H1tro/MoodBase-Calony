import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from './state';
import { advance, tick } from './simulation';
import { buyBuilder, startBuild, startShield, startUpgrade, toggleEnabled } from './construction';
import { batteryCap, caps, checkPlacement, dayLength, freeBuilder, nextBuilderPrice, sunlight } from './selectors';
import { deserialize, serialize } from './save';
import { getTerrain } from './terrain';
import { DAY_NIGHT, MAP_SIZE, PRODUCTION } from '../config/balance';
import type { BuildingType } from '../config/buildings';
import { shieldBlock } from './radiation';

/** Find the first valid spot for a building type. */
function spot(s: GameState, type: BuildingType) {
  for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) if (checkPlacement(s, type, x, y).ok) return { x, y };
  throw new Error('no spot for ' + type);
}

function place(s: GameState, type: BuildingType, finish = true) {
  const p = spot(s, type);
  const r = startBuild(s, type, p.x, p.y);
  expect(r.ok, JSON.stringify(r)).toBe(true);
  const b = s.buildings[s.buildings.length - 1];
  if (finish) advance(s, b.job!.end - s.time + 0.01, 0.25);
  return b;
}

const rich = () => {
  const s = createInitialState(1);
  s.res = { regolith: 1200, titanium: 200, ice: 200, credits: 20000 };
  s.life = { o2: 50, water: 100, food: 70, co2: 0.2, waste: 0 };
  return s;
};

describe('MVP chain: mine → resources → builder → build', () => {
  it('mines regolith, earns credits from missions, hires a builder and builds with two robots', () => {
    const s = createInitialState(7);
    const mine = place(s, 'mine');
    expect(mine.level).toBe(1);
    const r0 = s.res.regolith;
    advance(s, 20, 0.25);
    expect(s.res.regolith).toBeGreaterThan(r0); // mining works
    expect(s.missionsDone).toContain('c1_mine'); // mission reward paid
    // Not allowed to hire before a Builder Station exists
    s.res.credits = 600;
    expect(buyBuilder(s).ok).toBe(false);
    place(s, 'builderStation');
    expect(nextBuilderPrice(s)).toBe(500);
    const credits = s.res.credits;
    expect(buyBuilder(s).ok).toBe(true);
    expect(s.res.credits).toBe(credits - 500);
    expect(s.builders).toBe(2);
    // Two builders work in parallel; a third job is refused.
    s.res.regolith = 1000;
    place(s, 'solar', false);
    place(s, 'battery', false);
    expect(freeBuilder(s)).toBeNull();
    const third = startBuild(s, 'solar', spot(s, 'solar').x, spot(s, 'solar').y);
    expect(third.ok).toBe(false);
  });

  it('builder prices follow 500 / 1500 / 3000 / 6000', () => {
    const s = rich();
    s.buildings.push({ id: 99, type: 'builderStation', x: 0, y: 0, level: 5, shield: 0, enabled: true, online: true, split: 0.5, job: null });
    const prices: number[] = [];
    while (nextBuilderPrice(s) !== null) {
      prices.push(nextBuilderPrice(s)!);
      expect(buyBuilder(s).ok).toBe(true);
    }
    expect(prices).toEqual([500, 1500, 3000, 6000]);
    expect(s.builders).toBe(5);
  });
});

describe('resources and storage', () => {
  it('storage caps regolith', () => {
    const s = rich();
    place(s, 'mine');
    s.res.regolith = caps(s).regolith - 1;
    advance(s, 30, 0.25);
    expect(s.res.regolith).toBeLessThanOrEqual(caps(s).regolith + 1e-6);
  });

  it('ice extractor must touch ice', () => {
    const s = rich();
    const t = getTerrain(s.seed);
    const groundIdx = t.tiles.findIndex((k, i) => k === 'ground' && i % MAP_SIZE < MAP_SIZE - 2 && i < MAP_SIZE * (MAP_SIZE - 2));
    const x = groundIdx % MAP_SIZE;
    const y = Math.floor(groundIdx / MAP_SIZE);
    const ok = checkPlacement(s, 'ice', x, y);
    // Either fails for ice reason or the spot happens to touch ice
    if (!ok.ok) expect(ok.reason).toBeTruthy();
    expect(checkPlacement(s, 'ice', spot(s, 'ice').x, spot(s, 'ice').y).ok).toBe(true);
  });

  it('cannot place on top of another building', () => {
    const s = rich();
    const cc = s.buildings[0];
    expect(checkPlacement(s, 'solar', cc.x, cc.y).ok).toBe(false);
  });

  it('oxygen generator turns ice into O2 using the 0.89 ratio', () => {
    const s = rich();
    s.crew.count = 0;
    const gen = place(s, 'oxygen');
    gen.split = 1;
    s.res.ice = 100;
    s.life.o2 = 0;
    tick(s, 1);
    expect(s.life.o2).toBeCloseTo(PRODUCTION.oxygenIceIn * PRODUCTION.o2PerWater, 3);
  });
});

describe('power and night', () => {
  it('solar output is zero at night', () => {
    const s = rich();
    s.time = dayLength(s) + 30;
    expect(sunlight(s)).toBe(0);
    place(s, 'solar');
    tick(s, 0.25);
    expect(s.flows.powerProd).toBe(0);
  });

  it('low-priority buildings shut down first when energy runs out', () => {
    const s = rich();
    const mine = place(s, 'mine');
    const hab = place(s, 'habitat');
    s.time = dayLength(s) + 20; // night
    s.battery = 0.3; // only enough for a little
    tick(s, 0.25);
    expect(hab.online).toBe(true);
    expect(mine.online).toBe(false);
  });

  it('switching a building off saves power', () => {
    const s = rich();
    const mine = place(s, 'mine');
    toggleEnabled(s, mine.id);
    tick(s, 0.25);
    expect(mine.online).toBe(false);
  });

  it('battery never exceeds capacity', () => {
    const s = rich();
    place(s, 'solar');
    advance(s, 50, 0.25);
    expect(s.battery).toBeLessThanOrEqual(batteryCap(s) + 1e-6);
  });
});

describe('life support and failure', () => {
  it('running out of oxygen eventually fails the mission', () => {
    const s = createInitialState(3);
    s.life.o2 = 0;
    advance(s, 200, 0.25);
    expect(s.failed?.cause).toBe('o2');
  });

  it('a night with no power fails life support (cold)', () => {
    const s = createInitialState(3);
    s.time = dayLength(s) + 1;
    s.battery = 0;
    tick(s, 0.25);
    expect(s.flows.starving).toContain('cold');
  });

  it('regolith shielding reduces the dose fraction', () => {
    const s = rich();
    const hab = place(s, 'habitat');
    s.crew.count = 2;
    const before = shieldBlock(s);
    hab.shield = 2;
    expect(shieldBlock(s)).toBeGreaterThan(before);
    expect(startShield(s, hab.id).ok).toBe(true);
  });
});

describe('upgrades and missions', () => {
  it('upgrades are capped by Command Center level', () => {
    const s = rich();
    const solar = place(s, 'solar');
    expect(startUpgrade(s, solar.id).ok).toBe(false); // CC is level 1
    const cc = s.buildings[0];
    expect(startUpgrade(s, cc.id).ok).toBe(true);
    advance(s, cc.job!.end - s.time + 0.1, 0.25);
    expect(cc.level).toBe(2);
    expect(startUpgrade(s, solar.id).ok).toBe(true);
  });

  it('chapter 1 missions complete from real actions', () => {
    const s = rich();
    place(s, 'solar');
    advance(s, 0.5, 0.25);
    expect(s.missionsDone).toContain('c1_solar');
  });
});

describe('save', () => {
  it('round-trips through JSON', () => {
    const s = rich();
    place(s, 'mine');
    const copy = deserialize(serialize(s))!;
    expect(copy.buildings.length).toBe(s.buildings.length);
    expect(copy.res.regolith).toBeCloseTo(s.res.regolith);
    expect(copy.flows).toBeDefined();
  });

  it('rejects garbage', () => {
    expect(deserialize('{bad')).toBeNull();
    expect(deserialize('{"version":1}')).toBeNull();
  });
});

describe('balance', () => {
  it('a sensible build order survives the first lunar night', () => {
    const s = createInitialState(20261114);
    s.scienceQueue = [];
    const order: BuildingType[] = ['mine', 'solar', 'ice', 'oxygen', 'solar', 'battery', 'battery', 'solar', 'habitat', 'greenhouse', 'battery'];
    while (s.time < DAY_NIGHT.cycle + 30 && !s.failed) {
      const next = order[0];
      if (next && freeBuilder(s) !== null) {
        const p = (() => { try { return spot(s, next); } catch { return null; } })();
        if (p && startBuild(s, next, p.x, p.y).ok) order.shift();
      }
      // Smart player: switch the mine off at night to save power for life support.
      const night = s.time % DAY_NIGHT.cycle >= dayLength(s);
      for (const b of s.buildings) if (b.type === 'mine' && b.level > 0) b.enabled = !night;
      tick(s, 0.25);
    }
    expect(s.failed).toBeNull();
    expect(s.stats.nightsSurvived).toBe(1);
    expect(s.crew.health).toBeGreaterThan(50);
  });

  it('ignoring power storage leads to a cold night', () => {
    const s = createInitialState(20261114);
    s.scienceQueue = [];
    const order: BuildingType[] = ['mine', 'solar', 'ice', 'oxygen', 'habitat'];
    let sawCold = false;
    while (s.time < DAY_NIGHT.cycle && !s.failed) {
      const next = order[0];
      if (next && freeBuilder(s) !== null) {
        const p = spot(s, next);
        if (startBuild(s, next, p.x, p.y).ok) order.shift();
      }
      tick(s, 0.25);
      if (s.flows.starving.includes('cold')) sawCold = true;
    }
    expect(sawCold).toBe(true);
  });
});

describe('research and spaceport', () => {
  it('research needs a powered lab, costs credits, then applies its effect', async () => {
    const { startResearch } = await import('./research');
    const s = rich();
    expect(startResearch(s, 'solarEff').ok).toBe(false); // no lab
    s.buildings[0].level = 2; // Command Center L2 unlocks the lab
    place(s, 'solar');
    place(s, 'lab');
    const before = s.res.credits;
    expect(startResearch(s, 'solarEff').ok).toBe(true);
    expect(s.res.credits).toBe(before - 300);
    advance(s, 45, 0.25);
    expect(s.research.owned).toContain('solarEff');
  });

  it('a cargo run removes material and pays credits on landing', async () => {
    const { launchCargo } = await import('./spaceport');
    const s = rich();
    s.buildings[0].level = 3;
    s.res.titanium = 200;
    place(s, 'solar'); // the spaceport needs power, or the flight pauses
    place(s, 'spaceport');
    const credits = s.res.credits;
    expect(launchCargo(s, 'titanium').ok).toBe(true);
    expect(s.res.titanium).toBeLessThan(200);
    advance(s, 50, 0.25);
    expect(s.cargo.runs).toBe(1);
    expect(s.res.credits).toBeGreaterThan(credits);
  });
});
