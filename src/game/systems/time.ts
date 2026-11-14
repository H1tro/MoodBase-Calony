import { addLog, type GameState } from './state';
import { isDay } from './selectors';
import { queueQuiz } from './quiz';

/** Track sunset/sunrise transitions and per-cycle statistics. */
export function updateDayNight(s: GameState) {
  const night = !isDay(s);
  const c = s.cycle;
  if (night && !c.wasNight) {
    c.outage = false;
    addLog(s, '🌑 Sunset. Solar farms are offline — the colony is running on batteries.', 'warn');
    if (!s.scienceSeen.includes('lunarDay') && !s.scienceQueue.includes('lunarDay')) s.scienceQueue.push('lunarDay');
  } else if (!night && c.wasNight) {
    // Each sunrise, Mission Control asks a question about something the player has learned.
    queueQuiz(s);
    s.stats.nightsSurvived++;
    // A full cycle in which no enabled building ever lost power.
    if (c.index > 0 && !c.shortage) s.stats.energyCycles++;
    if (!c.outage) s.stats.cleanNights++;
    addLog(s, c.outage ? '🌅 Sunrise. You survived the night, but life support lost power.' : '🌅 Sunrise! The colony made it through the night with no outages.', c.outage ? 'warn' : 'good');
    // A new cycle starts at dawn: was the colony self-sufficient?
    const st = c.startLife;
    if (s.crew.count > 0 && !c.stockDipped && s.life.o2 >= st.o2 - 0.5 && s.life.water >= st.water - 0.5 && s.life.food >= st.food - 0.5) {
      s.stats.selfSufficientCycles++;
      addLog(s, 'Self-sufficient cycle: O₂, water and food all held steady!', 'good');
    }
    c.index++;
    c.shortage = false;
    c.startLife = { ...s.life };
    c.stockDipped = false;
  }
  c.wasNight = night;
}
