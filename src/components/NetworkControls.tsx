import { store } from '../game/store';
import { MONITORING, STATION_COLORS, type LinkKind } from '../game/config/monitoring';
import { cableCost, canConnect, capacity, linkRange, networkStatus, opsCenter } from '../game/systems/monitoring';
import type { Building, GameState } from '../game/systems/state';

/** Connection controls inside a Monitoring Station's info card. */
export function StationLinkControls({ s, b }: { s: GameState; b: Building }) {
  const st = networkStatus(s).find((n) => n.station.id === b.id);
  if (!st || b.level === 0) return null;
  const ops = opsCenter(s);
  const color = STATION_COLORS[st.index];
  const option = (kind: LinkKind) => {
    const L = MONITORING.links[kind];
    const can = canConnect(s, b.id, kind);
    const current = b.link === kind;
    return (
      <div key={kind} className={`rounded-lg border p-2 text-[11px] ${current ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-black/25'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold">{L.icon} {L.label}</span>
          {current ? (
            <span className="chip text-cyan">Connected</span>
          ) : (
            <button className="btn btn-blue px-2 py-1 text-xs" disabled={!can.ok} onClick={() => store.connectLink(b.id, kind)} title={can.ok ? '' : can.reason}>
              Connect{kind === 'wired' ? ` · ${cableCost(s, b).regolith} 🪨` : ''}
            </button>
          )}
        </div>
        <div className="mt-1 text-white/60">
          Range {linkRange(kind, b)} tiles · {L.powerKW} kW · {kind === 'wired' ? 'unaffected by solar storms' : 'drops out in solar storms'}
        </div>
        {!current && !can.ok && <div className="mt-0.5 font-semibold text-warn">{can.reason}</div>}
      </div>
    );
  };
  return (
    <div className="mt-2 rounded-lg bg-black/25 p-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold">
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: color }} />
          Station #{st.index + 1} · link to Operations Center
        </span>
        <span className={`chip font-bold ${st.active ? 'text-good' : 'text-warn'}`}>
          {st.active ? `● Transmitting · signal ${Math.round(st.quality * 100)}%` : `▲ ${st.problem}`}
        </span>
      </div>
      {ops ? (
        <>
          <div className="mb-1 text-[11px] text-white/60">
            Distance {st.distance?.toFixed(1)} tiles · network capacity {capacity(s)} station{capacity(s) === 1 ? '' : 's'} (Operations Center level)
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">{(['wired', 'wireless'] as LinkKind[]).map(option)}</div>
          {b.link && <button className="btn btn-gray mt-1.5 px-2 py-1 text-xs" onClick={() => store.disconnectLink(b.id)}>Disconnect</button>}
        </>
      ) : (
        <div className="text-[11px] text-warn">Build the Lunar Operations Center to receive this station's data.</div>
      )}
    </div>
  );
}

/** Summary + dashboard button inside the Operations Center's info card. */
export function OpsCenterSummary({ s, b }: { s: GameState; b: Building }) {
  if (b.level === 0) return null;
  const net = networkStatus(s);
  const activeCount = net.filter((n) => n.active).length;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-black/25 p-2 text-xs">
      <span>📡 {activeCount}/{capacity(s)} stations transmitting · {net.length}/{MONITORING.maxStations} built</span>
      <button className="btn btn-blue ml-auto px-3 py-1.5 text-sm" onClick={() => store.setPanel('monitor')}>Open dashboard</button>
    </div>
  );
}
