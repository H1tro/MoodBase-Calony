import { useState, type ReactNode } from 'react';
import { store, useGame } from '../game/store';
import type { Settings } from '../game/systems/profile';

function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/10 py-2.5">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[11px] text-white/55">{hint}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ k }: { k: 'cinematic' | 'briefing' | 'reduceMotion' | 'keyHints' }) {
  const { profile } = useGame();
  const on = profile.settings[k];
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => store.setSetting(k, !on)}
      className={`relative h-7 w-12 rounded-full border-2 border-black/40 transition ${on ? 'bg-good' : 'bg-white/15'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-0.5'}`} />
    </button>
  );
}

function Choice<K extends 'defaultSpeed' | 'graphics'>({ k, options }: { k: K; options: [Settings[K], string][] }) {
  const { profile } = useGame();
  return (
    <div className="flex gap-1">
      {options.map(([v, label]) => (
        <button key={String(v)} className={`btn px-2.5 py-1.5 text-xs ${profile.settings[k] === v ? 'btn-yellow' : 'btn-gray'}`} onClick={() => store.setSetting(k, v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Game options. Saved in the career profile, so they apply to every colony. */
export default function OptionsPanel() {
  const [confirm, setConfirm] = useState<null | 'colony' | 'achievements'>(null);
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-cyan">Gameplay</div>
      <Row label="Starting game speed" hint="Speed when a colony starts or is resumed.">
        <Choice k="defaultSpeed" options={[[1, '1×'], [2, '2×'], [4, '4×']]} />
      </Row>
      <Row label="Launch cinematic" hint="Play the robot launch sequence when a new colony starts.">
        <Toggle k="cinematic" />
      </Row>
      <Row label="Mission briefing" hint="Show the welcome briefing at the start of each colony.">
        <Toggle k="briefing" />
      </Row>

      <div className="mt-3 text-[11px] font-bold uppercase tracking-widest text-cyan">Display</div>
      <Row label="Graphics quality" hint="Low turns off regolith grain, ice glints, long shadows and footprints for slower computers.">
        <Choice k="graphics" options={[['high', 'High'], ['low', 'Low']]} />
      </Row>
      <Row label="Reduce motion" hint="No camera shake or zoom in the cinematic, and no red flash during solar storms.">
        <Toggle k="reduceMotion" />
      </Row>
      <Row label="Keyboard hints" hint="Show the shortcut line at the bottom of wide screens.">
        <Toggle k="keyHints" />
      </Row>

      <div className="mt-3 text-[11px] font-bold uppercase tracking-widest text-bad">Danger zone</div>
      {confirm ? (
        <div className="mt-2 rounded-xl border-2 border-bad/60 bg-bad/10 p-3 text-sm">
          {confirm === 'colony' ? 'Delete your saved colony? Achievements are kept.' : 'Reset all achievements and career stats? Your colony and settings are kept.'} This cannot be undone.
          <div className="mt-2 flex gap-2">
            <button className="btn btn-red flex-1" onClick={() => { if (confirm === 'colony') store.deleteColony(); else store.resetAchievements(); setConfirm(null); }}>Yes, delete</button>
            <button className="btn btn-gray flex-1" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn btn-gray text-sm" disabled={!store.hasColony} onClick={() => setConfirm('colony')}>🗑 Delete saved colony</button>
          <button className="btn btn-gray text-sm" onClick={() => setConfirm('achievements')}>↺ Reset achievements</button>
        </div>
      )}
      <p className="mt-3 text-[11px] text-white/45">There is no sound yet, so there are no audio settings.</p>
    </div>
  );
}
