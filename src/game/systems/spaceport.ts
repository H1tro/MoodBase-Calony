import { CARGO, type CargoKind } from '../config/balance';
import { addLog, type GameState } from './state';
import type { Result } from './construction';
import { active } from './selectors';
import { hasEffect } from './state';
import { addDustEverywhere } from './environment';
import { ENVIRONMENT } from '../config/station';

/** Earth contact lost (and no backup antenna running). */
export const commsDown = (s: GameState) => hasEffect(s, 'commsDown') && !hasEffect(s, 'backupAntenna');

export function cargoPayout(s: GameState, kind: CargoKind): number {
  const port = active(s, 'spaceport')[0];
  const lvl = port?.level ?? 1;
  return Math.round(CARGO.options[kind].payout * (1 + CARGO.levelBonus * (lvl - 1)));
}

function stock(s: GameState, kind: CargoKind): number {
  return kind === 'water' ? s.life.water : s.res[kind];
}

export function canLaunch(s: GameState, kind: CargoKind): Result {
  const port = active(s, 'spaceport')[0];
  if (!port) return { ok: false, reason: 'Build a Spaceport first' };
  if (s.cargo.active) return { ok: false, reason: 'A cargo run is already in flight' };
  if (!port.online) return { ok: false, reason: 'Spaceport has no power' };
  if (commsDown(s)) return { ok: false, reason: 'No contact with Earth: flights grounded' };
  const o = CARGO.options[kind];
  if (stock(s, kind) < o.amount) return { ok: false, reason: `Needs ${o.amount} ${o.unit} ${o.label.toLowerCase()}` };
  return { ok: true };
}

export function launchCargo(s: GameState, kind: CargoKind): Result {
  const can = canLaunch(s, kind);
  if (!can.ok) return can;
  const o = CARGO.options[kind];
  if (kind === 'water') s.life.water -= o.amount;
  else s.res[kind] -= o.amount;
  s.cargo.active = { kind, start: s.time, end: s.time + CARGO.duration, payout: cargoPayout(s, kind) };
  // Rocket exhaust blasts regolith across the base: more dust on the panels.
  addDustEverywhere(s, ENVIRONMENT.dustPerLaunch);
  addLog(s, `🚀 Cargo run launched with ${o.amount} ${o.unit} of ${o.label.toLowerCase()}.`);
  return { ok: true };
}

export function updateCargo(s: GameState, dt: number) {
  const c = s.cargo.active;
  if (!c) return;
  const port = active(s, 'spaceport')[0];
  if (!port || !port.online || commsDown(s)) {
    c.end += dt;
    c.start += dt;
    return;
  }
  if (s.time >= c.end) {
    s.res.credits += c.payout;
    s.stats.creditsEarned += c.payout;
    s.stats.cargoCredits += c.payout;
    s.cargo.runs++;
    s.cargo.active = null;
    addLog(s, `Cargo delivered! +${c.payout} ₡`, 'good');
  }
}
