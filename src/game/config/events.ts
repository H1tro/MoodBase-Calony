// Dynamic events. Each one changes real game variables, offers choices with
// different consequences, explains the real science, and is written to the
// mission history. Effect strengths and durations are GAME VALUES.
import { BUILDINGS } from './buildings';
import { MAINTENANCE } from './station';
import { addLog, type Effect, type GameState, type PendingEvent } from '../systems/state';
import { canAfford, freeBuilder, pay } from '../systems/selectors';
import { startClean, startRepair } from '../systems/construction';
import { getSpaceWeather, latestFlare } from '../systems/spaceWeather';
import { addDustEverywhere } from '../systems/environment';

export type Quality = 'good' | 'ok' | 'risky';

export interface EventChoice {
  id: string;
  label: string;
  detail: string;
  quality: Quality;
  /** Reason it can't be chosen right now, or null if available. */
  blocked?: (s: GameState, e: PendingEvent) => string | null;
  /** Apply the decision; returns the outcome text for the mission history. */
  apply: (s: GameState, e: PendingEvent) => string;
}

export interface EventDef {
  id: string;
  title: string;
  icon: string;
  /** What happened, for this occurrence. */
  describe: (s: GameState, e: PendingEvent) => string;
  /** Why it happens (real science). */
  science: string;
  /** Science card unlocked by the event. */
  factId?: string;
  /** Key into the NTRS snapshot for further reading. */
  ntrsTopic?: string;
  /** Random events: return a target when the event can happen now. Storms are triggered by the radiation system instead. */
  pick?: (s: GameState, r: number) => Omit<PendingEvent, 'id' | 't'> | null;
  /** Immediate effect when the event fires (before the choice). */
  onTrigger?: (s: GameState, e: PendingEvent) => void;
  choices: EventChoice[];
}

const name = (s: GameState, id?: number) => {
  const b = s.buildings.find((x) => x.id === id);
  return b ? BUILDINGS[b.type].name : 'equipment';
};
const effect = (s: GameState, type: Effect['type'], hours: number, buildingId?: number) => {
  s.station.effects = s.station.effects.filter((e) => e.type !== type);
  s.station.effects.push({ type, until: s.time + hours, buildingId });
};
const clear = (s: GameState, type: Effect['type']) => {
  s.station.effects = s.station.effects.filter((e) => e.type !== type);
};
const noBuilder = (s: GameState) => (freeBuilder(s) === null ? 'All builders are busy' : null);

export const EVENTS: Record<string, EventDef> = {
  solarStorm: {
    id: 'solarStorm',
    title: 'Solar particle storm incoming',
    icon: '☢️',
    describe: (s) => {
      const f = s.flare;
      const lead = f ? Math.max(0, Math.round(f.start - s.time)) : 0;
      const real = latestFlare(getSpaceWeather());
      const realNote = real && getSpaceWeather().source !== 'simulated'
        ? ` Real reference: NASA DONKI recorded a ${real.classType} solar flare on ${real.peakTime.slice(0, 10)}. This storm itself is simulated.`
        : '';
      return `Sensors detect energetic protons from an eruption on the Sun. The particle storm reaches the base in about ${lead} colony hours and lasts about 20 hours.${realNote}`;
    },
    science: 'Solar flares and coronal mass ejections can accelerate protons to near light speed. With no magnetic field or thick atmosphere, the lunar surface gets the full dose, so crews shelter behind mass (regolith, water, equipment).',
    factId: 'radiation',
    ntrsTopic: 'storm',
    choices: [
      {
        id: 'shelter', label: 'Shelter: all crew into the shielded habitats', quality: 'good',
        detail: 'Dose −40%. Construction pauses until the storm is over.',
        apply: (s) => {
          effect(s, 'shelter', (s.flare?.end ?? s.time + 40) - s.time);
          s.stats.shelterChoices++;
          return 'Crew sheltered behind regolith; construction paused for the storm.';
        },
      },
      {
        id: 'electronics', label: 'Power down the lab and radio stations', quality: 'ok',
        detail: 'Protects electronics from damage; research and station data pause during the storm. Crew dose unchanged.',
        apply: (s) => {
          effect(s, 'electronicsOff', (s.flare?.end ?? s.time + 40) - s.time);
          return 'Sensitive electronics safed; crew stayed at normal shielding.';
        },
      },
      {
        id: 'work', label: 'Keep working outside to finish construction', quality: 'risky',
        detail: 'Construction continues, but the crew takes +30% dose and electronics may be damaged.',
        apply: (s) => {
          effect(s, 'workThrough', (s.flare?.end ?? s.time + 40) - s.time);
          return 'Work continued through the storm; crew exposure increased.';
        },
      },
    ],
  },

  dustLofting: {
    id: 'dustLofting',
    title: 'Electrostatic dust coats the panels',
    icon: '🌫️',
    pick: (s) => (s.buildings.some((b) => b.type === 'solar' && b.level > 0) ? {} : null),
    onTrigger: (s) => addDustEverywhere(s, 0.2),
    describe: () => 'As the sunrise/sunset line passes, charged dust grains hop off the ground and settle on every solar panel. Solar output has dropped.',
    science: 'Sunlight and the solar wind give lunar dust an electric charge. Near the terminator (the day/night line), charged grains can be lifted and moved; Surveyor landers photographed a glow above the horizon thought to be lofted dust. Dust is sharp and sticky, and it blocks sunlight on panels.',
    factId: 'lunarDust',
    ntrsTopic: 'dust',
    choices: [
      {
        id: 'clean', label: 'Send a robot to clean every panel', quality: 'good',
        detail: `One builder, about ${Math.round(MAINTENANCE.clean.hours * 1.5)} h. All dust removed.`,
        blocked: (s) => noBuilder(s) ?? (s.buildings.some((b) => b.type === 'solar' && b.level > 0 && !b.job) ? null : 'No idle solar farm to start from'),
        apply: (s) => {
          const farm = s.buildings.find((b) => b.type === 'solar' && b.level > 0 && !b.job)!;
          startClean(s, farm.id, true);
          return 'A robot is cleaning every panel.';
        },
      },
      {
        id: 'tilt', label: 'Tilt the panels to shake dust off', quality: 'ok',
        detail: 'Halves the dust now, but panels work at −10% for 24 h while re-aligning.',
        apply: (s) => {
          for (const b of s.buildings) if (b.type === 'solar') b.dust = (b.dust ?? 0) * 0.5;
          effect(s, 'tilt', 24);
          return 'Panels tilted: half the dust shed, small temporary output loss.';
        },
      },
      {
        id: 'wait', label: 'Accept reduced power for now', quality: 'risky',
        detail: 'No cost now. Dust stays until cleaned.',
        apply: () => 'Dust left on the panels; solar output stays reduced.',
      },
    ],
  },

  equipmentFailure: {
    id: 'equipmentFailure',
    title: 'Equipment failure',
    icon: '🔧',
    pick: (s, r) => {
      const list = s.buildings.filter((b) => b.level > 0 && !b.job && ['oxygen', 'ice', 'mine', 'refinery', 'greenhouse'].includes(b.type) && (b.condition ?? 100) > 30);
      return list.length ? { buildingId: list[Math.floor(r * list.length)].id } : null;
    },
    onTrigger: (s, e) => {
      const b = s.buildings.find((x) => x.id === e.buildingId);
      if (b) b.condition = 0;
    },
    describe: (s, e) => `A pump and seal assembly in the ${name(s, e.buildingId)} has failed. It has stopped working completely.`,
    science: 'Thermal cycling (from +120 °C to −170 °C), abrasive dust in moving parts and micrometeoroid hits wear out machinery much faster than on Earth. Real missions carry spare parts and plan regular maintenance.',
    ntrsTopic: 'impacts',
    choices: [
      {
        id: 'repair', label: 'Full repair with a robot', quality: 'good',
        detail: `${MAINTENANCE.repair.regolith} regolith + ${MAINTENANCE.repair.titanium} titanium, about ${MAINTENANCE.repair.hours} h. Back to 100%.`,
        blocked: (s) => noBuilder(s) ?? (canAfford(s, MAINTENANCE.repair) ? null : 'Not enough regolith or titanium'),
        apply: (s, e) => {
          startRepair(s, e.buildingId!);
          return `Repair crew sent to the ${name(s, e.buildingId)}.`;
        },
      },
      {
        id: 'patch', label: 'Quick patch with spare parts', quality: 'ok',
        detail: '20 regolith, works right away at 60%, but wears out 3× faster until properly repaired.',
        blocked: (s) => (canAfford(s, { regolith: 20 }) ? null : 'Needs 20 regolith'),
        apply: (s, e) => {
          pay(s, { regolith: 20 });
          const b = s.buildings.find((x) => x.id === e.buildingId);
          if (b) { b.condition = 60; b.patched = true; }
          return `The ${name(s, e.buildingId)} was patched to 60%.`;
        },
      },
      {
        id: 'off', label: 'Switch it off and fix it later', quality: 'risky',
        detail: 'Saves its power, but it produces nothing until repaired.',
        apply: (s, e) => {
          const b = s.buildings.find((x) => x.id === e.buildingId);
          if (b) b.enabled = false;
          return `The ${name(s, e.buildingId)} was switched off, unrepaired.`;
        },
      },
    ],
  },

  waterLeak: {
    id: 'waterLeak',
    title: 'Water leak',
    icon: '💧',
    pick: (s) => (s.life.water > 30 ? { amount: Math.round(Math.min(25, s.life.water * 0.15)) } : null),
    onTrigger: (s, e) => {
      s.life.water = Math.max(0, s.life.water - (e.amount ?? 0));
      effect(s, 'leak', 72);
    },
    describe: (_s, e) => `A cracked fitting in a water tank sprayed out ${e.amount} L and is still leaking (about 0.8 L per hour).`,
    science: 'In vacuum, leaking water boils and freezes at the same time and is lost to space. Water is heavy to launch, so stations recycle almost all of it and treat every leak as urgent.',
    factId: 'waterRecycling',
    ntrsTopic: 'water',
    choices: [
      {
        id: 'patch', label: 'Emergency patch', quality: 'good',
        detail: '40 regolith. The leak stops now.',
        blocked: (s) => (canAfford(s, { regolith: 40 }) ? null : 'Needs 40 regolith'),
        apply: (s) => {
          pay(s, { regolith: 40 });
          clear(s, 'leak');
          return 'Leak sealed with an emergency patch.';
        },
      },
      {
        id: 'isolate', label: 'Isolate the leaking tank', quality: 'ok',
        detail: 'Free. The leak stops, but water storage is −30% for 48 h.',
        apply: (s) => {
          clear(s, 'leak');
          effect(s, 'waterCap', 48);
          return 'Tank isolated; water capacity reduced for two days.';
        },
      },
      {
        id: 'ignore', label: 'Ignore it', quality: 'risky',
        detail: 'Keeps losing about 0.8 L every hour for 72 h.',
        apply: () => 'Leak left running.',
      },
    ],
  },

  powerShortage: {
    id: 'powerShortage',
    title: 'Battery cell fault',
    icon: '🔋',
    pick: (s) => {
      const bat = s.buildings.find((b) => b.type === 'battery' && b.level > 0 && !b.job) ?? s.buildings.find((b) => b.type === 'command' && !b.job);
      return bat ? { buildingId: bat.id } : null;
    },
    onTrigger: (s, e) => effect(s, 'batteryFault', 48, e.buildingId),
    describe: () => 'Several battery cells overheated and were cut out of the circuit. A quarter of your energy storage is offline for 48 hours.',
    science: 'Batteries lose capacity when they get too hot or too cold, and failing cells must be isolated so they don’t damage the rest. Over a two-week lunar night, storage is the difference between a running base and a frozen one.',
    ntrsTopic: 'power',
    choices: [
      {
        id: 'emergency', label: 'Emergency power-saving mode', quality: 'good',
        detail: 'Only life support stays powered until you switch the mode off.',
        apply: (s) => {
          s.station.emergency = true;
          return 'Emergency power-saving mode on.';
        },
      },
      {
        id: 'repair', label: 'Replace the cells with a robot', quality: 'good',
        detail: `${MAINTENANCE.repair.regolith} regolith + ${MAINTENANCE.repair.titanium} titanium, about ${MAINTENANCE.repair.hours} h. Ends the fault early.`,
        blocked: (s) => noBuilder(s) ?? (canAfford(s, MAINTENANCE.repair) ? null : 'Not enough regolith or titanium'),
        apply: (s, e) => {
          const b = s.buildings.find((x) => x.id === e.buildingId);
          if (b) b.condition = Math.min(b.condition ?? 100, 99);
          startRepair(s, e.buildingId!);
          return 'Robot sent to replace the faulty cells.';
        },
      },
      {
        id: 'shed', label: 'Switch off mines and refineries', quality: 'ok',
        detail: 'Saves power for life support, but material production stops until you switch them back on.',
        apply: (s) => {
          for (const b of s.buildings) if (b.type === 'mine' || b.type === 'refinery') b.enabled = false;
          return 'Mines and refineries switched off to save power.';
        },
      },
    ],
  },

  commLoss: {
    id: 'commLoss',
    title: 'Communication loss with Earth',
    icon: '📡',
    pick: (s) => {
      const t = s.buildings.find((b) => b.type === 'opscenter' && b.level > 0 && !b.job) ?? s.buildings.find((b) => b.type === 'command' && !b.job);
      return t ? { buildingId: t.id } : null;
    },
    onTrigger: (s, e) => effect(s, 'commsDown', 36, e.buildingId),
    describe: () => 'The main antenna has lost lock on Earth. For 36 hours there are no cargo flights, no research support and no science-data income.',
    science: 'Earth–Moon radio links need a dish pointed precisely at Earth. A misalignment, a fault or a radio blackout cuts the link; on the far side of the Moon there is no direct line to Earth at all, which is why China placed the Queqiao relay satellite for Chang’e-4.',
    factId: 'radioDelay',
    choices: [
      {
        id: 'backup', label: 'Switch to the backup antenna', quality: 'ok',
        detail: 'Contact restored now, but the Command Center draws +1 kW for 36 h.',
        apply: (s) => {
          clear(s, 'commsDown');
          effect(s, 'backupAntenna', 36);
          return 'Backup antenna in use; contact restored at an energy cost.';
        },
      },
      {
        id: 'repair', label: 'Send a robot to realign the dish', quality: 'good',
        detail: `${MAINTENANCE.repair.regolith} regolith + ${MAINTENANCE.repair.titanium} titanium, about ${MAINTENANCE.repair.hours} h.`,
        blocked: (s) => noBuilder(s) ?? (canAfford(s, MAINTENANCE.repair) ? null : 'Not enough regolith or titanium'),
        apply: (s, e) => {
          const b = s.buildings.find((x) => x.id === e.buildingId);
          if (b) b.condition = Math.min(b.condition ?? 100, 99);
          startRepair(s, e.buildingId!);
          return 'Robot sent to realign the main dish.';
        },
      },
      {
        id: 'wait', label: 'Wait for contact to return', quality: 'risky',
        detail: 'No cost, but 36 h without Earth support.',
        apply: () => 'Waited out the communication blackout.',
      },
    ],
  },
};

/** Events that can be chosen by the random scheduler. */
export const RANDOM_EVENTS = ['dustLofting', 'equipmentFailure', 'waterLeak', 'powerShortage', 'commLoss'];

export function logEvent(s: GameState, text: string) {
  addLog(s, text, 'warn');
}
