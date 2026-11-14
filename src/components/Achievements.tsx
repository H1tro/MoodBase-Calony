import { useState } from 'react';
import { ACHIEVEMENTS, CATEGORIES, TIER_COLOR, type Achievement } from '../game/config/achievements';
import { DIFFICULTIES } from '../game/config/difficulty';
import type { Profile } from '../game/systems/profile';
import { Bar } from './ui';

type Filter = 'all' | 'unlocked' | 'locked';

function Card({ a, p, compact }: { a: Achievement; p: Profile; compact?: boolean }) {
  const u = p.unlocked[a.id];
  const hidden = a.secret && !u;
  const tier = TIER_COLOR[a.tier];
  return (
    <li
      className={`flex items-center gap-2.5 rounded-xl border-2 p-2 ${u ? 'bg-white/5' : 'border-white/5 bg-black/25'}`}
      style={u ? { borderColor: tier + '99' } : undefined}
    >
      <span
        className={`grid shrink-0 place-items-center rounded-full border-2 ${compact ? 'h-9 w-9 text-lg' : 'h-11 w-11 text-2xl'} ${u ? '' : 'opacity-40 grayscale'}`}
        style={{ borderColor: u ? tier : '#ffffff22', background: u ? tier + '22' : 'transparent' }}
      >
        {hidden ? '❓' : a.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${u ? '' : 'text-white/70'}`}>{hidden ? 'Secret achievement' : a.name}</span>
          <span className="rounded px-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: tier, border: `1px solid ${tier}66` }}>{a.tier}</span>
        </div>
        <div className={`text-white/60 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>{hidden ? 'Keep playing to discover it.' : a.desc}</div>
        {u && !compact && (
          <div className="mt-0.5 text-[10px] text-white/45">
            ✓ {new Date(u.at).toLocaleDateString()} · <span style={{ color: DIFFICULTIES[u.difficulty].color }}>{DIFFICULTIES[u.difficulty].name}</span>
          </div>
        )}
      </div>
    </li>
  );
}

/** All achievements grouped by category, with progress and a filter. */
export function AchievementList({ profile, compact = false }: { profile: Profile; compact?: boolean }) {
  const [filter, setFilter] = useState<Filter>('all');
  const got = ACHIEVEMENTS.filter((a) => profile.unlocked[a.id]).length;
  const show = (a: Achievement) => (filter === 'all' ? true : filter === 'unlocked' ? !!profile.unlocked[a.id] : !profile.unlocked[a.id]);
  const tiers = (['bronze', 'silver', 'gold', 'platinum'] as const).map((t) => ({
    t, got: ACHIEVEMENTS.filter((a) => a.tier === t && profile.unlocked[a.id]).length, all: ACHIEVEMENTS.filter((a) => a.tier === t).length,
  }));
  return (
    <div>
      <div className="mb-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold">{got} of {ACHIEVEMENTS.length} unlocked</span>
          <span className="text-white/50">{Math.round((got / ACHIEVEMENTS.length) * 100)}%</span>
        </div>
        <Bar value={got} max={ACHIEVEMENTS.length} color="#ffc93c" className="mt-1" />
        {!compact && (
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {tiers.map(({ t, got: g, all }) => (
              <span key={t} className="chip" style={{ color: TIER_COLOR[t] }}>● {t} {g}/{all}</span>
            ))}
          </div>
        )}
      </div>
      <div className="mb-2 flex gap-1">
        {(['all', 'unlocked', 'locked'] as Filter[]).map((f) => (
          <button key={f} className={`btn flex-1 px-1 py-1 text-xs capitalize ${filter === f ? 'btn-yellow' : 'btn-gray'}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      {CATEGORIES.map((c) => {
        const list = ACHIEVEMENTS.filter((a) => a.category === c && show(a));
        if (!list.length) return null;
        return (
          <div key={c} className="mb-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-cyan">{c}</div>
            <ul className={`grid gap-1.5 ${compact ? '' : 'sm:grid-cols-2'}`}>
              {list.map((a) => <Card key={a.id} a={a} p={profile} compact={compact} />)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
