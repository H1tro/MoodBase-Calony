// Real space-weather data handed to the simulation by the UI layer (see game/nasa.ts).
// The simulation never fetches anything itself, so it stays deterministic and testable.

export type DataSource = 'live' | 'cached' | 'snapshot' | 'simulated';

export interface RealFlare {
  id: string;
  classType: string; // e.g. "M1.7" (GOES X-ray class)
  peakTime: string; // ISO time
  location?: string | null;
  link?: string;
}

export interface SpaceWeather {
  source: DataSource;
  /** When the data was retrieved (ISO), or null for simulated data. */
  updated: string | null;
  flares: RealFlare[];
}

let current: SpaceWeather = { source: 'simulated', updated: null, flares: [] };

export function setSpaceWeather(w: SpaceWeather) {
  current = w;
}

export function getSpaceWeather(): SpaceWeather {
  return current;
}

const CLASS_ORDER = ['A', 'B', 'C', 'M', 'X'];

/** Strongest flare in the data (by GOES class letter, then number). */
export function strongestFlare(w: SpaceWeather = current): RealFlare | null {
  let best: RealFlare | null = null;
  let bestScore = -1;
  for (const f of w.flares) {
    const letter = CLASS_ORDER.indexOf(f.classType?.[0] ?? '');
    const score = letter * 100 + (parseFloat(f.classType?.slice(1) ?? '0') || 0);
    if (letter >= 0 && score > bestScore) {
      best = f;
      bestScore = score;
    }
  }
  return best;
}

export function latestFlare(w: SpaceWeather = current): RealFlare | null {
  return [...w.flares].sort((a, b) => (a.peakTime < b.peakTime ? 1 : -1))[0] ?? null;
}

/**
 * GAME VALUE: storm intensity scaled by how active the real Sun has been.
 * X-class activity → 1.25, M-class → 1.0, weaker → 0.85, no real data → 1.
 */
export function flareIntensity(w: SpaceWeather = current): number {
  if (w.source === 'simulated') return 1;
  const s = strongestFlare(w);
  if (!s) return 0.85;
  if (s.classType.startsWith('X')) return 1.25;
  if (s.classType.startsWith('M')) return 1;
  return 0.85;
}
