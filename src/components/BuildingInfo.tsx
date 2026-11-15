import { store, useGame } from '../game/store';
import { BUILDINGS, costFor, maxLevelOf, powerDraw, timeFor } from '../game/config/buildings';
import { OpsCenterSummary, StationLinkControls } from './NetworkControls';
import { REAL_WORLD } from '../game/config/realworld';
import { ENVIRONMENT, MAINTENANCE } from '../game/config/station';
import { canClean, canMove, canRepair } from '../game/systems/construction';
import { solarFarmEfficiency } from '../game/systems/power';
import { Bar } from './ui';
import { RADIATION } from '../game/config/balance';
import { texKey } from '../game/art/drawBuildings';
import { canShield, canUpgrade } from '../game/systems/construction';
import { buildTimeMult, oreTiles, statsFor } from '../game/systems/selectors';
import { fmtTime } from '../utils/format';
import { BuildingArt, CloseButton, CostList } from './ui';

export default function BuildingInfo() {
  const { s, ui } = useGame();
  if (ui.selectedId === null || ui.panel !== null || ui.placing) return null;
  const b = s.buildings.find((x) => x.id === ui.selectedId);
  if (!b) return null;
  const def = BUILDINGS[b.type];
  const MAX_LEVEL = maxLevelOf(b.type);
  const next = b.level + 1;
  const up = canUpgrade(s, b);
  const mv = canMove(s, b.id);
  const sh = b.type === 'habitat' ? canShield(s, b) : null;
  const now = statsFor(s, b.type, b.level);
  const after = next <= MAX_LEVEL ? statsFor(s, b.type, next) : [];
  const draw = b.level > 0 ? powerDraw(b.type, b.level) : 0;
  const status = b.level === 0 ? { t: 'Under construction', c: 'text-warn' }
    : !b.enabled ? { t: 'Switched off', c: 'text-white/60' }
    : def.power > 0 && !b.online ? { t: 'NO POWER — offline', c: 'text-bad' }
    : { t: 'Online', c: 'text-good' };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-2 sm:p-3">
      <div className="panel pointer-events-auto slide-down w-full max-w-3xl p-3">
        <div className="flex gap-3">
          <BuildingArt texKey={texKey(b.type, Math.max(1, b.level), b.shield)} className="hidden h-32 w-32 shrink-0 sm:block" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="title text-xl leading-tight sm:text-2xl">{def.icon} {def.name}</h2>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="chip bg-accent/20 text-accent">Level {b.level}/{MAX_LEVEL}</span>
                  {'★'.repeat(b.level) && <span className="text-accent">{'★'.repeat(b.level)}<span className="text-white/20">{'★'.repeat(MAX_LEVEL - b.level)}</span></span>}
                  <span className={`chip font-bold ${status.c}`}>{status.t}</span>
                  {draw > 0 && <span className="chip">⚡ {draw.toFixed(1)} kW</span>}
                  {b.type === 'habitat' && <span className="chip">🛡 Shield {b.shield}/{RADIATION.maxShield}</span>}
                  {b.type === 'mine' && oreTiles(s, b) >= 2 && <span className="chip text-[#ffb98a]">Ore bonus +50%</span>}
                </div>
              </div>
              <CloseButton onClick={() => store.select(null)} />
            </div>
            <p className="mt-1 text-xs text-white/75">{def.role}</p>
            <p className="mt-1 rounded-lg bg-cyan/10 px-2 py-1 text-[11px] text-cyan">🧠 Trade-off: {def.lesson}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-black/25 p-2 text-xs">
                <div className="mb-0.5 font-bold text-white/60">Now</div>
                {now.length ? now.map((t) => <div key={t}>• {t}</div>) : <div className="text-white/50">Not built yet</div>}
              </div>
              {after.length > 0 && (
                <div className="rounded-lg bg-good/10 p-2 text-xs">
                  <div className="mb-0.5 font-bold text-good">Level {next}</div>
                  {after.map((t) => <div key={t}>• {t}</div>)}
                </div>
              )}
            </div>
            {b.type === 'oxygen' && b.level > 0 && (
              <div className="mt-2 rounded-lg bg-black/25 p-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>💧 Water {Math.round((1 - b.split) * 100)}%</span>
                  <span>Electrolysis split</span>
                  <span>🫧 O₂ {Math.round(b.split * 100)}%</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={Math.round(b.split * 100)} onChange={(e) => store.setSplit(b.id, Number(e.target.value) / 100)} className="w-full accent-[#7dfff0]" aria-label="Water vs oxygen split" />
              </div>
            )}
            {b.level > 0 && (() => {
              const cond = Math.round(b.condition ?? 100);
              const rep = canRepair(s, b);
              const cl = b.type === 'solar' ? canClean(s, b) : null;
              return (
                <div className="mt-2 grid gap-2 rounded-lg bg-black/25 p-2 text-xs sm:grid-cols-2">
                  <div>
                    <div className="flex justify-between"><span>🔧 Equipment condition{b.patched ? ' (patched)' : ''}</span><span className={`font-mono ${cond < ENVIRONMENT.maintenanceBelow ? 'text-warn' : 'text-good'}`}>{cond}%</span></div>
                    <Bar value={cond} max={100} color={cond < ENVIRONMENT.maintenanceBelow ? '#ffa53c' : '#3fdc7c'} className="my-1 h-1.5" />
                    <button className="btn btn-gray px-2 py-1 text-xs" disabled={!rep.ok} title={rep.ok ? '' : rep.reason} onClick={() => store.repair(b.id)}>🔧 Repair ({MAINTENANCE.repair.regolith} 🪨 + {MAINTENANCE.repair.titanium} 🔩)</button>
                    {!rep.ok && cond < 100 && <div className="text-[10px] text-white/50">{rep.reason}</div>}
                  </div>
                  {cl && (
                    <div>
                      <div className="flex justify-between"><span>🌫 Dust on panels</span><span className="font-mono">{Math.round((b.dust ?? 0) * 100)}% · output {Math.round(solarFarmEfficiency(s, b) * 100)}%</span></div>
                      <Bar value={(b.dust ?? 0) * 100} max={100} color="#b9b2a6" className="my-1 h-1.5" />
                      <button className="btn btn-gray px-2 py-1 text-xs" disabled={!cl.ok} title={cl.ok ? '' : cl.reason} onClick={() => store.clean(b.id)}>🧹 Clean panels</button>
                    </div>
                  )}
                </div>
              );
            })()}
            <p className="mt-2 rounded-lg bg-good/10 px-2 py-1 text-[11px] text-white/85">🌍 <b className="text-good">In the real world:</b> {REAL_WORLD[b.type].text} <span className="text-white/40">({REAL_WORLD[b.type].source})</span></p>
            {b.type === 'monitor' && <StationLinkControls s={s} b={b} />}
            {b.type === 'opscenter' && <OpsCenterSummary s={s} b={b} />}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {b.job ? (
                <span className="chip text-warn">🔨 {({ shield: 'Shielding', repair: 'Repairing', clean: 'Cleaning', build: 'Building', upgrade: 'Upgrading' } as const)[b.job.kind]} — {fmtTime((b.job.end - s.time) / store.timeScale)} left</span>
              ) : b.level < MAX_LEVEL ? (
                <>
                  <button className="btn btn-green" disabled={!up.ok} onClick={() => store.upgrade(b.id)} title={up.ok ? '' : up.ok === false ? up.reason : ''}>
                    ⬆ Upgrade to L{next}
                  </button>
                  <CostList cost={costFor(b.type, next)} s={s} time={Math.round(timeFor(b.type, next) * buildTimeMult(s))} />
                </>
              ) : (
                <span className="chip text-accent">⭐ Max level</span>
              )}
              {!b.job && !up.ok && b.level < MAX_LEVEL && <span className="w-full text-[11px] font-semibold text-warn">{up.reason}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn btn-gray text-sm" disabled={!mv.ok} onClick={() => store.beginMove(b.id)} title={mv.ok ? 'Pick it up and place it somewhere else (G)' : mv.reason}>
                ✥ Move
              </button>
              {b.level > 0 && def.power > 0 && (
                <button className={`btn text-sm ${b.enabled ? 'btn-gray' : 'btn-yellow'}`} onClick={() => store.toggle(b.id)}>
                  {b.enabled ? '⏻ Switch off (save power)' : '⏻ Switch on'}
                </button>
              )}
              {sh && b.shield < RADIATION.maxShield && (
                <button className="btn btn-blue text-sm" disabled={!sh.ok} onClick={() => store.shield(b.id)} title={sh.ok ? '' : sh.ok === false ? sh.reason : ''}>
                  🛡 Add regolith shielding ({RADIATION.shieldCost(b.shield + 1).regolith} 🪨)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
