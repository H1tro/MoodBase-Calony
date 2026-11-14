import { useState, type ReactNode } from 'react';
import { store } from '../game/store';
import { STATION_COLORS } from '../game/config/monitoring';
import type { StationStatus } from '../game/systems/monitoring';
import { hoursToSwitch, isDay } from '../game/systems/selectors';
import type { GameState, Sample } from '../game/systems/state';
import { fmt, fmtTime } from '../utils/format';

export type Metric = 'temp' | 'rad' | 'sun' | 'dust';
export const METRIC: Record<Metric, { label: string; unit: string; digits: number }> = {
  dust: { label: 'Dust on solar panels', unit: '%', digits: 1 },
  temp: { label: 'Surface temperature', unit: '°C', digits: 0 },
  rad: { label: 'Radiation dose rate', unit: 'µSv/h', digits: 0 },
  sun: { label: 'Sunlight (illumination)', unit: 'W/m²', digits: 0 },
};

export const samplesOf = (s: GameState, id: number): Sample[] => s.monitoring.samples[String(id)] ?? [];
export const okSamples = (list: Sample[]) => list.filter((x) => x.ok);
export const stat = (vals: number[]) => (vals.length ? { min: Math.min(...vals), max: Math.max(...vals), avg: vals.reduce((a, b) => a + b, 0) / vals.length } : null);

export function Section({ title, level, opsLevel, children }: { title: string; level: number; opsLevel: number; children: ReactNode }) {
  const locked = opsLevel < level;
  return (
    <section className={`rounded-xl border p-3 ${locked ? 'border-white/10 bg-black/20' : 'border-edge bg-panel-2/60'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="title text-base">{title}</h3>
        <span className={`chip text-[10px] ${locked ? 'text-white/50' : 'text-cyan'}`}>{locked ? `🔒 Level ${level}` : `Level ${level}+`}</span>
      </div>
      {locked ? <p className="text-xs text-white/50">Upgrade the Operations Center to level {level} to unlock this.</p> : children}
    </section>
  );
}

export function Dot({ i }: { i: number }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATION_COLORS[i] }} />;
}

/** Shared monitoring chart helpers, used by Mission Control's Environmental Monitoring department. */

/** Tiny single-series trend line (no axes) used in station cards. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const v = values.filter((x) => isFinite(x));
  if (v.length < 2) return <div className="h-6 text-[10px] text-white/40">collecting…</div>;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const pts = values.map((x, i) => (isFinite(x) ? `${(i / (values.length - 1)) * 100},${22 - ((x - min) / (max - min || 1)) * 20}` : null));
  const segs: string[][] = [[]];
  for (const p of pts) (p ? segs[segs.length - 1].push(p) : segs.push([]));
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-6 w-full">
      {segs.filter((sg) => sg.length > 1).map((sg, i) => <polyline key={i} points={sg.join(' ')} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}
    </svg>
  );
}

/** Line chart, one measure, one series per station; crosshair tooltip; log option for radiation. */
export function LineChart({ s, net, metric, log = false }: { s: GameState; net: StationStatus[]; metric: Metric; log?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = 150, L = 46, R = 70, T = 10, B = 22;
  const series = net.map((n) => ({ n, data: samplesOf(s, n.station.id) })).filter((x) => x.data.length);
  const all = series.flatMap((x) => x.data);
  if (!all.length) return <p className="text-xs text-white/50">No data yet: connect a station and wait a few seconds.</p>;
  const t0 = Math.min(...all.map((d) => d.t));
  const t1 = Math.max(...all.map((d) => d.t), t0 + 1);
  const val = (d: Sample) => Number(d[metric] ?? NaN);
  const vals = all.filter((d) => d.ok && isFinite(val(d))).map(val);
  const f = (v: number) => (log ? Math.log10(Math.max(1, v)) : v);
  let lo = vals.length ? Math.min(...vals.map(f)) : 0;
  let hi = vals.length ? Math.max(...vals.map(f)) : 1;
  if (log) { lo = Math.floor(lo); hi = Math.max(lo + 1, Math.ceil(hi)); }
  // Minimum axis span so tiny sensor noise isn't blown up into big swings.
  const minSpan = log ? 1 : metric === 'temp' ? 60 : metric === 'dust' ? 10 : 300;
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const x = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (f(v) - lo) / (hi - lo)) * (H - T - B);
  const ticks = log ? Array.from({ length: hi - lo + 1 }, (_, i) => Math.pow(10, lo + i)) : [lo, (lo + hi) / 2, hi];
  const m = METRIC[metric];
  const ht = hover !== null ? hover : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${m.label} per station`}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(px < L || px > W - R ? null : t0 + ((px - L) / (W - L - R)) * (t1 - t0));
        }}
        onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#ffffff" strokeOpacity="0.08" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#c3c2b7">{fmt(v)}</text>
          </g>
        ))}
        <text x={L} y={H - 6} fontSize="10" fill="#c3c2b7">h{Math.round(t0)}</text>
        <text x={W - R} y={H - 6} fontSize="10" fill="#c3c2b7" textAnchor="end">h{Math.round(t1)}</text>
        {series.map(({ n, data }) => {
          const segs: string[][] = [[]];
          for (const d of data) (d.ok && isFinite(val(d)) ? segs[segs.length - 1].push(`${x(d.t)},${y(val(d))}`) : segs.push([]));
          const last = [...data].reverse().find((d) => d.ok && isFinite(val(d)));
          return (
            <g key={n.station.id}>
              {segs.filter((sg) => sg.length > 1).map((sg, i) => <polyline key={i} points={sg.join(' ')} fill="none" stroke={STATION_COLORS[n.index]} strokeWidth="2" strokeLinejoin="round" />)}
              {last && <text x={W - R + 6} y={y(val(last)) + 4} fontSize="10" fill="#f0efec">#{n.index + 1} {fmt(val(last), m.digits)}</text>}
            </g>
          );
        })}
        {ht !== null && <line x1={x(ht)} x2={x(ht)} y1={T} y2={H - B} stroke="#f0efec" strokeOpacity="0.5" />}
      </svg>
      {ht !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border border-edge bg-panel px-2 py-1 text-[11px] shadow-lg">
          <div className="text-white/60">Colony hour {Math.round(ht)}</div>
          {series.map(({ n, data }) => {
            const d = data.reduce((a, b) => (Math.abs(b.t - ht) < Math.abs(a.t - ht) ? b : a));
            return (
              <div key={n.station.id} className="flex items-center gap-1.5">
                <Dot i={n.index} /> #{n.index + 1}: {d.ok && isFinite(val(d)) ? `${fmt(val(d), m.digits)} ${m.unit}` : 'no data'}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function warnings(s: GameState, net: StationStatus[]): { kind: 'bad' | 'warn' | 'info'; text: string }[] {
  const out: { kind: 'bad' | 'warn' | 'info'; text: string }[] = [];
  const f = s.flare;
  if (f && s.time < f.start) out.push({ kind: 'bad', text: `☢ Solar particle storm in ${fmtTime((f.start - s.time) / store.timeScale)}: crew to shielded habitats.` });
  if (f && s.time >= f.start) out.push({ kind: 'bad', text: '☢ Solar storm in progress: radio links degraded, cables unaffected.' });
  const drain = s.flows.powerUsed - s.flows.powerProd;
  if (!isDay(s) && drain > 0 && s.battery / drain < hoursToSwitch(s)) out.push({ kind: 'bad', text: `🔋 Batteries will run out about ${fmtTime((hoursToSwitch(s) - s.battery / drain) / store.timeScale)} before sunrise. Switch off non-essential buildings.` });
  if (isDay(s) && hoursToSwitch(s) < 60 && s.battery < s.flows.batteryCap * 0.6) out.push({ kind: 'warn', text: `🌒 Sunset in ${fmtTime(hoursToSwitch(s) / store.timeScale)} and batteries are only ${Math.round((s.battery / Math.max(1, s.flows.batteryCap)) * 100)}% full.` });
  for (const n of net) {
    const last = [...samplesOf(s, n.station.id)].reverse().find((d) => d.ok);
    if (n.problem && n.station.level > 0) out.push({ kind: 'warn', text: `📡 Station #${n.index + 1}: ${n.problem}.` });
    if (last && last.temp < -150) out.push({ kind: 'info', text: `🥶 Station #${n.index + 1} reads ${fmt(last.temp)} °C: equipment must be heated to survive.` });
  }
  if (!out.length) out.push({ kind: 'info', text: '✅ All clear: no environmental hazards detected.' });
  return out;
}
