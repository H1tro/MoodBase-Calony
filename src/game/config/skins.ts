/**
 * Surface skins: a cosmetic look for the map and sky.
 * GAME ASSUMPTION: skins only change colours. The simulation (day length, sunlight,
 * resources, radiation) always uses the lunar values described in the Lunar Library.
 */
export type SkinId = 'moon' | 'mars' | 'europa' | 'titan';

export interface Skin {
  id: SkinId;
  name: string;
  /** One line of real science shown in Options. */
  fact: string;
  /** Per-channel multipliers applied to the grey lunar palette. */
  tint: [number, number, number];
  /** Colour of ore-rich ground (it must stand out from the tinted ground). */
  ore: number;
  /** Tint for boulder sprites. */
  prop: number;
  /** Sky gradient at night [top, bottom] and at noon [top, bottom]. */
  skyNight: [number, number];
  skyDay: [number, number];
  /** How strongly daylight hides the stars (1 = fully hidden at noon). */
  starFade: number;
  /** Apparent size of the Sun compared with the view from the Moon. */
  sun: number;
  /** Atmosphere glow on the horizon; null where there is no air. */
  haze: number | null;
  /** What hangs in the sky. */
  sky: 'earth' | 'moons' | 'jupiter' | 'saturn';
}

export const SKINS: Record<SkinId, Skin> = {
  moon: {
    id: 'moon', name: 'Moon',
    fact: 'Grey regolith under a black sky: with no air, the sky stays dark even at noon.',
    tint: [1, 1, 1], ore: 0xa8775c, prop: 0xffffff,
    skyNight: [0x010208, 0x070b1c], skyDay: [0x010208, 0x070b1c], starFade: 0.55, sun: 1, haze: null, sky: 'earth',
  },
  mars: {
    id: 'mars', name: 'Mars',
    fact: 'Iron oxide dust makes the ground rust-red, and dust in the thin air turns the daytime sky butterscotch.',
    tint: [1.3, 0.74, 0.5], ore: 0x3f3a78, prop: 0xe09a6a,
    skyNight: [0x05030a, 0x1a0f12], skyDay: [0x9a6a48, 0xd9a877], starFade: 1, sun: 0.66, haze: 0xe0a070, sky: 'moons',
  },
  europa: {
    id: 'europa', name: 'Europa',
    fact: 'An ice shell over a hidden ocean, with Jupiter filling the sky. The Sun looks five times smaller than from Earth.',
    tint: [1.02, 1.12, 1.24], ore: 0x9a6a4a, prop: 0xd6ecff,
    skyNight: [0x01030a, 0x06101f], skyDay: [0x01030a, 0x06101f], starFade: 0.35, sun: 0.19, haze: null, sky: 'jupiter',
  },
  titan: {
    id: 'titan', name: 'Titan',
    fact: 'Saturn’s largest moon has a thick orange haze of nitrogen and methane that hides the stars.',
    tint: [1.08, 0.82, 0.46], ore: 0x2f5f88, prop: 0xd0a060,
    skyNight: [0x140c04, 0x2a1a08], skyDay: [0x7a5318, 0xc08a2e], starFade: 1, sun: 0.11, haze: 0xd89a3a, sky: 'saturn',
  },
};

export const SKIN_ORDER: SkinId[] = ['moon', 'mars', 'europa', 'titan'];
export const skinOf = (id: string | undefined): Skin => SKINS[(id as SkinId) in SKINS ? (id as SkinId) : 'moon'];

/** Recolour a grey palette colour for a skin. Saturated colours (ice, ore, UI lines) are left alone. */
export function toneFor(skin: Skin) {
  const [tr, tg, tb] = skin.tint;
  if (tr === 1 && tg === 1 && tb === 1) return (c: number) => c;
  return (c: number) => {
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 40) return c;
    const f = (v: number, k: number) => Math.max(0, Math.min(255, Math.round(v * k)));
    return (f(r, tr) << 16) | (f(g, tg) << 8) | f(b, tb);
  };
}
