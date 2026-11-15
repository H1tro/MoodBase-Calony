import { BUILDINGS, costFor, maxLevelOf, timeFor, type BuildingType } from '../config/buildings';
import { RADIATION } from '../config/balance';
import { REAL_WORLD } from '../config/realworld';
import { MAINTENANCE } from '../config/station';
import { addLog, type Building, type GameState } from './state';
import {
  buildTimeMult, builderCap, built, canAfford, checkPlacement, commandLevel, freeBuilder,
  levelCap, maxCount, missingFor, nextBuilderPrice, pay, unlockLevel,
} from './selectors';

export type Result = { ok: true; id?: number } | { ok: false; reason: string };

const fail = (reason: string): Result => ({ ok: false, reason });

export function canStartBuild(s: GameState, type: BuildingType): Result {
  const max = maxCount(s, type);
  if (max === 0) return fail(`Unlocks at Command Center level ${unlockLevel(type)}`);
  if (built(s, type).length >= max) return fail(`Limit reached (${max}). Upgrade the Command Center for more.`);
  const cost = costFor(type, 1);
  if (!canAfford(s, cost)) return fail(`Not enough ${missingFor(s, cost).join(', ')}`);
  if (freeBuilder(s) === null) return fail('All builders are busy');
  return { ok: true };
}

/** Can this building be picked up and moved? (Free and instant, like relocating a module with a crane rover.) */
export function canMove(s: GameState, id: number): Result {
  const b = s.buildings.find((x) => x.id === id);
  if (!b) return fail('Building not found');
  if (b.job) return fail('Wait until the builder has finished working on it');
  return { ok: true };
}

export function moveBuilding(s: GameState, id: number, x: number, y: number): Result {
  const can = canMove(s, id);
  if (!can.ok) return can;
  const b = s.buildings.find((v) => v.id === id)!;
  if (b.x === x && b.y === y) return fail('It is already here');
  const place = checkPlacement(s, b.type, x, y, id);
  if (!place.ok) return fail(place.reason ?? 'Invalid location');
  b.x = x;
  b.y = y;
  addLog(s, `📦 ${BUILDINGS[b.type].name} moved to a new spot.`);
  return { ok: true, id };
}

export function startBuild(s: GameState, type: BuildingType, x: number, y: number): Result {
  const can = canStartBuild(s, type);
  if (!can.ok) return can;
  const place = checkPlacement(s, type, x, y);
  if (!place.ok) return fail(place.reason ?? 'Invalid location');
  const builder = freeBuilder(s)!;
  pay(s, costFor(type, 1));
  const duration = timeFor(type, 1) * buildTimeMult(s);
  const b: Building = {
    id: s.nextId++, type, x, y, level: 0, shield: 0, enabled: true, online: false, split: 0.5,
    job: { kind: 'build', builder, start: s.time, end: s.time + duration },
  };
  s.buildings.push(b);
  addLog(s, `Construction started: ${BUILDINGS[type].name}.`);
  return { ok: true, id: b.id };
}

export function canUpgrade(s: GameState, b: Building): Result {
  if (b.job) return fail('Already under construction');
  if (b.level >= maxLevelOf(b.type)) return fail('Maximum level reached');
  if (b.level >= levelCap(s, b.type)) return fail(`Upgrade the Command Center to level ${b.level + 1} first`);
  const cost = costFor(b.type, b.level + 1);
  if (!canAfford(s, cost)) return fail(`Not enough ${missingFor(s, cost).join(', ')}`);
  if (freeBuilder(s) === null) return fail('All builders are busy');
  return { ok: true };
}

export function startUpgrade(s: GameState, id: number): Result {
  const b = s.buildings.find((x) => x.id === id);
  if (!b) return fail('Building not found');
  const can = canUpgrade(s, b);
  if (!can.ok) return can;
  const builder = freeBuilder(s)!;
  pay(s, costFor(b.type, b.level + 1));
  const duration = timeFor(b.type, b.level + 1) * buildTimeMult(s);
  b.job = { kind: 'upgrade', builder, start: s.time, end: s.time + duration };
  addLog(s, `Upgrading ${BUILDINGS[b.type].name} to level ${b.level + 1}.`);
  return { ok: true, id };
}

export function canShield(s: GameState, b: Building): Result {
  if (b.type !== 'habitat') return fail('Only habitats can be shielded');
  if (b.level === 0 || b.job) return fail('Habitat is busy');
  if (b.shield >= RADIATION.maxShield) return fail('Maximum shielding');
  const cost = RADIATION.shieldCost(b.shield + 1);
  if (!canAfford(s, cost)) return fail('Not enough regolith');
  if (freeBuilder(s) === null) return fail('All builders are busy');
  return { ok: true };
}

export function startShield(s: GameState, id: number): Result {
  const b = s.buildings.find((x) => x.id === id);
  if (!b) return fail('Building not found');
  const can = canShield(s, b);
  if (!can.ok) return can;
  const builder = freeBuilder(s)!;
  pay(s, RADIATION.shieldCost(b.shield + 1));
  const duration = RADIATION.shieldTime(b.shield + 1) * buildTimeMult(s);
  b.job = { kind: 'shield', builder, start: s.time, end: s.time + duration };
  addLog(s, `Piling regolith shielding on a habitat (level ${b.shield + 1}).`);
  return { ok: true, id };
}

// ---------- Maintenance: repairs and panel cleaning ----------
export function canRepair(s: GameState, b: Building): Result {
  if (b.level === 0) return fail('Still under construction');
  if (b.job) return fail('A robot is already working here');
  if ((b.condition ?? 100) >= 100 && !s.station.effects.some((e) => e.buildingId === b.id)) return fail('Already in perfect condition');
  if (!canAfford(s, MAINTENANCE.repair)) return fail(`Repair needs ${MAINTENANCE.repair.regolith} regolith and ${MAINTENANCE.repair.titanium} titanium`);
  if (freeBuilder(s) === null) return fail('All builders are busy');
  return { ok: true };
}

export function startRepair(s: GameState, id: number): Result {
  const b = s.buildings.find((x) => x.id === id);
  if (!b) return fail('Building not found');
  const can = canRepair(s, b);
  if (!can.ok) return can;
  pay(s, MAINTENANCE.repair);
  b.job = { kind: 'repair', builder: freeBuilder(s)!, start: s.time, end: s.time + MAINTENANCE.repair.hours * buildTimeMult(s) };
  addLog(s, `🔧 Repair crew sent to ${BUILDINGS[b.type].name}.`);
  return { ok: true, id };
}

export function canClean(s: GameState, b: Building): Result {
  if (b.type !== 'solar') return fail('Only solar farms collect dust');
  if (b.level === 0 || b.job) return fail('A robot is already working here');
  if ((b.dust ?? 0) < 0.02) return fail('Panels are already clean');
  if (freeBuilder(s) === null) return fail('All builders are busy');
  return { ok: true };
}

/** Send a robot to brush dust off one solar farm (or every farm with `all`). */
export function startClean(s: GameState, id: number, all = false): Result {
  const b = s.buildings.find((x) => x.id === id);
  if (!b) return fail('Building not found');
  const can = canClean(s, b);
  if (!can.ok && !(all && b.type === 'solar' && !b.job && freeBuilder(s) !== null)) return can;
  b.job = { kind: 'clean', builder: freeBuilder(s)!, start: s.time, end: s.time + MAINTENANCE.clean.hours * buildTimeMult(s) * (all ? 1.5 : 1), all };
  addLog(s, all ? '🧹 A robot is cleaning every solar panel.' : '🧹 A robot is cleaning a solar farm.');
  return { ok: true, id };
}

export function canBuyBuilder(s: GameState): Result {
  const price = nextBuilderPrice(s);
  if (price === null) return fail('All 5 builders hired');
  if (s.builders >= builderCap(s)) {
    return fail(built(s, 'builderStation').length ? 'Upgrade the Builder Station for more room' : 'Build a Builder Station first');
  }
  if (s.res.credits < price) return fail(`Needs ${price} ₡`);
  return { ok: true };
}

export function buyBuilder(s: GameState): Result {
  const can = canBuyBuilder(s);
  if (!can.ok) return can;
  s.res.credits -= nextBuilderPrice(s)!;
  s.builders++;
  s.stats.buildersBought++;
  addLog(s, `New builder robot #${s.builders} activated!`, 'good');
  return { ok: true };
}

export function toggleEnabled(s: GameState, id: number): Result {
  const b = s.buildings.find((x) => x.id === id);
  if (!b) return fail('Building not found');
  b.enabled = !b.enabled;
  addLog(s, `${BUILDINGS[b.type].name} switched ${b.enabled ? 'ON' : 'OFF'}.`);
  return { ok: true };
}

export function setSplit(s: GameState, id: number, split: number): Result {
  const b = s.buildings.find((x) => x.id === id);
  if (!b || b.type !== 'oxygen') return fail('Not an oxygen generator');
  b.split = Math.max(0, Math.min(1, split));
  return { ok: true };
}

/** Finish any jobs whose timers have run out. */
export function completeJobs(s: GameState) {
  for (const b of s.buildings) {
    if (!b.job || s.time < b.job.end) continue;
    const kind = b.job.kind;
    const jobAll = !!b.job.all;
    b.job = null;
    const name = BUILDINGS[b.type].name;
    if (kind === 'shield') {
      b.shield++;
      addLog(s, `Habitat shielding is now level ${b.shield}.`, 'good');
    } else if (kind === 'repair') {
      b.condition = 100;
      b.patched = false;
      // A repair also fixes event damage tied to this building (battery fault, dish alignment...).
      s.station.effects = s.station.effects.filter((e) => e.buildingId !== b.id);
      addLog(s, `🔧 ${name} repaired to 100%.`, 'good');
    } else if (kind === 'clean') {
      for (const f of s.buildings) if (f.type === 'solar' && (f === b || jobAll)) f.dust = 0;
      addLog(s, jobAll ? '☀️ All solar panels are clean.' : '☀️ Solar farm cleaned.', 'good');
    } else {
      b.level++;
      if (kind === 'build') {
        s.stats.buildingsBuilt++;
        // The first time a building type is finished, show the real science behind it.
        const fact = REAL_WORLD[b.type].factOnBuild;
        if (fact && !s.scienceSeen.includes(fact) && !s.scienceQueue.includes(fact)) s.scienceQueue.push(fact);
      }
      s.stats.maxLevel = Math.max(s.stats.maxLevel, b.level);
      addLog(s, kind === 'build' ? `${name} is online!` : `${name} reached level ${b.level}!`, 'good');
      if (b.type === 'command') addLog(s, `Command Center level ${commandLevel(s)}: new buildings and upgrades unlocked.`, 'good');
    }
  }
}
