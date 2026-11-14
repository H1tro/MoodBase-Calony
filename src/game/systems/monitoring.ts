import { BUILDINGS, powerDraw } from '../config/buildings';
import { MONITORING, type LinkKind } from '../config/monitoring';
import { RADIATION } from '../config/balance';
import { addLog, type Building, type GameState, type Sample } from './state';
import type { Result } from './construction';
import { canAfford, missingFor, pay, sunlight } from './selectors';
import { getTerrain, tileAt } from './terrain';
import { commsDown } from './spaceport';

const M = MONITORING;

/** The colony's single Operations Center (built or under construction). */
export const opsCenter = (s: GameState) => s.buildings.find((b) => b.type === 'opscenter');
export const stations = (s: GameState) => s.buildings.filter((b) => b.type === 'monitor').sort((a, b) => a.id - b.id);

/** Connected stations the Operations Center can serve right now (= its level). */
export function capacity(s: GameState): number {
  const ops = opsCenter(s);
  return ops && ops.level > 0 ? ops.level * M.capacityPerLevel : 0;
}

/** Distance in tiles between footprint centres. */
export function linkDistance(a: Building, b: Building): number {
  const na = BUILDINGS[a.type].size / 2;
  const nb = BUILDINGS[b.type].size / 2;
  return Math.hypot(a.x + na - (b.x + nb), a.y + na - (b.y + nb));
}

export function linkRange(kind: LinkKind, station: Building): number {
  const L = M.links[kind];
  return L.rangeTiles + L.rangePerLevel * Math.max(0, station.level - 1);
}

export function cableCost(s: GameState, station: Building) {
  const ops = opsCenter(s);
  return { regolith: ops ? Math.ceil(linkDistance(station, ops)) * M.links.wired.regolithPerTile : 0 };
}

/** Extra power a station's link draws (kW). Used by the power system. */
export function linkDraw(b: Building): number {
  return b.type === 'monitor' && b.link && b.level > 0 ? M.links[b.link].powerKW : 0;
}

/** Signal quality 0..1 for a station's link at this moment (radio suffers in solar storms). */
export function linkQuality(s: GameState, b: Building): number {
  if (!b.link) return 0;
  const L = M.links[b.link];
  const storm = !!s.flare && s.time >= s.flare.start && s.time < s.flare.end;
  return storm ? L.flareQuality : L.quality;
}

export interface StationStatus {
  station: Building;
  /** 0..3: fixes the station's number and series colour. */
  index: number;
  distance: number | null;
  inRange: boolean;
  /** Why it is not delivering data, if it isn't. */
  problem: string | null;
  active: boolean;
  quality: number;
  kw: number;
}

/** Status of every station: the single source for the map, the UI and sampling. */
export function networkStatus(s: GameState): StationStatus[] {
  const ops = opsCenter(s);
  const cap = capacity(s);
  let served = 0;
  return stations(s).map((st, index) => {
    const distance = ops ? linkDistance(st, ops) : null;
    const inRange = !!st.link && distance !== null && distance <= linkRange(st.link, st);
    const kw = st.level > 0 ? powerDraw('monitor', st.level) + linkDraw(st) : 0;
    let problem: string | null = null;
    if (st.level === 0) problem = 'Under construction';
    else if (!ops || ops.level === 0) problem = 'No Operations Center';
    else if (!st.link) problem = 'Not connected';
    else if (!inRange) problem = 'Out of range';
    else if (!st.online) problem = st.enabled ? 'No power' : 'Switched off';
    else if (!ops.online) problem = 'Operations Center has no power';
    else if (served >= cap) problem = `Over capacity (Operations Center supports ${cap})`;
    const active = problem === null;
    if (active) served++;
    return { station: st, index, distance, inRange, problem, active, quality: active ? linkQuality(s, st) : 0, kw };
  });
}

// ---------------- Player actions ----------------
export function canConnect(s: GameState, id: number, kind: LinkKind): Result {
  const st = s.buildings.find((b) => b.id === id && b.type === 'monitor');
  const ops = opsCenter(s);
  if (!st) return { ok: false, reason: 'Not a Monitoring Station' };
  if (st.level === 0) return { ok: false, reason: 'Finish building the station first' };
  if (!ops) return { ok: false, reason: 'Build the Lunar Operations Center first' };
  if (st.link === kind) return { ok: false, reason: 'Already connected this way' };
  const d = linkDistance(st, ops);
  const range = linkRange(kind, st);
  if (d > range) return { ok: false, reason: `Too far for ${M.links[kind].label.toLowerCase()}: ${d.toFixed(1)} of ${range} tiles` };
  if (kind === 'wired') {
    const cost = cableCost(s, st);
    if (!canAfford(s, cost)) return { ok: false, reason: `Cable needs ${cost.regolith} regolith (not enough ${missingFor(s, cost).join(', ')})` };
  }
  return { ok: true };
}

export function connect(s: GameState, id: number, kind: LinkKind): Result {
  const can = canConnect(s, id, kind);
  if (!can.ok) return can;
  const st = s.buildings.find((b) => b.id === id)!;
  if (kind === 'wired') pay(s, cableCost(s, st));
  st.link = kind;
  addLog(s, `Monitoring Station #${stations(s).indexOf(st) + 1} connected by ${M.links[kind].label.toLowerCase()}.`, 'good');
  if (!s.scienceSeen.includes('lunarRadiation') && !s.scienceQueue.includes('lunarRadiation')) s.scienceQueue.push('lunarRadiation');
  return { ok: true };
}

export function disconnect(s: GameState, id: number): Result {
  const st = s.buildings.find((b) => b.id === id && b.type === 'monitor');
  if (!st || !st.link) return { ok: false, reason: 'Not connected' };
  st.link = null;
  addLog(s, 'Monitoring Station disconnected.');
  return { ok: true };
}

// ---------------- Sensors (game model built on real reference values) ----------------
/** What a station's instruments read right now. */
export function measure(s: GameState, st: Building): { temp: number; rad: number; sun: number } {
  const sun = sunlight(s);
  const terrain = getTerrain(s.seed, s.difficulty);
  let cold = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(terrain, st.x + dx, st.y + dy) === 'ice') cold = M.iceColdOffset;
  const wobble = Math.sin(s.time / 7 + st.id * 1.7) * 2;
  const temp = M.tempNight + (M.tempDay - M.tempNight) * Math.pow(sun, 0.35) + cold + wobble;
  const f = s.flare;
  let rad = M.radiationBackground + Math.sin(s.time / 5 + st.id) * 3;
  if (f && s.time >= f.start && s.time < f.end) rad += RADIATION.doseRate * 1000; // unshielded, mSv → µSv
  else if (f) rad += 15; // first energetic particles arrive ahead of the storm
  return { temp, rad, sun: M.solarConstant * sun };
}

/** Sample every built station on a fixed clock; active ones deliver data, the rest log a gap. */
export function updateMonitoring(s: GameState) {
  if (s.time < s.monitoring.nextSampleAt) return;
  s.monitoring.nextSampleAt = Math.floor(s.time / M.sampleEvery) * M.sampleEvery + M.sampleEvery;
  for (const ns of networkStatus(s)) {
    const st = ns.station;
    if (st.level === 0) continue;
    const key = String(st.id);
    const list = (s.monitoring.samples[key] ??= []);
    const ok = ns.active && ns.quality >= M.minQuality;
    const reading = ok ? measure(s, st) : { temp: NaN, rad: NaN, sun: NaN };
    const solar = s.buildings.filter((b) => b.type === 'solar' && b.level > 0);
    const dust = solar.length ? (solar.reduce((a, b) => a + (b.dust ?? 0), 0) / solar.length) * 100 : 0;
    const impacts = s.station.impacts.filter((x) => x.t > s.time - M.sampleEvery).length;
    const sample: Sample = { t: s.time, ok, kw: ns.kw, ...reading, dust: ok ? dust : NaN, impacts: ok ? impacts : NaN };
    list.push(sample);
    if (list.length > M.historyLength) list.splice(0, list.length - M.historyLength);
    if (ok && !commsDown(s)) {
      const c = M.creditsPerSample * st.level;
      s.res.credits += c;
      s.stats.creditsEarned += c;
      s.monitoring.dataCredits += c;
    }
  }
}

/** Extra seconds of solar-flare warning from the network (needs Operations Center level 3). */
export function flareWarningBonus(s: GameState): number {
  const ops = opsCenter(s);
  if (!ops || ops.level < M.unlock.warnings || !ops.online) return 0;
  return networkStatus(s).filter((n) => n.active).length * M.warningPerStation;
}

/** Network power: Operations Center + stations + links (kW). */
export function networkPower(s: GameState): { ops: number; stations: number; total: number } {
  const ops = opsCenter(s);
  const opsKw = ops && ops.level > 0 && ops.online ? powerDraw('opscenter', ops.level) : 0;
  const st = networkStatus(s).filter((n) => n.station.online).reduce((a, n) => a + n.kw, 0);
  return { ops: opsKw, stations: st, total: opsKw + st };
}
