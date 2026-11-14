import { describe, expect, it } from 'vitest';
import { createInitialState, type Building, type GameState } from './state';
import { advance, tick } from './simulation';
import { canStartBuild, canUpgrade, startUpgrade } from './construction';
import { capacity, connect, flareWarningBonus, networkStatus } from './monitoring';
import { deserialize, serialize } from './save';
import { MONITORING } from '../config/monitoring';
import { timeFor, type BuildingType } from '../config/buildings';
import { DIFFICULTIES } from '../config/difficulty';

let nextId = 100;
function add(s: GameState, type: BuildingType, x: number, y: number, level = 1): Building {
  const b: Building = { id: nextId++, type, x, y, level, shield: 0, enabled: true, online: true, split: 0.5, job: null, link: null };
  s.buildings.push(b);
  return b;
}

/** A colony with plenty of power and materials so the network can be tested in isolation. */
function colony(difficulty: 'medium' | 'hard' = 'medium') {
  const s = createInitialState(1, difficulty);
  s.scienceQueue = [];
  s.res = { regolith: 5000, titanium: 1000, ice: 500, credits: 5000 };
  s.buildings[0].level = 4; // Command Center L4 allows level-4 network buildings
  s.battery = 200;
  for (let i = 0; i < 6; i++) add(s, 'solar', 0, 0, 5); // positions don't matter for these tests
  add(s, 'battery', 0, 0, 5);
  s.battery = 2000;
  return s;
}

describe('monitoring network: placement rules', () => {
  it('only one Lunar Operations Center, at most four Monitoring Stations', () => {
    const s = colony();
    expect(canStartBuild(s, 'opscenter').ok).toBe(true);
    add(s, 'opscenter', 5, 5);
    const second = canStartBuild(s, 'opscenter');
    expect(second.ok).toBe(false);
    for (let i = 0; i < 4; i++) {
      expect(canStartBuild(s, 'monitor').ok).toBe(true);
      add(s, 'monitor', 2 + i, 2);
    }
    expect(canStartBuild(s, 'monitor').ok).toBe(false);
  });

  it('both types upgrade independently to level 4 and no further', () => {
    const s = colony();
    const ops = add(s, 'opscenter', 5, 5, 4);
    const a = add(s, 'monitor', 2, 2, 4);
    const b = add(s, 'monitor', 3, 2, 1);
    expect(canUpgrade(s, ops).ok).toBe(false);
    expect(canUpgrade(s, a).ok).toBe(false);
    expect(canUpgrade(s, b).ok).toBe(true);
  });

  it('higher levels cost more, and upgrade time follows the difficulty', () => {
    const s = colony('hard');
    const ops = add(s, 'opscenter', 5, 5, 1);
    expect(startUpgrade(s, ops.id).ok).toBe(true);
    expect(ops.job!.end - ops.job!.start).toBeCloseTo(timeFor('opscenter', 2) / DIFFICULTIES.hard.upgradeSpeed, 5);
    expect(timeFor('opscenter', 4)).toBeGreaterThan(timeFor('opscenter', 2));
  });
});

describe('monitoring network: connections and capacity', () => {
  it('Operations Center level = number of stations it can serve', () => {
    const s = colony();
    const ops = add(s, 'opscenter', 9, 13, 1);
    const st = [add(s, 'monitor', 6, 13), add(s, 'monitor', 13, 13), add(s, 'monitor', 9, 16)];
    for (const x of st) expect(connect(s, x.id, 'wireless').ok).toBe(true);
    tick(s, 0.25);
    expect(capacity(s)).toBe(1);
    expect(networkStatus(s).filter((n) => n.active)).toHaveLength(1);
    expect(networkStatus(s)[1].problem).toMatch(/capacity/);
    ops.level = 3;
    tick(s, 0.25);
    expect(networkStatus(s).filter((n) => n.active)).toHaveLength(3);
  });

  it('a cable costs regolith per tile and has short range; radio reaches further', () => {
    const s = colony();
    add(s, 'opscenter', 0, 0, 1);
    const near = add(s, 'monitor', 4, 0);
    const far = add(s, 'monitor', 13, 0);
    const before = s.res.regolith;
    expect(connect(s, near.id, 'wired').ok).toBe(true);
    expect(s.res.regolith).toBeLessThan(before);
    expect(connect(s, far.id, 'wired').ok).toBe(false); // ~12 tiles > cable range 10
    expect(connect(s, far.id, 'wireless').ok).toBe(true);
  });

  it('links draw power through the normal power system', () => {
    const s = colony();
    add(s, 'opscenter', 0, 0, 1);
    const st = add(s, 'monitor', 3, 0);
    tick(s, 0.25);
    const base = s.flows.powerDemand;
    connect(s, st.id, 'wireless');
    tick(s, 0.25);
    expect(s.flows.powerDemand).toBeCloseTo(base + MONITORING.links.wireless.powerKW, 5);
  });
});

describe('monitoring network: data', () => {
  it('active stations record temperature, radiation and sunlight, and earn data credits', () => {
    const s = colony();
    add(s, 'opscenter', 0, 0, 2);
    const st = add(s, 'monitor', 3, 0);
    connect(s, st.id, 'wired');
    const credits = s.res.credits;
    advance(s, 20, 0.25);
    const list = s.monitoring.samples[String(st.id)];
    expect(list.length).toBeGreaterThanOrEqual(9);
    const last = list[list.length - 1];
    expect(last.ok).toBe(true);
    expect(last.temp).toBeGreaterThan(-200);
    expect(last.temp).toBeLessThan(130);
    expect(last.rad).toBeGreaterThan(40);
    expect(s.res.credits).toBeGreaterThan(credits);
  });

  it('during a solar storm radio links drop data but cables keep working', () => {
    const s = colony();
    add(s, 'opscenter', 0, 0, 2);
    const wired = add(s, 'monitor', 3, 0);
    const radio = add(s, 'monitor', 0, 3);
    connect(s, wired.id, 'wired');
    connect(s, radio.id, 'wireless');
    s.flare = { warnAt: s.time, start: s.time, end: s.time + 30, dose: 0 };
    s.nextFlareAt = s.time;
    advance(s, 10, 0.25);
    const w = s.monitoring.samples[String(wired.id)].at(-1)!;
    const r = s.monitoring.samples[String(radio.id)].at(-1)!;
    expect(w.ok).toBe(true);
    expect(w.rad).toBeGreaterThan(1000); // storm spike
    expect(r.ok).toBe(false);
  });

  it('environmental warnings (level 3) extend the solar-flare warning', () => {
    const s = colony();
    const ops = add(s, 'opscenter', 0, 0, 2);
    const st = add(s, 'monitor', 3, 0);
    connect(s, st.id, 'wired');
    tick(s, 0.25);
    expect(flareWarningBonus(s)).toBe(0);
    ops.level = 3;
    tick(s, 0.25);
    expect(flareWarningBonus(s)).toBe(MONITORING.warningPerStation);
  });

  it('links and history survive save/load; older saves load with an empty network', () => {
    const s = colony();
    add(s, 'opscenter', 0, 0, 1);
    const st = add(s, 'monitor', 3, 0);
    connect(s, st.id, 'wired');
    advance(s, 6, 0.25);
    const copy = deserialize(serialize(s))!;
    expect(copy.buildings.find((b) => b.id === st.id)!.link).toBe('wired');
    expect(copy.monitoring.samples[String(st.id)].length).toBe(s.monitoring.samples[String(st.id)].length);
    const raw = JSON.parse(serialize(createInitialState(1)));
    delete raw.monitoring;
    expect(deserialize(JSON.stringify(raw))!.monitoring.samples).toEqual({});
  });
});
