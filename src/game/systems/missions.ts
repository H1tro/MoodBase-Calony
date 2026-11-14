import { CHAPTERS, type Chapter } from '../config/chapters';
import { addLog, type GameState } from './state';
import { caps } from './selectors';

export function currentChapter(s: GameState): Chapter | null {
  return CHAPTERS.find((c) => c.objectives.some((o) => !s.missionsDone.includes(o.id))) ?? null;
}

export function updateMissions(s: GameState) {
  const ch = currentChapter(s);
  if (ch) {
    for (const o of ch.objectives) {
      if (s.missionsDone.includes(o.id) || !o.check(s)) continue;
      s.missionsDone.push(o.id);
      const c = caps(s);
      const r = o.reward;
      if (r.credits) {
        s.res.credits += r.credits;
        s.stats.creditsEarned += r.credits;
      }
      if (r.regolith) s.res.regolith = Math.min(c.regolith, s.res.regolith + r.regolith);
      if (r.titanium) s.res.titanium = Math.min(c.titanium, s.res.titanium + r.titanium);
      if (r.ice) s.res.ice = Math.min(c.ice, s.res.ice + r.ice);
      const parts = [r.credits && `${r.credits} ₡`, r.regolith && `${r.regolith} regolith`, r.titanium && `${r.titanium} titanium`].filter(Boolean);
      addLog(s, `✅ Mission complete: ${o.text} (+${parts.join(', ')})`, 'good');
      if (o.science && !s.scienceSeen.includes(o.science) && !s.scienceQueue.includes(o.science)) s.scienceQueue.push(o.science);
    }
    if (ch.objectives.every((o) => s.missionsDone.includes(o.id))) {
      const next = currentChapter(s);
      addLog(s, next ? `🏁 Chapter ${ch.id} "${ch.title}" complete! Next: ${next.title}.` : '🏆 All chapters complete — your colony is self-sustaining!', 'good');
      if (!next) s.won = true;
    }
  }

}
