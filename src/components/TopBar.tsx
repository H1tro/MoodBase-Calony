import { useState } from 'react';
import { store, useGame } from '../game/store';
import { DAY_NIGHT } from '../game/config/balance';
import { dayLength, diff, hoursToSwitch, isDay } from '../game/systems/selectors';
import { fmt, fmtRate, fmtTime } from '../utils/format';
import { Bar, CloseButton, Modal, RES_META } from './ui';
import OptionsPanel from './OptionsPanel';
import CloudPanel from './CloudPanel';

function ResourcePill({ k }: { k: keyof typeof RES_META }) {
  const { s } = useGame();
  const meta = RES_META[k];
  const value = s.res[k];
  const cap = k === 'credits' ? null : s.flows.caps[k];
  const rate = k === 'credits' ? 0 : s.flows[k];
  const full = cap !== null && value >= cap - 0.5;
  return (
    <div className="panel flex min-w-0 items-center gap-1 px-1.5 py-1 sm:gap-2 sm:px-3 sm:py-1.5" title={`${meta.label}${cap ? ` — storage ${fmt(cap)} ${meta.unit}` : ''}${rate ? ` — ${fmtRate(rate)} ${meta.unit}/h` : ''}`}>
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-black/40 text-sm font-black sm:h-8 sm:w-8 sm:text-lg" style={{ background: meta.color + '33', color: meta.color }}>
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1">
          <span className="title text-sm leading-none sm:text-xl">{fmt(Math.floor(value))}</span>
          {full && <span className="chip hidden bg-warn/30 text-[10px] text-warn sm:inline">FULL</span>}
        </div>
        {cap !== null ? (
          <Bar value={value} max={cap} color={full ? '#ffa53c' : meta.color} className="mt-1 h-1.5" />
        ) : (
          <div className="mt-0.5 hidden text-[10px] font-semibold text-white/60 sm:block">earned {fmt(s.stats.creditsEarned)}</div>
        )}
      </div>
      {cap !== null && Math.abs(rate) > 0.01 && (
        <span className={`hidden text-xs font-bold lg:inline ${rate > 0 ? 'text-good' : 'text-bad'}`}>{fmtRate(rate)}/h</span>
      )}
    </div>
  );
}

function DayDial() {
  const { s } = useGame();
  const day = isDay(s);
  const pos = s.time % DAY_NIGHT.cycle;
  const frac = pos / DAY_NIGHT.cycle;
  const dayFrac = dayLength(s) / DAY_NIGHT.cycle;
  const d = diff(s);
  const r = 18;
  const C = 2 * Math.PI * r;
  return (
    <div className={`panel flex items-center gap-2 px-2 py-1.5 ${!day ? 'border-[#4a5bd6]' : ''}`} title="Lunar day–night cycle (compressed)">
      <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
        <circle cx="22" cy="22" r={r} fill="#0b1020" stroke="#2c3f70" strokeWidth="5" />
        <circle cx="22" cy="22" r={r} fill="none" stroke="#ffc93c" strokeWidth="5" strokeDasharray={`${C * dayFrac} ${C}`} transform="rotate(-90 22 22)" />
        <circle cx="22" cy="22" r={r} fill="none" stroke="#4a5bd6" strokeWidth="5" strokeDasharray={`${C * (1 - dayFrac)} ${C}`} strokeDashoffset={-C * dayFrac} transform="rotate(-90 22 22)" />
        <line x1="22" y1="22" x2={22 + 15 * Math.sin(frac * 2 * Math.PI)} y2={22 - 15 * Math.cos(frac * 2 * Math.PI)} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <text x="22" y="27" textAnchor="middle" fontSize="13">{day ? '☀️' : '🌙'}</text>
      </svg>
      <div className="leading-tight">
        <div className="title text-sm">{day ? 'Lunar day' : 'Lunar night'}</div>
        <div className={`text-xs font-semibold ${!day || hoursToSwitch(s) < 40 ? 'text-warn' : 'text-white/70'}`}>
          {day ? 'Sunset' : 'Sunrise'} in {fmtTime(hoursToSwitch(s) / store.timeScale)}
        </div>
        <div className="text-[10px] text-white/50">{store.speed === 0 ? <span className="font-bold text-bad">⏸ PAUSED</span> : <>Cycle {s.cycle.index + 1} · <span style={{ color: d.color }}>{d.name}</span></>}</div>
      </div>
    </div>
  );
}

export const SHORTCUTS: [string, string][] = [
  ['WASD / Arrows', 'Move the camera (or drag with the mouse)'],
  ['Wheel / Q E', 'Zoom out / in'],
  ['B', 'Build menu'],
  ['U', 'Upgrade the selected building'],
  ['G', 'Move the selected building'],
  ['R', 'Research'],
  ['T', 'Spaceport (trade)'],
  ['M', 'Mission Control'],
  ['L', 'Lunar Library & glossary'],
  ['Space', 'Pause / resume'],
  ['1 2 3', 'Speed 1× / 2× / 4×'],
  ['Enter', 'Confirm placement or move'],
  ['Esc / Right-click', 'Cancel placement, close panel, deselect'],
];

function GameMenu() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [options, setOptions] = useState(false);
  const [cloud, setCloud] = useState(false);
  const { speed } = useGame();
  return (
    <>
      <div className="panel flex items-center gap-1 p-1.5">
        <button className={`btn h-9 w-9 p-0 text-sm ${speed === 0 ? 'btn-red pulse-red' : 'btn-gray'}`} onClick={() => store.togglePause()} aria-label={speed === 0 ? 'Resume' : 'Pause'} title="Pause / resume (Space)">
          {speed === 0 ? '▶' : '⏸'}
        </button>
        {[1, 2, 4].map((v) => (
          <button key={v} className={`btn h-9 px-2 text-sm ${speed === v ? 'btn-yellow' : 'btn-gray'}`} onClick={() => store.setSpeed(v)} aria-label={`Speed ${v}x`}>
            {v}×
          </button>
        ))}
        <button className="btn btn-gray h-9 w-9 p-0 text-lg" onClick={() => setOpen(true)} aria-label="Menu">
          ☰
        </button>
      </div>
      {open && (
        <Modal onClose={() => { setOpen(false); setConfirm(false); }}>
          <h2 className="title mb-3 text-2xl">Colony menu</h2>
          <div className="grid gap-2">
            <button className="btn btn-green" onClick={() => { store.persist(); store.flash('Progress saved', 'ok'); setOpen(false); }}>💾 Save now</button>
            <p className="text-sm text-white/60">Progress also saves automatically every 10 seconds and after every action.</p>
            {!confirm ? (
              <button className="btn btn-red" onClick={() => setConfirm(true)}>🔄 Start a new colony</button>
            ) : (
              <div className="rounded-xl border-2 border-bad/60 bg-bad/10 p-3">
                <p className="mb-2 text-sm">You'll choose a difficulty next. Your current colony is replaced when the new mission launches.</p>
                <div className="flex gap-2">
                  <button className="btn btn-red flex-1" onClick={() => { store.openNewGame(); setOpen(false); setConfirm(false); }}>Choose difficulty</button>
                  <button className="btn btn-gray flex-1" onClick={() => setConfirm(false)}>Cancel</button>
                </div>
              </div>
            )}
            <button className="btn btn-gray" onClick={() => { setOpen(false); setCloud(true); }}>☁️ Cloud save</button>
            <button className="btn btn-gray" onClick={() => { setOpen(false); setOptions(true); }}>⚙️ Options</button>
            <button className="btn btn-gray" onClick={() => { setOpen(false); store.goToTitle(); }}>🏠 Main menu (saves first)</button>
            <button className="btn btn-blue" onClick={() => setOpen(false)}>Back to the colony</button>
          </div>
          <div className="mt-4 rounded-xl bg-black/30 p-3 text-xs">
            <div className="title mb-1 text-sm">⌨️ Keyboard & mouse</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-white/80">
              {SHORTCUTS.map(([k, d]) => (
                <div key={k} className="contents">
                  <kbd className="rounded bg-white/10 px-1.5 font-mono">{k}</kbd>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-white/50">
            Time scale: 1 real second = 1 colony hour. A full lunar day–night cycle takes 6 minutes at 1× speed (on the real Moon it lasts about 29.5 Earth days).
          </p>
        </Modal>
      )}
      {cloud && (
        <Modal onClose={() => setCloud(false)}>
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="title text-2xl">☁️ Cloud save</h2><CloseButton onClick={() => setCloud(false)} /></div>
          <CloudPanel />
        </Modal>
      )}
      {options && (
        <Modal onClose={() => setOptions(false)}>
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="title text-2xl">⚙️ Options</h2><CloseButton onClick={() => setOptions(false)} /></div>
          <OptionsPanel />
        </Modal>
      )}
    </>
  );
}

export default function TopBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start gap-1.5 p-2 sm:gap-2 sm:p-3">
      <div className="pointer-events-auto grid w-full min-w-0 grid-cols-4 gap-1.5 sm:gap-2 md:w-auto md:flex-1 lg:max-w-[760px]">
        <ResourcePill k="regolith" />
        <ResourcePill k="titanium" />
        <ResourcePill k="ice" />
        <ResourcePill k="credits" />
      </div>
      <div className="pointer-events-auto ml-auto flex items-start gap-1.5 sm:gap-2">
        <DayDial />
        <GameMenu />
      </div>
    </div>
  );
}
