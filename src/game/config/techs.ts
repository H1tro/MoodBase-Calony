// GAME VALUES — research technologies.

export type TechId = 'solarEff' | 'insulatedBatt' | 'waterRecycle' | 'stormShelter' | 'fastBuilders' | 'autoMining';

export interface TechDef {
  id: TechId;
  name: string;
  icon: string;
  effect: string;
  cost: number; // credits
  time: number; // seconds
  labLevel: number;
}

export const TECHS: TechDef[] = [
  { id: 'solarEff', name: 'High-efficiency panels', icon: '☀️', effect: 'Solar farms produce +25% power.', cost: 300, time: 40, labLevel: 1 },
  { id: 'insulatedBatt', name: 'Insulated batteries', icon: '🔋', effect: 'Battery capacity +50%.', cost: 400, time: 45, labLevel: 1 },
  { id: 'waterRecycle', name: 'Water recycling', icon: '♻️', effect: 'Crew water use −40%.', cost: 500, time: 50, labLevel: 2 },
  { id: 'stormShelter', name: 'Storm shelter', icon: '🛡️', effect: 'Solar-flare dose −50%.', cost: 600, time: 55, labLevel: 2 },
  { id: 'fastBuilders', name: 'Faster builders', icon: '⚙️', effect: 'Build and upgrade times −25%.', cost: 800, time: 60, labLevel: 3 },
  { id: 'autoMining', name: 'Automated mining', icon: '⛏️', effect: 'Mines and refineries +30% output.', cost: 1000, time: 70, labLevel: 3 },
];

export const TECH_BY_ID = Object.fromEntries(TECHS.map((t) => [t.id, t])) as Record<TechId, TechDef>;
