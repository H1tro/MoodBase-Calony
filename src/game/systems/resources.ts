import { PRODUCTION } from '../config/balance';
import { LIFE, conditionFactor } from '../config/station';
import type { GameState } from './state';
import { caps, diff, hasTech, oreTiles } from './selectors';

/** Run every producing building that is online. Output scales with equipment condition. */
export function updateProduction(s: GameState, dt: number) {
  const c = caps(s);
  s.flows.caps = c;
  const P = PRODUCTION;
  const T = s.totals;
  const auto = hasTech(s, 'autoMining') ? 1.3 : 1;
  const y = diff(s).yields;
  for (const b of s.buildings) {
    if (b.level === 0 || !b.online) continue;
    const L = b.level;
    const k = conditionFactor(b.condition);
    if (k <= 0) continue;
    switch (b.type) {
      case 'mine': {
        const ore = oreTiles(s, b) >= 2 ? P.oreBonus : 1;
        const before = s.res.regolith;
        s.res.regolith = Math.min(c.regolith, s.res.regolith + P.mineRegolith * L * ore * auto * y.regolith * k * dt);
        T.regolithMined += s.res.regolith - before;
        break;
      }
      case 'refinery': {
        if (s.res.titanium >= c.titanium) break;
        const need = P.refineryRegolithIn * L * auto * dt;
        if (s.res.regolith < need) break;
        s.res.regolith -= need;
        // Ilmenite-rich (ore) ground yields more titanium, so deposits matter for rare metal too.
        const ilmenite = oreTiles(s, b) >= 2 ? P.oreBonus : 1;
        const before = s.res.titanium;
        s.res.titanium = Math.min(c.titanium, s.res.titanium + P.refineryTitaniumOut * L * auto * ilmenite * y.titanium * k * dt);
        T.titaniumMade += s.res.titanium - before;
        break;
      }
      case 'ice': {
        const before = s.res.ice;
        s.res.ice = Math.min(c.ice, s.res.ice + P.iceKg * L * y.ice * k * dt);
        T.iceMined += s.res.ice - before;
        break;
      }
      case 'oxygen': {
        const o2Full = s.life.o2 >= c.o2 - 1e-6;
        const waterFull = s.life.water >= c.water - 1e-6;
        // Send the product where there is room; if both full, idle (don't waste ice).
        let split = b.split;
        if (o2Full && waterFull) break;
        if (o2Full) split = 0;
        else if (waterFull) split = 1;
        const proc = Math.min(s.res.ice, P.oxygenIceIn * L * k * dt);
        s.res.ice -= proc;
        const o2Before = s.life.o2;
        s.life.o2 = Math.min(c.o2, s.life.o2 + proc * split * P.o2PerWater);
        T.o2Made += s.life.o2 - o2Before;
        s.life.water = Math.min(c.water, s.life.water + proc * (1 - split));
        break;
      }
      case 'greenhouse': {
        if (s.life.food >= c.food) break;
        const need = P.greenhouseWaterIn * L * dt;
        if (s.life.water < need) break;
        s.life.water -= need;
        // Composting crew waste as fertiliser boosts the harvest (and empties waste storage).
        const compost = Math.min(s.life.waste, LIFE.compostPerGreenhouseLevel * L * dt);
        s.life.waste -= compost;
        T.wasteComposted += compost;
        const bonus = compost > 0 ? 1 + LIFE.compostFoodBonus * (compost / (LIFE.compostPerGreenhouseLevel * L * dt)) : 1;
        const before = s.life.food;
        s.life.food = Math.min(c.food, s.life.food + P.greenhouseFoodOut * L * k * bonus * dt);
        T.foodGrown += s.life.food - before;
        break;
      }
    }
  }
}
