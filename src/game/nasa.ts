// Real NASA data for the browser game, with honest fallbacks:
//   live DONKI request → cached copy (localStorage) → bundled snapshot → simulated.
// The source and the date of every dataset are always shown to the player.
import snapshot from './data/nasa-snapshot.json';
import { setSpaceWeather, type RealFlare, type SpaceWeather } from './systems/spaceWeather';

const CACHE_KEY = 'moonbase-v3-donki';
const DONKI = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR';

export interface NtrsReport { id: string; title: string; type: string; date: string; center: string | null; url: string }
export const NTRS = snapshot.ntrs as Record<string, { query: string; results: NtrsReport[] }>;
export const SNAPSHOT_DATE = snapshot.retrieved;

/** NASA Moon Trek (LRO WAC global mosaic) tile URL. Images load directly; no API key needed. */
export const trekTile = (z: number, row: number, col: number) =>
  `https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/${z}/${row}/${col}.jpg`;
export const TREK_URL = 'https://trek.nasa.gov/moon/';
export const NTRS_URL = 'https://ntrs.nasa.gov/';
export const DONKI_URL = 'https://ccmc.gsfc.nasa.gov/DONKI-API/';

const day = (d: Date) => d.toISOString().slice(0, 10);

function fromSnapshot(): SpaceWeather {
  const flares = (snapshot.donki?.flares ?? []) as RealFlare[];
  return flares.length ? { source: 'snapshot', updated: snapshot.retrieved, flares } : { source: 'simulated', updated: null, flares: [] };
}

function fromCache(): SpaceWeather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { updated: string; flares: RealFlare[] };
    return { source: 'cached', updated: c.updated, flares: c.flares };
  } catch {
    return null;
  }
}

let started = false;

/** Load space weather (once per page). Sets the simulation's real-data source and returns it. */
export async function loadSpaceWeather(force = false): Promise<SpaceWeather> {
  if (started && !force) return (await import('./systems/spaceWeather')).getSpaceWeather();
  started = true;
  // Show something immediately while the live request runs.
  setSpaceWeather(fromCache() ?? fromSnapshot());
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 864e5);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${DONKI}?startDate=${day(start)}&endDate=${day(end)}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`DONKI ${res.status}`);
    const data = (await res.json()) as { flrID: string; classType: string; peakTime: string; sourceLocation?: string; link?: string }[];
    const flares: RealFlare[] = data.map((f) => ({ id: f.flrID, classType: f.classType, peakTime: f.peakTime, location: f.sourceLocation ?? null, link: f.link }));
    const w: SpaceWeather = { source: 'live', updated: new Date().toISOString(), flares };
    setSpaceWeather(w);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ updated: w.updated, flares }));
    } catch {
      /* ignore */
    }
    return w;
  } catch {
    const w = fromCache() ?? fromSnapshot();
    setSpaceWeather(w);
    return w;
  }
}
