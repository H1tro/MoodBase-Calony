import { describe, expect, it } from 'vitest';
import { decideSync } from './cloudDecide';

describe('cloud sync decision', () => {
  it('copies to whichever side is missing a colony', () => {
    expect(decideSync({ localSavedAt: 100, remoteUpdatedAt: null, lastSyncAt: null })).toBe('upload');
    expect(decideSync({ localSavedAt: null, remoteUpdatedAt: 100, lastSyncAt: null })).toBe('download');
    expect(decideSync({ localSavedAt: null, remoteUpdatedAt: null, lastSyncAt: null })).toBe('nothing');
  });

  it('asks on a device that has never synced when both sides have a colony', () => {
    expect(decideSync({ localSavedAt: 100, remoteUpdatedAt: 200, lastSyncAt: null })).toBe('ask');
  });

  it('the side that changed since the last sync wins', () => {
    expect(decideSync({ localSavedAt: 5000, remoteUpdatedAt: 1000, lastSyncAt: 2000 })).toBe('upload');
    expect(decideSync({ localSavedAt: 1000, remoteUpdatedAt: 9000, lastSyncAt: 2000 })).toBe('download');
    expect(decideSync({ localSavedAt: 1500, remoteUpdatedAt: 2500, lastSyncAt: 2000 })).toBe('nothing');
  });

  it('never silently overwrites when both sides changed', () => {
    expect(decideSync({ localSavedAt: 5000, remoteUpdatedAt: 9000, lastSyncAt: 2000 })).toBe('ask');
  });
});
