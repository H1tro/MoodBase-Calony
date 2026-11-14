// REAL SCIENCE — glossary of terms used in the game.

export interface Term {
  term: string;
  meaning: string;
  /** Where it shows up in the game. */
  inGame?: string;
}

export const GLOSSARY: Term[] = [
  { term: 'Regolith', meaning: 'The layer of loose, broken rock and dust that covers the Moon’s surface, made by billions of years of impacts.', inGame: 'Main building material; also used as radiation shielding.' },
  { term: 'ISRU', meaning: 'In-Situ Resource Utilization: making what you need (water, oxygen, building material, fuel) from local resources instead of launching it from Earth.', inGame: 'Mines, ice extractors and the oxygen generator.' },
  { term: 'Electrolysis', meaning: 'Using electricity to split water (H₂O) into hydrogen and oxygen gas.', inGame: 'How the Oxygen Generator makes O₂.' },
  { term: 'Permanently shadowed region', meaning: 'Crater floors near the lunar poles that never receive direct sunlight. They are among the coldest places in the Solar System and can trap water ice.', inGame: 'Ice deposits (blue tiles).' },
  { term: 'Lunar day', meaning: 'One full cycle from sunrise to sunrise on the Moon, about 29.5 Earth days: roughly two weeks of light, then two weeks of night.', inGame: 'The day–night cycle, compressed to 6 minutes.' },
  { term: 'Terminator', meaning: 'The moving line between day and night on a planet or moon.', inGame: 'Dust lofting happens near it.' },
  { term: 'kW (kilowatt)', meaning: 'A unit of power: how fast energy is produced or used right now.', inGame: 'Solar output and building power draw.' },
  { term: 'kWh (kilowatt-hour)', meaning: 'A unit of energy: 1 kW used for 1 hour. Batteries are rated in kWh.', inGame: 'Battery storage.' },
  { term: 'Solar constant', meaning: 'The power of sunlight arriving at Earth’s distance from the Sun, about 1361 W per square metre. With no atmosphere, the lunar surface receives nearly all of it.', inGame: 'Illumination readings.' },
  { term: 'Sievert (Sv)', meaning: 'A unit of radiation dose that accounts for its effect on the human body. 1 mSv = 1/1000 Sv; 1 µSv = 1/1,000,000 Sv.', inGame: 'Crew dose and station radiation readings.' },
  { term: 'Solar particle event (SPE)', meaning: 'A burst of high-energy protons from the Sun, often after a flare or coronal mass ejection. Dangerous for astronauts outside Earth’s magnetic field.', inGame: 'Solar particle storms.' },
  { term: 'Solar flare class', meaning: 'Flares are graded A, B, C, M, X by their X-ray brightness; each letter is 10× stronger than the one before. X-class are the strongest.', inGame: 'Real flares from NASA DONKI.' },
  { term: 'Coronal mass ejection (CME)', meaning: 'A huge cloud of magnetised gas thrown off the Sun. CMEs can drive particle storms and geomagnetic storms.', inGame: 'Background of solar storms.' },
  { term: 'Micrometeoroid', meaning: 'A tiny particle of space rock or dust, usually smaller than a grain of sand, travelling at many km per second.', inGame: 'Impacts damage buildings.' },
  { term: 'CO₂ scrubber', meaning: 'A device that removes carbon dioxide from cabin air, using chemicals (like lithium hydroxide on Apollo) or regenerable absorbers (like the ISS).', inGame: 'Command Center and habitats, only with power.' },
  { term: 'ppm', meaning: 'Parts per million. 1% = 10,000 ppm. Earth’s air has about 420 ppm of CO₂.', inGame: 'Cabin CO₂ level.' },
  { term: 'ECLSS', meaning: 'Environmental Control and Life Support System: everything that keeps air, water, temperature and pressure safe on a spacecraft.', inGame: 'The Life Support department.' },
  { term: 'Ilmenite', meaning: 'A mineral (FeTiO₃) common in the dark lunar maria; a source of titanium, iron and oxygen.', inGame: 'Ore deposits and the Titanium Refinery.' },
  { term: 'Maria', meaning: 'The dark, smooth plains on the Moon, made of ancient lava (basalt). Latin for “seas”.', inGame: 'Titanium-rich ore.' },
  { term: 'Escape velocity', meaning: 'The speed needed to leave a body’s gravity without further thrust: about 2.4 km/s from the Moon, 11.2 km/s from Earth.', inGame: 'Spaceport cargo runs.' },
  { term: 'Artemis', meaning: 'NASA’s program to return astronauts to the Moon and build a lasting presence near the lunar south pole.', inGame: 'The setting of the game.' },
  { term: 'DONKI', meaning: 'NASA’s Space Weather Database Of Notifications, Knowledge, Information: a public record of real solar flares, CMEs and particle events.', inGame: 'Real solar data in Mission Control.' },
];
