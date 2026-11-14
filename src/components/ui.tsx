import { useEffect, useState, type ReactNode } from 'react';
import type { Cost } from '../game/config/buildings';
import type { GameState } from '../game/systems/state';
import { fmt } from '../utils/format';
import { onTexturesReady, texturePreview } from '../game/bridge';

export const RES_META = {
  regolith: { icon: '🪨', label: 'Regolith', color: '#b9b2a6', unit: 'kg' },
  titanium: { icon: '🔩', label: 'Titanium', color: '#9fc3ff', unit: 'kg' },
  ice: { icon: '🧊', label: 'Ice', color: '#7fe3ff', unit: 'kg' },
  credits: { icon: '₡', label: 'Credits', color: '#ffc93c', unit: '₡' },
} as const;

export function Bar({ value, max, color, className = '' }: { value: number; max: number; color: string; className?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-black/50 ${className}`}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${p * 100}%`, background: color }} />
    </div>
  );
}

/** Shows a cost; items you can't afford turn red. */
export function CostList({ cost, s, time }: { cost: Cost; s: GameState; time?: number }) {
  const items = (Object.keys(RES_META) as (keyof typeof RES_META)[]).filter((k) => (cost[k] ?? 0) > 0);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
      {items.map((k) => {
        const ok = s.res[k] >= (cost[k] ?? 0);
        return (
          <span key={k} className={`chip ${ok ? 'text-white' : 'text-bad'}`}>
            {RES_META[k].icon} {fmt(cost[k]!)}
          </span>
        );
      })}
      {items.length === 0 && <span className="chip">Free</span>}
      {time !== undefined && <span className="chip text-cyan">⏱ {time}s</span>}
    </div>
  );
}

/** Building artwork taken from the Phaser-generated texture. */
export function BuildingArt({ texKey, className = '' }: { texKey: string; className?: string }) {
  const [, force] = useState(0);
  useEffect(() => onTexturesReady(() => force((n) => n + 1)), []);
  const url = texturePreview(texKey);
  if (!url) return <div className={`${className} animate-pulse rounded-xl bg-white/5`} />;
  return <img src={url} alt="" className={`${className} object-contain drop-shadow-[0_6px_6px_rgba(0,0,0,0.5)]`} draggable={false} />;
}

export function Modal({ children, onClose, wide = false }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`panel pop-in max-h-[90vh] w-full overflow-y-auto scroll-thin p-5 ${wide ? 'max-w-3xl' : 'max-w-lg'}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button aria-label="Close" className="btn btn-red h-9 w-9 shrink-0 p-0 text-lg" onClick={onClick}>
      ✕
    </button>
  );
}
