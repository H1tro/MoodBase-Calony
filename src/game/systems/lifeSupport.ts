import { CREW } from '../config/balance';
import { LIFE } from '../config/station';
import { addLog, hasEffect, type FailCause, type GameState } from './state';
import { active, crewCapacity, diff, hasTech, levelSum } from './selectors';

type Problem = 'o2' | 'water' | 'food' | 'cold' | 'co2' | 'waste';

/** Cabin air volume (m³). */
export function cabinVolume(s: GameState): number {
  return LIFE.cabinCommand + levelSum(s, 'habitat') * LIFE.cabinPerHabitatLevel;
}

/** Convert kg of CO₂ in the cabin to parts per million (by volume). Air ≈ 1.2 kg/m³, 29 g/mol; CO₂ 44 g/mol. */
export function co2ToPpm(kg: number, volume: number): number {
  const airMol = (volume * 1.2 * 1000) / 29;
  return 420 + ((kg * 1000) / 44 / airMol) * 1e6;
}

/** CO₂ scrubbing capacity right now (kg/h). Scrubbers only work with power. */
export function scrubCapacity(s: GameState): number {
  const cc = s.buildings.find((b) => b.type === 'command');
  let cap = cc?.online ? LIFE.scrubCommand : 0;
  for (const h of active(s, 'habitat')) if (h.online) cap += LIFE.scrubPerHabitatLevel * h.level;
  return cap;
}

/** Share of crew water that is recycled (needs a powered Command Center). */
export function waterRecovery(s: GameState): number {
  const cc = s.buildings.find((b) => b.type === 'command');
  if (!cc?.online) return 0;
  return hasTech(s, 'waterRecycle') ? LIFE.waterRecoveryTech : LIFE.waterRecoveryBase;
}

export function wasteCap(s: GameState): number {
  return LIFE.wasteBaseCap + levelSum(s, 'storage') * LIFE.wastePerStorageLevel;
}

const DAMAGE: Record<Problem, number> = { ...CREW.damage, co2: LIFE.co2Damage, waste: LIFE.wasteDamage };
const MESSAGES: Record<Problem, string> = {
  o2: 'OXYGEN DEPLETED! Crew are suffocating.',
  water: 'Water tanks are empty!',
  food: 'Food stores are empty!',
  cold: 'Life support has no power — habitats are freezing!',
  co2: 'CO₂ is at a dangerous level! Scrubbers need power.',
  waste: 'Waste storage is full — hygiene problems are making the crew ill.',
};

/** Crew breathe, drink and eat; scrubbers, recycling and storage keep up (or don't). */
export function updateLifeSupport(s: GameState, dt: number) {
  const n = s.crew.count;
  const T = s.totals;
  const problems: Problem[] = [];

  // --- Oxygen, food: consumed by the crew ---
  const o2 = CREW.o2 * n * dt;
  const food = CREW.food * n * dt;
  T.o2Used += Math.min(o2, s.life.o2);
  T.foodUsed += Math.min(food, s.life.food);
  if (s.life.o2 >= o2) s.life.o2 -= o2;
  else { s.life.o2 = 0; problems.push('o2'); }
  if (s.life.food >= food) s.life.food -= food;
  else { s.life.food = 0; problems.push('food'); }

  // --- Water: used by the crew, partly recovered by recycling ---
  const recovery = waterRecovery(s);
  s.flows.waterRecovery = recovery;
  const gross = CREW.water * n * dt;
  const net = gross * (1 - recovery);
  T.waterUsed += gross;
  T.waterRecycled += gross - net;
  if (hasEffect(s, 'leak')) s.life.water = Math.max(0, s.life.water - 0.8 * dt);
  if (s.life.water >= net) s.life.water -= net;
  else { s.life.water = 0; problems.push('water'); }

  // --- CO₂: exhaled by the crew, removed by powered scrubbers ---
  s.life.co2 += LIFE.co2PerCrew * n * dt;
  const removed = Math.min(Math.max(0, s.life.co2 - 0.05), scrubCapacity(s) * dt);
  s.life.co2 -= removed;
  T.co2Removed += removed;
  const ppm = co2ToPpm(s.life.co2, cabinVolume(s));
  s.flows.co2ppm = ppm;
  let co2Damage = 0;
  if (ppm > LIFE.co2Danger * 3) co2Damage = LIFE.co2SevereDamage;
  else if (ppm > LIFE.co2Danger) co2Damage = LIFE.co2Damage;
  if (co2Damage > 0) problems.push('co2');
  if (ppm > LIFE.co2Warn && !s.scienceSeen.includes('co2Scrubbing') && !s.scienceQueue.includes('co2Scrubbing')) s.scienceQueue.push('co2Scrubbing');

  // --- Waste: produced by the crew, composted by greenhouses (see resources.ts) ---
  const waste = LIFE.wastePerCrew * n * dt;
  s.life.waste += waste;
  T.wasteMade += waste;
  const wcap = wasteCap(s);
  if (s.life.waste > wcap) {
    s.life.waste = wcap;
    problems.push('waste');
  }

  // --- Heating / air circulation: crew are cold if no living quarters have power ---
  const habitats = active(s, 'habitat');
  const cc = s.buildings.find((b) => b.type === 'command')!;
  const warm = cc.online || habitats.some((h) => h.online);
  const habitatsDark = habitats.length > 0 && habitats.every((h) => !h.online);
  if (!warm || habitatsDark) problems.push('cold');
  if (habitats.some((h) => h.enabled && !h.online) || (!cc.online && cc.enabled)) s.cycle.outage = true;

  // --- Health ---
  const prev = s.flows.starving;
  if (problems.length) {
    const worst = [...problems].sort((a, b) => (b === 'co2' ? co2Damage : DAMAGE[b]) - (a === 'co2' ? co2Damage : DAMAGE[a]))[0];
    s.lastCause = worst as FailCause;
  }
  const mult = diff(s).survivalDamage;
  for (const k of problems) {
    s.crew.health -= (k === 'co2' ? co2Damage : DAMAGE[k]) * mult * dt;
    if (!prev.includes(k)) addLog(s, MESSAGES[k], 'bad');
  }
  if (problems.some((k) => k === 'o2' || k === 'water' || k === 'food')) s.cycle.stockDipped = true;
  if (problems.length === 0 && !s.flare) s.crew.health = Math.min(100, s.crew.health + CREW.recovery * dt);
  s.flows.starving = problems;

  // --- New astronauts arrive when there is room and supplies are healthy ---
  const cap = crewCapacity(s);
  s.flows.crewCap = cap;
  if (s.crew.count < cap && s.life.o2 > 5 && s.life.water > 5 && s.life.food > 5 && s.crew.health > 50 && ppm < LIFE.co2Warn) {
    s.crew.arrivalTimer += dt;
    if (s.crew.arrivalTimer >= CREW.arrivalEvery) {
      s.crew.arrivalTimer = 0;
      s.crew.count++;
      addLog(s, `A new astronaut has arrived. Crew: ${s.crew.count}.`, 'good');
    }
  } else s.crew.arrivalTimer = 0;

  if (s.crew.health <= 0 && !s.failed) {
    s.crew.health = 0;
    s.failed = { cause: s.lastCause ?? 'o2' };
    addLog(s, 'MISSION FAILED — the crew had to evacuate.', 'bad');
  }
}
