import type { Cost } from './buildings';
import type { GameState } from '../systems/state';
import { active, commandLevel } from '../systems/selectors';

export interface Objective {
  id: string;
  text: string;
  hint: string;
  check: (s: GameState) => boolean;
  progress?: (s: GameState) => [number, number];
  reward: Cost;
  science?: string;
}

export interface Chapter {
  id: number;
  title: string;
  intro: string;
  objectives: Objective[];
}

const has = (s: GameState, t: Parameters<typeof active>[1]) => active(s, t).length > 0;

export const CHAPTERS: Chapter[] = [
  {
    id: 1, title: 'First Landing',
    intro: 'Your lander is down. Get power flowing and keep the crew breathing.',
    objectives: [
      { id: 'c1_solar', text: 'Build a Solar Farm', hint: 'Build → Solar Farm. Power comes first.', check: (s) => has(s, 'solar'), reward: { credits: 100 } },
      { id: 'c1_mine', text: 'Build a Regolith Mine', hint: 'Ore-rich (rusty) ground gives +50% output.', check: (s) => has(s, 'mine'), reward: { credits: 100, regolith: 100 }, science: 'regolith' },
      { id: 'c1_habitat', text: 'Build a Habitat', hint: 'More beds = more crew.', check: (s) => has(s, 'habitat'), reward: { credits: 150 } },
      {
        id: 'c1_oxygen', text: 'Supply the habitat with oxygen', hint: 'Build an Ice Extractor on blue ice, then an Oxygen Generator.',
        check: (s) => has(s, 'habitat') && active(s, 'ice').some((b) => b.online) && active(s, 'oxygen').some((b) => b.online && b.split > 0),
        reward: { credits: 200 }, science: 'electrolysis',
      },
    ],
  },
  {
    id: 2, title: 'Lunar Industry',
    intro: 'One robot cannot build a city. Expand your workforce and start refining titanium.',
    objectives: [
      { id: 'c2_station', text: 'Build a Builder Station', hint: 'It houses extra builder robots.', check: (s) => has(s, 'builderStation'), reward: { credits: 150 } },
      { id: 'c2_builder', text: 'Hire a 2nd builder robot', hint: 'Use the builder panel on the right (500 ₡).', check: (s) => s.builders >= 2, reward: { regolith: 200 } },
      { id: 'c2_cc2', text: 'Upgrade the Command Center to level 2', hint: 'Select the Command Center → Upgrade.', check: (s) => commandLevel(s) >= 2, reward: { credits: 200 } },
      { id: 'c2_refinery', text: 'Build a Titanium Refinery', hint: 'Unlocked at Command Center level 2.', check: (s) => has(s, 'refinery'), reward: { credits: 150 }, science: 'titanium' },
      { id: 'c2_storage', text: 'Build a Resource Storage', hint: 'Raises material limits.', check: (s) => has(s, 'storage'), reward: { credits: 150 } },
      {
        id: 'c2_ti', text: 'Stockpile 100 kg of titanium', hint: 'Keep the refinery powered in daylight.',
        check: (s) => s.res.titanium >= 100, progress: (s) => [Math.floor(s.res.titanium), 100], reward: { credits: 250 },
      },
    ],
  },
  {
    id: 3, title: 'Energy Crisis',
    intro: 'Night lasts a long time. Store energy, protect the crew, and keep life support running.',
    objectives: [
      { id: 'c3_battery', text: 'Store 1,000 kWh of energy', hint: 'Build or upgrade Battery Stations, charge them in daylight.', check: (s) => s.battery >= 1000, progress: (s) => [Math.floor(s.battery), 1000], reward: { credits: 200 } },
      { id: 'c3_night', text: 'Survive a lunar night', hint: 'Make it to sunrise with the crew alive.', check: (s) => s.stats.nightsSurvived >= 1, reward: { credits: 300 }, science: 'temperature' },
      { id: 'c3_clean', text: 'Get through a night with no life-support outage', hint: 'Switch off mines at night to save power for habitats.', check: (s) => s.stats.cleanNights >= 1, reward: { credits: 300 }, science: 'solarPoles' },
      { id: 'c3_shield', text: 'Shield a habitat to level 2', hint: 'Select a habitat → Add shielding.', check: (s) => active(s, 'habitat').some((h) => h.shield >= 2), reward: { credits: 300 }, science: 'doseLimit' },
    ],
  },
  {
    id: 4, title: 'Space Economy',
    intro: 'Turn lunar materials into credits by launching cargo.',
    objectives: [
      { id: 'c4_cc3', text: 'Upgrade the Command Center to level 3', hint: 'Needs titanium.', check: (s) => commandLevel(s) >= 3, reward: { credits: 300 } },
      { id: 'c4_lab', text: 'Research a technology', hint: 'Build a Research Lab, then open Research.', check: (s) => s.research.owned.length >= 1, reward: { credits: 200 } },
      { id: 'c4_port', text: 'Build the Spaceport', hint: 'Unlocked at Command Center level 3.', check: (s) => has(s, 'spaceport'), reward: { credits: 300 }, science: 'gravity' },
      { id: 'c4_runs', text: 'Complete 3 cargo runs', hint: 'Open the Spaceport panel.', check: (s) => s.cargo.runs >= 3, progress: (s) => [s.cargo.runs, 3], reward: { credits: 400 } },
      { id: 'c4_earn', text: 'Earn 1,000 ₡ from cargo', hint: 'Titanium pays best.', check: (s) => s.stats.cargoCredits >= 1000, progress: (s) => [s.stats.cargoCredits, 1000], reward: { titanium: 100 } },
    ],
  },
  {
    id: 5, title: 'Lunar Metropolis',
    intro: 'Build a colony that can sustain itself without help from Earth.',
    objectives: [
      { id: 'c5_cc5', text: 'Upgrade the Command Center to level 5', hint: 'The ultimate upgrade.', check: (s) => commandLevel(s) >= 5, progress: (s) => [commandLevel(s), 5], reward: { credits: 500 } },
      { id: 'c5_crew', text: 'House 8 astronauts', hint: 'Build and upgrade habitats; keep supplies up.', check: (s) => s.crew.count >= 8, progress: (s) => [s.crew.count, 8], reward: { credits: 500 }, science: 'oxygenNeed' },
      { id: 'c5_tech', text: 'Research 4 technologies', hint: 'Upgrade the Lab for higher tiers.', check: (s) => s.research.owned.length >= 4, progress: (s) => [s.research.owned.length, 4], reward: { credits: 500 } },
      { id: 'c5_self', text: 'Be self-sufficient for a full day–night cycle', hint: 'O₂, water and food must not drop over a whole cycle.', check: (s) => s.stats.selfSufficientCycles >= 1 && s.crew.count >= 4, reward: { credits: 1000 } },
    ],
  },
];
