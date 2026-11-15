import { store, useGame } from '../game/store';
import { TECHS } from '../game/config/techs';
import { CARGO, type CargoKind } from '../game/config/balance';
import { canResearch } from '../game/systems/research';
import { canLaunch, cargoPayout } from '../game/systems/spaceport';
import { active } from '../game/systems/selectors';
import { fmtTime } from '../utils/format';
import { Bar, CloseButton } from './ui';

function Sheet({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center p-2 sm:p-3">
      <div className="panel slide-down max-h-[70vh] w-full max-w-4xl overflow-y-auto scroll-thin p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h2 className="title text-2xl leading-none">{title}</h2>
            <p className="text-xs text-white/60">{sub}</p>
          </div>
          <CloseButton onClick={() => store.setPanel(null)} />
        </div>
        {children}
      </div>
    </div>
  );
}

export function ResearchPanel() {
  const { s, ui } = useGame();
  if (ui.panel !== 'research') return null;
  const lab = active(s, 'lab')[0];
  const r = s.research.active;
  return (
    <Sheet title="🔬 Research" sub={lab ? `Research Lab level ${lab.level}${lab.online ? '' : ' — NO POWER, research paused'}` : 'Build a Research Lab (unlocks at Command Center level 2) to start researching.'}>
      {r && (
        <div className="mb-3 rounded-xl bg-cyan/10 p-2">
          <div className="flex justify-between text-sm font-semibold">
            <span>Researching: {TECHS.find((t) => t.id === r.id)!.name}</span>
            <span className="font-mono">{fmtTime((r.end - s.time) / store.timeScale)}</span>
          </div>
          <Bar value={s.time - r.start} max={r.end - r.start} color="#7fe3ff" className="mt-1" />
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TECHS.map((t) => {
          const owned = s.research.owned.includes(t.id);
          const can = canResearch(s, t.id);
          return (
            <div key={t.id} className={`flex flex-col rounded-2xl border-2 p-3 ${owned ? 'border-good/60 bg-good/10' : 'border-edge bg-panel-2'}`}>
              <div className="title text-base">{t.icon} {t.name}</div>
              <div className="mb-2 text-xs text-white/70">{t.effect}</div>
              <div className="mt-auto flex flex-wrap items-center gap-1.5 text-xs">
                <span className="chip">Lab L{t.labLevel}</span>
                <span className="chip">⏱ {t.time}s</span>
                {owned ? (
                  <span className="chip ml-auto text-good">✓ Researched</span>
                ) : (
                  <button className="btn btn-blue ml-auto px-2 py-1.5 text-sm" disabled={!can.ok} onClick={() => store.research(t.id)} title={can.ok ? '' : can.reason}>
                    {t.cost} ₡
                  </button>
                )}
              </div>
              {!owned && !can.ok && <div className="mt-1 text-[10px] font-semibold text-warn">{can.reason}</div>}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

export function SpaceportPanel() {
  const { s, ui } = useGame();
  if (ui.panel !== 'spaceport') return null;
  const port = active(s, 'spaceport')[0];
  const c = s.cargo.active;
  return (
    <Sheet title="🚀 Spaceport" sub={port ? `Cargo runs completed: ${s.cargo.runs}. Exported material is gone from the colony — choose wisely.` : 'Build a Spaceport (unlocks at Command Center level 3) to trade materials for credits.'}>
      {c && (
        <div className="mb-3 rounded-xl bg-accent/10 p-2">
          <div className="flex justify-between text-sm font-semibold">
            <span>In flight: {CARGO.options[c.kind].label} → +{c.payout} ₡</span>
            <span className="font-mono">{fmtTime((c.end - s.time) / store.timeScale)}</span>
          </div>
          <Bar value={s.time - c.start} max={c.end - c.start} color="#ffc93c" className="mt-1" />
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(CARGO.options) as CargoKind[]).map((k) => {
          const o = CARGO.options[k];
          const can = canLaunch(s, k);
          return (
            <div key={k} className="flex flex-col rounded-2xl border-2 border-edge bg-panel-2 p-3">
              <div className="title text-base">{k === 'regolith' ? '🪨' : k === 'titanium' ? '🔩' : '💧'} {o.label}</div>
              <div className="text-xs text-white/70">Ship {o.amount} {o.unit}{k === 'water' ? ' — taken from life-support water!' : ''}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="title text-lg text-accent">+{cargoPayout(s, k)} ₡</span>
                <button className="btn btn-yellow px-3 py-1.5 text-sm" disabled={!can.ok} onClick={() => store.launch(k)}>Launch</button>
              </div>
              {!can.ok && <div className="mt-1 text-[10px] font-semibold text-warn">{can.reason}</div>}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

export function PlacementControls() {
  const { ui } = useGame();
  if (!ui.placing) return null;
  const check = store.ghostCheck();
  const ok = !!check?.ok;
  const moving = ui.moving !== null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-3">
      <div className="panel pointer-events-auto slide-down flex flex-wrap items-center justify-center gap-3 px-4 py-3">
        <div className="text-center sm:text-left">
          <div className="title text-lg leading-tight">{moving ? 'Moving a building' : 'Placing a building'}</div>
          <div className={`text-xs font-semibold ${!ui.ghost ? 'text-white/70' : ok ? 'text-good' : 'text-bad'}`}>
            {!ui.ghost ? 'Left-click the map to build (touch: tap, then ✓ Build)'
              : ok ? (moving ? 'Green = free spot. Left-click to move it here (free).' : 'Green = good spot. Left-click to build here.')
              : `Red: ${check?.reason}`}
          </div>
        </div>
        <button className="btn btn-green h-12 px-5 text-lg" disabled={!ok} onClick={() => store.confirmPlacement()}>{moving ? '✓ Move here' : '✓ Build'}</button>
        <button className="btn btn-red h-12 px-5 text-lg" onClick={() => store.cancelPlacement()}>✕ Cancel</button>
      </div>
    </div>
  );
}
