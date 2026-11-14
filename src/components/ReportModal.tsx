import { useEffect, useState, type ReactNode } from 'react';
import { useGame } from '../game/store';
import { buildReport } from '../game/systems/report';
import { fmt } from '../utils/format';
import { Bar, CloseButton, Modal } from './ui';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-cyan">{title}</div>
      {children}
    </div>
  );
}
const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex justify-between gap-2 text-xs"><span className="text-white/60">{k}</span><span className="font-mono font-semibold">{v}</span></div>
);

/** Detailed mission report, opened from Mission Control or at the end of a mission. */
export default function ReportModal() {
  const { s } = useGame();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener('open-report', on);
    return () => window.removeEventListener('open-report', on);
  }, []);
  if (!open) return null;
  const r = buildReport(s);
  const T = r.totals;
  return (
    <Modal wide onClose={() => setOpen(false)}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-cyan">Mission report · {r.difficulty}</div>
          <h2 className="title text-3xl leading-tight">
            {r.outcome === 'success' ? '🏆 Mission complete' : r.outcome === 'failed' ? '🚨 Mission failed' : '📄 Mission in progress'}
          </h2>
        </div>
        <CloseButton onClick={() => setOpen(false)} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4 rounded-xl border-2 border-accent/50 bg-accent/10 p-3">
        <div className="title text-5xl text-accent">{r.score.grade}</div>
        <div className="min-w-[200px] flex-1">
          <div className="text-sm font-bold">Overall performance: {r.score.total} / 100</div>
          {r.score.parts.map((p) => (
            <div key={p.label} className="mt-1 text-[11px]">
              <div className="flex justify-between"><span>{p.label}</span><span className="font-mono">{p.value}/{p.max}</span></div>
              <Bar value={p.value} max={p.max} color="#ffc93c" className="h-1.5" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Block title="⏱ Duration">
          <Row k="Colony hours" v={fmt(r.hours)} />
          <Row k="Day–night cycles completed" v={r.cycles} />
          <Row k="On the real Moon that would be about" v={`${fmt(r.realDaysEquivalent)} Earth days`} />
          <Row k="Story chapters completed" v={`${r.chaptersDone} / ${r.chaptersTotal}`} />
        </Block>
        <Block title="👩‍🚀 Crew condition">
          <Row k="Crew" v={r.crew.count} />
          <Row k="Health" v={`${r.crew.health}%`} />
          <Row k="Radiation dose (game scale)" v={`${r.crew.dose} mSv`} />
        </Block>
        <Block title="📦 Resources consumed">
          <Row k="Oxygen breathed" v={`${fmt(T.o2Used, 1)} kg`} />
          <Row k="Water used / recycled" v={`${fmt(T.waterUsed, 1)} / ${fmt(T.waterRecycled, 1)} L`} />
          <Row k="Food eaten / grown" v={`${fmt(T.foodUsed, 1)} / ${fmt(T.foodGrown, 1)} kg`} />
          <Row k="CO₂ scrubbed" v={`${fmt(T.co2Removed, 1)} kg`} />
          <Row k="Waste made / composted" v={`${fmt(T.wasteMade, 1)} / ${fmt(T.wasteComposted, 1)} kg`} />
          <Row k="Energy generated / used" v={`${fmt(T.energyMade)} / ${fmt(T.energyUsed)} kWh`} />
          <Row k="Regolith mined · ice mined · titanium made" v={`${fmt(T.regolithMined)} · ${fmt(T.iceMined)} · ${fmt(T.titaniumMade)} kg`} />
        </Block>
        <Block title="🧰 Remaining resources">
          <Row k="Oxygen · water · food" v={`${fmt(r.remaining.o2, 1)} kg · ${fmt(r.remaining.water, 1)} L · ${fmt(r.remaining.food, 1)} kg`} />
          <Row k="Battery" v={`${fmt(r.remaining.battery)} kWh`} />
          <Row k="Regolith · titanium · ice" v={`${fmt(r.remaining.regolith)} · ${fmt(r.remaining.titanium)} · ${fmt(r.remaining.ice)} kg`} />
          <Row k="Credits" v={`${fmt(r.remaining.credits)} ₡`} />
        </Block>
        <Block title="🔬 Science">
          <Row k="Technologies researched" v={r.science.techs} />
          <Row k="Science cards discovered" v={`${r.science.cards} / ${r.science.cardsTotal}`} />
          <Row k="Quiz answers correct" v={r.science.quizCorrect} />
          <Row k="Environmental measurements" v={fmt(r.science.samples)} />
        </Block>
        <Block title="🔧 Equipment condition">
          <Row k="Average condition" v={`${r.equipment.average}%`} />
          {r.equipment.worst && <Row k="Most worn" v={`${r.equipment.worst.name} (${r.equipment.worst.condition}%)`} />}
        </Block>
      </div>

      <Block title={`⚠ Events and decisions (${r.events.length})`}>
        {r.events.length ? (
          <ul className="grid max-h-40 gap-1 overflow-y-auto scroll-thin text-[11px]">
            {r.events.map((e, i) => (
              <li key={i}>
                <span className="font-mono text-white/45">h{Math.round(e.t)} </span>
                <b>{e.title}</b> → {e.choice}{' '}
                <span className={e.quality === 'good' ? 'text-good' : e.quality === 'risky' ? 'text-bad' : 'text-warn'}>({e.quality === 'good' ? 'good practice' : e.quality === 'risky' ? 'risky' : 'trade-off'})</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-white/55">No emergencies yet.</p>}
      </Block>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border-2 border-good/40 bg-good/10 p-3 text-xs">
          <div className="mb-1 font-bold text-good">What went well</div>
          <ul className="list-disc pl-4">{r.wentWell.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
        <div className="rounded-xl border-2 border-warn/40 bg-warn/10 p-3 text-xs">
          <div className="mb-1 font-bold text-warn">What could be improved</div>
          <ul className="list-disc pl-4">{r.improve.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      </div>
    </Modal>
  );
}
