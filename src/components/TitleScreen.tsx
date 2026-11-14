import { useEffect, useState } from 'react';
import { store, useGame } from '../game/store';
import { ACHIEVEMENTS, TIER_COLOR } from '../game/config/achievements';
import { DIFFICULTIES } from '../game/config/difficulty';
import { currentChapter } from '../game/systems/missions';
import { AchievementList } from './Achievements';
import OptionsPanel from './OptionsPanel';
import { LibraryContent } from './Library';
import CloudPanel from './CloudPanel';
import { cloudConfigured, getCloud } from '../game/cloud';

type Page = 'options' | 'achievements' | 'library' | 'cloud';
const SLIDE_MS = 450;

const PAGES: Record<Page, { title: string; sub: string }> = {
  achievements: { title: '🏅 Achievements', sub: 'Career progress across all your colonies' },
  library: { title: '📚 Lunar Library', sub: 'Science cards, glossary, real vs game, NASA technology' },
  options: { title: '⚙️ Options', sub: 'Saved for every colony' },
  cloud: { title: '☁️ Cloud save', sub: 'Keep your colony and achievements on every device' },
};

function MenuButton({ icon, label, sub, onClick, primary }: { icon: string; label: string; sub?: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} className={`btn ${primary ? 'btn-yellow' : 'btn-gray'} group h-auto w-full justify-start gap-3 px-4 py-3 text-left [@media(max-height:680px)]:py-2`}>
      <span className="text-2xl">{icon}</span>
      <span className="flex flex-1 flex-col items-start leading-tight">
        <span className="text-lg">{label}</span>
        {sub && <span className={`text-[11px] font-semibold ${primary ? 'text-[#5a3d00]' : 'text-white/60'}`}>{sub}</span>}
      </span>
      <span className="text-xl opacity-40 transition-transform group-hover:translate-x-1 group-hover:opacity-80">›</span>
    </button>
  );
}

/** Title / start page. Any menu button slides the menu out to the left. */
export default function TitleScreen() {
  const { s, screen, profile } = useGame();
  const [page, setPage] = useState<Page | null>(null);
  // Keeps the page content mounted while it slides out again.
  const [shown, setShown] = useState<Page | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (page) setShown(page);
    else if (shown) {
      const t = setTimeout(() => setShown(null), SLIDE_MS);
      return () => clearTimeout(t);
    }
  }, [page, shown]);

  // Coming back to the title (e.g. Main menu) always shows the menu.
  useEffect(() => {
    if (screen === 'title') {
      setLeaving(false);
      setPage(null);
    }
  }, [screen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && page && screen === 'title') setPage(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, screen]);

  if (screen !== 'title') return null;
  const has = store.hasColony;
  const d = DIFFICULTIES[s.difficulty];
  const ch = currentChapter(s);
  const got = ACHIEVEMENTS.filter((a) => profile.unlocked[a.id]);
  const recent = [...got].sort((a, b) => profile.unlocked[b.id].at - profile.unlocked[a.id].at).slice(0, 3);

  /** Slide the menu away, then run the action (start the game / open difficulty selection). */
  const leave = (action: () => void) => {
    setLeaving(true);
    setTimeout(action, SLIDE_MS);
  };
  const menuOut = page !== null || leaving;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[55] overflow-hidden" style={{ animation: 'fade-in .6s ease-out' }}>
      {/* Dark gradient behind the menu; it follows the menu off-screen. */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#02040a]/95 via-[#02040a]/70 to-[#02040a]/10 transition-opacity duration-500"
        style={{ opacity: leaving ? 0 : 1 }}
      />

      {/* ---- Main menu: slides out to the left ---- */}
      <div
        className="no-scrollbar absolute inset-y-0 left-0 w-full overflow-y-auto transition-all ease-in-out sm:w-[540px]"
        style={{ transitionDuration: `${SLIDE_MS}ms`, transform: menuOut ? 'translateX(-110%)' : 'translateX(0)', opacity: menuOut ? 0 : 1 }}
        aria-hidden={menuOut}
      >
        <div className="flex min-h-full flex-col justify-center p-5 sm:p-10 [@media(max-height:680px)]:py-4">
          <div className="w-full max-w-md">
            <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan">NASA Space Apps · Lunar outpost</div>
            <h1 className="title mt-1 text-5xl leading-[0.95] sm:text-6xl [@media(max-height:680px)]:text-4xl">
              MoonBase
              <br />
              <span className="text-accent">Colony</span>
            </h1>
            <p className="mt-3 text-sm text-white/75 [@media(max-height:680px)]:mt-1.5 [@media(max-height:680px)]:text-xs">Build power, life support and shelter on the Moon, and keep your crew alive through the long lunar night.</p>

            <div className="mt-6 grid gap-2.5 [@media(max-height:680px)]:mt-3 [@media(max-height:680px)]:gap-1.5">
              <MenuButton
                primary
                icon="▶"
                label={has ? 'Continue' : 'Play'}
                sub={has ? `${d.name} · Cycle ${s.cycle.index + 1} · ${ch ? `Chapter ${ch.id}: ${ch.title}` : 'Story complete'}${s.failed ? ' · mission failed' : ''}` : 'Choose a difficulty and launch'}
                onClick={() => leave(() => store.play())}
              />
              {has && <MenuButton icon="🌕" label="New colony" sub="Pick a difficulty; replaces the saved colony on launch" onClick={() => leave(() => store.openNewGame())} />}
              <MenuButton icon="🏅" label="Achievements" sub={`${got.length} of ${ACHIEVEMENTS.length} unlocked`} onClick={() => setPage('achievements')} />
              <MenuButton icon="📚" label="Lunar Library" sub="Science cards, glossary, real vs game, NASA tech" onClick={() => setPage('library')} />
              <MenuButton icon="☁️" label="Cloud save" sub={!cloudConfigured ? 'Offline: saved in this browser' : getCloud().email ? `Signed in as ${getCloud().email}` : 'Sign in to save across devices'} onClick={() => setPage('cloud')} />
              <MenuButton icon="⚙️" label="Options" sub="Speed, cinematic, graphics, reset" onClick={() => setPage('options')} />
            </div>

            {recent.length > 0 && (
              <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-white/50">Latest achievements</div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((a) => (
                    <span key={a.id} className="chip inline-flex items-center gap-1 text-xs" style={{ border: `1px solid ${TIER_COLOR[a.tier]}88` }}>
                      {a.icon} {a.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-6 text-[11px] text-white/40">
              {profile.stats.launches} colonies launched · {Object.values(profile.stats.nights).reduce((a, b) => a + b, 0)} lunar nights survived
            </p>
          </div>
        </div>
      </div>

      {/* ---- Sub-page: slides in from the right ---- */}
      <div
        className="absolute inset-0 overflow-y-auto bg-[#02040a]/80 backdrop-blur-sm transition-all ease-in-out"
        style={{ transitionDuration: `${SLIDE_MS}ms`, transform: page ? 'translateX(0)' : 'translateX(105%)', opacity: page ? 1 : 0 }}
        aria-hidden={!page}
      >
        {shown && (
          <div className="mx-auto w-full max-w-5xl p-4 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button className="btn btn-gray px-4" onClick={() => setPage(null)} aria-label="Back to the menu">← Back</button>
              <div>
                <h2 className="title text-3xl leading-none">{PAGES[shown].title}</h2>
                <p className="text-xs text-white/55">{PAGES[shown].sub}</p>
              </div>
            </div>
            <div className="panel p-4 sm:p-5">
              {shown === 'options' && <OptionsPanel />}
              {shown === 'achievements' && <AchievementList profile={profile} />}
              {shown === 'library' && <LibraryContent />}
              {shown === 'cloud' && <CloudPanel />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
