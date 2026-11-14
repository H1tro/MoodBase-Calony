import { TECH_BY_ID, type TechId } from '../config/techs';
import { addLog, type GameState } from './state';
import type { Result } from './construction';
import { active } from './selectors';
import { commsDown } from './spaceport';

export function canResearch(s: GameState, id: TechId): Result {
  const t = TECH_BY_ID[id];
  const lab = active(s, 'lab')[0];
  if (!lab) return { ok: false, reason: 'Build a Research Lab first' };
  if (s.research.owned.includes(id)) return { ok: false, reason: 'Already researched' };
  if (s.research.active) return { ok: false, reason: 'Lab is busy with another project' };
  if (lab.level < t.labLevel) return { ok: false, reason: `Needs Lab level ${t.labLevel}` };
  if (s.res.credits < t.cost) return { ok: false, reason: `Needs ${t.cost} ₡` };
  return { ok: true };
}

export function startResearch(s: GameState, id: TechId): Result {
  const can = canResearch(s, id);
  if (!can.ok) return can;
  const t = TECH_BY_ID[id];
  s.res.credits -= t.cost;
  s.research.active = { id, start: s.time, end: s.time + t.time };
  addLog(s, `Research started: ${t.name}.`);
  return { ok: true };
}

export function updateResearch(s: GameState, dt: number) {
  const r = s.research.active;
  if (!r) return;
  const lab = active(s, 'lab')[0];
  // No power → no progress: push the finish time back.
  if (!lab || !lab.online || commsDown(s)) {
    r.end += dt;
    r.start += dt;
    return;
  }
  if (s.time >= r.end) {
    s.research.owned.push(r.id);
    s.research.active = null;
    addLog(s, `Research complete: ${TECH_BY_ID[r.id].name}!`, 'good');
    if (r.id === 'waterRecycle' && !s.scienceSeen.includes('waterRecycling')) s.scienceQueue.push('waterRecycling');
  }
}
