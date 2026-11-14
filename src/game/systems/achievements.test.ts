import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, CATEGORIES, evaluateAchievements } from '../config/achievements';
import { createInitialState } from './state';
import { createProfile, DEFAULT_SETTINGS, parseProfile } from './profile';
import { DIFFICULTY_ORDER } from '../config/difficulty';

describe('achievements', () => {
  it('has unique ids, a known category, and checks that never throw on a fresh colony', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(25);
    const s = createInitialState(1);
    const p = createProfile();
    for (const a of ACHIEVEMENTS) {
      expect(CATEGORIES).toContain(a.category);
      expect(() => a.check(s, p)).not.toThrow();
    }
  });

  it('nothing unlocks on a brand-new colony', () => {
    expect(evaluateAchievements(createInitialState(1), createProfile())).toHaveLength(0);
  });

  it('unlocks once, records difficulty, and mirrors into the colony', () => {
    const s = createInitialState(1, 'hard');
    const p = createProfile();
    s.stats.buildingsBuilt = 1;
    const first = evaluateAchievements(s, p).map((a) => a.id);
    expect(first).toContain('groundbreaker');
    expect(p.unlocked.groundbreaker.difficulty).toBe('hard');
    expect(s.achievements).toContain('groundbreaker');
    expect(evaluateAchievements(s, p).map((a) => a.id)).not.toContain('groundbreaker');
  });

  it('career achievements use profile stats (All-Rounder, Veteran, Second Chance)', () => {
    const s = createInitialState(1);
    const p = createProfile();
    for (const d of DIFFICULTY_ORDER.slice(0, 3)) p.stats.nights[d] = 1;
    expect(evaluateAchievements(s, p).map((a) => a.id)).not.toContain('allRounder');
    p.stats.nights.impossible = 1;
    p.stats.launches = 5;
    p.stats.retries = 1;
    const ids = evaluateAchievements(s, p).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['allRounder', 'veteran', 'secondChance']));
  });
});

describe('profile', () => {
  it('fills defaults for missing or broken data', () => {
    expect(parseProfile(null).settings).toEqual(DEFAULT_SETTINGS);
    expect(parseProfile('{broken').stats.launches).toBe(0);
    const partial = parseProfile(JSON.stringify({ settings: { graphics: 'low' }, stats: { launches: 3 } }));
    expect(partial.settings.graphics).toBe('low');
    expect(partial.settings.cinematic).toBe(true);
    expect(partial.stats.launches).toBe(3);
    expect(partial.stats.nights.impossible).toBe(0);
  });

  it('round-trips through JSON', () => {
    const p = createProfile();
    p.unlocked.nightOwl = { at: 1, difficulty: 'easy' };
    p.settings.defaultSpeed = 4;
    const q = parseProfile(JSON.stringify(p));
    expect(q.unlocked.nightOwl.difficulty).toBe('easy');
    expect(q.settings.defaultSpeed).toBe(4);
  });
});
