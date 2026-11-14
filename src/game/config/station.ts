// GAME VALUES — life support (CO₂, waste, water recovery), surface environment
// (dust, micrometeoroids, wear) and maintenance. Real reference values that
// inspired them are noted as REAL; the game numbers are compressed for play.

export const LIFE = {
  /** kg CO₂ per astronaut per colony hour. REAL: ~1.0 kg/day exhaled vs ~0.84 kg O₂ inhaled (ratio ≈ 1.25). */
  co2PerCrew: 0.125,
  /** Cabin air volume, m³: Command Center + per habitat level. */
  cabinCommand: 150,
  cabinPerHabitatLevel: 100,
  /** CO₂ scrubbing capacity, kg/h (only while the building is powered). REAL: ISS uses CDRA; Apollo used LiOH canisters. */
  scrubCommand: 0.6,
  scrubPerHabitatLevel: 0.5,
  /** CO₂ thresholds in ppm. REAL: Earth's air ≈ 420 ppm; the ISS usually keeps CO₂ below about 3,000–5,000 ppm. */
  co2Ok: 3000,
  co2Warn: 5000,
  co2Danger: 10000,
  /** Health damage per hour above co2Danger, and above 3× co2Danger. */
  co2Damage: 0.5,
  co2SevereDamage: 1.2,
  /** Solid/organic waste per astronaut per hour (kg). */
  wastePerCrew: 0.04,
  wasteBaseCap: 40,
  wastePerStorageLevel: 30,
  /** Hygiene problem once waste storage overflows. */
  wasteDamage: 0.2,
  /** Greenhouses compost waste as fertiliser (kg/h per level) for a food bonus. */
  compostPerGreenhouseLevel: 0.08,
  compostFoodBonus: 0.25,
  /** Share of crew water recovered by recycling (needs a powered Command Center). REAL: ISS reached ~98% in 2023. */
  waterRecoveryBase: 0.5,
  waterRecoveryTech: 0.85,
};

export const ENVIRONMENT = {
  /** Dust settling on each solar farm per hour (0..1 coverage). */
  dustPerHour: 0.0004,
  /** Extra dust on every panel when a rocket launches. REAL: landing/launch plumes blast regolith at high speed. */
  dustPerLaunch: 0.05,
  /** Micrometeoroid impact chance per colony hour (any building). REAL: LRO found ~220 new craters per year across the Moon. */
  impactChancePerHour: 0.003,
  impactDamage: [5, 15] as const,
  /** Equipment wear per hour for working buildings (condition %). Quick-patched equipment wears ×3. */
  wearPerHour: 0.006,
  patchedWearMult: 3,
  /** Below this condition a building needs maintenance and loses output. */
  maintenanceBelow: 50,
};

export const MAINTENANCE = {
  repair: { regolith: 60, titanium: 10, hours: 10 },
  clean: { hours: 8 },
};

/** Output multiplier from equipment condition (0..100). */
export function conditionFactor(condition: number | undefined): number {
  const c = condition ?? 100;
  if (c <= 0) return 0;
  if (c >= ENVIRONMENT.maintenanceBelow) return 1;
  return 0.4 + 0.6 * (c / ENVIRONMENT.maintenanceBelow);
}

/** Difficulty factor on how often dynamic events happen (lower = more often). */
export const EVENT_GAP: Record<string, number> = { easy: 1.4, medium: 1, hard: 0.85, impossible: 0.7 };
export const EVENTS_TIMING = { minGap: 170, maxGap: 320 };
