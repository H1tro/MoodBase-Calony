import { PRODUCTION, RADIATION } from '../config/balance';
import { rand } from '../../utils/rng';
import { addLog, type GameState } from './state';
import { active, hasTech } from './selectors';
import { flareWarningBonus } from './monitoring';
import { triggerEvent } from './events';
import { flareIntensity } from './spaceWeather';
import { hasEffect } from './state';
import { BUILDINGS } from '../config/buildings';

/** Average fraction of flare dose blocked for the crew, filling best-shielded beds first. */
export function shieldBlock(s: GameState): number {
  const slots: number[] = [];
  for (let i = 0; i < PRODUCTION.commandCrew; i++) slots.push(RADIATION.commandShield);
  for (const h of active(s, 'habitat')) {
    for (let i = 0; i < h.level * PRODUCTION.habitatCrewPerLevel; i++) slots.push(RADIATION.shieldBlock[h.shield]);
  }
  slots.sort((a, b) => b - a);
  const n = Math.max(1, Math.min(s.crew.count, slots.length));
  let sum = 0;
  for (let i = 0; i < n; i++) sum += slots[i] ?? 0;
  return sum / n;
}

export function updateRadiation(s: GameState, dt: number) {
  const block = shieldBlock(s);
  s.flows.shieldBlock = block;
  s.flows.doseRate = 0;
  if (!s.flare && s.time >= s.nextFlareAt - RADIATION.warning - flareWarningBonus(s)) {
    s.flare = { warnAt: s.time, start: s.nextFlareAt, end: s.nextFlareAt + RADIATION.duration, dose: 0 };
    addLog(s, `☢ Solar flare detected! Particle storm arrives in ${Math.round(s.nextFlareAt - s.time)} s. Shield your habitats!`, 'warn');
    // The commander decides how to respond (shelter, safe electronics, or keep working).
    triggerEvent(s, 'solarStorm');
  }
  const f = s.flare;
  if (!f) return;
  if (s.time >= f.start && s.time < f.end) {
    const response = hasEffect(s, 'shelter') ? 0.6 : hasEffect(s, 'workThrough') ? 1.3 : 1;
    const rate = RADIATION.doseRate * flareIntensity() * (1 - block) * (hasTech(s, 'stormShelter') ? 0.5 : 1) * response;
    s.flows.doseRate = rate;
    f.dose += rate * dt;
    s.crew.dose += rate * dt;
    s.crew.health -= rate * RADIATION.healthPerMSv * dt;
    s.lastCause = 'radiation';
  } else if (s.time >= f.end) {
    s.stats.flaresSurvived++;
    // Unprotected electronics take damage from energetic particles.
    if (!hasEffect(s, 'electronicsOff')) {
      const sensitive = s.buildings.filter((b) => b.level > 0 && ['lab', 'opscenter', 'monitor', 'command'].includes(b.type));
      const [r0, n0] = rand(s.rng);
      s.rng = n0;
      const hit = sensitive[Math.floor(r0 * sensitive.length)];
      if (hit) {
        const dmg = hasEffect(s, 'workThrough') ? 20 : 10;
        hit.condition = Math.max(0, (hit.condition ?? 100) - dmg);
        addLog(s, `⚡ Particle storm damaged electronics in the ${BUILDINGS[hit.type].name} (−${dmg}%).`, 'warn');
      }
    }
    addLog(s, `Solar storm over. Each crew member received ${f.dose.toFixed(0)} mSv (game scale).`, f.dose > 60 ? 'warn' : 'good');
    const [r, next] = rand(s.rng);
    s.rng = next;
    s.nextFlareAt = s.time + RADIATION.minGap + r * (RADIATION.maxGap - RADIATION.minGap);
    s.flare = null;
  }
}
