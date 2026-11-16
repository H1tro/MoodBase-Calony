import { DIFFICULTY_ORDER, type DifficultyId } from '../config/difficulty';
import type { SkinId } from '../config/skins';

/** Player preferences, chosen in Options. */
export interface Settings {
  /** Play the launch cinematic when a new colony starts (it still waits for real setup). */
  cinematic: boolean;
  /** Show the mission briefing card at the start of a colony. */
  briefing: boolean;
  /** Game speed when a colony starts or is resumed. */
  defaultSpeed: 1 | 2 | 4;
  /** Fewer camera effects (cinematic shake and zoom, flare flashes). */
  reduceMotion: boolean;
  /** 'low' skips regolith grain, ice glints, cast shadows and footprints for slower computers. */
  graphics: 'high' | 'low';
  /** Show the keyboard shortcut line on wide screens. */
  keyHints: boolean;
  /** Cosmetic surface look (colours and sky only; the simulation stays lunar). */
  skin: SkinId;
  /** 'globe' draws the map on a curved world with a round horizon; 'flat' is the classic plateau. */
  mapShape: 'globe' | 'flat';
}

export interface Unlock {
  at: number; // Date.now()
  difficulty: DifficultyId;
}

/** Career progress that survives across colonies (stored separately from the colony save). */
export interface Profile {
  version: number;
  unlocked: Record<string, Unlock>;
  stats: {
    launches: number;
    retries: number;
    quizCorrect: number;
    failures: number;
    wins: Record<DifficultyId, number>;
    nights: Record<DifficultyId, number>;
  };
  settings: Settings;
}

export const PROFILE_KEY = 'moonbase-v3-profile';
const PROFILE_VERSION = 1;

const perDifficulty = () => Object.fromEntries(DIFFICULTY_ORDER.map((d) => [d, 0])) as Record<DifficultyId, number>;

export const DEFAULT_SETTINGS: Settings = {
  cinematic: true,
  briefing: true,
  defaultSpeed: 1,
  reduceMotion: false,
  graphics: 'high',
  keyHints: true,
  skin: 'moon',
  mapShape: 'globe',
};

export function createProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    unlocked: {},
    stats: { launches: 0, retries: 0, quizCorrect: 0, failures: 0, wins: perDifficulty(), nights: perDifficulty() },
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Parse a stored profile, filling any missing fields with defaults (never throws). */
export function parseProfile(json: string | null): Profile {
  const base = createProfile();
  if (!json) return base;
  try {
    const p = JSON.parse(json) as Partial<Profile>;
    return {
      version: PROFILE_VERSION,
      unlocked: p.unlocked && typeof p.unlocked === 'object' ? p.unlocked : {},
      stats: {
        ...base.stats,
        ...p.stats,
        wins: { ...base.stats.wins, ...p.stats?.wins },
        nights: { ...base.stats.nights, ...p.stats?.nights },
      },
      settings: { ...base.settings, ...p.settings },
    };
  } catch {
    return base;
  }
}

export function loadProfile(): Profile {
  try {
    return parseProfile(typeof localStorage === 'undefined' ? null : localStorage.getItem(PROFILE_KEY));
  } catch {
    return createProfile();
  }
}

/** Listeners notified after the profile is saved (cloud sync hooks in here). */
export const afterProfileSave = new Set<() => void>();

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    for (const l of afterProfileSave) l();
  } catch {
    /* storage full or blocked: progress just isn't kept */
  }
}
