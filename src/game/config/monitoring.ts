// GAME VALUES — the Lunar Monitoring Network (Operations Center + Monitoring Stations).
// Real reference values used for the simulated sensors are marked REAL.

export type LinkKind = 'wired' | 'wireless';

export const MONITORING = {
  /** Most Monitoring Stations a colony may build. */
  maxStations: 4,
  /** Connected stations the Operations Center can serve = its level. */
  capacityPerLevel: 1,
  /** Colony hours between measurements. */
  sampleEvery: 2,
  /** Samples kept per station (one full 360 h day–night cycle). */
  historyLength: 180,
  links: {
    wired: { label: 'Cable', icon: '🔌', powerKW: 0.1, rangeTiles: 10, rangePerLevel: 0, regolithPerTile: 15, quality: 1.0, flareQuality: 1.0, latencyMs: 2 },
    wireless: { label: 'Radio', icon: '📶', powerKW: 0.4, rangeTiles: 14, rangePerLevel: 2, regolithPerTile: 0, quality: 0.95, flareQuality: 0.35, latencyMs: 8 },
  },
  /** Below this link quality a sample is lost (data gap). */
  minQuality: 0.5,
  /** Credits per sample per station level: science data sold to Earth. */
  creditsPerSample: 0.5,
  /** Extra flare warning per active station (s), once warnings unlock at Ops level 3. */
  warningPerStation: 10,
  /** Ops Center level that unlocks each feature. */
  unlock: { history: 2, graphs: 3, warnings: 3, dashboard: 4 },

  // ---- Sensor model ----
  /** Surface temperature range in °C. REAL: lunar equator ~ +120 °C day, below −170 °C night. */
  tempDay: 120,
  tempNight: -170,
  /** Cold-trap offset for stations on or next to ice (°C). */
  iceColdOffset: -40,
  /** REAL: Chang'e-4 measured ~57 µSv/h of radiation dose rate on the lunar surface (2019–2020). */
  radiationBackground: 57,
  /** REAL: solar constant at Earth–Moon distance, W/m² (no atmosphere to absorb it). */
  solarConstant: 1361,
} as const;

export const STATION_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500']; // validated on the dark panel surface
