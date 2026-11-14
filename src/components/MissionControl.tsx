import { useEffect, useState, type ReactNode } from 'react';
import { store, useGame } from '../game/store';
import { BUILDINGS, powerDraw } from '../game/config/buildings';
import { LIFE, ENVIRONMENT } from '../game/config/station';
import { MONITORING, STATION_COLORS } from '../game/config/monitoring';
import { EVENTS } from '../game/config/events';
import { networkStatus, opsCenter, capacity, networkPower } from '../game/systems/monitoring';
import { cabinVolume, scrubCapacity, wasteCap } from '../game/systems/lifeSupport';
import { emergencyOff, powerPriority, solarFarmEfficiency } from '../game/systems/power';
import { hoursLeft, powerForecast } from '../game/systems/report';
import { getSpaceWeather, strongestFlare, type SpaceWeather } from '../game/systems/spaceWeather';
import { dayLength, cyclePos, isDay } from '../game/systems/selectors';
import { DAY_NIGHT } from '../game/config/balance';
import { CREW } from "../game/config/balance";
import type { GameState } from '../game/systems/state';
import { DONKI_URL, NTRS, NTRS_URL, SNAPSHOT_DATE, TREK_URL, loadSpaceWeather, trekTile } from '../game/nasa';
import { fmt, fmtRate, fmtTime } from '../utils/format';
import { Bar, CloseButton } from './ui';
import { Dot, LineChart, Section, Sparkline, okSamples, samplesOf, stat, warnings, type Metric } from './MonitoringPanel';

type Dept = 'env' | 'life' | 'power' | 'ops';
type EnvDept = 'temp' | 'rad' | 'sun' | 'surface';

export const openLibrary = () => window.dispatchEvent(new Event('open-library'));
export const openReport = () => window.dispatchEvent(new Event('open-report'));

function Card({ title, children, tone }: { title: ReactNode; children: ReactNode; tone?: 'bad' | 'warn' }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === 'bad' ? 'border-bad/60 bg-bad/10' : tone === 'warn' ? 'border-warn/50 bg-warn/5' : 'border-white/10 bg-black/25'}`}>
      <div className="mb-1 text-sm font-bold">{title}</div>
      {children}
    </div>
  );
}

/** Collapsible "why it matters" science note. */
export function Why({ children }: { children: ReactNode }) {
  return (
    <details className="mt-1.5 text-[11px] text-white/70">
      <summary className="cursor-pointer select-none text-cyan">ⓘ Why it matters</summary>
      <div className="mt-1 leading-snug">{children}</div>
    </details>
  );
}

function Kv({ k, v, tone }: { k: string; v: ReactNode; tone?: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-white/60">{k}</span>
      <span className={`font-mono font-semibold ${tone ?? ''}`}>{v}</span>
    </div>
  );
}

/** Badge that says exactly where a dataset comes from. */
export function SourceBadge({ w }: { w: SpaceWeather }) {
  const label = { live: 'LIVE NASA DATA', cached: 'NASA DATA (cached)', snapshot: 'NASA DATA (bundled snapshot)', simulated: 'SIMULATED (offline)' }[w.source];
  const tone = w.source === 'simulated' ? 'border-warn text-warn' : 'border-good text-good';
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${tone}`}>
      {label}{w.updated ? ` · ${w.updated.slice(0, 16).replace('T', ' ')} UTC` : ''}
    </span>
  );
}

const fmtH = (h: number) => (isFinite(h) ? fmtTime(h / store.timeScale) : '∞');

// ======================================================================
// Environmental Monitoring — four departments, each with four levels
// ======================================================================
const ENV_INFO: Record<EnvDept, { title: string; icon: string; metric?: Metric; science: string; ntrs: string }> = {
  temp: {
    title: 'Surface Temperature', icon: '🌡', metric: 'temp', ntrs: 'temperature',
    science: 'With no air to hold or spread heat, the surface swings from about +120 °C in sunlight to below −170 °C at night. Electronics, batteries and seals have limited working ranges, so real landers carry heaters and insulation, and the cold night raises energy demand.',
  },
  rad: {
    title: 'Radiation Monitoring', icon: '☢', metric: 'rad', ntrs: 'radiation',
    science: 'Galactic cosmic rays give a steady background (about 57 µSv/h measured by Chang’e-4). Solar particle events add short, intense spikes. Shielding with mass such as regolith or water, plus warnings from space-weather monitoring, keeps doses below career limits.',
  },
  sun: {
    title: 'Solar Activity & Illumination', icon: '☀', metric: 'sun', ntrs: 'power',
    science: 'Sunlight on the airless Moon delivers about 1361 W/m², but the Sun crosses the sky only once per ~29.5-day lunar day. Solar flares are graded by X-ray class (C, M, X); strong ones can be followed by particle storms. Knowing when the Sun sets and how active it is lets operators plan energy and safety.',
  },
  surface: {
    title: 'Surface Environment', icon: '🌫', metric: 'dust', ntrs: 'dust',
    science: 'Charged, abrasive dust settles on equipment and blocks sunlight on panels; rocket plumes throw more of it around. Micrometeoroids hit unprotected surfaces at many km/s. Both slowly degrade equipment, so regular cleaning and maintenance matter on the Moon.',
  },
};

function NtrsReading({ topic }: { topic: string }) {
  const list = NTRS[topic]?.results ?? [];
  return (
    <div className="mt-2 rounded-lg bg-black/25 p-2 text-[11px]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
        <span className="font-bold">📄 Real NASA technical reports</span>
        <span className="font-mono text-[10px] text-white/50">NASA NTRS · snapshot {SNAPSHOT_DATE.slice(0, 10)}</span>
      </div>
      {list.length ? (
        <ul className="grid gap-0.5">
          {list.slice(0, 3).map((r) => (
            <li key={r.id}>
              <a className="text-cyan underline decoration-dotted hover:text-white" href={r.url} target="_blank" rel="noreferrer">{r.title}</a>
              <span className="text-white/45"> · {r.type}{r.date ? ` · ${r.date.slice(0, 4)}` : ''}</span>
            </li>
          ))}
        </ul>
      ) : (
        <a className="text-cyan underline" href={NTRS_URL} target="_blank" rel="noreferrer">Search the NASA Technical Reports Server</a>
      )}
    </div>
  );
}

function RealFlares() {
  const [w, setW] = useState<SpaceWeather>(getSpaceWeather());
  const [busy, setBusy] = useState(false);
  const strongest = strongestFlare(w);
  return (
    <div className="mt-2 rounded-lg bg-black/25 p-2 text-[11px]">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-bold">🌞 Real solar flares (NASA DONKI)</span>
        <SourceBadge w={w} />
        <button className="btn btn-gray ml-auto px-2 py-0.5 text-[10px]" disabled={busy} onClick={async () => { setBusy(true); setW(await loadSpaceWeather(true)); setBusy(false); }}>
          {busy ? 'Updating…' : '↻ Update'}
        </button>
      </div>
      {w.flares.length ? (
        <>
          <ul className="grid max-h-28 gap-0.5 overflow-y-auto scroll-thin">
            {[...w.flares].sort((a, b) => (a.peakTime < b.peakTime ? 1 : -1)).slice(0, 8).map((f) => (
              <li key={f.id} className="flex gap-2 font-mono">
                <span className={f.classType.startsWith('X') ? 'text-bad' : f.classType.startsWith('M') ? 'text-warn' : 'text-white/70'}>{f.classType}</span>
                <span className="text-white/60">{f.peakTime.replace('T', ' ').slice(0, 16)}</span>
                {f.location && <span className="text-white/40">{f.location}</span>}
                {f.link && <a className="ml-auto text-cyan underline" href={f.link} target="_blank" rel="noreferrer">details</a>}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-white/55">
            Strongest recent flare: <b>{strongest?.classType ?? '—'}</b>. In the game, solar-storm strength is scaled by this real activity (X → stronger, C → weaker); the storms themselves are simulated.
          </p>
        </>
      ) : (
        <p className="text-white/55">No real data available right now; the game uses simulated solar activity.</p>
      )}
      <a className="mt-1 inline-block text-cyan underline" href={DONKI_URL} target="_blank" rel="noreferrer">NASA DONKI space-weather database</a>
    </div>
  );
}

function MoonTrek({ s }: { s: GameState }) {
  return (
    <div className="mt-2 rounded-lg bg-black/25 p-2 text-[11px]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
        <span className="font-bold">🗺 Real Moon map (NASA Moon Trek, LRO camera mosaic)</span>
        <a className="text-cyan underline" href={TREK_URL} target="_blank" rel="noreferrer">Open Moon Trek</a>
      </div>
      <div className="relative overflow-hidden rounded">
        <div className="flex">
          <img src={trekTile(0, 0, 0)} alt="Western half of the Moon (NASA LRO WAC mosaic)" className="w-1/2" loading="lazy" />
          <img src={trekTile(0, 0, 1)} alt="Eastern half of the Moon (NASA LRO WAC mosaic)" className="w-1/2" loading="lazy" />
        </div>
        {/* South-pole region: Artemis candidate landing area (the game's setting) */}
        <div className="absolute bottom-0 left-1/2 h-3 w-full -translate-x-1/2 border-t-2 border-dashed border-accent/80" />
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-black/70 px-1.5 text-[10px] text-accent">▼ south-pole region (your colony’s setting)</span>
      </div>
      <p className="mt-1 text-white/50">Real image: NASA/GSFC/Arizona State University, LRO Wide Angle Camera global mosaic. The colony map in the game is fictional. Day {s.cycle.index + 1} of your mission.</p>
    </div>
  );
}

function EnvDepartment({ s, dept, lvl }: { s: GameState; dept: EnvDept; lvl: number }) {
  const info = ENV_INFO[dept];
  const net = networkStatus(s);
  const active = net.filter((n) => n.active);
  const metric = info.metric!;
  const valOf = (n: (typeof net)[number]) => {
    const last = [...samplesOf(s, n.station.id)].reverse().find((d) => d.ok && isFinite(Number(d[metric] ?? NaN)));
    return last ? Number(last[metric]) : null;
  };
  const unit = { temp: '°C', rad: 'µSv/h', sun: 'W/m²', dust: '%' }[metric];
  const solar = s.buildings.filter((b) => b.type === 'solar' && b.level > 0);
  const avgDust = solar.length ? (solar.reduce((a, b) => a + (b.dust ?? 0), 0) / solar.length) * 100 : 0;
  const recentImpacts = s.station.impacts.filter((x) => x.t > s.time - DAY_NIGHT.cycle);
  const built = s.buildings.filter((b) => b.level > 0);
  const avgCond = built.length ? built.reduce((a, b) => a + (b.condition ?? 100), 0) / built.length : 100;
  const flareNow = !!s.flare && s.time >= s.flare.start;
  const deptWarnings = warnings(s, net).filter((w) => {
    if (dept === 'rad') return w.text.includes('☢');
    if (dept === 'temp') return w.text.includes('🥶') || w.text.includes('🔋');
    if (dept === 'sun') return w.text.includes('🌒') || w.text.includes('☢');
    return w.text.includes('📡');
  });
  if (dept === 'surface') {
    if (avgDust > 25) deptWarnings.push({ kind: 'warn', text: `🌫 Panels are ${Math.round(avgDust)}% covered in dust: send a robot to clean them.` });
    for (const b of built.filter((x) => (x.condition ?? 100) < ENVIRONMENT.maintenanceBelow)) deptWarnings.push({ kind: 'warn', text: `🔧 ${BUILDINGS[b.type].name} needs maintenance (${Math.round(b.condition ?? 100)}%).` });
  }
  if (!deptWarnings.length) deptWarnings.push({ kind: 'info', text: '✅ No alerts in this department.' });

  return (
    <div className="grid gap-2">
      {/* Level 1: current values and status */}
      <Section title={`${info.icon} Current readings`} level={1} opsLevel={lvl}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {net.length === 0 && <p className="text-xs text-white/50">No Monitoring Stations yet. Build some and connect them to the Operations Center.</p>}
          {net.map((n) => (
            <div key={n.station.id} className="rounded-lg bg-black/25 p-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold"><Dot i={n.index} /> Station #{n.index + 1}</div>
              <div className="title text-xl">{n.active && valOf(n) !== null ? `${fmt(valOf(n)!, metric === 'dust' ? 1 : 0)} ${unit}` : '—'}</div>
              <div className={`text-[11px] ${n.active ? 'text-good' : 'text-warn'}`}>{n.active ? '● transmitting' : `▲ ${n.problem}`}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 grid gap-1 rounded-lg bg-black/25 p-2 sm:grid-cols-2">
          {dept === 'temp' && (<>
            <Kv k="Colony status" v={isDay(s) ? 'lunar day' : 'lunar night'} />
            <Kv k="Equipment heating" v={!isDay(s) ? 'needed (cold soak)' : 'not needed'} tone={!isDay(s) ? 'text-warn' : ''} />
          </>)}
          {dept === 'rad' && (<>
            <Kv k="Status" v={flareNow ? 'SOLAR STORM' : s.flare ? 'storm incoming' : 'background only'} tone={flareNow ? 'text-bad' : s.flare ? 'text-warn' : 'text-good'} />
            <Kv k="Crew shielding blocks" v={`${Math.round(s.flows.shieldBlock * 100)}%`} />
            <Kv k="Crew dose so far" v={`${fmt(s.crew.dose)} mSv (game scale)`} />
            <Kv k="Dose rate now" v={`${s.flows.doseRate.toFixed(1)} mSv/h`} tone={s.flows.doseRate > 0 ? 'text-bad' : ''} />
          </>)}
          {dept === 'sun' && (<>
            <Kv k="Solar activity (game)" v={flareNow ? 'STORM' : s.flare ? 'ELEVATED' : 'QUIET'} tone={flareNow ? 'text-bad' : s.flare ? 'text-warn' : 'text-good'} />
            <Kv k="Illumination" v={`${fmt(MONITORING.solarConstant * s.flows.sunlight)} W/m²`} />
            <Kv k="Solar power available" v={`${s.flows.powerProd.toFixed(1)} kW`} />
            <Kv k={isDay(s) ? 'Sunset in' : 'Sunrise in'} v={fmtH(isDay(s) ? dayLength(s) - cyclePos(s) : DAY_NIGHT.cycle - cyclePos(s))} />
          </>)}
          {dept === 'surface' && (<>
            <Kv k="Dust on solar panels" v={`${fmt(avgDust, 1)}%`} tone={avgDust > 25 ? 'text-warn' : ''} />
            <Kv k="Solar efficiency" v={`${Math.round(s.flows.solarEfficiency * 100)}%`} tone={s.flows.solarEfficiency < 0.8 ? 'text-warn' : ''} />
            <Kv k="Impacts this cycle" v={recentImpacts.length} />
            <Kv k="Average equipment condition" v={`${Math.round(avgCond)}%`} tone={avgCond < 70 ? 'text-warn' : ''} />
          </>)}
        </div>
      </Section>

      {/* Level 2: history */}
      <Section title="📈 History" level={2} opsLevel={lvl}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {net.map((n) => (
            <div key={n.station.id} className="rounded-lg bg-black/25 p-2 text-[11px]">
              <div className="mb-0.5 flex items-center gap-1"><Dot i={n.index} /> #{n.index + 1} · last {MONITORING.historyLength * MONITORING.sampleEvery} h</div>
              <Sparkline values={samplesOf(s, n.station.id).slice(-90).map((d) => (metric === 'rad' ? Math.log10(Number(d.rad)) : Number(d[metric] ?? NaN)))} color={STATION_COLORS[n.index]} />
            </div>
          ))}
        </div>
        {dept === 'surface' && (
          <div className="mt-2 text-[11px]">
            <div className="font-semibold">Recent micrometeoroid impacts</div>
            {recentImpacts.length ? (
              <ul className="text-white/70">{recentImpacts.slice(-6).reverse().map((x, i) => <li key={i}>h{Math.round(x.t)} · {BUILDINGS[s.buildings.find((b) => b.id === x.buildingId)?.type ?? 'command'].name}</li>)}</ul>
            ) : <p className="text-white/50">None recorded this cycle.</p>}
          </div>
        )}
      </Section>

      {/* Level 3: graphs and alerts */}
      <Section title="📊 Graphs & alerts" level={3} opsLevel={lvl}>
        {net.length > 1 && <div className="mb-1 flex flex-wrap gap-3 text-[11px]">{net.map((n) => <span key={n.station.id} className="inline-flex items-center gap-1"><Dot i={n.index} /> Station #{n.index + 1}</span>)}</div>}
        <LineChart s={s} net={net} metric={metric} log={metric === 'rad'} />
        <ul className="mt-2 grid gap-1">
          {deptWarnings.map((w, i) => (
            <li key={i} className={`rounded-lg px-2 py-1 text-xs ${{ bad: 'bg-bad/15 text-[#ffc2c2]', warn: 'bg-warn/10 text-[#ffd9a8]', info: 'bg-black/25 text-white/80' }[w.kind]}`}>{w.text}</li>
          ))}
        </ul>
        {dept === 'sun' && (
          <div className="mt-2 text-[11px] text-white/70">
            ☀ Sun position: {isDay(s) ? `${Math.round((cyclePos(s) / dayLength(s)) * 100)}% of the way across the sky` : 'below the horizon'} · Forecast: {isDay(s) ? `sunset in ${fmtH(dayLength(s) - cyclePos(s))}, then ${fmtH(DAY_NIGHT.cycle - dayLength(s))} of darkness` : `sunrise in ${fmtH(DAY_NIGHT.cycle - cyclePos(s))}`}
          </div>
        )}
      </Section>

      {/* Level 4: analysis, comparison and the science */}
      <Section title="🔬 Analysis & science" level={4} opsLevel={lvl}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="text-white/50"><tr><th className="pr-2">Station</th><th className="pr-2">Min</th><th className="pr-2">Average</th><th className="pr-2">Max</th><th className="pr-2">Data uptime</th></tr></thead>
            <tbody>
              {net.map((n) => {
                const list = samplesOf(s, n.station.id);
                const vals = okSamples(list).map((d) => Number(d[metric] ?? NaN)).filter((v) => isFinite(v));
                const st = stat(vals);
                return (
                  <tr key={n.station.id} className="border-t border-white/5">
                    <td className="py-1 pr-2"><span className="inline-flex items-center gap-1"><Dot i={n.index} />#{n.index + 1}</span></td>
                    <td className="pr-2 font-mono">{st ? fmt(st.min, 1) : '—'}</td>
                    <td className="pr-2 font-mono">{st ? fmt(st.avg, 1) : '—'}</td>
                    <td className="pr-2 font-mono">{st ? fmt(st.max, 1) : '—'}</td>
                    <td className="pr-2 font-mono">{list.length ? `${Math.round((okSamples(list).length / list.length) * 100)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 rounded-lg bg-cyan/10 p-2 text-[11px] text-white/80"><b className="text-cyan">The science: </b>{info.science}</p>
        <NtrsReading topic={info.ntrs} />
      </Section>
      {(dept === 'rad' || dept === 'sun') && <RealFlares />}
      {dept === 'sun' && <MoonTrek s={s} />}
      <p className="text-[10px] text-white/40">Station readings are simulated by the game using real reference values; only items marked NASA DATA are real observations. {active.length}/{capacity(s)} station slots in use.</p>
    </div>
  );
}

// ======================================================================
// Life Support
// ======================================================================
function LifeDept({ s }: { s: GameState }) {
  const f = s.flows;
  const ppm = f.co2ppm;
  const co2Tone = ppm > LIFE.co2Danger ? 'bad' : ppm > LIFE.co2Warn ? 'warn' : undefined;
  const crewCo2 = LIFE.co2PerCrew * s.crew.count;
  const scrub = scrubCapacity(s);
  const wcap = wasteCap(s);
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {f.starving.length > 0 && (
        <div className="rounded-xl border-2 border-bad/60 bg-bad/10 p-2 text-sm font-bold text-[#ffc2c2] md:col-span-2">
          ⚠ Critical: {f.starving.map((k) => ({ o2: 'no oxygen', water: 'no water', food: 'no food', cold: 'habitats unpowered', co2: 'CO₂ dangerous', waste: 'waste storage full' })[k]).join(' · ')}
        </div>
      )}
      <Card title="🫧 Oxygen (O₂)" tone={s.life.o2 < 5 ? 'bad' : undefined}>
        <Kv k="In tanks" v={`${fmt(s.life.o2, 1)} / ${fmt(f.caps.o2)} kg`} />
        <Bar value={s.life.o2} max={f.caps.o2} color="#7dfff0" className="my-1" />
        <Kv k="Net change" v={`${fmtRate(f.o2, 2)} kg/h`} tone={f.o2 < 0 ? 'text-bad' : 'text-good'} />
        <Kv k="Crew breathes" v={`${(CREW.o2 * s.crew.count).toFixed(2)} kg/h`} />
        <Kv k="Lasts" v={fmtH(hoursLeft(s.life.o2, f.o2))} />
        <Why>Each astronaut needs oxygen every minute. The Oxygen Generator splits water from ice by electrolysis (1 kg water → 0.89 kg O₂). It needs ice and power, so a blackout or an empty ice store stops oxygen production.</Why>
      </Card>
      <Card title="💨 Carbon dioxide (CO₂)" tone={co2Tone}>
        <Kv k="Cabin level" v={`${fmt(ppm)} ppm (${(ppm / 10000).toFixed(2)}%)`} tone={co2Tone === 'bad' ? 'text-bad' : co2Tone === 'warn' ? 'text-warn' : 'text-good'} />
        <Bar value={Math.min(ppm, LIFE.co2Danger * 1.5)} max={LIFE.co2Danger * 1.5} color={co2Tone === 'bad' ? '#ff4d4d' : co2Tone === 'warn' ? '#ffa53c' : '#3fdc7c'} className="my-1" />
        <Kv k="Crew exhales" v={`${crewCo2.toFixed(2)} kg/h`} />
        <Kv k="Scrubbers can remove" v={`${scrub.toFixed(2)} kg/h`} tone={scrub < crewCo2 ? 'text-bad' : ''} />
        <Kv k="Cabin volume" v={`${fmt(cabinVolume(s))} m³`} />
        <Why>We breathe out CO₂ (about 1 kg per person per day). In a sealed cabin it builds up and causes headaches, then becomes dangerous. Earth’s air has about 420 ppm; the ISS keeps CO₂ low with powered scrubbers. In the game, scrubbers in the Command Center and habitats stop when they lose power.</Why>
      </Card>
      <Card title="💧 Water" tone={s.life.water < 5 ? 'bad' : undefined}>
        <Kv k="In tanks" v={`${fmt(s.life.water, 1)} / ${fmt(f.caps.water)} L`} />
        <Bar value={s.life.water} max={f.caps.water} color="#4aa3ff" className="my-1" />
        <Kv k="Net change" v={`${fmtRate(f.water, 2)} L/h`} tone={f.water < 0 ? 'text-bad' : 'text-good'} />
        <Kv k="Recycling recovers" v={`${Math.round(f.waterRecovery * 100)}% of crew water`} tone={f.waterRecovery === 0 ? 'text-bad' : ''} />
        <Kv k="Recycled so far" v={`${fmt(s.totals.waterRecycled)} L`} />
        {s.station.effects.some((e) => e.type === 'leak' && e.until > s.time) && <Kv k="Leak" v="−0.8 L/h" tone="text-bad" />}
        <Why>Water is heavy to launch, so stations recycle it. Crew water is cleaned and reused (better with the Water Recycling technology); the rest must come from melting lunar ice. Greenhouses also drink water, so food and water compete.</Why>
      </Card>
      <Card title="🥗 Food" tone={s.life.food < 5 ? 'bad' : undefined}>
        <Kv k="In storage" v={`${fmt(s.life.food, 1)} / ${fmt(f.caps.food)} kg`} />
        <Bar value={s.life.food} max={f.caps.food} color="#9be15d" className="my-1" />
        <Kv k="Net change" v={`${fmtRate(f.food, 2)} kg/h`} tone={f.food < 0 ? 'text-bad' : 'text-good'} />
        <Kv k="Grown / eaten (total)" v={`${fmt(s.totals.foodGrown)} / ${fmt(s.totals.foodUsed)} kg`} />
        <Kv k="Lasts" v={fmtH(hoursLeft(s.life.food, f.food))} />
        <Why>Greenhouses turn water and power into food. Composted crew waste works as fertiliser (+25% harvest). A permanent base cannot rely on supply ships forever.</Why>
      </Card>
      <Card title="♻️ Waste management" tone={s.life.waste >= wcap ? 'bad' : s.life.waste > wcap * 0.8 ? 'warn' : undefined}>
        <Kv k="Stored waste" v={`${fmt(s.life.waste, 1)} / ${fmt(wcap)} kg`} />
        <Bar value={s.life.waste} max={wcap} color="#c48a3a" className="my-1" />
        <Kv k="Net change" v={`${fmtRate(LIFE.wastePerCrew * s.crew.count - (s.totals.wasteComposted > 0 ? 0 : 0), 2)} kg/h produced`} />
        <Kv k="Composted so far" v={`${fmt(s.totals.wasteComposted, 1)} kg`} />
        <Why>Crews produce organic waste every day. Storing it takes space and, when full, causes hygiene problems. Composting it in greenhouses closes the loop: waste becomes fertiliser and food. Resource Storage adds room.</Why>
      </Card>
      <Card title="👩‍🚀 Crew health & safety" tone={s.crew.health < 40 ? 'bad' : s.crew.health < 75 ? 'warn' : undefined}>
        <Kv k="Crew" v={`${s.crew.count} / ${f.crewCap}`} />
        <Kv k="Health" v={`${Math.ceil(s.crew.health)}%`} tone={s.crew.health < 40 ? 'text-bad' : s.crew.health < 75 ? 'text-warn' : 'text-good'} />
        <Bar value={s.crew.health} max={100} color={s.crew.health < 40 ? '#ff4d4d' : s.crew.health < 75 ? '#ffa53c' : '#3fdc7c'} className="my-1" />
        <Kv k="Radiation dose" v={`${fmt(s.crew.dose)} mSv (game scale)`} />
        <Kv k="Storm shielding" v={`${Math.round(s.flows.shieldBlock * 100)}% blocked`} />
        <Why>Health drops when any life-support resource runs out, when habitats lose power (cold, CO₂) or during radiation storms. It recovers slowly when everything is fine. New astronauts only arrive when supplies and CO₂ are safe.</Why>
      </Card>
    </div>
  );
}

// ======================================================================
// Power Management
// ======================================================================
function PowerDept({ s }: { s: GameState }) {
  const f = s.flows;
  const fc = powerForecast(s);
  const consumers = s.buildings.filter((b) => b.level > 0 && powerDraw(b.type, b.level) > 0).sort((a, b) => powerPriority(b) - powerPriority(a));
  const farms = s.buildings.filter((b) => b.type === 'solar' && b.level > 0);
  const net = networkPower(s);
  return (
    <div className="grid gap-2">
      <div className="grid gap-2 md:grid-cols-3">
        <Card title="⚡ Balance now">
          <Kv k="Generated" v={`${f.powerProd.toFixed(1)} kW`} tone="text-good" />
          <Kv k="Consumed" v={`${f.powerUsed.toFixed(1)} kW of ${f.powerDemand.toFixed(1)} kW wanted`} tone={f.powerUsed < f.powerDemand - 0.01 ? 'text-bad' : ''} />
          <Kv k="Net" v={`${fmtRate(f.powerProd - f.powerUsed)} kW`} tone={f.powerProd - f.powerUsed < 0 ? 'text-bad' : 'text-good'} />
          <Kv k="Battery" v={`${fmt(s.battery)} / ${fmt(f.batteryCap)} kWh`} />
          <Bar value={s.battery} max={f.batteryCap} color="#3fdc7c" className="mt-1" />
          {net.total > 0 && <Kv k="Monitoring network" v={`${net.total.toFixed(2)} kW`} />}
        </Card>
        <Card title="🔮 Energy forecast" tone={fc.ok ? undefined : 'warn'}>
          {fc.day ? (
            <>
              <Kv k="Sunset in" v={fmtH(fc.hoursToSwitch)} />
              <Kv k="Battery at sunset (est.)" v={`${fmt(fc.batteryAtSunset ?? 0)} kWh`} />
              <Kv k="Night length" v={fmtH(fc.nightLength)} />
            </>
          ) : (
            <Kv k="Sunrise in" v={fmtH(fc.hoursToSwitch)} />
          )}
          <Kv k="Battery lasts" v={fmtH(fc.lastsHours)} tone={fc.ok ? 'text-good' : 'text-bad'} />
          <p className={`mt-1 text-xs font-semibold ${fc.ok ? 'text-good' : 'text-warn'}`}>
            {fc.ok ? '✓ Enough stored energy for the night at today’s demand.' : `▲ Short by about ${fmt(fc.shortfallKWh)} kWh: add batteries/solar or switch things off at night.`}
          </p>
        </Card>
        <Card title="☀ Solar condition">
          <Kv k="Sunlight" v={`${Math.round(f.sunlight * 100)}%`} />
          <Kv k="Panel efficiency" v={`${Math.round(f.solarEfficiency * 100)}%`} tone={f.solarEfficiency < 0.8 ? 'text-warn' : ''} />
          {farms.map((b, i) => (
            <div key={b.id} className="mt-1 flex items-center justify-between gap-2 text-[11px]">
              <span>Farm {i + 1}: dust {Math.round((b.dust ?? 0) * 100)}% · {Math.round(solarFarmEfficiency(s, b) * 100)}%</span>
              <button className="btn btn-gray px-1.5 py-0.5 text-[10px]" disabled={!!b.job || (b.dust ?? 0) < 0.02} onClick={() => store.clean(b.id)}>🧹 Clean</button>
            </div>
          ))}
          <Why>Solar power depends on sunlight (zero at night), dust on the panels and the panels’ condition. Cleaning restores output; rocket launches and dust events make panels dirty.</Why>
        </Card>
      </div>
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border-2 p-3 ${s.station.emergency ? 'border-bad bg-bad/15' : 'border-white/10 bg-black/25'}`}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">🚨 Emergency power-saving mode {s.station.emergency ? 'is ON' : ''}</div>
          <div className="text-[11px] text-white/65">Turns off everything except life support (Command Center, habitats, oxygen, ice, greenhouses) until you switch it off.</div>
        </div>
        <button className={`btn ${s.station.emergency ? 'btn-green' : 'btn-red'}`} onClick={() => store.toggleEmergency()}>{s.station.emergency ? 'Restore normal power' : 'Activate'}</button>
      </div>
      <Card title="🔀 Power distribution (priority order)">
        <p className="mb-1 text-[11px] text-white/60">When energy runs short, buildings at the bottom switch off first. Raise what matters most.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="text-white/50"><tr><th className="pr-2">Priority</th><th className="pr-2">Building</th><th className="pr-2">Draw</th><th className="pr-2">Status</th><th /></tr></thead>
            <tbody>
              {consumers.map((b) => {
                const status = !b.enabled ? ['switched off', 'text-white/50'] : emergencyOff(s, b) ? ['emergency off', 'text-warn'] : b.online ? ['● powered', 'text-good'] : ['▲ no power', 'text-bad'];
                return (
                  <tr key={b.id} className="border-t border-white/5">
                    <td className="py-1 pr-2">
                      <span className="inline-flex items-center gap-1">
                        <button className="btn btn-gray h-5 w-5 p-0 text-[10px]" aria-label="Raise priority" onClick={() => store.shiftPriority(b.id, 1)}>▲</button>
                        <span className="w-4 text-center font-mono">{powerPriority(b)}</span>
                        <button className="btn btn-gray h-5 w-5 p-0 text-[10px]" aria-label="Lower priority" onClick={() => store.shiftPriority(b.id, -1)}>▼</button>
                      </span>
                    </td>
                    <td className="pr-2">{BUILDINGS[b.type].icon} {BUILDINGS[b.type].name} L{b.level}{BUILDINGS[b.type].lifeSupport ? ' · life support' : ''}</td>
                    <td className="pr-2 font-mono">{powerDraw(b.type, b.level).toFixed(1)} kW</td>
                    <td className={`pr-2 ${status[1]}`}>{status[0]}</td>
                    <td><button className="btn btn-gray px-1.5 py-0.5 text-[10px]" onClick={() => store.toggle(b.id)}>{b.enabled ? 'Off' : 'On'}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Why>Real stations shed non-essential loads first when power is short. Life support (air, heat, water) always comes first; mining and manufacturing can wait for the Sun.</Why>
      </Card>
    </div>
  );
}

// ======================================================================
// Mission Operations
// ======================================================================
function OpsDept({ s }: { s: GameState }) {
  const [topic, setTopic] = useState('power');
  const effects = s.station.effects.filter((e) => e.until > s.time);
  const EFFECT_LABEL: Record<string, string> = {
    leak: '💧 Water leak (−0.8 L/h)', waterCap: '💧 Water tank isolated (−30% storage)', batteryFault: '🔋 Battery fault (−25% storage)',
    commsDown: '📡 No contact with Earth', backupAntenna: '📡 Backup antenna (+1 kW)', tilt: '☀ Panels re-aligning (−10%)',
    shelter: '🛡 Crew sheltering', workThrough: '☢ Crew working through storm', electronicsOff: '⚡ Electronics safed',
  };
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <Card title="⏱ Active conditions">
        {effects.length || s.station.emergency ? (
          <ul className="grid gap-1 text-xs">
            {s.station.emergency && <li className="text-warn">🚨 Emergency power-saving mode</li>}
            {effects.map((e, i) => <li key={i} className="flex justify-between gap-2"><span>{EFFECT_LABEL[e.type] ?? e.type}</span><span className="font-mono text-white/60">{fmtH(e.until - s.time)}</span></li>)}
          </ul>
        ) : <p className="text-xs text-white/55">No active events. Next check: unpredictable.</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn btn-yellow text-sm" onClick={openReport}>📄 Mission report</button>
          <button className="btn btn-blue text-sm" onClick={openLibrary}>📚 Lunar Library & glossary</button>
        </div>
      </Card>
      <Card title="📜 Mission history (decisions)">
        {s.station.history.length ? (
          <ul className="grid max-h-48 gap-1 overflow-y-auto scroll-thin text-[11px]">
            {[...s.station.history].reverse().map((h, i) => (
              <li key={i} className="rounded bg-black/25 px-2 py-1">
                <span className="font-mono text-white/45">h{Math.round(h.t)} </span>
                <b>{EVENTS[h.eventId]?.icon} {EVENTS[h.eventId]?.title}</b>: {h.outcome}
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-white/55">No events yet. Solar storms, dust, equipment failures, leaks, power faults and communication losses will appear here with your decisions.</p>}
      </Card>
      <Card title="📄 Scientific reports (NASA NTRS)">
        <select className="mb-1 w-full rounded bg-black/40 px-2 py-1 text-xs" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Report topic">
          {Object.entries(NTRS).map(([k, v]) => <option key={k} value={k}>{v.query}</option>)}
        </select>
        <NtrsReading topic={topic} />
        <p className="mt-1 text-[10px] text-white/45">Real report listings from the NASA Technical Reports Server, saved in the game on {SNAPSHOT_DATE.slice(0, 10)} (NTRS does not allow live requests from web pages). Refresh with <code>npm run data:nasa</code>.</p>
      </Card>
      <Card title="🌞 Space weather">
        <RealFlares />
      </Card>
    </div>
  );
}

// ======================================================================
export default function MissionControl() {
  const { s, ui } = useGame();
  const [dept, setDept] = useState<Dept>('life');
  const [env, setEnv] = useState<EnvDept>('temp');
  useEffect(() => {
    if (ui.panel === 'monitor') loadSpaceWeather();
  }, [ui.panel]);
  if (ui.panel !== 'monitor') return null;
  const ops = opsCenter(s);
  const lvl = ops && ops.level > 0 ? ops.level : 0;
  const alerts = { life: s.flows.starving.length > 0 || s.flows.co2ppm > LIFE.co2Warn, power: !powerForecast(s).ok || s.flows.shortage, env: !!s.flare, ops: s.station.effects.some((e) => e.until > s.time) };
  const TABS: [Dept, string][] = [['env', '🛰 Environment'], ['life', '🫧 Life Support'], ['power', '⚡ Power'], ['ops', '📋 Operations']];

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center p-2 sm:p-3">
      <div className="panel slide-down flex max-h-[82vh] w-full max-w-6xl flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-2 p-3 pb-2">
          <div>
            <h2 className="title text-2xl leading-none">🛰 Mission Control</h2>
            <p className="text-xs text-white/60">Central management of the lunar station · Day {s.cycle.index + 1} · {isDay(s) ? 'lunar day' : 'lunar night'}</p>
          </div>
          <CloseButton onClick={() => store.setPanel(null)} />
        </div>
        <div className="flex gap-1 overflow-x-auto px-3 pb-2">
          {TABS.map(([id, label]) => (
            <button key={id} className={`btn relative shrink-0 px-3 py-1.5 text-sm ${dept === id ? 'btn-yellow' : 'btn-gray'}`} onClick={() => setDept(id)}>
              {label}
              {alerts[id] && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-black/50 bg-bad" />}
            </button>
          ))}
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {dept === 'env' && (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-1">
                {(Object.keys(ENV_INFO) as EnvDept[]).map((k) => (
                  <button key={k} className={`btn px-2 py-1 text-xs ${env === k ? 'btn-blue' : 'btn-gray'}`} onClick={() => setEnv(k)}>{ENV_INFO[k].icon} {ENV_INFO[k].title}</button>
                ))}
                <span className="ml-auto text-[11px] text-white/55">
                  {lvl ? `Operations Center L${lvl} · ${networkStatus(s).filter((n) => n.active).length}/${capacity(s)} stations` : 'Build the Lunar Operations Center to unlock monitoring'}
                </span>
              </div>
              {lvl ? <EnvDepartment s={s} dept={env} lvl={lvl} /> : (
                <div className="grid gap-2">
                  <p className="rounded-lg bg-black/25 p-3 text-sm text-white/70">Environmental monitoring needs the <b>Lunar Operations Center</b> and <b>Monitoring Stations</b> (Build menu). Each Operations Center level unlocks a deeper level in every department: readings → history → graphs & alerts → analysis.</p>
                  {env === 'rad' || env === 'sun' ? <RealFlares /> : null}
                </div>
              )}
            </>
          )}
          {dept === 'life' && <LifeDept s={s} />}
          {dept === 'power' && <PowerDept s={s} />}
          {dept === 'ops' && <OpsDept s={s} />}
          <p className="mt-2 text-[10px] text-white/40">Game values are simplified so trade-offs show up in minutes. Real NASA data is always labelled with its source and date.</p>
        </div>
      </div>
    </div>
  );
}

