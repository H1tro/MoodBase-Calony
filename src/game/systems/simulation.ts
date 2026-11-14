import type { GameState } from './state';
import { completeJobs } from './construction';
import { updatePower } from './power';
import { updateProduction } from './resources';
import { updateLifeSupport } from './lifeSupport';
import { updateRadiation } from './radiation';
import { updateResearch } from './research';
import { updateCargo } from './spaceport';
import { updateDayNight } from './time';
import { updateMissions } from './missions';
import { updateMonitoring } from './monitoring';
import { updateEnvironment } from './environment';
import { updateEvents } from './events';

/** Advance the whole colony by dt colony-hours. Every number in the UI flows from here. */
export function tick(s: GameState, dt: number) {
  if (s.failed) return;
  const before = { regolith: s.res.regolith, titanium: s.res.titanium, ice: s.res.ice, ...s.life };
  s.time += dt;
  completeJobs(s);
  updatePower(s, dt);
  updateProduction(s, dt);
  updateLifeSupport(s, dt);
  updateRadiation(s, dt);
  updateResearch(s, dt);
  updateCargo(s, dt);
  updateMonitoring(s);
  updateEnvironment(s, dt);
  updateEvents(s);
  updateDayNight(s);
  updateMissions(s);
  const f = s.flows;
  // Smoothed net rates per hour, for display.
  const k = 0.2;
  f.regolith += ((s.res.regolith - before.regolith) / dt - f.regolith) * k;
  f.titanium += ((s.res.titanium - before.titanium) / dt - f.titanium) * k;
  f.ice += ((s.res.ice - before.ice) / dt - f.ice) * k;
  f.o2 += ((s.life.o2 - before.o2) / dt - f.o2) * k;
  f.water += ((s.life.water - before.water) / dt - f.water) * k;
  f.food += ((s.life.food - before.food) / dt - f.food) * k;
}

/** Run many ticks, e.g. for offline catch-up. */
export function advance(s: GameState, hours: number, step = 1) {
  let left = hours;
  while (left > 1e-9 && !s.failed) {
    const dt = Math.min(step, left);
    tick(s, dt);
    left -= dt;
  }
}
