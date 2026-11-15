import { BUILDINGS, MAX_LEVEL, maxLevelOf, type BuildingType, type Cost } from '../config/buildings';
import { BUILDER_PRICES, DAY_NIGHT, MAX_BUILDERS, MAP_SIZE, PRODUCTION, STORAGE } from '../config/balance';
import type { TechId } from '../config/techs';
import { DIFFICULTIES } from '../config/difficulty';
import { hasEffect, type Building, type GameState } from './state';
import { getTerrain, tileAt } from './terrain';

export const hasTech = (s: GameState, id: TechId) => s.research.owned.includes(id);

/** The colony's difficulty settings (single lookup used by every system). */
export const diff = (s: GameState) => DIFFICULTIES[s.difficulty] ?? DIFFICULTIES.medium;

/** Daylight hours per cycle for this difficulty. */
export const dayLength = (s: GameState) => DAY_NIGHT.cycle * diff(s).dayFraction;

/** Solar output multiplier from difficulty and research. */
export const solarMult = (s: GameState) => diff(s).solarMult * (hasTech(s, 'solarEff') ? 1.25 : 1);

export const commandLevel = (s: GameState) => s.buildings.find((b) => b.type === 'command')?.level ?? 1;

export const built = (s: GameState, type: BuildingType) => s.buildings.filter((b) => b.type === type);

/** Buildings that have finished first construction. */
export const active = (s: GameState, type?: BuildingType) =>
  s.buildings.filter((b) => b.level > 0 && (!type || b.type === type));

export const levelSum = (s: GameState, type: BuildingType) => active(s, type).reduce((a, b) => a + b.level, 0);

export function maxCount(s: GameState, type: BuildingType): number {
  return BUILDINGS[type].maxCount[commandLevel(s) - 1];
}

export function unlockLevel(type: BuildingType): number {
  return BUILDINGS[type].maxCount.findIndex((n) => n > 0) + 1;
}

/** Highest level a non-CC building may reach at the current CC level. */
export function levelCap(s: GameState, type: BuildingType): number {
  return type === 'command' ? MAX_LEVEL : Math.min(maxLevelOf(type), commandLevel(s));
}

export function builderCap(s: GameState): number {
  const station = active(s, 'builderStation')[0];
  return station ? Math.min(MAX_BUILDERS, station.level + 1) : 1;
}

export function nextBuilderPrice(s: GameState): number | null {
  return s.builders >= MAX_BUILDERS ? null : BUILDER_PRICES[s.builders - 1];
}

export function busyBuilders(s: GameState): number[] {
  return s.buildings.filter((b) => b.job).map((b) => b.job!.builder);
}

export function freeBuilder(s: GameState): number | null {
  const busy = new Set(busyBuilders(s));
  for (let i = 0; i < s.builders; i++) if (!busy.has(i)) return i;
  return null;
}

export function canAfford(s: GameState, c: Cost): boolean {
  return (c.regolith ?? 0) <= s.res.regolith + 1e-9 && (c.titanium ?? 0) <= s.res.titanium + 1e-9 &&
    (c.ice ?? 0) <= s.res.ice + 1e-9 && (c.credits ?? 0) <= s.res.credits + 1e-9;
}

export function missingFor(s: GameState, c: Cost): string[] {
  const out: string[] = [];
  if ((c.regolith ?? 0) > s.res.regolith) out.push('regolith');
  if ((c.titanium ?? 0) > s.res.titanium) out.push('titanium');
  if ((c.ice ?? 0) > s.res.ice) out.push('ice');
  if ((c.credits ?? 0) > s.res.credits) out.push('credits');
  return out;
}

export function pay(s: GameState, c: Cost) {
  s.res.regolith -= c.regolith ?? 0;
  s.res.titanium -= c.titanium ?? 0;
  s.res.ice -= c.ice ?? 0;
  s.res.credits -= c.credits ?? 0;
}

export function footprint(type: BuildingType, x: number, y: number) {
  const n = BUILDINGS[type].size;
  const cells: { x: number; y: number }[] = [];
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) cells.push({ x: x + dx, y: y + dy });
  return cells;
}

export function buildingAt(s: GameState, x: number, y: number): Building | undefined {
  return s.buildings.find((b) => {
    const n = BUILDINGS[b.type].size;
    return x >= b.x && x < b.x + n && y >= b.y && y < b.y + n;
  });
}

export type PlacementCheck = { ok: boolean; reason?: string; cells: { x: number; y: number; ok: boolean }[] };

/** `ignoreId`: a building being moved does not block its own new spot. */
export function checkPlacement(s: GameState, type: BuildingType, x: number, y: number, ignoreId?: number): PlacementCheck {
  const terrain = getTerrain(s.seed, s.difficulty);
  const occupied = (cx: number, cy: number) => {
    const o = buildingAt(s, cx, cy);
    return !!o && o.id !== ignoreId;
  };
  const cells = footprint(type, x, y).map((c) => {
    const kind = tileAt(terrain, c.x, c.y);
    const ok = kind !== null && kind !== 'crater' && kind !== 'boulder' && !occupied(c.x, c.y);
    return { ...c, ok };
  });
  if (cells.some((c) => c.x < 0 || c.y < 0 || c.x >= MAP_SIZE || c.y >= MAP_SIZE)) return { ok: false, reason: 'Outside the map', cells };
  const bad = cells.find((c) => !c.ok);
  if (bad) {
    const k = tileAt(terrain, bad.x, bad.y);
    const reason = occupied(bad.x, bad.y) ? 'Space is occupied' : k === 'crater' ? 'Cannot build inside a crater' : 'Boulder in the way';
    return { ok: false, reason, cells };
  }
  if (BUILDINGS[type].needsIce && !cells.some((c) => tileAt(terrain, c.x, c.y) === 'ice')) {
    return { ok: false, reason: 'Must touch an ice deposit (blue tiles)', cells: cells.map((c) => ({ ...c, ok: false })) };
  }
  return { ok: true, cells };
}

export function oreTiles(s: GameState, b: Building): number {
  const terrain = getTerrain(s.seed, s.difficulty);
  return footprint(b.type, b.x, b.y).filter((c) => tileAt(terrain, c.x, c.y) === 'ore').length;
}

// ---- Time of day ----
export const cyclePos = (s: GameState) => s.time % DAY_NIGHT.cycle;
export const isDay = (s: GameState) => cyclePos(s) < dayLength(s);

/** 0..1 solar intensity with soft dawn and dusk. */
export function sunlight(s: GameState): number {
  const p = cyclePos(s);
  const day = dayLength(s);
  const { ramp, cycle } = DAY_NIGHT;
  if (p < ramp) return p / ramp;
  if (p < day - ramp) return 1;
  if (p < day) return (day - p) / ramp;
  if (p > cycle - 0.001) return 0;
  return 0;
}

/** Hours until the next sunset (if day) or sunrise (if night). */
export function hoursToSwitch(s: GameState): number {
  const p = cyclePos(s);
  const day = dayLength(s);
  return p < day ? day - p : DAY_NIGHT.cycle - p;
}

// ---- Capacities ----
export function batteryCap(s: GameState): number {
  const mult = hasTech(s, 'insulatedBatt') ? 1.5 : 1;
  // A battery-cell fault (dynamic event) takes a quarter of storage offline.
  const fault = hasEffect(s, 'batteryFault') ? 0.75 : 1;
  return (PRODUCTION.commandBatteryKWh + levelSum(s, 'battery') * PRODUCTION.batteryKWh) * mult * fault;
}

export function caps(s: GameState) {
  const st = levelSum(s, 'storage');
  const cc = commandLevel(s);
  return {
    regolith: STORAGE.base.regolith + st * STORAGE.perStorageLevel.regolith + cc * STORAGE.perCommandLevel.regolith,
    titanium: STORAGE.base.titanium + st * STORAGE.perStorageLevel.titanium + cc * STORAGE.perCommandLevel.titanium,
    ice: STORAGE.base.ice + st * STORAGE.perStorageLevel.ice + cc * STORAGE.perCommandLevel.ice,
    o2: STORAGE.o2Base + levelSum(s, 'oxygen') * STORAGE.o2PerOxygenLevel + levelSum(s, 'habitat') * STORAGE.o2PerHabitatLevel,
    water: (STORAGE.waterBase + levelSum(s, 'ice') * STORAGE.waterPerIceLevel + st * STORAGE.waterPerStorageLevel) * (hasEffect(s, 'waterCap') ? 0.7 : 1),
    food: STORAGE.foodBase + levelSum(s, 'greenhouse') * STORAGE.foodPerGreenhouseLevel,
  };
}

export function crewCapacity(s: GameState): number {
  return PRODUCTION.commandCrew + levelSum(s, 'habitat') * PRODUCTION.habitatCrewPerLevel;
}

/** Duration multiplier for builds, upgrades and shielding: research bonus ÷ difficulty speed. */
export function buildTimeMult(s: GameState): number {
  return (hasTech(s, 'fastBuilders') ? 0.75 : 1) / diff(s).upgradeSpeed;
}

/** Human-readable stats for a building at a level (for the info card). */
export function statsFor(s: GameState, type: BuildingType, level: number): string[] {
  const P = PRODUCTION;
  const out: string[] = [];
  if (level <= 0) return out;
  switch (type) {
    case 'command': out.push(`Unlocks buildings up to level ${level}`, `Houses ${P.commandCrew} crew`, `Battery ${P.commandBatteryKWh} kWh`); break;
    case 'solar': out.push(`${(P.solarKW * level * solarMult(s)).toFixed(1)} kW in full sun`, '0 kW at night'); break;
    case 'battery': out.push(`Stores ${P.batteryKWh * level * (hasTech(s, 'insulatedBatt') ? 1.5 : 1)} kWh`); break;
    case 'mine': out.push(`${(P.mineRegolith * level * diff(s).yields.regolith).toFixed(1)} kg regolith/h (+50% on ore)`); break;
    case 'refinery': out.push(`${P.refineryRegolithIn * level} kg regolith/h → ${(P.refineryTitaniumOut * level * diff(s).yields.titanium).toFixed(2)} kg titanium/h (+50% on ore)`); break;
    case 'ice': out.push(`${(P.iceKg * level * diff(s).yields.ice).toFixed(2)} kg ice/h`); break;
    case 'oxygen': out.push(`Processes ${(P.oxygenIceIn * level).toFixed(1)} kg ice/h into water + O₂`); break;
    case 'greenhouse': out.push(`${(P.greenhouseWaterIn * level).toFixed(2)} L water/h → ${(P.greenhouseFoodOut * level).toFixed(2)} kg food/h`); break;
    case 'habitat': out.push(`Houses ${P.habitatCrewPerLevel * level} crew`); break;
    case 'storage': out.push(`+${STORAGE.perStorageLevel.regolith * level} regolith, +${STORAGE.perStorageLevel.titanium * level} titanium, +${STORAGE.perStorageLevel.ice * level} ice`); break;
    case 'builderStation': out.push(`Room for ${Math.min(MAX_BUILDERS, level + 1)} builder robots`); break;
    case 'lab': out.push(`Research tier ${Math.min(3, level)}`); break;
    case 'spaceport': out.push(`Cargo payout +${Math.round((level - 1) * 15)}%`); break;
    case 'opscenter': out.push(`Supports ${level} connected station${level > 1 ? 's' : ''}`, ['Live temperature, radiation, link status, energy', '+ Measurement history and per-station energy', '+ Graphs, solar data, warnings, network energy', '+ Full dashboard: comparisons, analysis, network health'][level - 1]); break;
    case 'monitor': out.push('Measures temperature, radiation and sunlight', `Radio range ${14 + 2 * (level - 1)} tiles, data worth ${(0.5 * level).toFixed(1)} credits per sample`); break;
  }
  return out;
}
