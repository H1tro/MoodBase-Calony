import { EVENTS, RANDOM_EVENTS } from '../config/events';
import { EVENT_GAP, EVENTS_TIMING } from '../config/station';
import { rand } from '../../utils/rng';
import { addLog, type GameState } from './state';

const roll = (s: GameState) => {
  const [r, n] = rand(s.rng);
  s.rng = n;
  return r;
};

/** Start an event: apply its immediate effect and wait for the commander's decision. */
export function triggerEvent(s: GameState, id: string, target: { buildingId?: number; amount?: number } = {}) {
  const def = EVENTS[id];
  if (!def || s.station.pending) return false;
  const e = { id, t: s.time, ...target };
  s.station.pending = e;
  def.onTrigger?.(s, e);
  addLog(s, `${def.icon} ${def.title}: decision needed.`, 'warn');
  return true;
}

/** Random event scheduler (solar storms come from the radiation system instead). */
export function updateEvents(s: GameState) {
  if (s.failed || s.station.pending || s.time < s.station.nextEventAt) return;
  const gap = EVENTS_TIMING.minGap + roll(s) * (EVENTS_TIMING.maxGap - EVENTS_TIMING.minGap);
  s.station.nextEventAt = s.time + gap * (EVENT_GAP[s.difficulty] ?? 1);
  // Try events in a random order until one fits the colony's situation.
  const order = [...RANDOM_EVENTS].sort(() => roll(s) - 0.5);
  for (const id of order) {
    const target = EVENTS[id].pick?.(s, roll(s));
    if (target) {
      triggerEvent(s, id, target);
      return;
    }
  }
}

/** Apply the commander's decision and write it to the mission history. */
export function resolveEvent(s: GameState, choiceId: string): { ok: boolean; outcome: string } {
  const e = s.station.pending;
  if (!e) return { ok: false, outcome: 'No event pending' };
  const def = EVENTS[e.id];
  const choice = def.choices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, outcome: 'Unknown choice' };
  const blocked = choice.blocked?.(s, e);
  if (blocked) return { ok: false, outcome: blocked };
  const outcome = choice.apply(s, e);
  s.station.history.push({ t: e.t, eventId: e.id, choiceId, outcome, quality: choice.quality });
  if (s.station.history.length > 80) s.station.history.shift();
  s.stats.eventsResolved++;
  s.station.pending = null;
  addLog(s, `📋 ${def.title}: ${outcome}`, choice.quality === 'risky' ? 'warn' : 'info');
  if (def.factId && !s.scienceSeen.includes(def.factId) && !s.scienceQueue.includes(def.factId)) s.scienceQueue.push(def.factId);
  return { ok: true, outcome };
}
