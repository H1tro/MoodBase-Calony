import { useEffect } from 'react';
import GameCanvas from './game/GameCanvas';
import { store } from './game/store';
import TopBar from './components/TopBar';
import SidePanel from './components/SidePanel';
import MissionsPanel from './components/MissionsPanel';
import BottomBar from './components/BottomBar';
import BuildMenu from './components/BuildMenu';
import BuildingInfo from './components/BuildingInfo';
import { PlacementControls, ResearchPanel, SpaceportPanel } from './components/ActionPanels';
import { Modals, Toasts } from './components/Overlays';
import DifficultySelect from './components/DifficultySelect';
import LaunchSequence from './components/LaunchSequence';
import MissionControl from './components/MissionControl';
import EventModal from './components/EventModal';
import ReportModal from './components/ReportModal';
import Library from './components/Library';
import { loadSpaceWeather } from './game/nasa';
import { initCloud, subscribeCloud } from './game/cloud';
import TitleScreen from './components/TitleScreen';
import { useGame } from './game/store';

/** Desktop keyboard shortcuts. Camera keys (WASD/arrows/Q/E) live in the Phaser scene. */
function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // No game shortcuts on the difficulty screen or during the launch sequence.
  if (store.screen !== 'game') return;
  const s = store.state;
  const modal = s.failed || s.won || s.scienceQueue.length > 0;
  const ui = store.ui;
  if (e.key === 'Escape') {
    if (ui.placing) store.cancelPlacement();
    else if (ui.panel) store.setPanel(null);
    else store.select(null);
    return;
  }
  if (modal) return;
  switch (e.key.toLowerCase()) {
    case 'enter':
      if (ui.placing && ui.ghost) store.confirmPlacement();
      break;
    case ' ':
      e.preventDefault();
      store.togglePause();
      break;
    case 'b':
      if (!ui.placing) store.setPanel('build');
      break;
    case 'r':
      if (!ui.placing) store.setPanel('research');
      break;
    case 't':
      if (!ui.placing) store.setPanel('spaceport');
      break;
    case 'm':
      if (!ui.placing) store.setPanel('monitor');
      break;
    case 'g':
      if (ui.placing) break;
      if (ui.selectedId !== null) store.beginMove(ui.selectedId);
      else store.flash('Select a building first, then press G to move it.', 'ok');
      break;
    case 'l':
      window.dispatchEvent(new Event('open-library'));
      break;
    case 'u':
      if (ui.selectedId !== null) store.upgrade(ui.selectedId);
      else store.flash('Select a building first, then press U to upgrade it.', 'ok');
      break;
    case '1':
      store.setSpeed(1);
      break;
    case '2':
      store.setSpeed(2);
      break;
    case '3':
      store.setSpeed(4);
      break;
  }
}

export default function App() {
  const { screen, profile } = useGame();
  useEffect(() => {
    store.start();
    // Real NASA space weather (live → cached → bundled snapshot → simulated).
    loadSpaceWeather().then(() => store.emit());
    // Cloud saves (Supabase): only active when configured and the player is signed in.
    const unsubCloud = subscribeCloud(() => store.emit());
    void initCloud(() => store.reloadFromStorage());
    window.addEventListener('keydown', onKey);
    return () => {
      store.stop();
      unsubCloud();
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden">
      <GameCanvas />
      {/* Soft vignette: the eye is drawn to the base, the edges fall into darkness like a lunar horizon */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.6)_100%)]" />
      {screen === 'game' && (
      <div className="pointer-events-none absolute inset-0">
        <TopBar />
        <MissionsPanel />
        <SidePanel />
        <BottomBar />
        <BuildMenu />
        <BuildingInfo />
        <ResearchPanel />
        <SpaceportPanel />
        <MissionControl />
        <PlacementControls />
        <Toasts />
        <Modals />
        <EventModal />
        <p className={`absolute bottom-1 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[11px] text-white/45 ${profile.settings.keyHints ? 'xl:block' : ''}`}>
          <b>WASD</b> move · <b>Wheel/Q E</b> zoom · <b>B</b> build · <b>U</b> upgrade · <b>R</b> research · <b>T</b> trade · <b>M</b> Mission Control · <b>L</b> library · <b>Space</b> pause · <b>Esc / right-click</b> cancel
        </p>
      </div>
      )}
      <TitleScreen />
      <ReportModal />
      <Library />
      <DifficultySelect />
      <LaunchSequence />
    </main>
  );
}
