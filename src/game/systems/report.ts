import { BUILDINGS } from '../config/buildings';
import { CHAPTERS } from '../config/chapters';
import { DAY_NIGHT } from '../config/balance';
import { EVENTS } from '../config/events';
import { SCIENCE } from '../config/science';
import { DIFFICULTIES } from '../config/difficulty';
import type { GameState } from './state';
import { dayLength, hoursToSwitch, isDay } from './selectors';

// ---------------- Forecasts ----------------
export interface PowerForecast {
  day: boolean;
  hoursToSwitch: number;
  net: number; // kW now
  nightLength: number;
  /** Expected battery at sunset (day only). */
  batteryAtSunset: number | null;
  /** How long the battery lasts at the current night-time demand. */
  lastsHours: number;
  /** Hours still needed to reach sunrise (night) or the whole night (day). */
  neededHours: number;
  ok: boolean;
  shortfallKWh: number;
}

/** Will the batteries make it through the (next) night at today's demand? */
export function powerForecast(s: GameState): PowerForecast {
  const f = s.flows;
  const day = isDay(s);
  const toSwitch = hoursToSwitch(s);
  const nightLength = DAY_NIGHT.cycle - dayLength(s);
  const net = f.powerProd - f.powerUsed;
  const demand = Math.max(0.01, f.powerDemand);
  if (day) {
    const atSunset = Math.max(0, Math.min(f.batteryCap, s.battery + net * toSwitch));
    const lasts = atSunset / demand;
    return { day, hoursToSwitch: toSwitch, net, nightLength, batteryAtSunset: atSunset, lastsHours: lasts, neededHours: nightLength, ok: lasts >= nightLength, shortfallKWh: Math.max(0, demand * nightLength - atSunset) };
  }
  const lasts = s.battery / demand;
  return { day, hoursToSwitch: toSwitch, net, nightLength, batteryAtSunset: null, lastsHours: lasts, neededHours: toSwitch, ok: lasts >= toSwitch, shortfallKWh: Math.max(0, demand * toSwitch - s.battery) };
}

/** Hours until a supply runs out at its current net rate (Infinity if not falling). */
export function hoursLeft(stock: number, ratePerHour: number): number {
  return ratePerHour < -1e-6 ? stock / -ratePerHour : Infinity;
}

// ---------------- Mission report ----------------
export interface MissionReport {
  outcome: 'success' | 'failed' | 'in progress';
  difficulty: string;
  hours: number;
  cycles: number;
  realDaysEquivalent: number;
  chaptersDone: number;
  chaptersTotal: number;
  crew: { count: number; health: number; dose: number };
  totals: GameState['totals'];
  remaining: { regolith: number; titanium: number; ice: number; credits: number; o2: number; water: number; food: number; battery: number };
  science: { techs: number; cards: number; cardsTotal: number; quizCorrect: number; samples: number; stationsActive: number };
  events: { title: string; choice: string; outcome: string; quality: 'good' | 'ok' | 'risky'; t: number }[];
  equipment: { average: number; worst: { name: string; condition: number } | null };
  score: { total: number; grade: string; parts: { label: string; value: number; max: number }[] };
  wentWell: string[];
  improve: string[];
}

export function buildReport(s: GameState): MissionReport {
  const chaptersDone = CHAPTERS.filter((c) => c.objectives.every((o) => s.missionsDone.includes(o.id))).length;
  const built = s.buildings.filter((b) => b.level > 0);
  const avgCond = built.length ? built.reduce((a, b) => a + (b.condition ?? 100), 0) / built.length : 100;
  const worstB = [...built].sort((a, b) => (a.condition ?? 100) - (b.condition ?? 100))[0];
  const samples = Object.values(s.monitoring.samples).reduce((a, l) => a + l.filter((x) => x.ok).length, 0);
  const events = s.station.history.map((h) => {
    const def = EVENTS[h.eventId];
    return { title: def?.title ?? h.eventId, choice: def?.choices.find((c) => c.id === h.choiceId)?.label ?? '—', outcome: h.outcome, quality: h.quality, t: h.t };
  });
  const good = events.filter((e) => e.quality === 'good').length;
  const risky = events.filter((e) => e.quality === 'risky').length;

  // Score (0–100): five parts.
  const survival = s.failed ? 0 : Math.round((s.crew.health / 100) * 30);
  const progress = Math.round((chaptersDone / CHAPTERS.length) * 25);
  const sustain = Math.min(15, s.stats.selfSufficientCycles * 5 + s.stats.energyCycles * 3 + s.stats.cleanNights * 2);
  const science = Math.min(15, s.research.owned.length * 2 + Math.floor(s.scienceSeen.length / 2) + s.quiz.correct + Math.floor(samples / 50));
  const decisions = events.length ? Math.round(15 * Math.max(0, (good + 0.5 * (events.length - good - risky)) / events.length)) : 8;
  const total = survival + progress + sustain + science + decisions;
  const grade = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : total >= 40 ? 'D' : 'E';

  const wentWell: string[] = [];
  const improve: string[] = [];
  const T = s.totals;
  if (!s.failed && s.crew.health >= 80) wentWell.push('The crew stayed healthy.');
  if (s.stats.cleanNights > 0) wentWell.push(`Life support kept running through ${s.stats.cleanNights} night(s) without an outage.`);
  if (T.waterRecycled > T.waterUsed * 0.5 && T.waterUsed > 0) wentWell.push(`Recycling recovered ${Math.round((T.waterRecycled / T.waterUsed) * 100)}% of the crew’s water.`);
  if (T.foodGrown >= T.foodUsed && T.foodUsed > 0) wentWell.push('Greenhouses grew at least as much food as the crew ate.');
  if (good >= 2) wentWell.push(`${good} event decisions followed good practice.`);
  if (s.research.owned.length >= 3) wentWell.push(`${s.research.owned.length} technologies researched.`);
  if (samples > 100) wentWell.push(`The monitoring network collected ${samples} measurements.`);

  if (s.failed) improve.push(`The mission failed (${s.failed.cause}). Check the matching system in Mission Control before it runs out.`);
  if (s.stats.nightsSurvived > s.stats.cleanNights) improve.push('Life support lost power during a night: build more batteries or switch off mines and refineries at sunset.');
  if (s.crew.dose > 100) improve.push('Crew radiation dose was high: add regolith shielding and shelter during solar storms.');
  if (avgCond < 70) improve.push(`Equipment is worn (average ${Math.round(avgCond)}%): schedule repairs before things fail.`);
  if (risky > good) improve.push('Several risky event decisions: the safe choice usually costs a little now but saves a lot later.');
  if (T.wasteMade > 0 && T.wasteComposted < T.wasteMade * 0.3) improve.push('Little waste was composted: greenhouses turn waste into extra food.');
  if (s.res.titanium < 20 && chaptersDone < 3) improve.push('Titanium was scarce: build a refinery on ore-rich ground.');
  if (!wentWell.length) wentWell.push('The colony was founded: every mission starts with a first landing.');
  if (!improve.length) improve.push('Keep the same strategy and push for the next chapter.');

  return {
    outcome: s.failed ? 'failed' : s.won || chaptersDone === CHAPTERS.length ? 'success' : 'in progress',
    difficulty: DIFFICULTIES[s.difficulty].name,
    hours: Math.round(s.time),
    cycles: s.cycle.index,
    realDaysEquivalent: Math.round((s.time / DAY_NIGHT.cycle) * 29.5),
    chaptersDone,
    chaptersTotal: CHAPTERS.length,
    crew: { count: s.crew.count, health: Math.round(s.crew.health), dose: Math.round(s.crew.dose) },
    totals: T,
    remaining: { ...s.res, o2: s.life.o2, water: s.life.water, food: s.life.food, battery: s.battery },
    science: { techs: s.research.owned.length, cards: s.scienceSeen.filter((x) => x in SCIENCE).length, cardsTotal: Object.keys(SCIENCE).length, quizCorrect: s.quiz.correct, samples, stationsActive: 0 },
    events,
    equipment: { average: Math.round(avgCond), worst: worstB ? { name: BUILDINGS[worstB.type].name, condition: Math.round(worstB.condition ?? 100) } : null },
    score: {
      total, grade,
      parts: [
        { label: 'Crew survival', value: survival, max: 30 },
        { label: 'Mission progress', value: progress, max: 25 },
        { label: 'Sustainability', value: sustain, max: 15 },
        { label: 'Science', value: science, max: 15 },
        { label: 'Decisions', value: decisions, max: 15 },
      ],
    },
    wentWell,
    improve,
  };
}
