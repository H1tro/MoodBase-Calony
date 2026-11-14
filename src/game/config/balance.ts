// GAME VALUES — every tunable number of the simulation lives here.
// Time unit: 1 real second of play = 1 "colony hour" (h).
// These are game assumptions, deliberately compressed and simplified.
// Real lunar facts are kept separately in science.ts.

export const TICK_SECONDS = 0.25;

export const MAP_SIZE = 20;

export const DAY_NIGHT = {
  /** Full day+night cycle length in colony hours (real Moon: ~708 h). */
  cycle: 360,
  // The day/night split depends on difficulty: see config/difficulty.ts (dayFraction).
  /** Dawn/dusk ramp in hours where solar output fades in/out. */
  ramp: 12,
};

export const START = {
  regolith: 600,
  titanium: 40,
  ice: 50,
  credits: 200,
  batteryKWh: 200,
  o2: 55,
  water: 110,
  food: 60,
  crew: 2,
};

export const PRODUCTION = {
  solarKW: 5, // per level, full sunlight
  batteryKWh: 400, // per level
  commandBatteryKWh: 200,
  mineRegolith: 3, // per hour per level
  oreBonus: 1.5,
  refineryRegolithIn: 4, // per hour per level
  refineryTitaniumOut: 0.6,
  iceKg: 1.2, // per hour per level
  oxygenIceIn: 0.8, // kg ice processed per hour per level
  /** Electrolysis: 1 kg water → 0.89 kg O₂ (real chemistry: O is 16/18 of water by mass). */
  o2PerWater: 0.89,
  greenhouseWaterIn: 0.3, // L/h per level
  greenhouseFoodOut: 0.15, // kg/h per level
  habitatCrewPerLevel: 2,
  commandCrew: 2,
};

export const STORAGE = {
  base: { regolith: 1000, titanium: 200, ice: 300 },
  perStorageLevel: { regolith: 1000, titanium: 250, ice: 300 },
  perCommandLevel: { regolith: 300, titanium: 60, ice: 60 },
  o2Base: 60, o2PerOxygenLevel: 40, o2PerHabitatLevel: 20,
  waterBase: 120, waterPerIceLevel: 40, waterPerStorageLevel: 100,
  foodBase: 80, foodPerGreenhouseLevel: 40,
};

export const CREW = {
  o2: 0.1, // kg per astronaut per hour
  water: 0.2, // L per astronaut per hour
  food: 0.08, // kg per astronaut per hour
  arrivalEvery: 45, // hours between new astronauts when there is room
  /** Health damage per hour when a supply runs out. */
  damage: { o2: 1.5, water: 0.5, food: 0.3, cold: 0.4 },
  recovery: 0.3,
};

export const RADIATION = {
  firstFlareAfter: 420,
  minGap: 300,
  maxGap: 600,
  warning: 30,
  duration: 20,
  doseRate: 8, // mSv per hour, unshielded (game scale)
  healthPerMSv: 0.15,
  commandShield: 0.3,
  /** Fraction of dose blocked by regolith shielding level 0..3. */
  shieldBlock: [0, 0.4, 0.65, 0.8],
  maxShield: 3,
  shieldCost: (next: number) => ({ regolith: 200 * next }),
  shieldTime: (next: number) => 15 * next,
};

export const BUILDER_PRICES = [500, 1500, 3000, 6000];
export const MAX_BUILDERS = 5;

export const CARGO = {
  duration: 45,
  levelBonus: 0.15,
  options: {
    regolith: { label: 'Regolith', amount: 400, unit: 'kg', payout: 120 },
    titanium: { label: 'Titanium', amount: 60, unit: 'kg', payout: 300 },
    water: { label: 'Water', amount: 40, unit: 'L', payout: 200 },
  },
} as const;

export type CargoKind = keyof typeof CARGO.options;

/** Offline catch-up limit in hours (= real seconds). */
export const OFFLINE_CAP = 1800;
