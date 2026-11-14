import { useEffect, useState } from 'react';
import { announcePanelOpen } from '../game/bridge';
import { useGame } from '../game/store';
import { CHAPTERS } from '../game/config/chapters';
import { ACHIEVEMENTS } from '../game/config/achievements';
import { AchievementList } from './Achievements';
import { currentChapter } from '../game/systems/missions';
import { fmt } from '../utils/format';
import { Bar } from './ui';

type Tab = 'missions' | 'awards' | 'log';

export default function MissionsPanel() {
  const [open, setOpenRaw] = useState(() => typeof window === 'undefined' || window.innerWidth >= 900);
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== 'missions' && window.innerWidth < 900) setOpenRaw(false);
    };
    window.addEventListener('side-panel-open', onOther);
    return () => window.removeEventListener('side-panel-open', onOther);
  }, []);
  const setOpen = (v: boolean) => {
    setOpenRaw(v);
    if (v) announcePanelOpen('missions');
  };
  const [tab, setTab] = useState<Tab>('missions');
  const { s, ui, profile } = useGame();
  const ch = currentChapter(s);
  const doneInCh = ch ? ch.objectives.filter((o) => s.missionsDone.includes(o.id)).length : 0;
  if (ui.placing && window.innerWidth < 1280) return null;

  return (
    <div className="pointer-events-none absolute left-2 top-[124px] bottom-[96px] z-10 flex w-[min(300px,calc(100vw-16px))] flex-col items-start gap-2 sm:left-3 md:top-[84px]">
      <button className="btn btn-blue pointer-events-auto text-sm" onClick={() => setOpen(!open)}>
        {open ? '◂ Hide missions' : `📋 Chapter ${ch?.id ?? 5} · ${doneInCh}/${ch?.objectives.length ?? 0} ▸`}
      </button>
      {open && (
        <div className="panel pointer-events-auto slide-down flex max-h-full w-full flex-col overflow-hidden">
          <div className="flex gap-1 border-b-2 border-edge p-1.5">
            {(['missions', 'awards', 'log'] as Tab[]).map((t) => (
              <button key={t} className={`btn flex-1 px-1 py-1.5 text-xs ${tab === t ? 'btn-yellow' : 'btn-gray'}`} onClick={() => setTab(t)}>
                {t === 'missions' ? '📋 Missions' : t === 'awards' ? `🏅 ${Object.keys(profile.unlocked).length}/${ACHIEVEMENTS.length}` : '📜 Log'}
              </button>
            ))}
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
            {tab === 'missions' && (
              ch ? (
                <>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-cyan">Chapter {ch.id} of {CHAPTERS.length}</div>
                  <h3 className="title text-xl leading-tight">{ch.title}</h3>
                  <p className="mb-2 text-xs text-white/70">{ch.intro}</p>
                  <Bar value={doneInCh} max={ch.objectives.length} color="#ffc93c" className="mb-3" />
                  <ul className="grid gap-2">
                    {ch.objectives.map((o) => {
                      const done = s.missionsDone.includes(o.id);
                      const prog = o.progress?.(s);
                      const reward = [o.reward.credits && `${o.reward.credits} ₡`, o.reward.regolith && `${o.reward.regolith} 🪨`, o.reward.titanium && `${o.reward.titanium} 🔩`].filter(Boolean).join(' + ');
                      return (
                        <li key={o.id} className={`rounded-xl border-2 p-2 ${done ? 'border-good/50 bg-good/10' : 'border-edge bg-black/20'}`}>
                          <div className="flex items-start gap-2">
                            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-black ${done ? 'bg-good text-black' : 'bg-white/10'}`}>{done ? '✓' : ''}</span>
                            <div className="min-w-0 flex-1">
                              <div className={`text-sm font-semibold ${done ? 'text-white/60 line-through' : ''}`}>{o.text}</div>
                              {!done && <div className="text-[11px] text-white/60">💡 {o.hint}</div>}
                              {!done && prog && (
                                <div className="mt-1 flex items-center gap-2">
                                  <Bar value={prog[0]} max={prog[1]} color="#7fe3ff" />
                                  <span className="shrink-0 font-mono text-[10px]">{fmt(Math.min(prog[0], prog[1]))}/{fmt(prog[1])}</span>
                                </div>
                              )}
                              <div className="mt-1 text-[11px] font-semibold text-accent">🎁 {reward}</div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div className="text-center">
                  <div className="text-4xl">🏆</div>
                  <h3 className="title text-xl">All chapters complete!</h3>
                  <p className="text-sm text-white/70">Your colony is self-sustaining. Keep upgrading and chase every achievement.</p>
                </div>
              )
            )}
            {tab === 'awards' && <AchievementList profile={profile} compact />}
            {tab === 'log' && (
              <ul className="grid gap-1">
                {s.log.map((l) => (
                  <li key={l.id} className={`rounded-lg px-2 py-1 text-xs ${{ info: 'bg-black/20', good: 'bg-good/10 text-[#b8ffd0]', warn: 'bg-warn/10 text-[#ffd9a8]', bad: 'bg-bad/15 text-[#ffc2c2]' }[l.kind]}`}>
                    <span className="mr-1 font-mono text-[10px] text-white/40">h{Math.floor(l.t)}</span>
                    {l.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
