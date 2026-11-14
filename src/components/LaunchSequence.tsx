import { useEffect, useRef, useState } from 'react';
import { store, useGame } from '../game/store';
import { DIFFICULTIES } from '../game/config/difficulty';

// Phase start times in ms. The final phases wait for real initialisation.
const T = { robot: 1800, launch: 4400, landing: 6900, landed: 9700 };
const READY_HOLD = 1200;
const FADE = 700;

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeIn = (p: number) => p * p * p;
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

const STARS = Array.from({ length: 140 }, (_, i) => ({ x: (i * 97.13) % 800, y: (i * 53.71) % 300, r: 0.4 + ((i * 7) % 10) / 9, d: (i % 7) / 7 }));

/** The exploration robot (2D, in the game's palette). `lights` 0..3 = systems online. */
function Robot({ lights, arm, eye }: { lights: number; arm: number; eye: number }) {
  return (
    <g>
      <ellipse cx="0" cy="62" rx="58" ry="10" fill="#000" opacity="0.35" />
      {/* Treads */}
      <rect x="-52" y="36" width="104" height="24" rx="12" fill="#2b2f3a" stroke="#141826" strokeWidth="2" />
      {[-36, -12, 12, 36].map((x) => <circle key={x} cx={x} cy="48" r="7" fill="#4a5366" stroke="#141826" strokeWidth="1.5" />)}
      {/* Arms */}
      <g transform={`rotate(${-arm * 70} -44 -6)`}>
        <rect x="-62" y="-10" width="18" height="44" rx="6" fill="#d9dee6" stroke="#141826" strokeWidth="2" />
        <rect x="-64" y="30" width="22" height="8" rx="3" fill="#8c95a6" />
      </g>
      <g transform={`rotate(${arm * 70} 44 -6)`}>
        <rect x="44" y="-10" width="18" height="44" rx="6" fill="#d9dee6" stroke="#141826" strokeWidth="2" />
        <rect x="42" y="30" width="22" height="8" rx="3" fill="#8c95a6" />
      </g>
      {/* Body */}
      <rect x="-44" y="-20" width="88" height="60" rx="10" fill="#f2b705" stroke="#141826" strokeWidth="2.5" />
      <rect x="-44" y="-20" width="88" height="12" rx="6" fill="#ffd23f" opacity="0.6" />
      <rect x="-30" y="-2" width="60" height="30" rx="5" fill="#141826" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={-16 + i * 16} cy="13" r="5" fill={i < lights ? (i === 2 ? '#3fdc7c' : '#7fe3ff') : '#2b3346'}
          style={{ filter: i < lights ? 'drop-shadow(0 0 6px #7fe3ff)' : 'none', transition: 'fill .3s' }} />
      ))}
      {/* Neck + head */}
      <rect x="-6" y="-36" width="12" height="18" fill="#8c95a6" />
      <rect x="-34" y="-74" width="68" height="40" rx="12" fill="#eef2f7" stroke="#141826" strokeWidth="2.5" />
      <rect x="-24" y="-64" width="48" height="18" rx="9" fill="#0b1020" />
      <rect x={-18 + eye * 20} y="-60" width="16" height="10" rx="5" fill="#7fe3ff" style={{ filter: 'drop-shadow(0 0 8px #7fe3ff)' }} opacity={0.3 + 0.7 * clamp(lights / 3)} />
      {/* Antenna */}
      <line x1="22" y1="-74" x2="30" y2="-100" stroke="#9aa5b8" strokeWidth="3" />
      <circle cx="30" cy="-102" r="4" fill={lights > 0 ? '#ff4d4d' : '#552222'} />
    </g>
  );
}

/** Landing capsule shell; `legs` 0..1 deploys the landing legs, `open` 0..1 opens it. */
function Capsule({ legs, flame, retro }: { legs: number; flame: number; retro?: boolean }) {
  const f = flame * (0.85 + Math.random() * 0.3);
  return (
    <g>
      {flame > 0.02 && (
        <g opacity={clamp(flame * 1.5)}>
          <path d={`M-26 70 Q0 ${70 + 150 * f} 26 70 Z`} fill="#ff8a3d" opacity="0.8" />
          <path d={`M-14 70 Q0 ${70 + 95 * f} 14 70 Z`} fill="#ffd23f" />
          <path d={`M-6 70 Q0 ${70 + 50 * f} 6 70 Z`} fill="#fff" />
          {retro && <ellipse cx="0" cy={70 + 140 * f} rx={60 * f} ry={10 * f} fill="#ffd23f" opacity="0.25" />}
        </g>
      )}
      {/* Legs */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <line x1={s * 40} y1="40" x2={s * (48 + 30 * legs)} y2={60 + 22 * legs} stroke="#9aa5b8" strokeWidth="4" />
          <ellipse cx={s * (48 + 30 * legs)} cy={62 + 22 * legs} rx="10" ry="3" fill="#6b7487" />
        </g>
      ))}
      <path d="M-56 70 L-46 -40 Q0 -110 46 -40 L56 70 Z" fill="#e8edf3" stroke="#141826" strokeWidth="3" />
      <path d="M-56 70 L-46 -40 Q-30 -66 -10 -78 L-24 70 Z" fill="#fff" opacity="0.5" />
      <rect x="-56" y="40" width="112" height="16" fill="#e63946" />
      <rect x="-60" y="62" width="120" height="12" rx="4" fill="#d4a017" stroke="#141826" strokeWidth="2" />
      <circle cx="0" cy="-12" r="16" fill="#0b1020" stroke="#9aa5b8" strokeWidth="4" />
      <circle cx="-4" cy="-16" r="5" fill="#7fe3ff" opacity="0.8" />
    </g>
  );
}

function Typed({ text, t }: { text: string; t: number }) {
  const n = Math.floor(t / 35);
  return (
    <span>
      {text.slice(0, n)}
      <span className="animate-pulse">{n < text.length || Math.floor(t / 400) % 2 ? '▌' : ' '}</span>
    </span>
  );
}

export default function LaunchSequence() {
  const { screen } = useGame();
  const [t, setT] = useState(0);
  const start = useRef(0);
  const readyAt = useRef<number | null>(null);
  const skipped = useRef(false);
  const run = store.mission?.run;

  // Frame clock, restarted for every launch attempt.
  useEffect(() => {
    if (screen !== 'launch') return;
    // With the cinematic turned off in Options, jump straight to touchdown (it still waits for real setup).
    const off = !store.profile.settings.cinematic;
    start.current = performance.now() - (off ? T.landed : 0);
    readyAt.current = null;
    skipped.current = off;
    setT(start.current ? performance.now() - start.current : 0);
    let raf = 0;
    const loop = () => {
      setT(performance.now() - start.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen, run]);

  const L = store.mission;
  const ready = store.launchReady;
  const cinemaDone = t >= T.landed;
  if (ready && cinemaDone && readyAt.current === null) readyAt.current = t;
  const hold = skipped.current ? 350 : READY_HOLD;
  const fadeP = readyAt.current !== null ? seg(t, readyAt.current + hold, readyAt.current + hold + FADE) : 0;

  useEffect(() => {
    if (fadeP >= 1 && screen === 'launch') store.finishLaunch();
  }, [fadeP, screen]);

  if (screen !== 'launch' || !L) return null;
  const d = DIFFICULTIES[L.difficulty];
  const doneCount = L.tasks.filter((x) => x.done).length;
  const progress = doneCount / L.tasks.length;

  const skip = () => {
    if (start.current && t < T.landed) {
      start.current = performance.now() - T.landed;
      skipped.current = true;
    }
  };

  // ---- Choreography ----
  const phase = readyAt.current !== null ? 'ready' : t < T.robot ? 'init' : t < T.launch ? 'robot' : t < T.landing ? 'launch' : 'landing';
  const pR = seg(t, T.robot, T.launch);
  const pL = seg(t, T.launch, T.landing);
  const pD = seg(t, T.landing, T.landed);

  const robotRise = easeOut(seg(pR, 0, 0.35));
  const lights = pR > 0.75 ? 3 : pR > 0.55 ? 2 : pR > 0.4 ? 1 : 0;
  const arm = phase === 'robot' ? Math.sin(seg(pR, 0.45, 0.95) * Math.PI) * 0.8 : 0;
  const eye = phase === 'robot' ? Math.sin(t / 300) : 0;
  const scanY = -110 + ((t / 8) % 190);

  // Launch: shell closes, engines light, the capsule climbs while the camera pulls back and shakes.
  const shell = easeInOut(seg(pL, 0, 0.3));
  const ignite = seg(pL, 0.3, 0.45);
  const climb = easeIn(seg(pL, 0.45, 1));
  const calm = store.profile.settings.reduceMotion;
  const shake = calm ? 0 : phase === 'launch' ? (ignite > 0 ? (1 - climb) * 3 + 1 : 0) : 0;
  const camScale = calm ? 1 : phase === 'launch' ? 1 + 0.12 * ignite - 0.2 * climb : phase === 'landing' ? 1.08 - 0.08 * pD : 1;
  const sx = shake ? (Math.random() - 0.5) * shake * 2 : 0;
  const sy = shake ? (Math.random() - 0.5) * shake * 2 : 0;

  // Landing: the scene switches to the lunar surface; the capsule descends on retro-rockets.
  const bay = phase === 'landing' || phase === 'ready' ? 1 - seg(pD, 0, 0.18) : 1;
  const desc = easeOut(seg(pD, 0.08, 0.82));
  const capY = -260 + 560 * desc;
  const touchdown = pD >= 0.82;
  const retro = touchdown ? 0 : 0.4 + 0.6 * (1 - desc);
  const legsOut = seg(pD, 0.45, 0.7);
  const dust = seg(pD, 0.8, 1);
  const rollOut = easeOut(seg(pD, 0.86, 1));

  const titles: Record<string, string> = {
    init: 'INITIALIZING MISSION...',
    robot: 'ROBOT SYSTEMS ONLINE',
    launch: 'DEPLOYMENT INITIATED',
    landing: touchdown ? (ready ? 'TOUCHDOWN CONFIRMED' : 'TOUCHDOWN · AWAITING SYSTEMS...') : 'POWERED DESCENT · NO ATMOSPHERE',
    ready: 'MISSION READY',
  };
  const phaseStart = { init: 0, robot: T.robot, launch: T.launch, landing: T.landing, ready: readyAt.current ?? 0 }[phase];
  const clock = (t / 1000).toFixed(1).padStart(5, '0');

  return (
    <div className="pointer-events-auto fixed inset-0 z-[70] select-none overflow-hidden bg-[#02040a] font-mono text-cyan" style={{ opacity: 1 - fadeP, animation: 'fade-in .5s ease-out' }}>
      <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="bayBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#030712" /><stop offset="1" stopColor="#0b1a33" />
          </linearGradient>
          <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7fe3ff" stopOpacity="0" /><stop offset="0.5" stopColor="#7fe3ff" stopOpacity="0.55" /><stop offset="1" stopColor="#7fe3ff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="earthGlow"><stop offset="0.7" stopColor="#4aa3ff" stopOpacity="0.35" /><stop offset="1" stopColor="#4aa3ff" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="800" height="450" fill="#010208" />
        {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={0.35 + 0.5 * Math.abs(Math.sin(t / 900 + s.d * 6))} />)}

        <g transform={`translate(${400 + sx} ${225 + sy}) scale(${camScale}) translate(-400 -225)`}>
          {/* ---------- Lunar surface (landing) ---------- */}
          <g opacity={1 - bay}>
            <circle cx="660" cy="80" r="60" fill="url(#earthGlow)" />
            <circle cx="660" cy="80" r="36" fill="#1f6fd1" />
            <ellipse cx="648" cy="72" rx="13" ry="9" fill="#3fbf6b" />
            <ellipse cx="672" cy="92" rx="9" ry="10" fill="#3fbf6b" />
            <path d="M660 44 A36 36 0 0 1 660 116 A20 36 0 0 0 660 44" fill="#02040a" opacity="0.55" />
            <path d="M0 300 L60 250 L110 280 L180 220 L250 270 L320 235 L390 275 L470 215 L540 262 L610 230 L690 270 L760 240 L800 260 L800 450 L0 450 Z" fill="#3f434d" />
            <path d="M180 220 L250 270 L210 300 Z M470 215 L540 262 L500 300 Z" fill="#6a6e79" />
            <path d="M0 330 Q400 300 800 330 L800 450 L0 450 Z" fill="#8e919b" />
            <ellipse cx="170" cy="380" rx="70" ry="16" fill="#6c707b" /><ellipse cx="170" cy="377" rx="58" ry="11" fill="#5f636e" />
            <ellipse cx="640" cy="400" rx="90" ry="20" fill="#6c707b" /><ellipse cx="640" cy="396" rx="74" ry="14" fill="#5f636e" />
            <ellipse cx="420" cy="372" rx="26" ry="6" fill="#6c707b" />
          </g>

          {/* ---------- Launch bay ---------- */}
          <g opacity={bay}>
            <rect width="800" height="450" fill="url(#bayBg)" opacity="0.9" />
            {Array.from({ length: 13 }, (_, i) => <line key={i} x1={400 + (i - 6) * 30} y1="330" x2={400 + (i - 6) * 140} y2="450" stroke="#1f3a66" strokeWidth="1" />)}
            {[340, 360, 390, 430].map((y) => <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="#1f3a66" strokeWidth="1" />)}
            <rect x="0" y="328" width="800" height="3" fill="#7fe3ff" opacity="0.25" />
            {/* Gantry towers and arms */}
            {[-1, 1].map((s) => (
              <g key={s}>
                <rect x={400 + s * 170 - 14} y="90" width="28" height="240" fill="#16233f" stroke="#2c3f70" strokeWidth="2" />
                {[110, 150, 190, 230, 270].map((y) => <line key={y} x1={400 + s * 170 - 14} y1={y} x2={400 + s * 170 + 14} y2={y + 30} stroke="#2c3f70" strokeWidth="2" />)}
                <rect x={s < 0 ? 400 - 156 : 400 + 156 - (90 - 70 * climb - 40 * ignite)} y="200" width={Math.max(0, 90 - 70 * climb - 40 * ignite)} height="8" fill="#2c3f70" />
                <circle cx={400 + s * 170} cy="96" r="4" fill="#ffa53c" opacity={0.4 + 0.6 * Math.abs(Math.sin(t / 250))} />
              </g>
            ))}
            {/* Launch pad */}
            <rect x="300" y="326" width="200" height="10" rx="3" fill="#2b3346" />
            <rect x="300" y="326" width="200" height="3" fill="#ffc93c" opacity="0.7" />
          </g>

          {/* ---------- Robot (prep) ---------- */}
          {(phase === 'robot' || (phase === 'launch' && shell < 1)) && (
            <g transform={`translate(400 ${270 + (1 - robotRise) * 200})`} opacity={robotRise}>
              <Robot lights={lights} arm={arm} eye={eye} />
              {phase === 'robot' && (
                <rect x="-80" y={scanY} width="160" height="16" fill="url(#scan)" />
              )}
            </g>
          )}
          {/* Diagnostic callouts */}
          {phase === 'robot' && [['MOBILITY', -120, 40, 0.4], ['POWER CORE', 120, 10, 0.55], ['OPTICS / SCAN', 120, -60, 0.75]].map(([label, x, y, at]) => (
            pR > (at as number) && (
              <g key={label as string} transform={`translate(${400 + (x as number)} ${270 + (y as number)})`} opacity={seg(pR, at as number, (at as number) + 0.1)}>
                <line x1={(x as number) < 0 ? 40 : -40} y1="0" x2="0" y2="0" stroke="#7fe3ff" strokeWidth="1" />
                <text x={(x as number) < 0 ? -4 : 4} y="4" fontSize="11" fill="#7fe3ff" textAnchor={(x as number) < 0 ? 'end' : 'start'}>{label as string} ✓</text>
              </g>
            )
          ))}

          {/* ---------- Capsule (launch + landing) ---------- */}
          {phase === 'launch' && (
            <g transform={`translate(400 ${262 - climb * 520})`}>
              {/* Shell halves slide in around the robot */}
              <g opacity={shell} transform={`scale(${0.6 + 0.4 * shell})`}>
                <Capsule legs={0} flame={ignite * (1 + climb)} />
              </g>
              {ignite > 0 && climb < 0.6 && [0, 1, 2, 3, 4, 5].map((i) => {
                const a = ((t / 600 + i / 6) % 1);
                return <circle key={i} cx={(i % 2 ? 1 : -1) * (30 + a * 120)} cy={70 + climb * 520 - a * 10} r={10 + a * 30} fill="#8e919b" opacity={(1 - a) * 0.35 * ignite} />;
              })}
            </g>
          )}
          {(phase === 'landing' || phase === 'ready') && (
            <g>
              <g transform={`translate(400 ${capY})`}>
                <Capsule legs={legsOut} flame={retro} retro />
              </g>
              {/* Ballistic dust: no air, so it flies in clean arcs and falls straight back */}
              {dust > 0 && dust < 1 && Array.from({ length: 16 }, (_, i) => {
                const dir = i % 2 ? 1 : -1;
                const v = 40 + (i * 13) % 70;
                const tt = dust * 1.2;
                const x = 400 + dir * v * tt * 2.2;
                const y = capY + 80 - (v * 0.9 * tt - 60 * tt * tt);
                return <circle key={i} cx={x} cy={y} r={2.2} fill="#b4b6bd" opacity={1 - dust} />;
              })}
              {rollOut > 0 && (
                <g transform={`translate(${400 + 120 * rollOut} ${capY + 60}) scale(0.45)`}>
                  <Robot lights={3} arm={0} eye={0.5} />
                </g>
              )}
            </g>
          )}
        </g>
      </svg>

      {/* ---------- HUD ---------- */}
      <div className="pointer-events-none absolute inset-3 sm:inset-6">
        {(['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'left-0 bottom-0 border-l-2 border-b-2', 'right-0 bottom-0 border-r-2 border-b-2'] as const).map((c) => (
          <span key={c} className={`absolute h-6 w-6 border-cyan/70 ${c}`} />
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4 text-[11px] sm:p-8 sm:text-xs">
        <div>
          <div className="tracking-[0.25em] text-cyan/80">MOONBASE COLONY // MISSION CONTROL</div>
          <div className="mt-1 text-white/50">AUTONOMOUS EXPLORATION ROBOT · UNIT MB-01</div>
        </div>
        <div className="text-right">
          <div className="text-white/70">T+ {clock}s</div>
          <div className="mt-1 inline-block rounded border px-2 py-0.5 font-bold" style={{ borderColor: d.color, color: d.color }}>
            DIFFICULTY: {d.name.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 top-[22%] text-center sm:top-[18%]">
        <div className={`text-lg font-bold tracking-[0.2em] sm:text-2xl ${phase === 'launch' ? 'text-warn' : phase === 'ready' ? 'text-good' : 'text-cyan'}`}>
          <Typed key={phase + (touchdown ? 't' : '')} text={titles[phase]} t={t - phaseStart} />
        </div>
        {phase === 'init' && (
          <div className="mx-auto mt-4 h-12 w-12 animate-spin rounded-full border-4 border-cyan/20 border-t-cyan" />
        )}
        {phase === 'landing' && !touchdown && <div className="mt-2 text-[11px] text-white/50">The Moon has no air: no parachutes, retro-rockets only</div>}
        {phase === 'ready' && <div className="mt-2 text-xs text-white/70">Landing zone secured · handing control to the commander</div>}
      </div>

      {/* Real initialisation status */}
      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4 sm:p-8">
        <div className="w-full max-w-sm rounded-lg border border-cyan/30 bg-[#030712]/80 p-3 text-[11px]">
          <div className="mb-1 flex justify-between text-white/60">
            <span>SYSTEMS CHECK</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="mb-2 h-1.5 overflow-hidden rounded bg-white/10">
            <div className="h-full bg-cyan transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
          </div>
          {L.tasks.map((task) => (
            <div key={task.id} className={task.done ? 'text-good' : 'text-white/50'}>
              {task.done ? '■' : <span className="animate-pulse">□</span>} {task.label}
            </div>
          ))}
        </div>
        {!L.error && fadeP === 0 && (
          <button className="btn btn-gray text-sm" onClick={skip} disabled={cinemaDone}>
            {cinemaDone && !ready ? 'Finishing setup…' : 'Skip ▸▸'}
          </button>
        )}
      </div>

      {L.error && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-4">
          <div className="panel max-w-md border-bad p-5 font-sans text-white">
            <div className="font-mono text-xs tracking-widest text-bad">LAUNCH ABORTED</div>
            <p className="mt-2 text-sm">{L.error}</p>
            <div className="mt-4 flex gap-2">
              <button className="btn btn-green flex-1" onClick={() => store.startLaunch()}>↺ Retry launch</button>
              <button className="btn btn-gray flex-1" onClick={() => store.abortLaunch()}>Back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
