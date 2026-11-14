// REAL SCIENCE — facts about the Moon and human spaceflight, shown on
// science cards. These are kept separate from game balance numbers.
// Values are rounded and stated as approximations.

export interface ScienceFact {
  id: string;
  title: string;
  fact: string;
  /** How the game simplifies this (game assumption). */
  inGame: string;
  source: string;
}

export const SCIENCE: Record<string, ScienceFact> = {
  lunarDay: {
    id: 'lunarDay',
    title: 'A lunar day is about a month long',
    fact: 'From one sunrise to the next takes about 29.5 Earth days, so most places on the Moon get roughly two weeks of sunlight followed by roughly two weeks of darkness.',
    inGame: 'One full day–night cycle is compressed to 6 minutes.',
    source: 'NASA Science — Moon facts',
  },
  temperature: {
    id: 'temperature',
    title: 'Extreme temperatures',
    fact: 'With no atmosphere to hold heat, the lunar equator can reach about +120 °C in the day and fall below −130 °C at night. Equipment must be heated to survive the night.',
    inGame: 'Habitats without power get cold and slowly harm crew health.',
    source: 'NASA Lunar Reconnaissance Orbiter (Diviner) results',
  },
  ice: {
    id: 'ice',
    title: 'Ice in the shadows',
    fact: 'In 2009 the LCROSS impactor confirmed water ice in a permanently shadowed crater near the lunar south pole. Ice there could supply water, oxygen and rocket propellant.',
    inGame: 'Ice appears as blue deposits and must be mined by an Ice Extractor.',
    source: 'NASA LCROSS mission',
  },
  electrolysis: {
    id: 'electrolysis',
    title: 'Splitting water makes oxygen',
    fact: 'Electrolysis uses electricity to split water (H₂O) into hydrogen and oxygen. By mass, about 89% of water is oxygen, so 1 kg of water can yield about 0.89 kg of O₂.',
    inGame: 'The Oxygen Generator uses the real 0.89 ratio; its speed is a game value.',
    source: 'Basic chemistry; used by the ISS Oxygen Generation Assembly',
  },
  oxygenNeed: {
    id: 'oxygenNeed',
    title: 'How much oxygen does an astronaut need?',
    fact: 'NASA planning documents assume roughly 0.8 kg of oxygen per crew member per day, depending on activity.',
    inGame: 'Crew consumption is scaled up so you can see the effect within minutes.',
    source: 'NASA Life Support Baseline Values and Assumptions Document',
  },
  radiation: {
    id: 'radiation',
    title: 'No magnetic shield',
    fact: 'The Moon has no global magnetic field and almost no atmosphere, so crews are exposed to cosmic rays and solar particle events. Covering habitats with regolith is one studied way to block radiation.',
    inGame: 'Each shielding level blocks part of the flare dose; numbers are game-scale.',
    source: 'NASA Space Radiation research',
  },
  doseLimit: {
    id: 'doseLimit',
    title: 'A career dose limit',
    fact: 'NASA limits an astronaut’s total career radiation exposure to 600 millisieverts (mSv).',
    inGame: 'The dose meter uses game-scale mSv values.',
    source: 'NASA-STD-3001 (2022 update)',
  },
  regolith: {
    id: 'regolith',
    title: 'Regolith: lunar soil',
    fact: 'Regolith is a layer of broken rock and dust covering the Moon. It is sharp and clingy (it damaged Apollo spacesuits), but it is also a building material, and by mass it is roughly 40–45% oxygen bound in minerals.',
    inGame: 'Regolith is the main building material.',
    source: 'NASA / Lunar Sourcebook',
  },
  titanium: {
    id: 'titanium',
    title: 'Titanium in the maria',
    fact: 'Some dark lunar mare basalts contain the mineral ilmenite (FeTiO₃), which is rich in titanium and is also a candidate source of oxygen.',
    inGame: 'The refinery turns regolith into titanium at a fixed game rate.',
    source: 'Apollo sample analyses',
  },
  waterRecycling: {
    id: 'waterRecycling',
    title: 'Recycling every drop',
    fact: 'In 2023 the ISS life-support system demonstrated recovering about 98% of the water brought aboard, including from crew sweat and urine.',
    inGame: 'The Water Recycling tech cuts crew water use by 40%.',
    source: 'NASA ECLSS announcement, 2023',
  },
  solarPoles: {
    id: 'solarPoles',
    title: 'Peaks of near-eternal light',
    fact: 'Some ridges near the lunar south pole receive sunlight most of the time, which is one reason Artemis missions target that region.',
    inGame: 'The game uses a simple equal day/night cycle.',
    source: 'NASA Artemis / LRO',
  },
  lunarRadiation: {
    id: 'lunarRadiation',
    title: 'Measuring radiation on the Moon',
    fact: 'In 2019 the Chinese Chang\u2019e-4 lander measured the radiation dose rate on the lunar surface: about 57 microsieverts per hour, roughly 200 times more than on Earth\u2019s surface. Sunlight on the airless surface delivers about 1361 W/m\u00b2.',
    inGame: 'Monitoring Stations use these real values as their background readings; flare spikes, temperatures and timings are game simplifications.',
    source: 'Zhang et al., Science Advances (2020); NASA solar constant',
  },
  gravity: {
    id: 'gravity',
    title: 'One-sixth gravity',
    fact: 'Surface gravity on the Moon is about 1.62 m/s², roughly one-sixth of Earth’s. Launching cargo off the Moon needs far less energy than launching from Earth.',
    inGame: 'Cargo runs from the Spaceport earn credits.',
    source: 'NASA Moon fact sheet',
  },
  radioDelay: {
    id: 'radioDelay',
    title: 'Talking to the Moon takes time',
    fact: 'The Moon is about 384,000 km away, so radio signals need about 1.3 seconds to get there. A question and its answer take about 2.6 seconds, which is why Moon robots are often given commands in batches instead of being steered live.',
    inGame: 'The dashboard shows short network latency inside the base; the Earth–Moon delay is not simulated.',
    source: 'Distance ÷ speed of light; NASA',
  },
  moonquakes: {
    id: 'moonquakes',
    title: 'The Moon shakes',
    fact: 'Seismometers left by Apollo astronauts recorded thousands of moonquakes between 1969 and 1977. Some shallow moonquakes lasted more than 10 minutes, which future base designers have to plan for.',
    inGame: 'Moonquakes are not simulated; Monitoring Stations measure temperature, radiation and sunlight.',
    source: 'NASA Apollo Passive Seismic Experiment',
  },
  moxie: {
    id: 'moxie',
    title: 'Oxygen made on another world',
    fact: 'From 2021 to 2023, NASA’s MOXIE experiment on the Perseverance rover made oxygen out of the carbon dioxide in Mars’s thin air: the first oxygen ever produced on another planet.',
    inGame: 'On the Moon there is almost no air, so your Oxygen Generator splits water from lunar ice instead.',
    source: 'NASA Jet Propulsion Laboratory',
  },
  plantsOnMoon: {
    id: 'plantsOnMoon',
    title: 'The first plant to sprout on the Moon',
    fact: 'In January 2019 a cotton seed sprouted inside a small sealed container carried by China’s Chang’e-4 lander on the far side of the Moon: the first plant ever to germinate there.',
    inGame: 'Greenhouses turn water and power into food at a simplified game rate.',
    source: 'China National Space Administration (Chang’e-4)',
  },
  lunarDust: {
    id: 'lunarDust',
    title: 'Sticky, sharp moon dust',
    fact: 'Lunar dust has never been worn down by wind or water, so its grains are sharp and jagged, and sunlight gives them an electric charge. Apollo astronauts found it clung to spacesuits and equipment. Surveyor landers photographed a glow above the horizon after sunset, thought to be dust lifted by electric charge.',
    inGame: 'Dust builds up on solar panels and lowers their output until a robot cleans them; rocket launches add more.',
    source: 'NASA Apollo & Surveyor results',
  },
  micrometeoroids: {
    id: 'micrometeoroids',
    title: 'A steady rain of tiny impacts',
    fact: 'With no atmosphere to burn them up, grains of space dust hit the Moon at many kilometres per second. By comparing before-and-after images, NASA’s Lunar Reconnaissance Orbiter found about 220 brand-new craters forming across the Moon every year.',
    inGame: 'Random micrometeoroid hits lower a building’s condition; repairs restore it.',
    source: 'Speyerer et al., Nature (2016), LRO',
  },
  co2Scrubbing: {
    id: 'co2Scrubbing',
    title: 'Removing the CO₂ we breathe out',
    fact: 'Every astronaut breathes out about 1 kg of carbon dioxide a day, so spacecraft must remove it. On Apollo 13 the crew famously built an adapter from tape, plastic and cardboard so the command module’s square CO₂ filters could fit the lunar module’s round sockets. The ISS uses machines that absorb CO₂ and vent it to space.',
    inGame: 'Scrubbers in the Command Center and habitats remove CO₂ only while they have power.',
    source: 'NASA Apollo 13; ISS ECLSS',
  },
};
