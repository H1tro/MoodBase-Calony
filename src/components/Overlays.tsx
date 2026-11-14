import { useEffect, useRef, useState } from 'react';
import { store, useGame } from '../game/store';
import { SCIENCE } from '../game/config/science';
import type { LogEntry } from '../game/systems/state';
import { Modal } from './ui';
import { openReport } from './MissionControl';
import { QUIZ_BY_ID, QUIZ_REWARD } from '../game/config/quiz';
import { diff, hoursToSwitch } from '../game/systems/selectors';
import { fmtTime } from '../utils/format';
import { DAY_NIGHT } from '../game/config/balance';

/** Short-lived notifications for errors and important log events. */
export function Toasts() {
  const { s, ui } = useGame();
  const [items, setItems] = useState<{ id: string; text: string; kind: string }[]>([]);
  const lastLog = useRef(s.log[0]?.id ?? 0);
  const lastFlash = useRef(0);

  useEffect(() => {
    const add: { id: string; text: string; kind: string }[] = [];
    // A new colony restarts log numbering.
    if ((s.log[0]?.id ?? 0) < lastLog.current) lastLog.current = s.log[0]?.id ?? 0;
    const fresh: LogEntry[] = s.log.filter((l) => l.id > lastLog.current && l.kind !== 'info');
    if (s.log[0]) lastLog.current = Math.max(lastLog.current, s.log[0].id);
    for (const l of fresh.slice(0, 3).reverse()) add.push({ id: 'l' + l.id, text: l.text, kind: l.kind });
    if (ui.flash && ui.flash.id !== lastFlash.current) {
      lastFlash.current = ui.flash.id;
      add.push({ id: 'f' + ui.flash.id, text: ui.flash.text, kind: ui.flash.kind === 'error' ? 'bad' : 'good' });
    }
    if (!add.length) return;
    setItems((cur) => [...cur, ...add].slice(-4));
    const ids = add.map((a) => a.id);
    // Not cleared on re-render (the store updates many times a second); each toast removes itself.
    setTimeout(() => setItems((cur) => cur.filter((c) => !ids.includes(c.id))), 4200);
  });

  return (
    <div className="pointer-events-none absolute left-1/2 top-[124px] z-40 flex w-[min(460px,calc(100vw-24px))] -translate-x-1/2 flex-col items-center gap-1.5 md:top-[84px]">
      {items.map((t) => (
        <div
          key={t.id}
          className={`slide-down rounded-xl border-2 px-3 py-1.5 text-center text-sm font-semibold shadow-lg ${
            { good: 'border-good/60 bg-[#0f2e1d]/95', bad: 'border-bad/70 bg-[#3a1010]/95', warn: 'border-warn/70 bg-[#3a2a10]/95', info: 'border-edge bg-panel/95' }[t.kind]
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

const FAIL_INFO = {
  o2: { title: 'The oxygen ran out', why: 'The crew used oxygen faster than the Oxygen Generator could make it — or the generator lost power or ran out of ice.', real: 'Real life-support systems keep emergency oxygen reserves (tanks and chemical oxygen candles) and run redundant generators so one failure is never fatal.' },
  water: { title: 'The water ran out', why: 'Crew drinking water plus greenhouse irrigation used more than the colony produced.', real: 'The ISS recycles about 98% of its water. Recycling is usually cheaper than mining or shipping new water.' },
  food: { title: 'The food ran out', why: 'Greenhouses could not grow enough food for the crew size.', real: 'Long missions combine stored food with growing fresh crops; NASA experiments like Veggie on the ISS test lunar-style farming.' },
  cold: { title: 'Life support lost power', why: 'The batteries emptied during the long lunar night and the habitats froze.', real: 'Engineers size batteries (or nuclear power like NASA’s Fission Surface Power project) to survive the full ~14-day lunar night.' },
  co2: { title: 'Carbon dioxide built up', why: 'Without power, the CO₂ scrubbers stopped and the crew’s exhaled CO₂ filled the sealed cabin.', real: 'Spacecraft carry backup scrubbers. On Apollo 13 the crew built an adapter from tape and cardboard so spare CO₂ filters would fit — and survived.' },
  waste: { title: 'Waste overwhelmed the base', why: 'Waste storage filled up and hygiene problems made the crew ill.', real: 'Real missions plan waste storage and disposal carefully, and future bases plan to recycle organic waste into fertiliser.' },
  radiation: { title: 'A solar storm hit the crew', why: 'The crew received a high radiation dose during a solar particle event.', real: 'Missions plan storm shelters with thick shielding — water, regolith or equipment — where crews wait out solar storms.' },
} as const;

export function Modals() {
  const { s } = useGame();
  if (s.failed) {
    const info = FAIL_INFO[s.failed.cause];
    return (
      <Modal>
        <div className="text-center text-5xl">🚨</div>
        <h2 className="title text-center text-3xl text-bad">Mission failed</h2>
        <h3 className="title mb-3 text-center text-lg">{info.title}</h3>
        <div className="grid gap-2 text-sm">
          <p className="rounded-xl bg-black/30 p-3"><b className="text-warn">What happened: </b>{info.why}</p>
          <p className="rounded-xl bg-cyan/10 p-3"><b className="text-cyan">How real engineers handle it: </b>{info.real}</p>
          <p className="text-xs text-white/60">Colony survived {s.stats.nightsSurvived} night(s), built {s.stats.buildingsBuilt} buildings, crew of {s.crew.count}.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-green flex-1" onClick={() => store.loadCheckpoint()}>↺ Retry from last sunrise</button>
          <button className="btn btn-gray flex-1" onClick={() => store.openNewGame()}>New colony…</button>
        </div>
        <button className="btn btn-yellow mt-2 w-full" onClick={openReport}>📄 Mission report: what went well, what to improve</button>
      </Modal>
    );
  }
  if (s.won) {
    return (
      <Modal>
        <div className="text-center text-5xl">🏆🌕</div>
        <h2 className="title text-center text-3xl text-accent">Lunar Metropolis!</h2>
        <p className="my-3 text-center text-sm">You built a self-sustaining colony: power through the night, oxygen and water from ice, food from greenhouses and shielding from regolith. That is exactly the puzzle real mission planners are working on for Artemis.</p>
        <button className="btn btn-blue mb-2 w-full" onClick={openReport}>📄 Read the mission report</button>
        <button className="btn btn-yellow w-full" onClick={() => store.dismissWin()}>Keep building</button>
      </Modal>
    );
  }
  const id = s.scienceQueue[0];
  if (id === 'intro') return <Intro />;
  if (id?.startsWith('quiz:')) return <QuizCard id={id.slice(5)} />;
  const fact = id ? SCIENCE[id] : undefined;
  if (fact) {
    return (
      <Modal onClose={() => store.dismissScience()}>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-cyan">🔭 Science card</div>
        <h2 className="title mb-2 text-2xl leading-tight">{fact.title}</h2>
        <div className="rounded-xl border-2 border-good/40 bg-good/10 p-3 text-sm">
          <div className="mb-1 text-[11px] font-bold uppercase text-good">Real science</div>
          {fact.fact}
          <div className="mt-1 text-[10px] text-white/50">Source: {fact.source}</div>
        </div>
        <div className="mt-2 rounded-xl border-2 border-accent/40 bg-accent/10 p-3 text-sm">
          <div className="mb-1 text-[11px] font-bold uppercase text-accent">Game assumption</div>
          {fact.inGame}
        </div>
        <button className="btn btn-blue mt-3 w-full" onClick={() => store.dismissScience()}>Got it — back to the colony</button>
      </Modal>
    );
  }
  return null;
}

function Intro() {
  const s = store.state;
  const d = diff(s);
  return (
    <Modal wide>
      <div className="text-[11px] font-bold uppercase tracking-widest text-cyan">Mission briefing</div>
      <h2 className="title text-3xl leading-tight">Welcome, Commander 🌕</h2>
      <p className="mt-1 text-sm text-white/80">
        Your lander has touched down near the lunar south pole with 2 astronauts, 1 builder robot and a few supplies. Grow the outpost into a self-sustaining colony, and keep the crew alive.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[
          ['⚡', 'Power', 'Solar farms only work in daylight. Store energy in batteries for the long night.'],
          ['🫧', 'Life support', 'Ice → water → oxygen. Crew also need food from greenhouses.'],
          ['☢', 'Radiation', 'Solar flares strike without much warning. Pile regolith on habitats.'],
          ['🤖', 'Builders', 'Every job needs a free robot. Hire more with credits from missions.'],
        ].map(([i, t, d]) => (
          <div key={t} className="rounded-xl bg-black/30 p-3">
            <div className="title text-base">{i} {t}</div>
            <div className="text-xs text-white/70">{d}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-cyan/10 p-3 text-xs text-cyan">
        🖱 Drag to move the camera · Scroll or pinch to zoom · Tap a building for details · Press <b>Build</b> to construct.
        <br />⏱ Time is compressed: 1 real second = 1 colony hour. The first sunset comes in {fmtTime(hoursToSwitch(s))}, and on <b style={{ color: d.color }}>{d.name}</b> each night lasts {fmtTime(DAY_NIGHT.cycle * (1 - d.dayFraction))}.
      </div>
      <button className="btn btn-yellow mt-4 w-full text-lg" onClick={() => store.dismissScience()}>Start the mission 🚀</button>
    </Modal>
  );
}

/** Sunrise quiz from Mission Control: about a fact the player has already discovered. */
function QuizCard({ id }: { id: string }) {
  const q = QUIZ_BY_ID[id];
  const [pick, setPick] = useState<number | null>(null);
  if (!q) {
    store.dismissScience();
    return null;
  }
  return (
    <Modal>
      <div className="text-[11px] font-bold uppercase tracking-widest text-cyan">🧠 Sunrise quiz from Mission Control</div>
      <h2 className="title mb-2 text-xl leading-tight">{q.question}</h2>
      <div className="grid gap-1.5">
        {q.options.map((o, k) => (
          <button key={k} disabled={pick !== null}
            className={`rounded-lg border-2 p-2 text-left text-sm ${pick === null ? 'border-edge bg-panel-2 hover:border-accent' : k === q.answer ? 'border-good bg-good/15' : k === pick ? 'border-bad bg-bad/15' : 'border-white/10 opacity-60'}`}
            onClick={() => { setPick(k); store.answerQuiz(q.id, k); }}>{o}</button>
        ))}
      </div>
      {pick !== null ? (
        <>
          <p className="mt-2 rounded-xl bg-black/30 p-3 text-sm"><b className={pick === q.answer ? 'text-good' : 'text-warn'}>{pick === q.answer ? `Correct! +${QUIZ_REWARD} ₡. ` : 'Not quite. '}</b>{q.explain}</p>
          <button className="btn btn-blue mt-3 w-full" onClick={() => store.dismissScience()}>Continue</button>
        </>
      ) : (
        <button className="btn btn-gray mt-3 w-full text-sm" onClick={() => store.dismissScience()}>Skip question</button>
      )}
    </Modal>
  );
}
