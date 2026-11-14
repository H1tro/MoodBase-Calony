import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { SCIENCE } from '../game/config/science';
import { GLOSSARY } from '../game/config/glossary';
import { REAL_WORLD } from '../game/config/realworld';
import { BUILDINGS, BUILD_ORDER } from '../game/config/buildings';
import { QUIZ } from '../game/config/quiz';
import { CREW, DAY_NIGHT, PRODUCTION, RADIATION } from '../game/config/balance';
import { LIFE } from '../game/config/station';
import { DIFFICULTIES } from '../game/config/difficulty';
import { CloseButton, Modal } from './ui';

type Tab = 'cards' | 'glossary' | 'compare' | 'tech' | 'quiz';

/** Real vs game numbers, so players know exactly what is simplified. */
function Compare() {
  const { s } = useGame();
  const dayPct = Math.round(DIFFICULTIES[s.difficulty].dayFraction * 100);
  const rows: [string, string, string][] = [
    ['Day–night cycle', 'About 29.5 Earth days (sunrise to sunrise)', `${DAY_NIGHT.cycle} colony hours = 6 real minutes (${dayPct}% day on ${DIFFICULTIES[s.difficulty].name})`],
    ['Surface temperature', 'About +120 °C (day) to below −170 °C (night) at the equator', 'Same range in the station sensor model'],
    ['Sunlight', 'About 1361 W/m² (no atmosphere)', 'Same value for illumination readings'],
    ['Background radiation', 'About 57 µSv/h (Chang’e-4, 2019)', 'Same background; storm spikes are game values'],
    ['Oxygen per astronaut', 'About 0.84 kg per day', `${CREW.o2} kg per colony hour (sped up)`],
    ['CO₂ per astronaut', 'About 1 kg per day', `${LIFE.co2PerCrew} kg per colony hour (same ratio to O₂)`],
    ['Water from electrolysis', '1 kg water → 0.89 kg O₂', `Same (${PRODUCTION.o2PerWater})`],
    ['Water recycling', 'ISS ≈ 98% (2023)', `${Math.round(LIFE.waterRecoveryBase * 100)}% base, ${Math.round(LIFE.waterRecoveryTech * 100)}% with research`],
    ['Gravity', '1.62 m/s² (≈ 1/6 g)', 'Shown in crew hops and rover dust; not part of the economy'],
    ['Career dose limit', '600 mSv (NASA, 2022)', `Game dose scale; storms deal ${RADIATION.doseRate} mSv/h unshielded`],
    ['New craters', 'About 220 per year (LRO)', 'Random micrometeoroid hits on buildings'],
    ['Earth–Moon radio delay', 'About 1.3 s each way', 'Not simulated'],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-white/50"><tr><th className="py-1 pr-2">Topic</th><th className="pr-2 text-good">Real Moon</th><th className="text-accent">This game</th></tr></thead>
        <tbody>
          {rows.map(([a, b, c]) => (
            <tr key={a} className="border-t border-white/10 align-top"><td className="py-1.5 pr-2 font-semibold">{a}</td><td className="pr-2">{b}</td><td className="text-white/70">{c}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Practice({ seen }: { seen: string[] }) {
  const available = QUIZ.filter((q) => seen.includes(q.factId));
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  if (!available.length) return <p className="text-sm text-white/60">Discover science cards in the game to unlock practice questions.</p>;
  const q = available[i % available.length];
  return (
    <div>
      <div className="mb-1 text-[11px] text-white/50">Practice question {(i % available.length) + 1} of {available.length} (no rewards here; answer at sunrise in the game for credits)</div>
      <div className="mb-2 text-sm font-bold">{q.question}</div>
      <div className="grid gap-1.5">
        {q.options.map((o, k) => (
          <button key={k} disabled={pick !== null}
            className={`rounded-lg border-2 p-2 text-left text-sm ${pick === null ? 'border-edge bg-panel-2 hover:border-accent' : k === q.answer ? 'border-good bg-good/15' : k === pick ? 'border-bad bg-bad/15' : 'border-white/10 opacity-60'}`}
            onClick={() => setPick(k)}>{o}</button>
        ))}
      </div>
      {pick !== null && (
        <>
          <p className="mt-2 text-xs"><b className={pick === q.answer ? 'text-good' : 'text-bad'}>{pick === q.answer ? 'Correct! ' : 'Not quite. '}</b>{q.explain}</p>
          <button className="btn btn-blue mt-2" onClick={() => { setI(i + 1); setPick(null); }}>Next question</button>
        </>
      )}
    </div>
  );
}

/** Lunar Library content: discovered science cards, glossary, real-vs-game numbers, real technology, quiz practice. */
export function LibraryContent() {
  const { s } = useGame();
  const [tab, setTab] = useState<Tab>('cards');
  const facts = Object.values(SCIENCE);
  const seen = s.scienceSeen;
  const found = facts.filter((f) => seen.includes(f.id));
  const TABS: [Tab, string][] = [['cards', `🔭 Science cards ${found.length}/${facts.length}`], ['glossary', '📖 Glossary'], ['compare', '⚖️ Real vs game'], ['tech', '🛠 Real technology'], ['quiz', '🧠 Practice quiz']];
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map(([id, label]) => <button key={id} className={`btn px-2 py-1.5 text-xs ${tab === id ? 'btn-yellow' : 'btn-gray'}`} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === 'cards' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {facts.map((f) => seen.includes(f.id) ? (
            <div key={f.id} className="rounded-xl border-2 border-good/30 bg-black/25 p-3 text-xs">
              <div className="title text-base leading-tight">{f.title}</div>
              <p className="mt-1">{f.fact}</p>
              <p className="mt-1 text-accent"><b>In the game:</b> {f.inGame}</p>
              <p className="mt-1 text-[10px] text-white/45">Source: {f.source}</p>
            </div>
          ) : (
            <div key={f.id} className="grid place-items-center rounded-xl border-2 border-dashed border-white/10 p-3 text-xs text-white/40">🔒 Undiscovered: keep playing to find it</div>
          ))}
        </div>
      )}
      {tab === 'glossary' && (
        <dl className="grid gap-2 sm:grid-cols-2">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="rounded-xl bg-black/25 p-2 text-xs">
              <dt className="font-bold text-cyan">{g.term}</dt>
              <dd className="mt-0.5">{g.meaning}</dd>
              {g.inGame && <dd className="mt-0.5 text-[11px] text-accent">In the game: {g.inGame}</dd>}
            </div>
          ))}
        </dl>
      )}
      {tab === 'compare' && <Compare />}
      {tab === 'tech' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(['command', ...BUILD_ORDER] as const).map((t) => (
            <div key={t} className="rounded-xl bg-black/25 p-2 text-xs">
              <div className="font-bold">{BUILDINGS[t].icon} {BUILDINGS[t].name}</div>
              <p className="mt-0.5 text-white/80">{REAL_WORLD[t].text}</p>
              <p className="mt-0.5 text-[10px] text-white/45">Source: {REAL_WORLD[t].source}</p>
            </div>
          ))}
        </div>
      )}
      {tab === 'quiz' && <Practice seen={seen} />}
    </div>
  );
}

/** In-game Lunar Library window (opened from Mission Control or with L). */
export default function Library() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener('open-library', on);
    return () => window.removeEventListener('open-library', on);
  }, []);
  if (!open) return null;
  return (
    <Modal wide onClose={() => setOpen(false)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="title text-2xl">📚 Lunar Library</h2>
        <CloseButton onClick={() => setOpen(false)} />
      </div>
      <LibraryContent />
    </Modal>
  );
}
