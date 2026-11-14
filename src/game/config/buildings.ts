// GAME VALUES — building definitions. These numbers are game-balance
// assumptions chosen for fun and clarity, NOT NASA engineering data.

export type BuildingType =
  | 'command'
  | 'solar'
  | 'battery'
  | 'mine'
  | 'refinery'
  | 'ice'
  | 'oxygen'
  | 'greenhouse'
  | 'habitat'
  | 'storage'
  | 'builderStation'
  | 'lab'
  | 'spaceport'
  | 'opscenter'
  | 'monitor';

export type Cost = { regolith?: number; titanium?: number; ice?: number; credits?: number };

export interface BuildingDef {
  type: BuildingType;
  name: string;
  icon: string;
  size: number; // footprint is size × size tiles
  role: string;
  /** The engineering trade-off this building teaches. */
  lesson: string;
  /** Max number allowed, indexed by Command Center level − 1. 0 = locked. */
  maxCount: [number, number, number, number, number];
  baseCost: Cost;
  /** Seconds to build level 1. */
  baseTime: number;
  /** Power draw in kW at level 1 while switched on (0 = none). */
  power: number;
  /** Higher = kept online longer when energy runs out. */
  priority: number;
  /** Must at least one footprint tile be ice? */
  needsIce?: boolean;
  lifeSupport?: boolean;
  /** Highest level for this type (default MAX_LEVEL). */
  maxLevel?: number;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  command: {
    type: 'command', name: 'Command Center', icon: '🛰️', size: 3,
    role: 'Heart of the colony. Its level unlocks new buildings and caps how far others can be upgraded. Houses the first 2 astronauts.',
    lesson: 'Every system depends on the core: upgrading it opens options but costs lots of material and a builder for a long time.',
    maxCount: [1, 1, 1, 1, 1], baseCost: { regolith: 600, credits: 150 }, baseTime: 40, power: 1.5, priority: 8, lifeSupport: true,
  },
  solar: {
    type: 'solar', name: 'Solar Farm', icon: '☀️', size: 2,
    role: 'Makes electricity in sunlight. Produces nothing during the lunar night.',
    lesson: 'Sunlight is free but disappears at night, so solar only works together with storage.',
    maxCount: [3, 4, 5, 6, 8], baseCost: { regolith: 120 }, baseTime: 12, power: 0, priority: 0,
  },
  battery: {
    type: 'battery', name: 'Battery Station', icon: '🔋', size: 2,
    role: 'Stores energy (kWh) so the base keeps running through the night.',
    lesson: 'Storage is heavy and expensive. Too little and life support fails at night; too much wastes material.',
    maxCount: [2, 3, 4, 5, 6], baseCost: { regolith: 150 }, baseTime: 15, power: 0, priority: 0,
  },
  mine: {
    type: 'mine', name: 'Regolith Mine', icon: '⛏️', size: 2,
    role: 'Excavates regolith, the basic building material. +50% output when placed on ore-rich ground.',
    lesson: 'Mining is power-hungry. At night you may need to switch it off to save energy for life support.',
    maxCount: [1, 2, 3, 3, 4], baseCost: { regolith: 80 }, baseTime: 10, power: 1.5, priority: 3,
  },
  refinery: {
    type: 'refinery', name: 'Titanium Refinery', icon: '🏭', size: 2,
    role: 'Processes regolith into titanium, needed for advanced upgrades.',
    lesson: 'Refining uses the most power per unit. Run it in daylight when solar is plentiful.',
    maxCount: [0, 1, 2, 2, 3], baseCost: { regolith: 300, credits: 100 }, baseTime: 30, power: 3, priority: 2,
  },
  ice: {
    type: 'ice', name: 'Ice Extractor', icon: '🧊', size: 2,
    role: 'Mines lunar ice. Must be placed on an ice deposit (blue tiles).',
    lesson: 'Water ice is the most precious lunar resource: it becomes drinking water, oxygen and even rocket fuel.',
    maxCount: [1, 2, 2, 3, 3], baseCost: { regolith: 150 }, baseTime: 15, power: 1.5, priority: 6, needsIce: true, lifeSupport: true,
  },
  oxygen: {
    type: 'oxygen', name: 'Oxygen Generator', icon: '🫧', size: 2,
    role: 'Melts ice into water and splits some of it into oxygen (electrolysis). Use the slider to choose water vs O₂.',
    lesson: 'The same ice can become water OR oxygen, not both. Engineers balance the split against crew needs.',
    maxCount: [1, 2, 2, 3, 3], baseCost: { regolith: 180 }, baseTime: 18, power: 2, priority: 9, lifeSupport: true,
  },
  greenhouse: {
    type: 'greenhouse', name: 'Greenhouse', icon: '🌱', size: 2,
    role: 'Grows food using water and power.',
    lesson: 'Growing food costs water and energy, but shipping food from Earth forever is impossible for a permanent base.',
    maxCount: [1, 1, 2, 3, 4], baseCost: { regolith: 200 }, baseTime: 20, power: 1.5, priority: 7, lifeSupport: true,
  },
  habitat: {
    type: 'habitat', name: 'Habitat', icon: '🏠', size: 2,
    role: 'Living quarters for 2 astronauts per level. Can be covered with regolith shielding against radiation.',
    lesson: 'Piling regolith on habitats blocks radiation, but every ton spent on shielding is a ton not spent on growth.',
    maxCount: [1, 2, 3, 4, 5], baseCost: { regolith: 200 }, baseTime: 20, power: 1, priority: 10, lifeSupport: true,
  },
  storage: {
    type: 'storage', name: 'Resource Storage', icon: '📦', size: 2,
    role: 'Raises the storage limits for regolith, titanium, ice and water.',
    lesson: 'Production is useless if there is nowhere to keep it. Full storage means wasted output.',
    maxCount: [1, 2, 2, 3, 4], baseCost: { regolith: 150 }, baseTime: 12, power: 0, priority: 0,
  },
  builderStation: {
    type: 'builderStation', name: 'Builder Station', icon: '🤖', size: 2,
    role: 'Garage for builder robots. Each level houses one more robot (up to 5 total).',
    lesson: 'Robots let you build in parallel. Labour, not just material, limits how fast a base grows.',
    maxCount: [1, 1, 1, 1, 1], baseCost: { regolith: 250 }, baseTime: 20, power: 0.5, priority: 5,
  },
  lab: {
    type: 'lab', name: 'Research Lab', icon: '🔬', size: 2,
    role: 'Researches technologies that make the colony more efficient.',
    lesson: 'Research costs resources now but pays back by making every other system better.',
    maxCount: [0, 1, 1, 1, 1], baseCost: { regolith: 400, credits: 150 }, baseTime: 35, power: 1, priority: 4,
  },
  spaceport: {
    type: 'spaceport', name: 'Spaceport', icon: '🚀', size: 3,
    role: 'Launches cargo runs that trade materials for credits.',
    lesson: 'Exporting earns credits, but every kilogram you ship away is gone from the colony.',
    maxCount: [0, 0, 1, 1, 1], baseCost: { regolith: 900, titanium: 100, credits: 300 }, baseTime: 60, power: 2, priority: 1,
  },
  opscenter: {
    type: 'opscenter', name: 'Lunar Operations Center', icon: '🛰', size: 2,
    role: 'The one dispatcher for your monitoring network. Each level supports one more connected Monitoring Station and unlocks deeper data analysis.',
    lesson: 'Data only matters if someone can receive and analyse it. More stations need a bigger control centre, and more power.',
    maxCount: [1, 1, 1, 1, 1], baseCost: { regolith: 350, credits: 150 }, baseTime: 30, power: 1.5, priority: 4, maxLevel: 4,
  },
  monitor: {
    type: 'monitor', name: 'Lunar Monitoring Station', icon: '📡', size: 1,
    role: 'Measures temperature, radiation and sunlight where it stands. Connect it to the Operations Center by cable or radio.',
    lesson: 'A cable is cheap to run and immune to solar storms, but costs material and has short reach. Radio reaches further but uses more power and drops out during flares.',
    maxCount: [4, 4, 4, 4, 4], baseCost: { regolith: 120 }, baseTime: 12, power: 0.3, priority: 3, maxLevel: 4,
  },
};

export const BUILD_ORDER: BuildingType[] = [
  'solar', 'battery', 'mine', 'ice', 'oxygen', 'habitat', 'greenhouse',
  'storage', 'builderStation', 'refinery', 'lab', 'spaceport', 'opscenter', 'monitor',
];

export const MAX_LEVEL = 5;

/** Highest level a building type can reach. */
export const maxLevelOf = (type: BuildingType) => BUILDINGS[type].maxLevel ?? MAX_LEVEL;

/** Cost to reach `level` (1 = initial construction). */
export function costFor(type: BuildingType, level: number): Cost {
  const def = BUILDINGS[type];
  const steps = type === 'command' ? level - 2 : level - 1;
  const mult = Math.pow(1.75, Math.max(0, steps));
  const c: Cost = {};
  if (def.baseCost.regolith) c.regolith = Math.round((def.baseCost.regolith * mult) / 10) * 10;
  if (def.baseCost.credits) c.credits = Math.round((def.baseCost.credits * (type === 'command' ? level - 1 : mult)) / 10) * 10;
  const ti = (def.baseCost.titanium ?? 0) * mult + (level >= 3 ? (type === 'command' ? 100 : 25 * def.size) * (level - 2) : 0);
  if (ti > 0) c.titanium = Math.round(ti / 5) * 5;
  return c;
}

/** Seconds to reach `level`. */
export function timeFor(type: BuildingType, level: number): number {
  const steps = type === 'command' ? level - 2 : level - 1;
  return Math.round(BUILDINGS[type].baseTime * Math.pow(1.55, Math.max(0, steps)));
}

/** Power draw in kW at a level. */
export function powerDraw(type: BuildingType, level: number): number {
  return BUILDINGS[type].power * (1 + 0.25 * (level - 1));
}
