// GAME VALUES — every difficulty-dependent number lives in this one file.

export type DifficultyId = 'easy' | 'medium' | 'hard' | 'impossible';

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  tagline: string;
  /** 1..4, shown as a pip meter on the card. */
  rank: number;
  /** Tailwind-friendly theme colour. */
  color: string;

  // ---- Headline multipliers (shown on the selection card) ----
  /** Overall resource abundance. Drives deposits and starting materials. */
  resourceAbundance: number;
  /** Share of the day–night cycle that is daylight (night = 1 − this). */
  dayFraction: number;
  /** Build/upgrade SPEED multiplier: duration = base ÷ speed. */
  upgradeSpeed: number;
  /** Solar output multiplier. */
  solarMult: number;

  // ---- How abundance is applied (not one flat multiplier) ----
  deposits: {
    /** How many ice patches and ore (ilmenite) patches spawn. */
    ice: number;
    ore: number;
    /** Patch radius scale (bigger = more tiles per deposit). */
    size: number;
  };
  /** Output per deposit, per resource. Rare titanium scales hardest; life-critical ice the gentlest. */
  yields: { regolith: number; ice: number; titanium: number };
  /** Starting regolith / titanium / ice / credits multiplier. */
  startMaterials: number;
  /** Health damage multiplier when supplies run out (Easy is forgiving). */
  survivalDamage: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  easy: {
    id: 'easy', name: 'Easy', rank: 1, color: '#3fdc7c',
    tagline: 'Rich deposits, long days and fast builders. Great for learning how a lunar base works.',
    resourceAbundance: 1.8, dayFraction: 0.7, upgradeSpeed: 1.5, solarMult: 1.0,
    deposits: { ice: 6, ore: 6, size: 1.25 },
    yields: { regolith: 1.4, ice: 1.3, titanium: 1.6 },
    startMaterials: 1.5,
    survivalDamage: 0.6,
  },
  medium: {
    id: 'medium', name: 'Medium', rank: 2, color: '#5fb0ff',
    tagline: 'The intended balance. Days are a little longer than nights.',
    resourceAbundance: 1.0, dayFraction: 0.55, upgradeSpeed: 1.0, solarMult: 1.0,
    deposits: { ice: 4, ore: 4, size: 1.0 },
    yields: { regolith: 1, ice: 1, titanium: 1 },
    startMaterials: 1,
    survivalDamage: 1,
  },
  hard: {
    id: 'hard', name: 'Hard', rank: 3, color: '#ffa53c',
    tagline: 'Scarce deposits, equal day and night, slow construction. Every kilowatt-hour counts.',
    resourceAbundance: 0.5, dayFraction: 0.5, upgradeSpeed: 0.75, solarMult: 1.0,
    deposits: { ice: 3, ore: 2, size: 0.85 },
    yields: { regolith: 0.85, ice: 0.85, titanium: 0.6 },
    startMaterials: 0.85,
    survivalDamage: 1,
  },
  impossible: {
    id: 'impossible', name: 'Impossible', rank: 4, color: '#ff4d4d',
    tagline: 'Nights last almost twice as long as days. Better panels (+20%) help, but only careful storage keeps the crew alive.',
    resourceAbundance: 0.25, dayFraction: 0.35, upgradeSpeed: 0.65, solarMult: 1.2,
    deposits: { ice: 2, ore: 1, size: 0.75 },
    // Common regolith is cut gently so a base can still be built; rare titanium is cut hardest.
    yields: { regolith: 0.75, ice: 0.75, titanium: 0.4 },
    startMaterials: 0.75,
    survivalDamage: 1,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'medium', 'hard', 'impossible'];
export const DEFAULT_DIFFICULTY: DifficultyId = 'medium';

export function isDifficultyId(v: unknown): v is DifficultyId {
  return typeof v === 'string' && v in DIFFICULTIES;
}
