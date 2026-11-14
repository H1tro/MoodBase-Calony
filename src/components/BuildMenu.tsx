import { store, useGame } from '../game/store';
import { BUILDINGS, BUILD_ORDER, costFor, timeFor } from '../game/config/buildings';
import { texKey } from '../game/art/drawBuildings';
import { canStartBuild } from '../game/systems/construction';
import { buildTimeMult, built, maxCount } from '../game/systems/selectors';
import { BuildingArt, CloseButton, CostList } from './ui';

export default function BuildMenu() {
  const { s, ui } = useGame();
  if (ui.panel !== 'build') return null;
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center p-2 sm:p-3">
      <div className="panel slide-down w-full max-w-5xl p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h2 className="title text-2xl leading-none">🏗️ Build</h2>
            <p className="text-xs text-white/60">Pick a building, then tap the map to place it. Each one needs a free builder robot.</p>
          </div>
          <CloseButton onClick={() => store.setPanel(null)} />
        </div>
        <div className="scroll-thin flex snap-x gap-2 overflow-x-auto pb-2">
          {BUILD_ORDER.map((type) => {
            const def = BUILDINGS[type];
            const can = canStartBuild(s, type);
            const max = maxCount(s, type);
            const locked = max === 0;
            const count = built(s, type).length;
            return (
              <button
                key={type}
                className={`group relative flex w-[150px] shrink-0 snap-start flex-col rounded-2xl border-2 p-2 text-left transition ${can.ok ? 'border-edge bg-panel-2 hover:-translate-y-1 hover:border-accent' : 'border-edge/60 bg-black/30'}`}
                onClick={() => store.beginPlacement(type)}
                title={can.ok ? def.role : can.reason}
              >
                <div className="relative h-24">
                  <BuildingArt texKey={texKey(type, 1)} className={`h-full w-full ${locked ? 'opacity-30 grayscale' : can.ok ? '' : 'opacity-70'}`} />
                  {locked && <span className="absolute inset-0 grid place-items-center text-3xl">🔒</span>}
                  <span className="chip absolute right-0 top-0">{count}/{max}</span>
                </div>
                <div className="title text-sm leading-tight">{def.icon} {def.name}</div>
                <div className="mb-1 line-clamp-2 text-[10px] leading-snug text-white/60">{def.role}</div>
                <div className="mt-auto">
                  <CostList cost={costFor(type, 1)} s={s} time={Math.round(timeFor(type, 1) * buildTimeMult(s))} />
                  {!can.ok && <div className="mt-1 text-[10px] font-semibold leading-tight text-warn">{can.reason}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
