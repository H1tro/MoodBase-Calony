import { useEffect, useState } from 'react';
import { announcePanelOpen } from '../game/bridge';
import { store, useGame } from '../game/store';
import { BUILDINGS } from '../game/config/buildings';
import { CREW } from '../game/config/balance';
import { canBuyBuilder } from '../game/systems/construction';
import { builderCap, nextBuilderPrice } from '../game/systems/selectors';
import { fmt, fmtRate, fmtTime } from '../utils/format';
import { Bar } from './ui';

function BuildersPanel() {
  const { s } = useGame();
  const jobs = s.buildings.filter((b) => b.job);
  const free = s.builders - jobs.length;
  const price = nextBuilderPrice(s);
  const can = canBuyBuilder(s);
  return (
    <div className="panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="title text-base">🤖 Builders</h3>
        <span className={`chip ${free > 0 ? 'text-good' : 'text-warn'}`}>{free}/{s.builders} free</span>
      </div>
      <div className="grid gap-1.5">
        {Array.from({ length: s.builders }, (_, i) => {
          const job = s.buildings.find((b) => b.job?.builder === i);
          return (
            <button
              key={i}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs ${job ? 'border-warn/50 bg-warn/10 hover:bg-warn/20' : 'border-good/40 bg-good/10'}`}
              onClick={() => job && store.select(job.id)}
              disabled={!job}
            >
              <span className="text-base">🤖</span>
              <span className="flex-1 truncate font-semibold">
                {job ? `${({ shield: 'Shielding', build: 'Building', upgrade: 'Upgrading', repair: 'Repairing', clean: 'Cleaning' } as const)[job.job!.kind]} ${BUILDINGS[job.type].name}` : 'Idle — ready to build'}
              </span>
              {job && <span className="font-mono text-warn">{fmtTime((job.job!.end - s.time) / store.timeScale)}</span>}
            </button>
          );
        })}
      </div>
      {price !== null ? (
        <button className="btn btn-yellow mt-2 w-full text-sm" onClick={() => store.buyBuilder()} title={can.ok ? '' : can.reason} disabled={!can.ok}>
          + Hire builder · {fmt(price)} ₡
        </button>
      ) : (
        <div className="mt-2 text-center text-xs text-white/60">All 5 builders hired</div>
      )}
      {!can.ok && price !== null && <p className="mt-1 text-center text-[11px] text-white/60">{can.reason} (room for {builderCap(s)})</p>}
    </div>
  );
}

function Supply({ icon, label, value, cap, rate, unit, color }: { icon: string; label: string; value: number; cap: number; rate: number; unit: string; color: string }) {
  const empty = value <= 0.01;
  const hoursLeft = rate < -0.001 ? value / -rate : null;
  const low = hoursLeft !== null && hoursLeft < 60;
  return (
    <div className={`rounded-lg px-1 py-0.5 ${empty ? 'pulse-red bg-bad/15' : ''}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{icon} {label}</span>
        <span className="font-mono">
          {fmt(value, 1)}<span className="text-white/50">/{fmt(cap)} {unit}</span>
        </span>
      </div>
      <Bar value={value} max={cap} color={empty ? '#ff4d4d' : color} className="my-0.5 h-1.5" />
      <div className="flex justify-between text-[10px]">
        <span className={rate >= 0 ? 'text-good' : 'text-bad'}>{fmtRate(rate, 2)} {unit}/h</span>
        {hoursLeft !== null && <span className={low ? 'font-bold text-bad' : 'text-white/60'}>empty in {fmtTime(hoursLeft / store.timeScale)}</span>}
      </div>
    </div>
  );
}

function LifeSupportPanel() {
  const { s } = useGame();
  const f = s.flows;
  const net = f.powerProd - f.powerUsed;
  const emptyIn = net < -0.01 ? s.battery / -net : null;
  const health = s.crew.health;
  const flareActive = s.flare && s.time >= s.flare.start;
  return (
    <div className="panel grid gap-2 p-3">
      <h3 className="title text-base">🧑‍🚀 Life support</h3>
      {/* Power */}
      <div className="rounded-lg bg-black/25 p-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">⚡ Power</span>
          <span>
            <span className="text-good">+{f.powerProd.toFixed(1)}</span> / <span className="text-bad">−{f.powerDemand.toFixed(1)}</span> kW
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span>🔋 {fmt(s.battery)} / {fmt(f.batteryCap)} kWh</span>
          <span className={net >= 0 ? 'text-good' : 'text-bad'}>{net >= 0 ? 'charging' : `empty in ${fmtTime(emptyIn! / store.timeScale)}`}</span>
        </div>
        <Bar value={s.battery} max={f.batteryCap} color="#3fdc7c" className="mt-1" />
        {f.powerDemand > f.powerUsed + 0.01 && <p className="mt-1 text-[11px] font-semibold text-bad">⚠ Not enough power: some buildings are offline!</p>}
      </div>
      <Supply icon="🫧" label="Oxygen" value={s.life.o2} cap={f.caps.o2} rate={f.o2} unit="kg" color="#7dfff0" />
      <Supply icon="💧" label="Water" value={s.life.water} cap={f.caps.water} rate={f.water} unit="L" color="#4aa3ff" />
      <div className={`rounded-lg px-1 py-0.5 text-xs ${f.co2ppm > 10000 ? 'pulse-red bg-bad/15' : ''}`}>
        <div className="flex justify-between"><span className="font-semibold">💨 Cabin CO₂</span><span className={`font-mono ${f.co2ppm > 10000 ? 'text-bad' : f.co2ppm > 5000 ? 'text-warn' : 'text-good'}`}>{fmt(f.co2ppm)} ppm</span></div>
        <Bar value={Math.min(f.co2ppm, 15000)} max={15000} color={f.co2ppm > 10000 ? '#ff4d4d' : f.co2ppm > 5000 ? '#ffa53c' : '#3fdc7c'} className="my-0.5 h-1.5" />
      </div>
      <Supply icon="🥗" label="Food" value={s.life.food} cap={f.caps.food} rate={f.food} unit="kg" color="#9be15d" />
      {/* Crew */}
      <div className="rounded-lg bg-black/25 p-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">👩‍🚀 Crew {s.crew.count}/{f.crewCap}</span>
          <span className={health < 40 ? 'font-bold text-bad' : health < 75 ? 'text-warn' : 'text-good'}>Health {Math.ceil(health)}%</span>
        </div>
        <Bar value={health} max={100} color={health < 40 ? '#ff4d4d' : health < 75 ? '#ffa53c' : '#3fdc7c'} className="mt-1" />
        {s.crew.count < f.crewCap && s.crew.arrivalTimer > 0 && (
          <p className="mt-1 text-[10px] text-white/60">Next astronaut in {fmtTime((CREW.arrivalEvery - s.crew.arrivalTimer) / store.timeScale)}</p>
        )}
        {f.starving.length > 0 && (
          <p className="mt-1 text-[11px] font-bold text-bad">
            ⚠ {f.starving.map((k) => ({ o2: 'No oxygen', water: 'No water', food: 'No food', cold: 'Habitats unpowered', co2: 'CO₂ dangerous', waste: 'Waste storage full' })[k]).join(' · ')}
          </p>
        )}
      </div>
      {/* Radiation */}
      <div className={`rounded-lg p-2 ${flareActive ? 'pulse-red bg-bad/20' : s.flare ? 'bg-warn/15' : 'bg-black/25'}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">☢ Radiation</span>
          <span>Shielding blocks {Math.round(f.shieldBlock * 100)}%</span>
        </div>
        <div className="mt-1 text-[11px] text-white/70">
          {flareActive
            ? <span className="font-bold text-bad">SOLAR FLARE! {f.doseRate.toFixed(1)} mSv/h</span>
            : s.flare
              ? <span className="font-bold text-warn">Flare arriving in {fmtTime((s.flare.start - s.time) / store.timeScale)}</span>
              : <>Total crew dose: {fmt(s.crew.dose, 0)} mSv (game scale)</>}
        </div>
      </div>
    </div>
  );
}

export default function SidePanel() {
  const [open, setOpenRaw] = useState(() => typeof window === 'undefined' || window.innerWidth >= 900);
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== 'status' && window.innerWidth < 900) setOpenRaw(false);
    };
    window.addEventListener('side-panel-open', onOther);
    return () => window.removeEventListener('side-panel-open', onOther);
  }, []);
  const setOpen = (v: boolean) => {
    setOpenRaw(v);
    if (v) announcePanelOpen('status');
  };
  const { s, ui } = useGame();
  const alert = s.flows.starving.length > 0 || !!s.flare || s.crew.health < 50;
  // Free up the map while placing a building on smaller screens.
  if (ui.placing && window.innerWidth < 1280) return null;
  return (
    <div className="pointer-events-none absolute right-2 top-[124px] bottom-[96px] z-10 flex w-[min(300px,calc(100vw-16px))] flex-col items-end gap-2 sm:right-3 md:top-[84px]">
      <button className={`btn pointer-events-auto text-sm ${alert ? 'btn-red pulse-red' : 'btn-blue'}`} onClick={() => setOpen(!open)}>
        {open ? 'Hide status ▸' : `◂ Status · ❤ ${Math.ceil(s.crew.health)}% · 🤖 ${s.builders - s.buildings.filter((b) => b.job).length}/${s.builders}`}
      </button>
      {open && (
        <div className="pointer-events-auto slide-down grid w-full gap-2 overflow-y-auto scroll-thin pb-1">
          <BuildersPanel />
          <LifeSupportPanel />
        </div>
      )}
    </div>
  );
}
