import { useSyncExternalStore } from 'react';
import { TICK_SECONDS, type CargoKind } from './config/balance';
import type { BuildingType } from './config/buildings';
import type { TechId } from './config/techs';
import { createInitialState, type GameState } from './systems/state';
import { tick } from './systems/simulation';
import * as C from './systems/construction';
import { startResearch } from './systems/research';
import { launchCargo } from './systems/spaceport';
import { catchUp, clearSave, loadGame, saveGame, CHECKPOINT_KEY } from './systems/save';
import { checkPlacement } from './systems/selectors';
import { getTerrain } from './systems/terrain';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type DifficultyId } from './config/difficulty';
import { rebuildMap } from './bridge';
import { connect, disconnect } from './systems/monitoring';
import type { LinkKind } from './config/monitoring';
import { loadProfile, saveProfile, createProfile, type Profile, type Settings } from './systems/profile';
import { evaluateAchievements } from './config/achievements';
import { addLog } from './systems/state';
import { answerQuiz } from './systems/quiz';
import { resolveEvent } from './systems/events';
import { startClean, startRepair } from './systems/construction';
import { powerPriority } from './systems/power';

export type Panel = 'build' | 'research' | 'spaceport' | 'monitor' | null;

export interface UIState {
  placing: BuildingType | null;
  /** Set while an existing building is being moved (placing then holds its type). */
  moving: number | null;
  ghost: { x: number; y: number } | null;
  selectedId: number | null;
  panel: Panel;
  flash: { text: string; kind: 'error' | 'ok'; id: number } | null;
}

type Listener = () => void;

/** Which top-level screen is showing. The colony only runs on 'game'. */
export type Screen = 'title' | 'select' | 'launch' | 'game';

export interface LaunchTask { id: string; label: string; done: boolean }
export interface LaunchState {
  difficulty: DifficultyId;
  tasks: LaunchTask[];
  error: string | null;
  run: number;
}

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

class GameStore {
  state: GameState;
  ui: UIState = { placing: null, moving: null, ghost: null, selectedId: null, panel: null, flash: null };
  speed = 1;
  private lastSpeed = 1;
  version = 0;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private acc = 0;
  private sinceSave = 0;
  private flashId = 0;
  /** A saved colony continues straight away; a first visit starts at difficulty selection. */
  screen: Screen;
  pendingDifficulty: DifficultyId = DEFAULT_DIFFICULTY;
  mission: LaunchState | null = null;
  /** True when a saved colony exists that the player can continue. */
  hasColony: boolean;
  /** Where "Back" on the difficulty screen returns to. */
  private returnTo: 'title' | 'game' = 'title';
  /** Career profile: achievements, lifetime stats and settings (separate from the colony save). */
  profile: Profile = loadProfile();
  private track = { nights: 0, failed: false, won: false };

  constructor() {
    const loaded = loadGame();
    this.state = loaded ?? createInitialState();
    if (loaded) catchUp(this.state);
    this.hasColony = !!loaded;
    // Every visit starts on the title screen.
    this.screen = 'title';
    this.resetTracking();
    this.pendingDifficulty = this.state.difficulty;
    // Prime derived values so the first frame shows real numbers.
    tick(this.state, 0.001);
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getVersion = () => this.version;

  emit() {
    this.version++;
    for (const l of this.listeners) l();
  }

  start() {
    if (this.timer) return;
    this.last = performance.now();
    this.timer = setInterval(() => this.loop(), 100);
    window.addEventListener('beforeunload', this.persist);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener('beforeunload', this.persist);
  }

  private loop() {
    const now = performance.now();
    // Cap long gaps (background tab) so the colony isn't destroyed while hidden.
    const real = Math.min(5, (now - this.last) / 1000);
    this.last = now;
    // The colony waits while the player reads a briefing or a result screen.
    // Also waits while the commander decides how to respond to an event.
    if (this.screen !== 'game' || this.state.failed || this.state.won || this.state.scienceQueue.length > 0 || this.state.station.pending) return;
    this.acc += real * this.speed;
    let steps = 0;
    const cycleBefore = this.state.cycle.index;
    while (this.acc >= TICK_SECONDS && steps < 200) {
      tick(this.state, TICK_SECONDS);
      this.acc -= TICK_SECONDS;
      steps++;
    }
    if (this.state.cycle.index !== cycleBefore) saveGame(this.state, CHECKPOINT_KEY);
    // Save a failure right away so a page reload can't undo it.
    if (this.state.failed) this.persist();
    this.sinceSave += real;
    if (this.sinceSave >= 10) this.persist();
    if (steps > 0) {
      this.trackProgress();
      this.emit();
    }
  }

  private resetTracking() {
    this.track = { nights: this.state.stats.nightsSurvived, failed: !!this.state.failed, won: this.state.won };
  }

  /** Update career stats from what just happened in the colony and unlock achievements. */
  private trackProgress() {
    const s = this.state;
    const p = this.profile;
    let changed = false;
    if (s.stats.nightsSurvived > this.track.nights) {
      p.stats.nights[s.difficulty] += s.stats.nightsSurvived - this.track.nights;
      this.track.nights = s.stats.nightsSurvived;
      changed = true;
    }
    if (s.failed && !this.track.failed) {
      p.stats.failures++;
      changed = true;
    }
    this.track.failed = !!s.failed;
    if (s.won && !this.track.won) {
      p.stats.wins[s.difficulty]++;
      changed = true;
    }
    this.track.won = s.won;
    for (const a of evaluateAchievements(s, p)) {
      addLog(s, `🏅 Achievement unlocked: ${a.name}`, 'good');
      changed = true;
    }
    if (changed) saveProfile(p);
  }

  persist = () => {
    this.sinceSave = 0;
    // Never save the placeholder colony shown behind the difficulty / launch screens.
    if (this.screen !== 'game') return;
    saveGame(this.state);
  };

  private report(r: C.Result, okText?: string) {
    if (!r.ok) this.flash(r.reason, 'error');
    else if (okText) this.flash(okText, 'ok');
    this.emit();
    return r;
  }

  flash(text: string, kind: 'error' | 'ok' = 'error') {
    this.ui.flash = { text, kind, id: ++this.flashId };
    this.emit();
  }

  // ---------- UI intents ----------
  setPanel(panel: Panel) {
    this.ui.panel = this.ui.panel === panel ? null : panel;
    if (panel) this.ui.selectedId = null;
    this.emit();
  }

  select(id: number | null) {
    this.ui.selectedId = id;
    if (id !== null) this.ui.panel = null;
    this.emit();
  }

  beginPlacement(type: BuildingType) {
    const can = C.canStartBuild(this.state, type);
    if (!can.ok) return this.report(can);
    this.ui = { ...this.ui, placing: type, moving: null, ghost: null, panel: null, selectedId: null };
    this.emit();
    return can;
  }

  /** Pick up an existing building; the same green/red ghost then shows where it can go. */
  beginMove(id: number) {
    const can = C.canMove(this.state, id);
    if (!can.ok) return this.report(can);
    const b = this.state.buildings.find((x) => x.id === id)!;
    this.ui = { ...this.ui, placing: b.type, moving: id, ghost: { x: b.x, y: b.y }, panel: null, selectedId: null };
    this.emit();
    return can;
  }

  setGhost(x: number, y: number) {
    if (!this.ui.placing) return;
    this.ui.ghost = { x, y };
    this.emit();
  }

  cancelPlacement() {
    const moved = this.ui.moving;
    this.ui.placing = null;
    this.ui.moving = null;
    this.ui.ghost = null;
    if (moved !== null) this.ui.selectedId = moved;
    this.emit();
  }

  ghostCheck() {
    const { placing, ghost } = this.ui;
    if (!placing || !ghost) return null;
    return checkPlacement(this.state, placing, ghost.x, ghost.y, this.ui.moving ?? undefined);
  }

  confirmPlacement() {
    const { placing, ghost, moving } = this.ui;
    if (!placing || !ghost) return;
    if (moving !== null) {
      const cur = this.state.buildings.find((b) => b.id === moving);
      // Dropped back on its own spot: nothing to do.
      if (cur && cur.x === ghost.x && cur.y === ghost.y) return this.cancelPlacement();
      const r = C.moveBuilding(this.state, moving, ghost.x, ghost.y);
      if (r.ok) {
        this.ui = { ...this.ui, placing: null, moving: null, ghost: null, selectedId: moving };
        this.persist();
      }
      return this.report(r, r.ok ? 'Building moved' : undefined);
    }
    const r = C.startBuild(this.state, placing, ghost.x, ghost.y);
    if (r.ok) {
      this.ui.placing = null;
      this.ui.ghost = null;
      this.persist();
    }
    return this.report(r);
  }

  // ---------- Game actions ----------
  upgrade(id: number) {
    const r = C.startUpgrade(this.state, id);
    if (r.ok) this.persist();
    return this.report(r);
  }
  shield(id: number) {
    const r = C.startShield(this.state, id);
    if (r.ok) this.persist();
    return this.report(r);
  }
  toggle(id: number) {
    return this.report(C.toggleEnabled(this.state, id));
  }
  setSplit(id: number, v: number) {
    return this.report(C.setSplit(this.state, id, v));
  }
  buyBuilder() {
    const r = C.buyBuilder(this.state);
    if (r.ok) this.persist();
    return this.report(r, 'New builder robot hired!');
  }
  research(id: TechId) {
    const r = startResearch(this.state, id);
    if (r.ok) this.persist();
    return this.report(r);
  }
  connectLink(id: number, kind: LinkKind) {
    const r = connect(this.state, id, kind);
    if (r.ok) this.persist();
    return this.report(r);
  }
  disconnectLink(id: number) {
    const r = disconnect(this.state, id);
    if (r.ok) this.persist();
    return this.report(r);
  }
  launch(kind: CargoKind) {
    const r = launchCargo(this.state, kind);
    if (r.ok) this.persist();
    return this.report(r);
  }
  dismissScience() {
    const id = this.state.scienceQueue.shift();
    // Quiz cards are tracked in state.quiz; closing one unanswered counts as skipped.
    if (id?.startsWith('quiz:')) {
      if (!this.state.quiz.answered.includes(id.slice(5))) this.state.quiz.answered.push(id.slice(5));
    } else if (id && !this.state.scienceSeen.includes(id)) this.state.scienceSeen.push(id);
    this.persist();
    this.emit();
  }
  setSpeed(v: number) {
    if (v > 0) this.lastSpeed = v;
    this.speed = v;
    this.emit();
  }
  togglePause() {
    this.setSpeed(this.speed === 0 ? this.lastSpeed : 0);
  }
  /** Divisor that turns colony hours into real seconds for countdowns (1× while paused). */
  get timeScale() {
    return this.speed > 0 ? this.speed : 1;
  }
  // ---------- New game: difficulty selection → launch sequence → game ----------
  /** Show the difficulty selection screen (from the menu, a failed mission, or first visit). */
  openNewGame() {
    this.returnTo = this.screen === 'game' && !this.state.failed ? 'game' : 'title';
    this.pendingDifficulty = this.state.difficulty;
    this.screen = 'select';
    this.ui = { placing: null, moving: null, ghost: null, selectedId: null, panel: null, flash: null };
    this.emit();
  }
  /** Leave the selection screen without starting over. */
  cancelNewGame() {
    this.screen = this.returnTo;
    this.emit();
  }
  chooseDifficulty(d: DifficultyId) {
    this.pendingDifficulty = d;
    this.emit();
  }
  /**
   * Start the launch sequence. The cinematic shows these real initialisation
   * steps; it only finishes once every one of them is done.
   */
  async startLaunch() {
    const difficulty = this.pendingDifficulty;
    const run = (this.mission?.run ?? 0) + 1;
    const d = DIFFICULTIES[difficulty];
    this.mission = {
      difficulty, run, error: null,
      tasks: [
        { id: 'terrain', label: `Surveying terrain · ${d.deposits.ice} ice / ${d.deposits.ore} ore deposits`, done: false },
        { id: 'systems', label: `Calibrating power & ${Math.round(d.dayFraction * 100)}/${Math.round((1 - d.dayFraction) * 100)} day–night cycle`, done: false },
        { id: 'map', label: 'Rendering landing zone', done: false },
        { id: 'save', label: 'Writing mission log', done: false },
      ],
    };
    this.screen = 'launch';
    this.ui = { placing: null, moving: null, ghost: null, selectedId: null, panel: null, flash: null };
    this.emit();
    const L = this.mission;
    const done = (id: string) => {
      if (this.mission !== L) return;
      L.tasks.find((t) => t.id === id)!.done = true;
      this.emit();
    };
    try {
      await nextFrame();
      const fresh = createInitialState(undefined, difficulty);
      getTerrain(fresh.seed, fresh.difficulty); // generate deposits for this difficulty
      done('terrain');
      await nextFrame();
      tick(fresh, 0.001); // power, life support and the day–night cycle compute their first values
      if (!this.profile.settings.briefing) fresh.scienceQueue = fresh.scienceQueue.filter((x) => x !== 'intro');
      this.state = fresh;
      this.speed = this.profile.settings.defaultSpeed;
      this.resetTracking();
      done('systems');
      await rebuildMap(); // resolves only after the map has drawn its first frame
      done('map');
      clearSave();
      saveGame(this.state);
      saveGame(this.state, CHECKPOINT_KEY);
      this.profile.stats.launches++;
      saveProfile(this.profile);
      done('save');
    } catch (e) {
      if (this.mission === L) {
        L.error = e instanceof Error ? e.message : String(e);
        this.emit();
      }
    }
  }
  /** Give up on a failed launch and return to difficulty selection (difficulty choice is kept). */
  abortLaunch() {
    if (this.mission) this.pendingDifficulty = this.mission.difficulty;
    this.mission = null;
    this.screen = 'select';
    this.emit();
  }
  get launchReady() {
    return !!this.mission && !this.mission.error && this.mission.tasks.every((t) => t.done);
  }
  /** Called by the cinematic when its final fade completes. Hands control to the player. */
  finishLaunch() {
    if (!this.launchReady) return;
    this.screen = 'game';
    this.hasColony = true;
    this.last = performance.now();
    this.acc = 0;
    this.emit();
  }
  loadCheckpoint() {
    const cp = loadGame(CHECKPOINT_KEY);
    if (!cp) return this.openNewGame();
    this.state = cp;
    this.state.failed = null;
    this.profile.stats.retries++;
    this.resetTracking();
    saveProfile(this.profile);
    tick(this.state, 0.001);
    this.ui = { placing: null, moving: null, ghost: null, selectedId: null, panel: null, flash: null };
    this.persist();
    this.emit();
  }
  // ---------- Title screen, options, achievements ----------
  /** Title screen "Play": continue the saved colony, or start a new one. */
  play() {
    if (!this.hasColony) return this.openNewGame();
    this.screen = 'game';
    this.speed = this.profile.settings.defaultSpeed;
    this.last = performance.now();
    this.acc = 0;
    this.resetTracking();
    this.emit();
  }
  /** Save and return to the title screen. */
  goToTitle() {
    this.persist();
    this.hasColony = true;
    this.screen = 'title';
    this.ui = { placing: null, moving: null, ghost: null, selectedId: null, panel: null, flash: null };
    this.emit();
  }
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    this.profile.settings[key] = value;
    saveProfile(this.profile);
    // Graphics quality applies to the map, so rebuild it with the new setting.
    if (key === 'graphics') rebuildMap().catch(() => undefined);
    this.emit();
  }
  /** Clear achievements and career stats (settings are kept). */
  resetAchievements() {
    const fresh = createProfile();
    this.profile = { ...fresh, settings: this.profile.settings };
    this.state.achievements = [];
    saveProfile(this.profile);
    this.resetTracking();
    this.emit();
  }
  /** Delete the saved colony (achievements are kept). */
  deleteColony() {
    clearSave();
    this.state = createInitialState();
    tick(this.state, 0.001);
    this.hasColony = false;
    // The colony is gone, so leave the game screen.
    if (this.screen === 'game') {
      this.screen = 'title';
      this.ui = { placing: null, moving: null, ghost: null, selectedId: null, panel: null, flash: null };
    }
    this.resetTracking();
    rebuildMap().catch(() => undefined);
    this.emit();
  }
  /** Answer the mission quiz on screen; the card then shows the explanation until dismissed. */
  answerQuiz(id: string, choice: number) {
    const r = answerQuiz(this.state, id, choice);
    if (r.correct) {
      this.profile.stats.quizCorrect++;
      this.trackProgress();
      saveProfile(this.profile);
    }
    this.persist();
    this.emit();
    return r;
  }
  // ---------- Mission Control actions ----------
  /** Apply the commander's decision for the pending event. */
  decideEvent(choiceId: string) {
    const r = resolveEvent(this.state, choiceId);
    if (!r.ok) this.flash(r.outcome);
    else {
      this.trackProgress();
      this.persist();
    }
    this.emit();
    return r;
  }
  toggleEmergency() {
    const st = this.state.station;
    st.emergency = !st.emergency;
    addLog(this.state, st.emergency ? '⚠ Emergency power-saving mode ON: only life support is powered.' : 'Emergency power-saving mode off.', st.emergency ? 'warn' : 'info');
    this.persist();
    this.emit();
  }
  /** Raise (+1) or lower (−1) a building's power priority. */
  shiftPriority(id: number, delta: number) {
    const b = this.state.buildings.find((x) => x.id === id);
    if (!b) return;
    b.priority = Math.max(0, Math.min(12, powerPriority(b) + delta));
    this.emit();
  }
  resetPriority(id: number) {
    const b = this.state.buildings.find((x) => x.id === id);
    if (b) delete b.priority;
    this.emit();
  }
  repair(id: number) {
    const r = startRepair(this.state, id);
    if (r.ok) this.persist();
    return this.report(r);
  }
  clean(id: number) {
    const r = startClean(this.state, id);
    if (r.ok) this.persist();
    return this.report(r);
  }
  /** Reload colony and career from this browser's storage (after a cloud download). */
  reloadFromStorage() {
    const loaded = loadGame();
    this.state = loaded ?? createInitialState();
    this.profile = loadProfile();
    this.hasColony = !!loaded;
    this.pendingDifficulty = this.state.difficulty;
    tick(this.state, 0.001);
    this.resetTracking();
    this.ui = { placing: null, moving: null, ghost: null, selectedId: null, panel: null, flash: null };
    rebuildMap().catch(() => undefined);
    this.flash('Cloud save loaded', 'ok');
    this.emit();
  }
  dismissWin() {
    this.state.won = false;
    this.emit();
  }
}

export const store = new GameStore();

/** React hook: re-renders on every store change and returns the live state. */
export function useGame() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return { s: store.state, ui: store.ui, speed: store.speed, screen: store.screen, profile: store.profile };
}
