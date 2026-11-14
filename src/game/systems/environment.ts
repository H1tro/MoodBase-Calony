import { BUILDINGS } from '../config/buildings';
import { ENVIRONMENT } from '../config/station';
import { rand } from '../../utils/rng';
import { addLog, hasEffect, type GameState } from './state';

/** Dust on solar panels, micrometeoroid impacts, equipment wear and expiring effects. */
export function updateEnvironment(s: GameState, dt: number) {
  const E = ENVIRONMENT;
  for (const b of s.buildings) {
    if (b.level === 0) continue;
    if (b.type === 'solar') b.dust = Math.min(1, (b.dust ?? 0) + E.dustPerHour * dt);
    // Working machinery wears out slowly; quick patches wear out faster.
    if (b.online && BUILDINGS[b.type].power > 0) {
      const before = b.condition ?? 100;
      const after = Math.max(0, before - E.wearPerHour * (b.patched ? E.patchedWearMult : 1) * dt);
      b.condition = after;
      if (before >= E.maintenanceBelow && after < E.maintenanceBelow) addLog(s, `🔧 ${BUILDINGS[b.type].name} needs maintenance (condition ${Math.round(after)}%).`, 'warn');
    }
  }

  // Micrometeoroids: tiny grains at many km/s. Rare, but there is no air to stop them.
  const [r, n1] = rand(s.rng);
  s.rng = n1;
  if (r < E.impactChancePerHour * dt) {
    const targets = s.buildings.filter((b) => b.level > 0);
    if (targets.length) {
      const [r2, n2] = rand(s.rng);
      const [r3, n3] = rand(n2);
      s.rng = n3;
      const b = targets[Math.floor(r2 * targets.length)];
      const dmg = E.impactDamage[0] + r3 * (E.impactDamage[1] - E.impactDamage[0]);
      b.condition = Math.max(0, (b.condition ?? 100) - dmg);
      s.station.impacts.push({ t: s.time, buildingId: b.id });
      if (s.station.impacts.length > 100) s.station.impacts.shift();
      addLog(s, `☄ Micrometeoroid impact on ${BUILDINGS[b.type].name}: condition −${Math.round(dmg)}%.`, 'warn');
      if (!s.scienceSeen.includes('micrometeoroids') && !s.scienceQueue.includes('micrometeoroids')) s.scienceQueue.push('micrometeoroids');
    }
  }

  // Crew sheltering from a solar storm: robots wait inside too, so construction pauses.
  if (hasEffect(s, 'shelter')) for (const b of s.buildings) if (b.job) { b.job.end += dt; b.job.start += dt; }

  // Drop expired effects.
  if (s.station.effects.some((e) => e.until <= s.time)) {
    for (const e of s.station.effects.filter((x) => x.until <= s.time)) {
      const msg: Partial<Record<typeof e.type, string>> = {
        leak: 'The water leak has run its course.',
        waterCap: 'The isolated water tank is back in service.',
        batteryFault: 'Battery cells are back to full capacity.',
        commsDown: '📡 Contact with Earth restored.',
        backupAntenna: 'Backup antenna switched off; main dish is back.',
      };
      if (msg[e.type]) addLog(s, msg[e.type]!, 'info');
    }
    s.station.effects = s.station.effects.filter((e) => e.until > s.time);
  }
}

/** Raise dust on every solar farm (e.g. rocket launch plume). */
export function addDustEverywhere(s: GameState, amount: number) {
  for (const b of s.buildings) if (b.type === 'solar' && b.level > 0) b.dust = Math.min(1, (b.dust ?? 0) + amount);
}
