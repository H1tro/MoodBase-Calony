# 🌕 MoonBase Colony v3

**A lunar base-building strategy game about the engineering trade-offs that make or break a mission.**
Built for the NASA Space Apps Challenge.

You command the first permanent colony on the Moon. Build solar farms, batteries, ice extractors,
oxygen generators, greenhouses and shielded habitats, and keep your crew alive through the long lunar
night and sudden solar storms. Every number on screen comes from a single simulation, and every button does something real.

---

## Quick start

Requirements: **Node.js 18+** (tested with Node 22).

```bash
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173).

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check (`tsc -b`) and production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run the simulation unit tests (Vitest) |
| `npm run data:nasa` | Refresh the bundled NASA snapshot (NTRS reports + DONKI flares) |

---

## Play online, cloud saves and deployment

- **Hosting:** Vercel, deployed from this GitHub repository (`main` → production).
- **Cloud saves:** Supabase. Players can sign in with an email link (no password) to keep their colony, achievements and options across devices. Row Level Security means every player can only access their own save.
- Without Supabase settings the game works fully offline, saving in the browser.

Step-by-step setup (Supabase table, keys, Vercel import, environment variables): **[DEPLOY.md](DEPLOY.md)**.

## How to play

| Action | Mouse | Touch |
|---|---|---|
| Move the camera | Drag | Drag |
| Zoom | Mouse wheel, or the ＋/－ buttons | Pinch, or the ＋/－ buttons |
| Building details / upgrade | Click a building | Tap a building |
| Build | **Build** button → pick a card → click the map → **✓ Build** | Same |
| Cancel / confirm placement | `Esc` or right-click / `Enter` | ✕ / ✓ buttons |
| Move camera with keys | `WASD` or arrow keys, `Q`/`E` to zoom | — |
| Shortcuts | `B` build · `U` upgrade · `R` research · `T` spaceport · `Space` pause · `1 2 3` speed | — |
| Building info at a glance | Hover a building | — |

**Placement:** the footprint glows **green** on a valid spot and **red** when it is blocked
(occupied, a crater, a boulder, off the map, or an Ice Extractor that isn't touching ice).

**Builders:** you start with one robot. Each construction, upgrade or shielding job needs a free robot,
which drives to the site and works until the timer runs out. You can hire up to four more for **500 / 1 500 / 3 000 / 6 000 ₡**.
You need a **Builder Station** to house them, and each station level adds room for one more robot.

**Time scale:** 1 real second = 1 colony hour. A full day–night cycle lasts 6 minutes
(3.5 min of daylight and 2.5 min of night). Use the 1× / 2× / 4× buttons to speed it up.

### Mission Control: the station's management hub

Press **🛰 Control** (or `M`). There are four departments:

| Department | What you manage |
|---|---|
| 🛰 **Environmental Monitoring** | Four sub-departments: **Surface Temperature**, **Radiation**, **Solar Activity & Illumination** and **Surface Environment** (dust, micrometeoroid impacts, equipment condition, solar efficiency). Each has four levels, unlocked by the Lunar Operations Center: (1) current readings, (2) history, (3) graphs and alerts, (4) analysis, station comparison, the science, and real NASA reports. |
| 🫧 **Life Support** | O₂, **CO₂** (ppm vs. safe limits, scrubber capacity), water (recycling %, leaks), food (grown vs. eaten, composting), **waste** storage, crew health and dose. Each card has a "Why it matters" explanation. |
| ⚡ **Power Management** | Generation and consumption, battery, an **energy forecast** ("will the batteries last the night?"), solar efficiency per farm with **cleaning**, **emergency power-saving mode**, and a **priority table** where you decide what loses power first. |
| 📋 **Mission Operations** | Active events and effects, the **mission history** of your decisions, **scientific reports** (NASA NTRS), **live space weather** (NASA DONKI), the **mission report** and the **Lunar Library**. |

### Life support, linked to everything else

- **CO₂** builds up from breathing (game rate keeps the real ≈1.25 CO₂-to-O₂ mass ratio). Scrubbers in the Command Center and habitats remove it only while powered. A night blackout means cold **and** CO₂ build-up.
- **Water**: crew water is partly recycled (50%, or 85% with research) when the Command Center has power; the rest comes from melting ice. Greenhouses also use water.
- **Waste** accumulates. Greenhouses compost it as fertiliser (+25% food), and Resource Storage adds room. Overflow causes hygiene problems.
- **Equipment condition** drops with wear and micrometeoroid hits; worn machines produce less. A builder robot can **repair** them. **Dust** settles on solar panels (more after rocket launches); a robot can **clean** them.

### Dynamic events (each with three choices)

Solar storm · Dust lofting · Equipment failure · Water leak · Battery fault (power shortage) · Communication loss.
Each event changes real game variables, pauses the colony for a decision, has different consequences per choice, explains the real science afterwards with a link to a real NASA report, and is written to the mission history.

### NASA data integration (real data is always labelled)

| Source | How it is used | Fallback |
|---|---|---|
| **NASA DONKI** (`ccmc.gsfc.nasa.gov/DONKI-API`) | Live list of real solar flares (class, time, location, link) in Mission Control. The strongest recent real flare scales the strength of the game's (simulated) solar storms. | Cached copy → bundled snapshot → clearly labelled **SIMULATED** |
| **NASA Moon Trek** | Real LRO Wide Angle Camera mosaic of the whole Moon, with the south-pole region marked. | Image simply doesn't load offline |
| **NASA NTRS** | Real technical-report listings per topic (dust, radiation, power, CO₂, water…) in Mission Control and after events. NTRS blocks browser (CORS) requests, so the listings are a dated snapshot. | Refresh with `npm run data:nasa` |

Every NASA dataset shows its source and its last update date. Station sensor readings are simulated from real reference values and are never shown as NASA observations.

### Mission report

Open it from Mission Control or at the end of a mission. It shows duration (and the real-Moon equivalent in Earth days), resources consumed and remaining, crew condition, science done (technologies, cards, quiz answers, measurements), every event and decision, equipment condition, a **score out of 100 with a grade**, and **what went well / what to improve**.

### Learning

- **Lunar Library** (title screen, Mission Control, or `L`): discovered science cards (20, each with a source), a **glossary** (22 terms), a **Real Moon vs. this game** comparison table, the real technology behind every building, and a practice quiz.
- **Sunrise quiz**: each sunrise, Mission Control asks about a fact you've discovered (+100 ₡ for a correct answer).
- Every building's info card has an **"In the real world"** note.

### Title screen, options and achievements

The game opens on a title screen: **Play / Continue** (resume the saved colony, or pick a difficulty and launch), **New colony**, **Achievements** and **Options**.
**Main menu** in the in-game ☰ menu saves and returns there.

**Options** are stored in a separate career profile (`moonbase-v3-profile`), so they apply to every colony:
starting game speed, launch cinematic on/off (it still waits for real setup), mission briefing on/off,
graphics quality (Low turns off regolith grain, ice glints, long shadows and footprints), reduce motion, and keyboard hints.
A danger zone deletes the saved colony or resets achievements, each behind a confirmation.

**37 career achievements** in six categories, tiered bronze / silver / gold / platinum. They persist across colonies, and each records the difficulty it was earned on.

| Category | Achievements |
|---|---|
| First steps | Groundbreaker, First Breath, Robot Crew, First Export, First Contact |
| Engineering | Solar Field, Power Hoarder, Bunker, Maxed Out, Planetary Command |
| Survival | Night Owl, Lights On, Storm Survivor, Hardwired, Off the Grid, *one secret* |
| Science | Curious Mind, Cold Trap, Know-It-All |
| Economy | Ice Miner, Titanium Age, Space Trader, Full House |
| Mastery | Fast Track, Veteran Commander, Lunar Metropolis, Mission Commander, All-Rounder (a night on every difficulty), Impossible Is Nothing |

Also: First Lunar Day, Greenhouse Operator, Energy Manager, Radiation Awareness, Water Conservation, Crisis Manager, Quiz Whiz and Lunar Librarian.

### Difficulty levels

Chosen when a new colony starts, saved with it, and never changed afterwards. Saves from before this feature load as **Medium**.
All values live in `src/game/config/difficulty.ts`.

| | Easy | Medium | Hard | Impossible |
|---|---:|---:|---:|---:|
| Resource abundance | 1.8× | 1.0× | 0.5× | 0.25× |
| Ice / ore deposits on the map | 6 / 6 (larger) | 4 / 4 | 3 / 2 (smaller) | 2 / 1 (small) |
| Yield per deposit: regolith · ice · titanium | 1.4 · 1.3 · 1.6 | 1 · 1 · 1 | 0.85 · 0.85 · 0.6 | 0.75 · 0.75 · 0.4 |
| Day / night | 70 / 30 % | 55 / 45 % | 50 / 50 % | 35 / 65 % |
| Build & upgrade speed (100 s job) | 1.5× (67 s) | 1.0× (100 s) | 0.75× (133 s) | 0.65× (154 s) |
| Solar output | 100 % | 100 % | 100 % | 120 % |

Abundance is **not** one flat multiplier. It sets how many deposits spawn and how big they are, and each resource scales differently:
rare titanium scales hardest, life-critical ice the gentlest, so even Impossible stays winnable with careful play.
Ore (ilmenite) ground now also boosts the Titanium Refinery, so deposits matter for rare metal too. Easy additionally softens crew-health damage (0.6×).

### Lunar Monitoring Network

One **Lunar Operations Center** (the dispatcher, max 1) and up to **4 Lunar Monitoring Stations**, each upgradeable on its own from level 1 to 4.
They use the normal build/upgrade system (costs rise per level; times follow the difficulty; level is capped by the Command Center).
All values are in `src/game/config/monitoring.ts`.

Each station is connected by hand from its info card:

| Link | Reach | Power | Cost | In a solar storm |
|---|---|---|---|---|
| 🔌 Cable | 10 tiles | 0.1 kW | 15 regolith per tile | keeps working |
| 📶 Radio | 14 tiles (+2 per station level) | 0.4 kW | free | drops out (data gaps) |

The Operations Center serves as many stations as its level. Its dashboard (**🛰 Monitor** button or `M`) unlocks by level:

1. **Basic Control:** live temperature and radiation per station, connection status, Operations Center energy use.
2. **Extended Control:** measurement records, temperature and radiation history, energy per station.
3. **Advanced Control:** graphs (temperature, radiation, sunlight), solar activity and illumination, environmental warnings, total network energy. Each active station also adds 10 s of solar-flare warning.
4. **Planetary Command:** station comparison and historical analysis (min/avg/max, day–night swing, trend, uptime), network health and latency, equipment status.

Stations and links draw power through the normal power system, so they go offline with everything else when energy runs out. Delivered measurements earn a few credits (science data sold to Earth).
The sensor model uses real reference values: about 57 µSv/h background radiation (Chang'e-4), 1361 W/m² sunlight, and +120 °C to −170 °C at the surface. Storm spikes and timings are game values.

**Placing buildings with a mouse:** a single left click places the building (the footprint shows green or red under the cursor). On touch screens, tap to position, then press ✓ Build.

### Launch sequence

Starting a new colony plays a short mission-control cinematic: initializing → robot systems online → deployment → powered descent → touchdown → mission ready.
Its *Systems check* list shows the real setup steps (terrain and deposits, power and day–night, rendering the map, saving). It only hands control to you after the map has actually drawn its first frame.
It can be skipped. If setup fails, it shows an error with Retry.

### On the lunar surface

The map tries to *feel* like the Moon, and each effect is physically motivated:

- **Black sky at noon.** With no atmosphere there is no blue sky. The Sun is a hard white disc crossing the sky during the lunar day, and Earth hangs almost still on the horizon.
- **Long, sharp shadows** swing around every building and boulder as the Sun moves. They stretch at dawn and dusk, are short at noon, and vanish at night.
- **Low-gravity crew.** Astronauts go outside in daylight and move in long, slow bunny hops, as Apollo crews did. They leave footprints and retreat indoors at night or when a solar flare is coming.
- **Ballistic dust.** The rover's wheels throw dust in clean arcs that fall straight back down, with no dust cloud hanging in the air.
- Regolith grain, crater ejecta rays, rocks on crater rims, ice crystals glinting in sunlight, a mountain horizon, and the descent stage and flag of the first landing (the flag hangs from a horizontal rod, because there's no wind).

### The trade-offs you'll face

| System | The decision |
|---|---|
| ⚡ **Power** | Solar farms make 0 kW at night. Batteries are expensive. You can switch off mines and refineries at night (⏻ button) so the habitats stay powered. When energy runs out, the lowest-priority buildings shut down first. |
| 🫧 **Oxygen & water** | The Oxygen Generator melts ice and splits it. A slider chooses **water vs. O₂**, because the same ice can't become both. |
| 🥗 **Food** | Greenhouses turn water + power into food, so they compete with the crew for water. |
| ☢ **Radiation** | Solar flares come with about 30 s of warning. Piling **regolith shielding** on habitats blocks part of the dose, but that regolith can't be spent on growth. |
| 🚀 **Economy** | The Spaceport sells materials for credits, and anything you export is gone from the colony. Selling *water* pays well but drains life support. |
| 🔬 **Research** | Spend credits now (water recycling, storm shelter, better panels …) to make every system more efficient later. |

**Mission failure:** if crew health reaches 0 (no O₂, water or food, unpowered habitats, or a big radiation dose),
the mission fails. The result screen explains *what happened* and *how real engineers handle it*. You can retry from the last sunrise.

### Story chapters

1. **First Landing** — build a solar farm, regolith mine and habitat, and supply the habitat with oxygen.
2. **Lunar Industry** — Builder Station, a 2nd builder, Command Center level 2, a titanium refinery and storage.
3. **Energy Crisis** — store 1 000 kWh, survive the night with no life-support outage, and shield a habitat.
4. **Space Economy** — Command Center level 3, research, the Spaceport, and cargo runs.
5. **Lunar Metropolis** — Command Center level 5, 8 crew, 4 technologies, and a fully self-sufficient day–night cycle.

There are also 10 achievements, a mission log, and science cards that unlock as you play.

---

## Real science vs. game assumptions

To keep the game honest, real facts and game balance are kept **separate in the code and on screen**:

- `src/game/config/science.ts` holds **real science**: rounded facts with sources, shown on "Science cards" with a green *Real science* label.
  Examples: the ~29.5-day lunar day, LCROSS ice confirmation (2009), the electrolysis mass ratio (1 kg water → 0.89 kg O₂),
  NASA's 600 mSv career dose limit, and ~98% ISS water recovery.
- `src/game/config/balance.ts` and `buildings.ts` hold **game values**: production rates, costs, timers, crew consumption and dose rates.
  These are **not NASA data**. They are tuned so trade-offs show up within minutes. Science cards label them *Game assumption*.

The only real number used directly in the simulation is the electrolysis ratio (0.89).

---

## Architecture

```
src/
  game/
    config/     buildings, balance (all game values), techs, chapters + achievements, science (real facts)
    systems/    pure TypeScript simulation, no Phaser/React imports:
                state, simulation (tick), power, resources, lifeSupport, radiation,
                construction (builders/upgrades/shielding), research, spaceport,
                missions, time (day/night), save (localStorage + offline catch-up), terrain
    art/        procedural low-poly isometric art: painter, buildings (13 types × 5 levels), terrain, props
    entities/   BuildingView (sprite, scaffolding, timers, lights, particles), BuilderBot
    scenes/     BootScene (bakes textures), BackgroundScene (stars, Earth), MoonScene (map, camera, input)
    store.ts    single game store: runs the fixed-step tick (0.25 h), exposes actions to React and Phaser
    bridge.ts   lets React controls reach Phaser (zoom, building previews)
  components/   React + Tailwind HUD: TopBar, MissionsPanel, SidePanel (builders + life support),
                BottomBar, BuildMenu, BuildingInfo, ActionPanels (research, spaceport, placement), Overlays
  utils/        formatting and a seeded RNG
```

**Data flow:** the React HUD and the Phaser map never change resources themselves. They call store actions
(`beginPlacement`, `confirmPlacement`, `upgrade`, `buyBuilder`, `research`, `launch` …). Those actions run validated
functions in `systems/`. The store ticks the simulation and notifies both React (`useSyncExternalStore`) and Phaser.

**Saving:** progress auto-saves to `localStorage` (key `moonbase-v3`) every 10 s, after every action and when the page closes.
A checkpoint is saved at each sunrise for "Retry". When you return, up to 30 minutes of offline time is simulated,
and that catch-up can never fail the mission.

### Art pipeline

All buildings are **drawn procedurally at start-up** in a low-poly isometric style (`src/game/art/`).
They use faceted domes, tanks and boxes, a light direction, outlines, emissive windows that glow at night, and a pad trim
whose colour shows the level (bronze → silver → gold → cyan → magenta). Each building looks different at each of its 5 levels.

**Why not Blender renders?** Blender was not installed on the development machine, and the source 3D models of the
*Low Poly Space Colony Pack* were not in the project. Only small pre-rendered sprites were, and they were nearly white and
low-resolution. The procedural art avoids those limits and any asset-redistribution restrictions. To use real
renders later, bake PNGs and swap the texture keys in `BootScene`; `texKey(type, level)` is the only lookup.

---

## Tests

`npm test` runs the simulation tests in `src/game/systems/simulation.test.ts`. They cover:

- the MVP chain: mining → storage → mission credits → hiring a builder → parallel construction
- builder prices 500/1500/3000/6000, storage caps, placement rules (ice, overlap)
- night solar output is 0, power-priority shutdown, the ⏻ switch, battery caps
- oxygen generation using the 0.89 ratio, failure from no O₂, cold habitats
- regolith shielding, upgrade caps by Command Center level, chapter missions, save round-trip
- research completes only with a powered lab; cargo runs pay out on landing
- difficulty: deposits, day/night split, upgrade speed, 1.2x Impossible solar, saving, survival on all four levels
- monitoring network: one Operations Center, max four stations, levels 1-4, capacity, cable vs radio, power draw, sampling, storm data gaps, save/load
- **balance:** a sensible build order survives the first night, and a colony without batteries suffers a cold night

---

## Credits

Game design, code and procedural art: MoonBase Colony team, NASA Space Apps Challenge.
Inspired by the general base-builder genre. No art, characters or UI from any existing game are used.
See `ASSET_LICENSE_NOTICE.txt` for library and font licenses.
