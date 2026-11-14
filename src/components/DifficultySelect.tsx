import { store, useGame } from '../game/store';
import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyDef } from '../game/config/difficulty';

function Pips({ d }: { d: DifficultyDef }) {
  return (
    <div className="flex gap-1" aria-label={`Difficulty ${d.rank} of 4`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className="h-2.5 w-6 rounded-sm border border-black/40" style={{ background: i <= d.rank ? d.color : 'rgba(255,255,255,0.1)' }} />
      ))}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/10 py-1.5 text-xs">
      <span className="text-white/60">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  );
}

function Card({ d, selected }: { d: DifficultyDef; selected: boolean }) {
  const day = Math.round(d.dayFraction * 100);
  const secs = Math.round(100 / d.upgradeSpeed);
  return (
    <button
      onClick={() => store.chooseDifficulty(d.id)}
      onDoubleClick={() => { store.chooseDifficulty(d.id); store.startLaunch(); }}
      aria-pressed={selected}
      className={`relative flex flex-col rounded-2xl border-2 p-4 text-left transition duration-200 ${selected ? '-translate-y-1 shadow-[0_0_0_4px_var(--glow),0_12px_30px_rgba(0,0,0,0.5)]' : 'opacity-80 hover:-translate-y-0.5 hover:opacity-100'}`}
      style={{ borderColor: d.color, background: `linear-gradient(180deg, ${d.color}26 0%, #101a33 55%)`, ['--glow' as string]: d.color + '66' }}
    >
      {selected && <span className="chip absolute right-3 top-3 font-bold text-black" style={{ background: d.color }}>SELECTED</span>}
      <div className="title text-2xl leading-none" style={{ color: d.color }}>{d.name}</div>
      <div className="mt-2"><Pips d={d} /></div>
      <p className="mt-2 min-h-[48px] text-xs text-white/75">{d.tagline}</p>
      <div className="mt-2">
        <Stat label="🪨 Resources">
          {d.resourceAbundance}× · {d.deposits.ice} ice / {d.deposits.ore} ore deposits
        </Stat>
        <Stat label="☀️ Day / 🌙 Night">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-2 w-16 overflow-hidden rounded-full">
              <span style={{ width: `${day}%`, background: '#ffc93c' }} />
              <span style={{ width: `${100 - day}%`, background: '#4a5bd6' }} />
            </span>
            {day}/{100 - day}
          </span>
        </Stat>
        <Stat label="🔨 Build speed">{d.upgradeSpeed}× (100 s → {secs} s)</Stat>
        <Stat label="⚡ Solar output">{Math.round(d.solarMult * 100)}%</Stat>
      </div>
    </button>
  );
}

/** Difficulty selection, shown on first launch and whenever a new colony is started. */
export default function DifficultySelect() {
  const { screen } = useGame();
  if (screen !== 'select') return null;
  const chosen = DIFFICULTIES[store.pendingDifficulty];
  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] overflow-y-auto bg-[#02040a]/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col justify-center p-4 sm:p-8">
        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.3em] text-cyan">Mission planning · MoonBase Colony</div>
        <h1 className="title text-3xl leading-tight sm:text-4xl">Choose your mission difficulty</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/70">
          Difficulty changes the map’s deposits, how long the lunar night lasts, how fast robots build and how much power solar farms make. It is saved with your colony and cannot change later.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DIFFICULTY_ORDER.map((id) => <Card key={id} d={DIFFICULTIES[id]} selected={store.pendingDifficulty === id} />)}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn btn-yellow h-12 px-6 text-lg" onClick={() => store.startLaunch()}>
            🚀 Launch mission · <span style={{ color: '#3a2600' }}>{chosen.name}</span>
          </button>
          <button className="btn btn-gray h-12 px-5" onClick={() => store.cancelNewGame()}>← Back</button>
          {store.hasColony && <span className="text-xs text-warn">Launching replaces your current colony.</span>}
        </div>
        <p className="mt-4 text-[11px] text-white/40">Game values are simplified for play. On the real Moon, day and night each last about two weeks.</p>
      </div>
    </div>
  );
}
