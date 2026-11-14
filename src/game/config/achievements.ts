import type { GameState } from '../systems/state';
import type { Profile } from '../systems/profile';
import { DIFFICULTY_ORDER } from './difficulty';
import { DAY_NIGHT } from './balance';
import { active, commandLevel, isDay } from '../systems/selectors';
import { networkStatus, opsCenter } from '../systems/monitoring';
import { TECHS } from './techs';
import { CHAPTERS } from './chapters';
import { SCIENCE } from './science';

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type Category = 'First steps' | 'Engineering' | 'Survival' | 'Science' | 'Economy' | 'Mastery';

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  category: Category;
  tier: Tier;
  /** Hidden until unlocked. */
  secret?: boolean;
  /** Evaluated against the current colony and the career profile. */
  check: (s: GameState, p: Profile) => boolean;
}

export const TIER_COLOR: Record<Tier, string> = { bronze: '#cd7f32', silver: '#c9d3e6', gold: '#ffc93c', platinum: '#7fe3ff' };

const count = (s: GameState, type: Parameters<typeof active>[1]) => active(s, type).length;
const stormNow = (s: GameState) => !!s.flare && s.time >= s.flare.start && s.time < s.flare.end;

export const ACHIEVEMENTS: Achievement[] = [
  // ---- First steps ----
  { id: 'groundbreaker', name: 'Groundbreaker', icon: '🏗️', category: 'First steps', tier: 'bronze', desc: 'Finish your first building.', check: (s) => s.stats.buildingsBuilt >= 1 },
  { id: 'firstBreath', name: 'First Breath', icon: '🫧', category: 'First steps', tier: 'bronze', desc: 'Make oxygen from lunar ice.', check: (s) => active(s, 'oxygen').some((b) => b.online && b.split > 0) && s.flows.o2 > 0 },
  { id: 'firstLunarDay', name: 'First Lunar Day', icon: '🌅', category: 'First steps', tier: 'bronze', desc: 'Complete the first 24 hours of a mission.', check: (s) => s.time - (DAY_NIGHT.ramp + 2) >= 24 },
  { id: 'greenhouse', name: 'Greenhouse Operator', icon: '🌱', category: 'First steps', tier: 'bronze', desc: 'Grow 20 kg of food in greenhouses.', check: (s) => s.totals.foodGrown >= 20 },
  { id: 'robotCrew', name: 'Robot Crew', icon: '🤖', category: 'First steps', tier: 'bronze', desc: 'Hire an extra builder robot.', check: (s) => s.stats.buildersBought >= 1 },
  { id: 'export', name: 'First Export', icon: '🚀', category: 'First steps', tier: 'bronze', desc: 'Complete a cargo run from the Spaceport.', check: (s) => s.cargo.runs >= 1 },
  { id: 'firstContact', name: 'First Contact', icon: '📡', category: 'First steps', tier: 'bronze', desc: 'Get data from a Monitoring Station.', check: (s) => networkStatus(s).some((n) => n.active) },

  // ---- Engineering ----
  { id: 'solarField', name: 'Solar Field', icon: '☀️', category: 'Engineering', tier: 'silver', desc: 'Run 6 Solar Farms at once.', check: (s) => count(s, 'solar') >= 6 },
  { id: 'energyManager', name: 'Energy Manager', icon: '⚖️', category: 'Engineering', tier: 'gold', desc: 'Get through a full day–night cycle without any building losing power.', check: (s) => s.stats.energyCycles >= 1 },
  { id: 'powerHoarder', name: 'Power Hoarder', icon: '🔋', category: 'Engineering', tier: 'silver', desc: 'Store 3,000 kWh in your batteries.', check: (s) => s.battery >= 3000 },
  { id: 'bunker', name: 'Bunker', icon: '🛡️', category: 'Engineering', tier: 'silver', desc: 'Shield a habitat to level 3 with regolith.', check: (s) => s.buildings.some((b) => b.shield >= 3) },
  { id: 'maxed', name: 'Maxed Out', icon: '⭐', category: 'Engineering', tier: 'gold', desc: 'Upgrade any building to level 5.', check: (s) => s.stats.maxLevel >= 5 },
  { id: 'command', name: 'Planetary Command', icon: '🛰', category: 'Engineering', tier: 'gold', desc: 'Operations Center at level 4 with all 4 stations transmitting.', check: (s) => (opsCenter(s)?.level ?? 0) >= 4 && networkStatus(s).filter((n) => n.active).length >= 4 },

  // ---- Survival ----
  { id: 'nightOwl', name: 'Night Owl', icon: '🌑', category: 'Survival', tier: 'bronze', desc: 'Survive a lunar night.', check: (s) => s.stats.nightsSurvived >= 1 },
  { id: 'lightsOn', name: 'Lights On', icon: '💡', category: 'Survival', tier: 'silver', desc: 'Get through a night with no life-support outage.', check: (s) => s.stats.cleanNights >= 1 },
  { id: 'storm', name: 'Storm Survivor', icon: '☢️', category: 'Survival', tier: 'silver', desc: 'Survive a solar flare.', check: (s) => s.stats.flaresSurvived >= 1 },
  { id: 'radiationAware', name: 'Radiation Awareness', icon: '🛡', category: 'Survival', tier: 'silver', desc: 'Shelter the crew when a solar particle storm is coming.', check: (s) => s.stats.shelterChoices >= 1 },
  { id: 'waterWise', name: 'Water Conservation', icon: '💧', category: 'Survival', tier: 'silver', desc: 'Recycle 100 L of crew water without the tanks ever running dry.', check: (s) => s.totals.waterRecycled >= 100 && !s.cycle.stockDipped },
  { id: 'crisis', name: 'Crisis Manager', icon: '🚨', category: 'Survival', tier: 'gold', desc: 'Make decisions on 5 station emergencies.', check: (s) => s.stats.eventsResolved >= 5 },
  { id: 'hardwired', name: 'Hardwired', icon: '🔌', category: 'Survival', tier: 'silver', desc: 'Keep a cabled station transmitting through a solar storm.', check: (s) => stormNow(s) && networkStatus(s).some((n) => n.active && n.station.link === 'wired') },
  { id: 'selfSufficient', name: 'Off the Grid', icon: '♻️', category: 'Survival', tier: 'gold', desc: 'Keep O₂, water and food steady for a whole day–night cycle.', check: (s) => s.stats.selfSufficientCycles >= 1 },
  { id: 'secondChance', name: 'Second Chance', icon: '↺', category: 'Survival', tier: 'bronze', secret: true, desc: 'Retry a failed mission from the last sunrise.', check: (_s, p) => p.stats.retries >= 1 },

  // ---- Science ----
  { id: 'curious', name: 'Curious Mind', icon: '🔭', category: 'Science', tier: 'silver', desc: 'Read 6 science cards.', check: (s) => s.scienceSeen.filter((x) => x !== 'intro').length >= 6 },
  { id: 'coldTrap', name: 'Cold Trap', icon: '🥶', category: 'Science', tier: 'silver', desc: 'Measure a temperature below −200 °C (a station near ice, at night).', check: (s) => Object.values(s.monitoring.samples).some((list) => list.some((x) => x.ok && x.temp < -200)) },
  { id: 'quizWhiz', name: 'Quiz Whiz', icon: '🧠', category: 'Science', tier: 'silver', desc: 'Answer 10 Mission Control quiz questions correctly (across all colonies).', check: (_s, p) => p.stats.quizCorrect >= 10 },
  { id: 'bookworm', name: 'Lunar Librarian', icon: '📚', category: 'Science', tier: 'gold', desc: 'Discover every science card in the Lunar Library.', check: (s) => Object.keys(SCIENCE).every((id) => s.scienceSeen.includes(id)) },
  { id: 'scholar', name: 'Know-It-All', icon: '🎓', category: 'Science', tier: 'gold', desc: 'Research every technology.', check: (s) => s.research.owned.length >= TECHS.length },

  // ---- Economy ----
  { id: 'iceMiner', name: 'Ice Miner', icon: '🧊', category: 'Economy', tier: 'bronze', desc: 'Stockpile 500 kg of ice.', check: (s) => s.res.ice >= 500 },
  { id: 'titaniumAge', name: 'Titanium Age', icon: '🔩', category: 'Economy', tier: 'silver', desc: 'Stockpile 300 kg of titanium.', check: (s) => s.res.titanium >= 300 },
  { id: 'trader', name: 'Space Trader', icon: '💰', category: 'Economy', tier: 'gold', desc: 'Earn 5,000 ₡ in one colony.', check: (s) => s.stats.creditsEarned >= 5000 },
  { id: 'fullHouse', name: 'Full House', icon: '👩‍🚀', category: 'Economy', tier: 'gold', desc: 'House 8 astronauts.', check: (s) => s.crew.count >= 8 },

  // ---- Mastery (career-wide) ----
  { id: 'fastTrack', name: 'Fast Track', icon: '⚡', category: 'Mastery', tier: 'gold', desc: 'Reach Command Center level 2 before the first sunset.', check: (s) => commandLevel(s) >= 2 && s.cycle.index === 0 && isDay(s) && s.stats.nightsSurvived === 0 },
  { id: 'veteran', name: 'Veteran Commander', icon: '🎖️', category: 'Mastery', tier: 'silver', desc: 'Launch 5 colonies.', check: (_s, p) => p.stats.launches >= 5 },
  { id: 'metropolis', name: 'Lunar Metropolis', icon: '🏆', category: 'Mastery', tier: 'gold', desc: 'Complete all five story chapters.', check: (s) => CHAPTERS.every((c) => c.objectives.every((o) => s.missionsDone.includes(o.id))) },
  { id: 'commander', name: 'Mission Commander', icon: '🧑‍🚀', category: 'Mastery', tier: 'platinum', desc: 'Complete a full mission (all chapters) with the crew above 70% health.', check: (s) => CHAPTERS.every((c) => c.objectives.every((o) => s.missionsDone.includes(o.id))) && s.crew.health >= 70 },
  { id: 'allRounder', name: 'All-Rounder', icon: '🌗', category: 'Mastery', tier: 'platinum', desc: 'Survive a lunar night on every difficulty.', check: (_s, p) => DIFFICULTY_ORDER.every((d) => p.stats.nights[d] >= 1) },
  { id: 'impossible', name: 'Impossible Is Nothing', icon: '🔥', category: 'Mastery', tier: 'platinum', desc: 'Complete the story on Impossible.', check: (s, p) => (s.won && s.difficulty === 'impossible') || p.stats.wins.impossible >= 1 },
];

export const CATEGORIES: Category[] = ['First steps', 'Engineering', 'Survival', 'Science', 'Economy', 'Mastery'];

/** Check every locked achievement; returns the ones unlocked by this call. */
export function evaluateAchievements(s: GameState, p: Profile): Achievement[] {
  const fresh: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (p.unlocked[a.id]) continue;
    let ok = false;
    try {
      ok = a.check(s, p);
    } catch {
      ok = false;
    }
    if (ok) {
      p.unlocked[a.id] = { at: Date.now(), difficulty: s.difficulty };
      if (!s.achievements.includes(a.id)) s.achievements.push(a.id);
      fresh.push(a);
    }
  }
  return fresh;
}
