import { OFFLINE_CAP } from '../config/balance';
import { DEFAULT_DIFFICULTY, isDifficultyId } from '../config/difficulty';
import { createInitialState, emptyFlows, SAVE_VERSION, addLog, type GameState } from './state';
import { advance } from './simulation';

export const SAVE_KEY = 'moonbase-v3';
export const CHECKPOINT_KEY = 'moonbase-v3-checkpoint';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function serialize(s: GameState): string {
  const { flows: _flows, ...rest } = s;
  void _flows;
  return JSON.stringify({ ...rest, savedAt: Date.now() });
}

export function deserialize(json: string): GameState | null {
  try {
    const data = JSON.parse(json) as Partial<GameState>;
    if (!data || data.version !== SAVE_VERSION || !Array.isArray(data.buildings)) return null;
    // Saves from before difficulty levels existed are Medium; a saved difficulty is never changed on load.
    const difficulty = isDifficultyId(data.difficulty) ? data.difficulty : DEFAULT_DIFFICULTY;
    const base = createInitialState(data.seed, difficulty);
    return {
      ...base,
      ...data,
      difficulty,
      stats: { ...base.stats, ...data.stats },
      cycle: { ...base.cycle, ...data.cycle },
      crew: { ...base.crew, ...data.crew },
      life: { ...base.life, ...data.life },
      station: { ...base.station, ...data.station },
      totals: { ...base.totals, ...data.totals },
      quiz: { ...base.quiz, ...data.quiz },
      monitoring: { ...base.monitoring, ...data.monitoring },
      flows: emptyFlows(),
    } as GameState;
  } catch {
    return null;
  }
}

/** Listeners notified after a successful local save (cloud sync hooks in here). */
export const afterSave = new Set<() => void>();

export function saveGame(s: GameState, key = SAVE_KEY, storage: Storage | null = safeStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, serialize(s));
    s.savedAt = Date.now();
    for (const l of afterSave) l();
    return true;
  } catch {
    return false;
  }
}

export function loadGame(key = SAVE_KEY, storage: Storage | null = safeStorage()): GameState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? deserialize(raw) : null;
  } catch {
    return null;
  }
}

export function clearSave(storage: Storage | null = safeStorage()) {
  try {
    storage?.removeItem(SAVE_KEY);
    storage?.removeItem(CHECKPOINT_KEY);
  } catch {
    /* ignore */
  }
}

/** Simulate time that passed while the game was closed (capped, never lethal). */
export function catchUp(s: GameState, now = Date.now()) {
  const away = Math.min(OFFLINE_CAP, Math.max(0, (now - s.savedAt) / 1000));
  if (away < 5 || s.failed) return 0;
  const before = { ...s.res };
  advance(s, away, 1);
  if (s.failed) {
    // Offline time should never end the mission; leave the player a chance to recover.
    s.failed = null;
    s.crew.health = Math.max(s.crew.health, 15);
  }
  const gained = Math.round(s.res.regolith - before.regolith);
  addLog(s, `Welcome back! ${Math.round(away)} colony hours passed while you were away${gained > 0 ? ` (+${gained} regolith)` : ''}.`, 'info');
  return away;
}
