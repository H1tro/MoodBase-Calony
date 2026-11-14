// Refreshes the bundled NASA data snapshot used when the game is offline.
//   npm run data:nasa
// - NASA Technical Reports Server (NTRS): real report listings per game topic.
//   NTRS does not allow browser (CORS) requests, so the game ships this snapshot.
// - NASA DONKI: recent solar flares and solar energetic particle events, used as an
//   offline fallback (the game also fetches DONKI live in the browser).
import { writeFile } from 'node:fs/promises';

const TOPICS = {
  dust: 'lunar dust mitigation solar array',
  radiation: 'lunar regolith radiation shielding',
  storm: 'solar particle event lunar surface crew',
  power: 'lunar night power fission surface power',
  oxygen: 'oxygen extraction lunar regolith',
  co2: 'carbon dioxide removal spacecraft cabin',
  water: 'water recovery system International Space Station',
  temperature: 'lunar surface thermal environment',
  impacts: 'micrometeoroid lunar surface',
  food: 'plant growth space crop production',
};

async function ntrs(q) {
  const url = `https://ntrs.nasa.gov/api/citations/search?q=${encodeURIComponent(q)}&page.size=4`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NTRS ${res.status}`);
  const data = await res.json();
  return data.results.map((r) => ({
    id: String(r.id),
    title: r.title,
    type: r.stiTypeDetails ?? r.stiType ?? 'Report',
    date: (r.distributionDate ?? r.submittedDate ?? '').slice(0, 10),
    center: r.center?.name ?? null,
    url: `https://ntrs.nasa.gov/citations/${r.id}`,
  }));
}

async function donki(kind, days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 864e5);
  const d = (x) => x.toISOString().slice(0, 10);
  const url = `https://ccmc.gsfc.nasa.gov/DONKI-API/get/${kind}?startDate=${d(start)}&endDate=${d(end)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DONKI ${res.status}`);
  return res.json();
}

const out = { retrieved: new Date().toISOString(), ntrs: {}, donki: { flares: [], sep: [] } };
for (const [key, q] of Object.entries(TOPICS)) {
  try {
    out.ntrs[key] = { query: q, results: await ntrs(q) };
    console.log(`NTRS ${key}: ${out.ntrs[key].results.length}`);
  } catch (e) {
    console.warn(`NTRS ${key} failed: ${e.message}`);
    out.ntrs[key] = { query: q, results: [] };
  }
}
try {
  const flr = await donki('FLR', 60);
  out.donki.flares = flr.map((f) => ({ id: f.flrID, classType: f.classType, peakTime: f.peakTime, location: f.sourceLocation, link: f.link }));
  const sep = await donki('SEP', 60);
  out.donki.sep = sep.map((x) => ({ id: x.sepID, eventTime: x.eventTime, link: x.link }));
  console.log(`DONKI flares: ${out.donki.flares.length}, SEP: ${out.donki.sep.length}`);
} catch (e) {
  console.warn(`DONKI failed: ${e.message}`);
}
await writeFile(new URL('../src/game/data/nasa-snapshot.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('Wrote src/game/data/nasa-snapshot.json');
