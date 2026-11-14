import type { BuildingType } from '../config/buildings';
import type { TechId } from '../config/techs';
import { START, RADIATION, DAY_NIGHT, type CargoKind } from '../config/balance';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type DifficultyId } from '../config/difficulty';
import type { LinkKind } from '../config/monitoring';
import { CC_POS } from './terrain';

export type ResKey = 'regolith' | 'titanium' | 'ice' | 'credits';
export type JobKind = 'build' | 'upgrade' | 'shield' | 'repair' | 'clean';

export interface Job {
  kind: JobKind;
  builder: number;
  start: number;
  end: number;
  /** Cleaning job: clean every solar farm, not just this one. */
  all?: boolean;
}

export interface Building {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
  /** 0 while first being constructed. */
  level: number;
  /** Regolith shielding level (habitats). */
  shield: number;
  /** Player power switch. */
  enabled: boolean;
  /** Actually powered this tick. */
  online: boolean;
  /** Oxygen generator: share of processed water split into O₂ (0..1). */
  split: number;
  job: Job | null;
  /** Monitoring Station only: how it connects to the Operations Center. */
  link?: LinkKind | null;
  /** Equipment condition 0..100 (wear, impacts, failures). Missing = 100. */
  condition?: number;
  /** Solar farms: dust coverage 0..1. Missing = 0. */
  dust?: number;
  /** Player power priority override (higher = kept on longer). */
  priority?: number;
  /** Quick-patched equipment wears out faster until properly repaired. */
  patched?: boolean;
}

/** One measurement from a Monitoring Station. `ok: false` = sample lost (no link or interference). */
export interface Sample {
  t: number;
  ok: boolean;
  temp: number; // degrees C
  rad: number; // microsievert per hour
  sun: number; // W/m2
  kw: number; // station + link power draw
  /** Average solar-panel dust coverage at sampling time, % (surface environment). */
  dust?: number;
  /** Micrometeoroid impacts recorded since the previous sample. */
  impacts?: number;
}

export type LogKind = 'info' | 'good' | 'warn' | 'bad';
export interface LogEntry { id: number; t: number; text: string; kind: LogKind }

export interface Flows {
  powerProd: number; powerDemand: number; powerUsed: number; batteryCap: number;
  regolith: number; titanium: number; ice: number;
  o2: number; water: number; food: number;
  sunlight: number;
  doseRate: number;
  shieldBlock: number;
  crewCap: number;
  caps: Record<'regolith' | 'titanium' | 'ice' | 'o2' | 'water' | 'food', number>;
  starving: ('o2' | 'water' | 'food' | 'cold' | 'co2' | 'waste')[];
  /** Cabin CO₂ in parts per million. */
  co2ppm: number;
  co2: number; // net kg/h
  waste: number; // net kg/h
  /** Share of crew water recovered by recycling (0..1). */
  waterRecovery: number;
  /** Average solar efficiency from dust and equipment condition (0..1). */
  solarEfficiency: number;
  /** True when an enabled building lost power this tick. */
  shortage: boolean;
}

export interface GameState {
  version: number;
  seed: number;
  /** Chosen at new-game time and saved; never changes during a colony. */
  difficulty: DifficultyId;
  rng: number;
  time: number; // colony hours (= real seconds)
  nextId: number;
  nextLogId: number;
  buildings: Building[];
  res: Record<ResKey, number>;
  battery: number; // kWh
  life: { o2: number; water: number; food: number; co2: number; waste: number };
  crew: { count: number; health: number; dose: number; arrivalTimer: number };
  builders: number;
  research: { owned: TechId[]; active: { id: TechId; start: number; end: number } | null };
  cargo: { active: { kind: CargoKind; start: number; end: number; payout: number } | null; runs: number };
  flare: { warnAt: number; start: number; end: number; dose: number } | null;
  /** Monitoring network data, keyed by station building id. */
  monitoring: { samples: Record<string, Sample[]>; nextSampleAt: number; dataCredits: number };
  /** Mission quiz progress in this colony. */
  quiz: { answered: string[]; correct: number };
  /** Station-wide modes and the dynamic event system. */
  station: {
    emergency: boolean;
    nextEventAt: number;
    pending: PendingEvent | null;
    effects: Effect[];
    history: EventRecord[];
    impacts: { t: number; buildingId: number }[];
  };
  /** Cumulative mission totals for the mission report. */
  totals: Totals;
  nextFlareAt: number;
  cycle: { index: number; wasNight: boolean; outage: boolean; startLife: { o2: number; water: number; food: number }; stockDipped: boolean; shortage: boolean };
  stats: {
    nightsSurvived: number; cleanNights: number; flaresSurvived: number; selfSufficientCycles: number;
    creditsEarned: number; cargoCredits: number; buildersBought: number; buildingsBuilt: number; maxLevel: number;
    energyCycles: number; eventsResolved: number; shelterChoices: number;
  };
  missionsDone: string[];
  achievements: string[];
  scienceQueue: string[];
  scienceSeen: string[];
  log: LogEntry[];
  failed: { cause: FailCause } | null;
  won: boolean;
  lastCause: FailCause | null;
  savedAt: number;
  /** Recomputed every tick; not saved. */
  flows: Flows;
}

export type FailCause = 'o2' | 'water' | 'food' | 'cold' | 'radiation' | 'co2' | 'waste';

/** A dynamic event waiting for the commander's decision. */
export interface PendingEvent {
  id: string;
  t: number;
  /** Building the event affects, if any. */
  buildingId?: number;
  /** Event-specific numbers (e.g. litres lost). */
  amount?: number;
}

/** A temporary effect on the station. */
export interface Effect {
  type: 'leak' | 'waterCap' | 'batteryFault' | 'commsDown' | 'backupAntenna' | 'tilt' | 'shelter' | 'workThrough' | 'electronicsOff';
  until: number;
  buildingId?: number;
}

/** One entry in the mission history. */
export interface EventRecord {
  t: number;
  eventId: string;
  choiceId: string | null;
  outcome: string;
  quality: 'good' | 'ok' | 'risky';
}

export interface Totals {
  o2Used: number; waterUsed: number; waterRecycled: number; foodUsed: number; co2Removed: number;
  wasteMade: number; wasteComposted: number; energyMade: number; energyUsed: number;
  regolithMined: number; iceMined: number; titaniumMade: number; foodGrown: number; o2Made: number;
}

export const emptyTotals = (): Totals => ({
  o2Used: 0, waterUsed: 0, waterRecycled: 0, foodUsed: 0, co2Removed: 0,
  wasteMade: 0, wasteComposted: 0, energyMade: 0, energyUsed: 0,
  regolithMined: 0, iceMined: 0, titaniumMade: 0, foodGrown: 0, o2Made: 0,
});

export const SAVE_VERSION = 3;

export function emptyFlows(): Flows {
  return {
    powerProd: 0, powerDemand: 0, powerUsed: 0, batteryCap: 0,
    regolith: 0, titanium: 0, ice: 0, o2: 0, water: 0, food: 0,
    sunlight: 1, doseRate: 0, shieldBlock: 0, crewCap: 0,
    caps: { regolith: 0, titanium: 0, ice: 0, o2: 0, water: 0, food: 0 },
    starving: [],
    co2ppm: 0, co2: 0, waste: 0, waterRecovery: 0, solarEfficiency: 1, shortage: false,
  };
}

export function createInitialState(seed = 20261114, difficulty: DifficultyId = DEFAULT_DIFFICULTY): GameState {
  const m = DIFFICULTIES[difficulty].startMaterials;
  const mat = (v: number) => Math.round((v * m) / 10) * 10;
  const cc: Building = {
    id: 1, type: 'command', x: CC_POS.x, y: CC_POS.y, level: 1, shield: 0,
    enabled: true, online: true, split: 0.5, job: null,
  };
  return {
    version: SAVE_VERSION,
    seed,
    difficulty,
    rng: seed ^ 0x5bd1e995,
    time: DAY_NIGHT.ramp + 2, // start just after sunrise
    nextId: 2,
    nextLogId: 1,
    buildings: [cc],
    res: { regolith: mat(START.regolith), titanium: mat(START.titanium), ice: mat(START.ice), credits: mat(START.credits) },
    battery: START.batteryKWh,
    life: { o2: START.o2, water: START.water, food: START.food, co2: 0.2, waste: 0 },
    crew: { count: START.crew, health: 100, dose: 0, arrivalTimer: 0 },
    builders: 1,
    research: { owned: [], active: null },
    cargo: { active: null, runs: 0 },
    flare: null,
    monitoring: { samples: {}, nextSampleAt: 0, dataCredits: 0 },
    nextFlareAt: RADIATION.firstFlareAfter,
    quiz: { answered: [], correct: 0 },
    station: { emergency: false, nextEventAt: 260, pending: null, effects: [], history: [], impacts: [] },
    totals: emptyTotals(),
    cycle: { index: 0, wasNight: false, outage: false, startLife: { o2: START.o2, water: START.water, food: START.food }, stockDipped: false, shortage: false },
    stats: {
      nightsSurvived: 0, cleanNights: 0, flaresSurvived: 0, selfSufficientCycles: 0,
      creditsEarned: 0, cargoCredits: 0, buildersBought: 0, buildingsBuilt: 0, maxLevel: 1,
      energyCycles: 0, eventsResolved: 0, shelterChoices: 0,
    },
    missionsDone: [],
    achievements: [],
    scienceQueue: ['intro'],
    scienceSeen: [],
    log: [{ id: 0, t: 0, text: 'Touchdown! Commander, the lander is down. Build power and life support before sunset.', kind: 'info' }],
    failed: null,
    won: false,
    lastCause: null,
    savedAt: Date.now(),
    flows: emptyFlows(),
  };
}

export const hasEffect = (s: GameState, type: Effect['type']) => s.station.effects.some((e) => e.type === type && e.until > s.time);

export function addLog(s: GameState, text: string, kind: LogKind = 'info') {
  s.log.unshift({ id: s.nextLogId++, t: s.time, text, kind });
  if (s.log.length > 60) s.log.length = 60;
}
