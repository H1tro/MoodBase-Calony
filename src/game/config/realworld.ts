// REAL SCIENCE — the real technology behind each game building.
import type { BuildingType } from './buildings';

export interface RealWorld {
  text: string;
  source: string;
  /** Science card unlocked the first time this building is finished. */
  factOnBuild?: string;
}

export const REAL_WORLD: Record<BuildingType, RealWorld> = {
  command: { text: 'NASA’s Artemis program plans a long-term base camp near the lunar south pole, starting with small habitats and landers like this.', source: 'NASA Artemis' },
  solar: { text: 'Most spacecraft near Earth and the Moon run on solar power. The International Space Station, about as long as a football field, is powered by huge solar arrays, and modern space solar cells convert about 30% of sunlight into electricity.', source: 'NASA ISS' },
  battery: { text: 'A two-week lunar night would need enormous batteries, so NASA is also developing Fission Surface Power: a small nuclear reactor of about 40 kW that works day and night.', source: 'NASA Fission Surface Power project' },
  mine: { text: 'Using materials found where you are is called ISRU (In-Situ Resource Utilization). Every kilogram that does not have to be launched from Earth saves fuel and money.', source: 'NASA ISRU' },
  refinery: { text: 'Heating ilmenite with hydrogen releases water, which can then be split into oxygen. It is one of the best-studied ways to make oxygen from Moon rock, leaving iron and titanium oxide behind.', source: 'NASA / Lunar Sourcebook' },
  ice: { text: 'NASA’s VIPER rover was built to drive into the cold south-pole region and map how much water ice is hidden in the soil.', source: 'NASA VIPER' },
  oxygen: { text: 'On the International Space Station, oxygen is made by splitting water with electricity: the same process your Oxygen Generator uses.', source: 'NASA ECLSS', factOnBuild: 'moxie' },
  greenhouse: { text: 'Astronauts grow lettuce and other greens on the ISS in a small garden called Veggie, and in 2019 a seed sprouted on the Moon for the first time.', source: 'NASA Veggie; CNSA Chang’e-4', factOnBuild: 'plantsOnMoon' },
  habitat: { text: 'Apollo astronauts lived in their small lunar module. The longest stay so far was Apollo 17 in 1972: about 75 hours on the surface.', source: 'NASA Apollo 17' },
  storage: { text: 'The six Apollo landings brought back 382 kg of Moon rocks, core samples and soil, still studied by scientists today.', source: 'NASA Lunar Sample Laboratory' },
  builderStation: { text: 'Robots already work on the Moon. China’s Yutu-2 rover began driving on the far side in 2019 and kept exploring for years.', source: 'CNSA Chang’e-4' },
  lab: { text: 'Some Apollo samples were kept sealed for about 50 years and only opened in 2019–2022, so that today’s better instruments could study them.', source: 'NASA ANGSA program' },
  spaceport: { text: 'To escape the Moon’s gravity a rocket needs about 2.4 km/s, compared with about 11.2 km/s from Earth. That is why fuel made on the Moon could one day supply missions deeper into space.', source: 'NASA Moon fact sheet' },
  opscenter: { text: 'During Apollo, Mission Control in Houston watched every system on the spacecraft in real time, despite the 1.3-second radio delay each way.', source: 'NASA Johnson Space Center', factOnBuild: 'radioDelay' },
  monitor: { text: 'Apollo crews set up science stations (ALSEP) that measured heat flow, solar wind and moonquakes and radioed the data to Earth for years.', source: 'NASA Apollo Lunar Surface Experiments Package', factOnBuild: 'moonquakes' },
};
