// REAL SCIENCE — quiz questions. Each one is answered by a science card
// (factId), so a question is only asked after the player has discovered it.

export interface QuizQuestion {
  id: string;
  factId: string;
  question: string;
  options: string[];
  /** Index into options. */
  answer: number;
  explain: string;
}

/** Credits for a correct answer to a sunrise quiz (game value). */
export const QUIZ_REWARD = 100;

export const QUIZ: QuizQuestion[] = [
  {
    id: 'q_lunarDay', factId: 'lunarDay',
    question: 'How long is one full day–night cycle on the Moon (sunrise to sunrise)?',
    options: ['About 24 hours', 'About 29.5 Earth days', 'About one Earth year', 'It is always daytime'],
    answer: 1,
    explain: 'The Moon turns once for every orbit, so each spot sees roughly two weeks of sunlight and then two weeks of night.',
  },
  {
    id: 'q_temperature', factId: 'temperature',
    question: 'How cold can the night get at the lunar equator?',
    options: ['About +20 °C', 'About 0 °C', 'Below −130 °C', 'About −10 °C'],
    answer: 2,
    explain: 'With no atmosphere to trap heat, the surface cools to below −130 °C at night after reaching about +120 °C in the day.',
  },
  {
    id: 'q_ice', factId: 'ice',
    question: 'Where did NASA’s LCROSS mission confirm water ice in 2009?',
    options: ['In a permanently shadowed crater near the south pole', 'On the sunny equator', 'In the Moon’s atmosphere', 'Under Apollo 11’s landing site'],
    answer: 0,
    explain: 'Craters near the poles that never see sunlight stay cold enough to keep ice for billions of years.',
  },
  {
    id: 'q_electrolysis', factId: 'electrolysis',
    question: 'What do you get when you split water (H₂O) with electricity?',
    options: ['Carbon and oxygen', 'Hydrogen and oxygen', 'Helium and neon', 'Salt and steam'],
    answer: 1,
    explain: 'Electrolysis splits water into hydrogen and oxygen. About 89% of water’s mass is oxygen.',
  },
  {
    id: 'q_oxygenNeed', factId: 'oxygenNeed',
    question: 'Roughly how much oxygen does one astronaut need per day?',
    options: ['About 0.8 kg', 'About 8 kg', 'About 80 kg', 'About 1 gram'],
    answer: 0,
    explain: 'NASA plans for about 0.8 kg of oxygen per crew member per day, depending on how active they are.',
  },
  {
    id: 'q_radiation', factId: 'radiation',
    question: 'Why is radiation a bigger danger on the Moon than on Earth’s surface?',
    options: ['The Moon is closer to the Sun', 'Moon rocks are highly radioactive', 'The Moon has no global magnetic field and almost no atmosphere', 'Earthlight is harmful'],
    answer: 2,
    explain: 'Earth’s magnetic field and thick air block most cosmic rays and solar particles. The Moon has neither.',
  },
  {
    id: 'q_doseLimit', factId: 'doseLimit',
    question: 'What is NASA’s career radiation limit for an astronaut?',
    options: ['6 mSv', '600 mSv', '60,000 mSv', 'There is no limit'],
    answer: 1,
    explain: 'Since 2022, NASA limits every astronaut to 600 millisieverts over a whole career.',
  },
  {
    id: 'q_regolith', factId: 'regolith',
    question: 'About how much of lunar regolith (soil), by mass, is oxygen?',
    options: ['About 1%', 'About 10%', 'About 40–45%', 'About 90%'],
    answer: 2,
    explain: 'The oxygen is locked inside minerals, so regolith itself is a possible oxygen source, not just a building material.',
  },
  {
    id: 'q_titanium', factId: 'titanium',
    question: 'Which titanium-rich mineral is found in the dark lunar maria?',
    options: ['Quartz', 'Ilmenite', 'Diamond', 'Halite (salt)'],
    answer: 1,
    explain: 'Ilmenite (FeTiO₃) contains iron, titanium and oxygen, so it is studied as a source of both metal and oxygen.',
  },
  {
    id: 'q_water', factId: 'waterRecycling',
    question: 'In 2023, the ISS life-support system recovered about how much of its water?',
    options: ['About 98%', 'About 50%', 'About 10%', 'None: all water comes from Earth'],
    answer: 0,
    explain: 'The ISS recycles water from humidity and urine. Recycling is far cheaper than launching new water.',
  },
  {
    id: 'q_poles', factId: 'solarPoles',
    question: 'Why do Artemis missions aim for the lunar south pole?',
    options: ['It is the warmest place on the Moon', 'It is the closest point to Earth', 'It has ice in shadowed craters and ridges with long sunlight', 'It has no craters'],
    answer: 2,
    explain: 'Ice for water and oxygen sits next to high ridges that are lit most of the time: ideal for solar power.',
  },
  {
    id: 'q_gravity', factId: 'gravity',
    question: 'How strong is gravity on the Moon compared to Earth?',
    options: ['About the same', 'About one-sixth', 'About twice as strong', 'There is no gravity'],
    answer: 1,
    explain: 'Lunar gravity is about 1.62 m/s², roughly 1/6 of Earth’s, which is why astronauts bounce when they walk.',
  },
  {
    id: 'q_lunarRadiation', factId: 'lunarRadiation',
    question: 'What radiation dose rate did China’s Chang’e-4 lander measure on the lunar surface?',
    options: ['About 0.1 µSv/h', 'About 57 µSv/h', 'About 5,000 µSv/h', 'Zero'],
    answer: 1,
    explain: 'About 57 µSv per hour, roughly 200 times higher than on Earth’s surface.',
  },
  {
    id: 'q_radioDelay', factId: 'radioDelay',
    question: 'How long does a radio signal take to travel from Earth to the Moon?',
    options: ['Instantly', 'About 1.3 seconds', 'About 8 minutes', 'About 1 hour'],
    answer: 1,
    explain: 'Light and radio travel about 300,000 km per second, and the Moon is about 384,000 km away.',
  },
  {
    id: 'q_moonquakes', factId: 'moonquakes',
    question: 'What did seismometers left by Apollo astronauts record?',
    options: ['Nothing: the Moon is completely still', 'Thousands of moonquakes', 'Wind on the surface', 'Rain from comets'],
    answer: 1,
    explain: 'Between 1969 and 1977 they recorded thousands of moonquakes; some shallow ones lasted more than 10 minutes.',
  },
  {
    id: 'q_moxie', factId: 'moxie',
    question: 'What did NASA’s MOXIE experiment on Mars produce oxygen from?',
    options: ['Ice', 'Carbon dioxide in the air', 'Rocks', 'Sunlight alone'],
    answer: 1,
    explain: 'MOXIE split carbon dioxide (CO₂) from the thin Martian air into oxygen and carbon monoxide.',
  },
  {
    id: 'q_plants', factId: 'plantsOnMoon',
    question: 'What was the first plant to sprout on the Moon (Chang’e-4, 2019)?',
    options: ['A potato', 'A cotton seed', 'A sunflower', 'Moss'],
    answer: 1,
    explain: 'A cotton seed germinated inside a small sealed container on the lander, on the far side of the Moon.',
  },
  {
    id: 'q_dust', factId: 'lunarDust',
    question: 'Why is lunar dust so sharp?',
    options: ['It is made of glass bottles', 'No wind or water has ever worn the grains smooth', 'It freezes into crystals at night', 'Astronauts crushed it'],
    answer: 1,
    explain: 'On Earth, wind and water round off grains over time. On the Moon nothing does, so dust stays jagged and abrasive.',
  },
  {
    id: 'q_impacts', factId: 'micrometeoroids',
    question: 'About how many new craters did NASA’s LRO find forming on the Moon each year?',
    options: ['None', 'About 2', 'About 220', 'About 2 million large craters'],
    answer: 2,
    explain: 'By comparing images taken years apart, LRO scientists found roughly 220 new craters per year.',
  },
  {
    id: 'q_co2', factId: 'co2Scrubbing',
    question: 'How much carbon dioxide does one astronaut breathe out per day, roughly?',
    options: ['About 1 gram', 'About 1 kg', 'About 100 kg', 'None: CO₂ only comes from machines'],
    answer: 1,
    explain: 'About 1 kg per person per day, which is why scrubbers must run all the time.',
  },
];

export const QUIZ_BY_ID = Object.fromEntries(QUIZ.map((q) => [q.id, q])) as Record<string, QuizQuestion>;
