export function fmt(n: number, digits = 0): string {
  if (!isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs >= 100000) return (n / 1000).toFixed(0) + 'k';
  if (abs >= 10000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtRate(n: number, digits = 1): string {
  const s = fmt(Math.abs(n), digits);
  if (Math.abs(n) < 0.005) return '±0';
  return (n > 0 ? '+' : '−') + s;
}

/** Seconds → "m:ss". */
export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
