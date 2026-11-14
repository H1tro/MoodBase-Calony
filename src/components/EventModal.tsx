import { useState } from 'react';
import { store, useGame } from '../game/store';
import { EVENTS } from '../game/config/events';
import { SCIENCE } from '../game/config/science';
import { NTRS } from '../game/nasa';
import { Modal } from './ui';

/** A dynamic event: what happened, the choices, then the consequence and the science behind it. */
export default function EventModal() {
  const { s, screen } = useGame();
  const [result, setResult] = useState<{ eventId: string; outcome: string } | null>(null);
  const e = s.station.pending;

  if (screen !== 'game') return null;
  if (!e && !result) return null;
  if (result) {
    const def = EVENTS[result.eventId];
    const fact = def.factId ? SCIENCE[def.factId] : null;
    const report = def.ntrsTopic ? NTRS[def.ntrsTopic]?.results[0] : undefined;
    return (
      <Modal>
        <div className="text-[11px] font-bold uppercase tracking-widest text-cyan">Decision logged in the mission history</div>
        <h2 className="title text-2xl leading-tight">{def.icon} {def.title}</h2>
        <p className="mt-2 rounded-xl bg-black/30 p-3 text-sm"><b className="text-accent">Consequence: </b>{result.outcome}</p>
        <div className="mt-2 rounded-xl border-2 border-good/40 bg-good/10 p-3 text-sm">
          <div className="mb-1 text-[11px] font-bold uppercase text-good">Why this happens (real science)</div>
          {def.science}
          {fact && <div className="mt-1 text-[11px] text-white/60">More in the Lunar Library: “{fact.title}”.</div>}
        </div>
        {report && (
          <a href={report.url} target="_blank" rel="noreferrer" className="mt-2 block rounded-xl bg-black/25 p-2 text-xs text-cyan underline">
            📄 Read a real NASA report: {report.title} ({report.date.slice(0, 4)})
          </a>
        )}
        <button className="btn btn-blue mt-3 w-full" onClick={() => setResult(null)}>Back to the colony</button>
      </Modal>
    );
  }

  const def = EVENTS[e!.id];
  return (
    <Modal>
      <div className="text-[11px] font-bold uppercase tracking-widest text-warn">⚠ Station alert · the colony is paused</div>
      <h2 className="title text-2xl leading-tight">{def.icon} {def.title}</h2>
      <p className="mt-2 text-sm text-white/85">{def.describe(s, e!)}</p>
      <div className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white/50">How do you respond, Commander?</div>
      <div className="mt-1 grid gap-2">
        {def.choices.map((c) => {
          const blocked = c.blocked?.(s, e!) ?? null;
          return (
            <button
              key={c.id}
              disabled={!!blocked}
              onClick={() => {
                const r = store.decideEvent(c.id);
                if (r.ok) setResult({ eventId: def.id, outcome: r.outcome });
              }}
              className="rounded-xl border-2 border-edge bg-panel-2 p-3 text-left transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-45"
            >
              <div className="text-sm font-bold">{c.label}</div>
              <div className="text-[11px] text-white/65">{c.detail}</div>
              {blocked && <div className="mt-0.5 text-[11px] font-semibold text-warn">Not possible: {blocked}</div>}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
