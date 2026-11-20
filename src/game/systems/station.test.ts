import { describe, expect, it } from 'vitest';
import { createInitialState, hasEffect, type Building, type GameState } from './state';
import { advance, tick } from './simulation';
import { co2ToPpm, scrubCapacity } from './lifeSupport';
import { resolveEvent, triggerEvent } from './events';
import { buildReport, powerForecast } from './report';
import { canLaunch } from './spaceport';
import { flareIntensity, setSpaceWeather, strongestFlare } from './spaceWeather';
import { queueQuiz } from './quiz';
import { deserialize, serialize } from './save';
import { startRepair } from './construction';
import { offlineReason, updatePower } from './power';
import { LIFE } from '../config/station';
import { DAY_NIGHT } from '../config/balance';
import { QUIZ_REWARD } from '../config/quiz';
import type { BuildingType } from '../config/buildings';

let nextId = 500;
function add(s: GameState, type: BuildingType, level = 1, extra: Partial<Building> = {}): Building {
  const b: Building = { id: nextId++, type, x: 0, y: 0, level, shield: 0, enabled: true, online: true, split: 0.5, job: null, ...extra };
  s.buildings.push(b);
  return b;
}
function colony() {
  const s = createInitialState(1);
  s.scienceQueue = [];
  s.res = { regolith: 5000, titanium: 1000, ice: 500, credits: 5000 };
  s.station.nextEventAt = 1e9; // no random events unless a test asks
  s.nextFlareAt = 1e9;
  return s;
}

describe('life support: CO₂, water, waste', () => {
  it('CO₂ conversion starts at Earth-like 420 ppm', () => {
    expect(co2ToPpm(0, 150)).toBeCloseTo(420, 0);
    expect(co2ToPpm(1, 150)).toBeGreaterThan(co2ToPpm(0.5, 150));
  });

  it('powered scrubbers keep CO₂ safe; without power it climbs to dangerous levels', () => {
    const s = colony();
    advance(s, 20, 0.25);
    expect(s.flows.co2ppm).toBeLessThan(LIFE.co2Warn);
    s.buildings[0].enabled = false; // Command Center (scrubbers) off
    expect(scrubCapacity(s)).toBeGreaterThan(0);
    advance(s, 30, 0.25);
    expect(scrubCapacity(s)).toBe(0);
    expect(s.flows.co2ppm).toBeGreaterThan(LIFE.co2Danger);
    expect(s.flows.starving).toContain('co2');
  });

  it('water recycling recovers part of crew water, only with power', () => {
    const s = colony();
    tick(s, 1);
    expect(s.flows.waterRecovery).toBe(LIFE.waterRecoveryBase);
    s.research.owned.push('waterRecycle');
    tick(s, 1);
    expect(s.flows.waterRecovery).toBe(LIFE.waterRecoveryTech);
    s.buildings[0].enabled = false;
    tick(s, 1);
    expect(s.flows.waterRecovery).toBe(0);
  });

  it('waste fills storage; greenhouses compost it into a bigger harvest', () => {
    const s = colony();
    s.crew.count = 6;
    advance(s, 10, 0.25);
    const waste = s.life.waste;
    expect(waste).toBeGreaterThan(1);
    add(s, 'greenhouse', 3);
    add(s, 'solar', 5); add(s, 'solar', 5);
    s.life.food = 0;
    advance(s, 5, 0.25);
    expect(s.totals.wasteComposted).toBeGreaterThan(0);
    expect(s.totals.foodGrown).toBeGreaterThan(0);
  });
});

describe('power management', () => {
  it('emergency mode keeps life support on and switches the rest off', () => {
    const s = colony();
    const mine = add(s, 'mine');
    const hab = add(s, 'habitat');
    s.station.emergency = true;
    tick(s, 0.25);
    expect(mine.online).toBe(false);
    expect(hab.online).toBe(true);
  });

  it('a player priority override changes which building loses power first', () => {
    const s = colony();
    const mine = add(s, 'mine');
    const lab = add(s, 'lab');
    s.time = DAY_NIGHT.cycle - 20; // night
    s.battery = 0.4; // enough for one of them for one tick
    for (const b of s.buildings) if (b !== mine && b !== lab) b.enabled = false;
    tick(s, 0.25);
    expect(lab.online).toBe(true); // lab priority 4 > mine 3
    expect(mine.online).toBe(false);
    mine.priority = 9;
    s.battery = 0.4;
    tick(s, 0.25);
    expect(mine.online).toBe(true);
  });

  it('dust lowers solar output; cleaning restores it; forecast is computed', () => {
    const s = colony();
    const farm = add(s, 'solar', 2);
    s.time = DAY_NIGHT.cycle + 60;
    tick(s, 0.25);
    const clean = s.flows.powerProd;
    farm.dust = 0.5;
    tick(s, 0.25);
    expect(s.flows.powerProd).toBeCloseTo(clean * 0.5, 1);
    const f = powerForecast(s);
    expect(f.day).toBe(true);
    expect(f.nightLength).toBeGreaterThan(0);
  });
});

describe('environment and maintenance', () => {
  it('working machines wear out and a repair restores 100%', () => {
    const s = colony();
    const mine = add(s, 'mine');
    add(s, 'solar', 5); add(s, 'solar', 5);
    advance(s, 100, 0.25);
    expect(mine.condition!).toBeLessThan(100);
    expect(startRepair(s, mine.id).ok).toBe(true);
    advance(s, 20, 0.25);
    expect(mine.condition!).toBeGreaterThan(99); // repaired to 100%, then a few hours of normal wear
  });
});

describe('dynamic events', () => {
  it('dust lofting coats panels; tilting halves the dust and is recorded in history', () => {
    const s = colony();
    const farm = add(s, 'solar');
    expect(triggerEvent(s, 'dustLofting')).toBe(true);
    expect(farm.dust).toBeCloseTo(0.2, 5);
    const r = resolveEvent(s, 'tilt');
    expect(r.ok).toBe(true);
    expect(farm.dust).toBeCloseTo(0.1, 5);
    expect(hasEffect(s, 'tilt')).toBe(true);
    expect(s.station.history.at(-1)!.choiceId).toBe('tilt');
    expect(s.stats.eventsResolved).toBe(1);
    expect(s.station.pending).toBeNull();
  });

  it('water leak drains water until patched', () => {
    const s = colony();
    s.life.water = 100;
    triggerEvent(s, 'waterLeak', { amount: 15 });
    expect(s.life.water).toBe(85);
    expect(hasEffect(s, 'leak')).toBe(true);
    resolveEvent(s, 'patch');
    expect(hasEffect(s, 'leak')).toBe(false);
  });

  it('equipment failure stops output; a quick patch brings it back at 60%', () => {
    const s = colony();
    const gen = add(s, 'oxygen');
    triggerEvent(s, 'equipmentFailure', { buildingId: gen.id });
    expect(gen.condition).toBe(0);
    resolveEvent(s, 'patch');
    expect(gen.condition).toBe(60);
    expect(gen.patched).toBe(true);
  });

  it('communication loss grounds flights until the backup antenna is used', () => {
    const s = colony();
    add(s, 'spaceport');
    s.res.regolith = 1000;
    triggerEvent(s, 'commLoss', { buildingId: s.buildings[0].id });
    tick(s, 0.25);
    expect(canLaunch(s, 'regolith').ok).toBe(false);
    resolveEvent(s, 'backup');
    expect(canLaunch(s, 'regolith').ok).toBe(true);
  });

  it('battery fault cuts storage; repairing the battery ends it early', () => {
    const s = colony();
    const bat = add(s, 'battery', 2);
    tick(s, 0.25);
    const cap = s.flows.batteryCap;
    triggerEvent(s, 'powerShortage', { buildingId: bat.id });
    tick(s, 0.25);
    expect(s.flows.batteryCap).toBeCloseTo(cap * 0.75, 5);
    resolveEvent(s, 'repair');
    advance(s, 20, 0.25);
    expect(hasEffect(s, 'batteryFault')).toBe(false);
  });

  it('a solar storm asks for a decision; sheltering lowers the dose compared to working through', () => {
    const dose = (choice: string) => {
      const s = colony();
      s.crew.count = 2;
      s.nextFlareAt = s.time + 5;
      advance(s, 1, 0.25);
      expect(s.station.pending?.id).toBe('solarStorm');
      resolveEvent(s, choice);
      advance(s, 40, 0.25);
      return s.crew.dose;
    };
    expect(dose('shelter')).toBeLessThan(dose('work'));
  });

  it('random events happen on their own over time', () => {
    const s = colony();
    add(s, 'solar'); add(s, 'mine');
    s.station.nextEventAt = s.time + 2;
    advance(s, 5, 0.25);
    expect(s.station.pending).not.toBeNull();
  });
});

describe('real data, quiz, report, saves', () => {
  it('real flare class scales storm strength; simulated data stays neutral', () => {
    setSpaceWeather({ source: 'simulated', updated: null, flares: [] });
    expect(flareIntensity()).toBe(1);
    const w = { source: 'snapshot' as const, updated: '2026-11-14', flares: [{ id: 'a', classType: 'M1.7', peakTime: '2026-11-11T21:21Z' }, { id: 'b', classType: 'X1.0', peakTime: '2026-11-01T00:00Z' }] };
    expect(strongestFlare(w)!.classType).toBe('X1.0');
    expect(flareIntensity(w)).toBe(1.25);
    setSpaceWeather({ source: 'simulated', updated: null, flares: [] });
  });

  it('the sunrise quiz only asks about discovered facts and rewards correct answers', async () => {
    const { answerQuiz } = await import('./quiz');
    const s = colony();
    expect(queueQuiz(s)).toBe(false);
    s.scienceSeen.push('gravity');
    expect(queueQuiz(s)).toBe(true);
    expect(s.scienceQueue.at(-1)).toBe('quiz:q_gravity');
    const credits = s.res.credits;
    expect(answerQuiz(s, 'q_gravity', 1).correct).toBe(true);
    expect(s.res.credits).toBe(credits + QUIZ_REWARD);
    expect(answerQuiz(s, 'q_gravity', 1).reward).toBe(0); // only once
  });

  it('the mission report summarises the mission', () => {
    const s = colony();
    advance(s, 50, 0.25);
    const r = buildReport(s);
    expect(r.hours).toBeGreaterThan(50);
    expect(r.score.total).toBeGreaterThan(0);
    expect(r.score.parts.reduce((a, p) => a + p.max, 0)).toBe(100);
    expect(r.wentWell.length + r.improve.length).toBeGreaterThan(0);
  });

  it('old saves without the new systems load with safe defaults', () => {
    const raw = JSON.parse(serialize(createInitialState(1)));
    delete raw.station;
    delete raw.totals;
    delete raw.life.co2;
    delete raw.life.waste;
    const s = deserialize(JSON.stringify(raw))!;
    expect(s.life.co2).toBeGreaterThanOrEqual(0);
    expect(s.life.waste).toBe(0);
    expect(s.station.effects).toEqual([]);
    tick(s, 1);
    expect(Number.isFinite(s.flows.co2ppm)).toBe(true);
  });
});

describe('offline reasons', () => {
  it('names emergency mode, broken equipment and a real shortage separately', () => {
    const s = colony();
    s.battery = 500;
    const mine = add(s, 'mine');
    updatePower(s, 0.25);
    expect(offlineReason(s, mine)).toBeNull();

    s.station.emergency = true;
    updatePower(s, 0.25);
    expect(mine.online).toBe(false);
    expect(offlineReason(s, mine)).toBe('emergency');
    s.station.emergency = false;

    mine.condition = 0;
    updatePower(s, 0.25);
    expect(offlineReason(s, mine)).toBe('broken');
    mine.condition = 100;

    mine.enabled = false;
    updatePower(s, 0.25);
    expect(offlineReason(s, mine)).toBe('off');
    mine.enabled = true;

    s.battery = 0;
    s.time = DAY_NIGHT.cycle - 1; // night: no solar
    updatePower(s, 0.25);
    expect(offlineReason(s, mine)).toBe('power');
  });
});
