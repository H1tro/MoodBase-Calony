import { BUILDINGS, powerDraw } from '../config/buildings';
import { PRODUCTION } from '../config/balance';
import { conditionFactor } from '../config/station';
import { hasEffect, type Building, type GameState } from './state';
import { batteryCap, solarMult, sunlight } from './selectors';
import { linkDraw } from './monitoring';

/** Power priority (higher = kept on longer). The player can override the default. */
export const powerPriority = (b: Building) => b.priority ?? BUILDINGS[b.type].priority;

/** Fraction of rated output a solar farm delivers: dust blocks light, damage cuts output. */
export function solarFarmEfficiency(s: GameState, b: Building): number {
  return (1 - (b.dust ?? 0)) * conditionFactor(b.condition) * (hasEffect(s, 'tilt') ? 0.9 : 1);
}

/** In emergency power-saving mode only life support stays on. */
export function emergencyOff(s: GameState, b: Building): boolean {
  return s.station.emergency && !BUILDINGS[b.type].lifeSupport;
}

/** Extra draw from temporary effects (e.g. the backup antenna on the Command Center). */
function effectDraw(s: GameState, b: Building): number {
  return b.type === 'command' && hasEffect(s, 'backupAntenna') ? 1 : 0;
}

/** Electronics switched off to ride out a solar storm. */
function stormSafed(s: GameState, b: Building): boolean {
  return hasEffect(s, 'electronicsOff') && (b.type === 'lab' || b.type === 'monitor');
}

export type OfflineReason = 'off' | 'emergency' | 'storm' | 'broken' | 'power';

/** Why a building is not running right now (null when it is running or draws no power). */
export function offlineReason(s: GameState, b: Building): OfflineReason | null {
  if (b.level === 0 || b.online) return null;
  if (!b.enabled) return 'off';
  if (emergencyOff(s, b)) return 'emergency';
  if (stormSafed(s, b)) return 'storm';
  if (conditionFactor(b.condition) <= 0) return 'broken';
  return BUILDINGS[b.type].power > 0 ? 'power' : null;
}

export const OFFLINE_TEXT: Record<OfflineReason, string> = {
  off: 'Switched off',
  emergency: 'Off: emergency power mode',
  storm: 'Off: safed for solar storm',
  broken: 'Broken: needs repair',
  power: 'NO POWER: not enough energy',
};

/**
 * Power model: solar output + battery charge is shared among consumers in
 * priority order (life support first). When energy runs out, the lowest
 * priority buildings go offline first.
 */
export function updatePower(s: GameState, dt: number) {
  const sun = sunlight(s);
  const eff = solarMult(s);
  let prod = 0;
  let effSum = 0;
  let farms = 0;
  for (const b of s.buildings) {
    if (b.type !== 'solar' || b.level === 0) continue;
    const e = solarFarmEfficiency(s, b);
    effSum += e;
    farms++;
    if (b.enabled) prod += PRODUCTION.solarKW * b.level * sun * eff * e;
  }
  s.flows.solarEfficiency = farms ? effSum / farms : 1;
  const cap = batteryCap(s);
  let energy = s.battery + prod * dt;
  let demand = 0;
  let used = 0;
  let shortage = false;
  const consumers = s.buildings.filter((b) => b.level > 0).sort((a, b) => powerPriority(b) - powerPriority(a));
  for (const b of consumers) {
    const draw = powerDraw(b.type, b.level) + linkDraw(b) + effectDraw(s, b);
    const switchedOff = !b.enabled || emergencyOff(s, b) || stormSafed(s, b) || conditionFactor(b.condition) <= 0;
    if (draw === 0) {
      b.online = !switchedOff;
      continue;
    }
    if (switchedOff) {
      b.online = false;
      continue;
    }
    demand += draw;
    const need = draw * dt;
    if (energy + 1e-9 >= need) {
      energy -= need;
      used += draw;
      b.online = true;
    } else {
      b.online = false;
      shortage = true;
    }
  }
  // Buildings still under construction are never online.
  for (const b of s.buildings) if (b.level === 0) b.online = false;
  s.battery = Math.max(0, Math.min(cap, energy));
  s.totals.energyMade += prod * dt;
  s.totals.energyUsed += used * dt;
  if (shortage) s.cycle.shortage = true;
  s.flows.shortage = shortage;
  s.flows.powerProd = prod;
  s.flows.powerDemand = demand;
  s.flows.powerUsed = used;
  s.flows.batteryCap = cap;
  s.flows.sunlight = sun;
}
