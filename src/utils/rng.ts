/** Mulberry32 — small deterministic PRNG. Returns [value 0..1, nextState]. */
export function rand(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Stateful helper for one-off generation (terrain, art). */
export function makeRng(seed: number) {
  let s = seed | 0;
  return () => {
    const [v, n] = rand(s);
    s = n;
    return v;
  };
}
