import { store, useGame } from '../game/store';
import { active } from '../game/systems/selectors';
import { zoomBy } from '../game/bridge';
import { BUILDINGS } from '../game/config/buildings';

function BigButton({ icon, label, onClick, activeState, badge, color }: { icon: string; label: string; onClick: () => void; activeState?: boolean; badge?: string; color: string }) {
  return (
    <button className={`btn ${color} relative h-14 min-w-[54px] flex-col gap-0.5 px-1.5 sm:h-16 sm:min-w-[84px] sm:px-2 ${activeState ? 'ring-4 ring-cyan' : ''}`} onClick={onClick}>
      <span className="text-2xl leading-none sm:text-3xl">{icon}</span>
      <span className="text-[11px] sm:text-xs">{label}</span>
      {badge && <span className="absolute -right-1.5 -top-1.5 rounded-full border-2 border-black/50 bg-bad px-1.5 text-[10px]">{badge}</span>}
    </button>
  );
}

export default function BottomBar() {
  const { s, ui } = useGame();
  const selected = ui.selectedId !== null ? s.buildings.find((b) => b.id === ui.selectedId) : undefined;
  const hasLab = active(s, 'lab').length > 0;
  const hasPort = active(s, 'spaceport').length > 0;
  if (ui.placing) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-2 p-2 sm:p-3">
      <div className="pointer-events-auto flex flex-col gap-1.5">
        <button className="btn btn-gray h-10 w-10 p-0 text-xl" onClick={() => zoomBy(1.2)} aria-label="Zoom in">＋</button>
        <button className="btn btn-gray h-10 w-10 p-0 text-xl" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">－</button>
      </div>
      <div className="pointer-events-auto flex items-end gap-2">
        <BigButton icon="🏗️" label="Build" color="btn-yellow" onClick={() => store.setPanel('build')} activeState={ui.panel === 'build'} />
        <BigButton
          icon="⬆️"
          label="Upgrade"
          color="btn-green"
          onClick={() => {
            if (selected) store.select(selected.id);
            else store.flash('Tap a building on the map to see its upgrade.', 'ok');
          }}
          badge={selected ? `L${selected.level}` : undefined}
        />
        <BigButton icon="🔬" label="Research" color="btn-blue" onClick={() => store.setPanel('research')} activeState={ui.panel === 'research'} badge={s.research.active ? '…' : hasLab ? undefined : '🔒'} />
        <BigButton icon="🛰" label="Control" color="btn-blue" onClick={() => store.setPanel('monitor')} activeState={ui.panel === 'monitor'} badge={s.station.pending || s.flows.starving.length || s.station.effects.some((e) => e.until > s.time) ? '!' : undefined} />
        <BigButton icon="🚀" label="Spaceport" color="btn-blue" onClick={() => store.setPanel('spaceport')} activeState={ui.panel === 'spaceport'} badge={s.cargo.active ? '…' : hasPort ? undefined : '🔒'} />
      </div>
      <div className="hidden w-10 sm:block" aria-hidden />
      {selected && ui.panel === null && <span className="sr-only">{BUILDINGS[selected.type].name} selected</span>}
    </div>
  );
}
