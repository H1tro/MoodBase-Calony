// Pure decision logic for cloud sync (kept separate so it can be unit-tested).

export interface SyncSides {
  /** When this device last saved locally (ms), or null if there is no local colony. */
  localSavedAt: number | null;
  /** When the cloud save was last updated (ms), or null if there is none. */
  remoteUpdatedAt: number | null;
  /** When this device last synced successfully (ms), or null if never. */
  lastSyncAt: number | null;
}

export type SyncAction = 'upload' | 'download' | 'ask' | 'nothing';

/**
 * - Only one side has a colony → copy it to the other side.
 * - Only one side changed since the last sync → that side wins.
 * - Both changed (or this device has never synced) → ask the player.
 */
export function decideSync({ localSavedAt, remoteUpdatedAt, lastSyncAt }: SyncSides): SyncAction {
  if (localSavedAt === null && remoteUpdatedAt === null) return 'nothing';
  if (remoteUpdatedAt === null) return 'upload';
  if (localSavedAt === null) return 'download';
  if (lastSyncAt === null) return 'ask';
  const localChanged = localSavedAt > lastSyncAt;
  const remoteChanged = remoteUpdatedAt > lastSyncAt + 1000; // allow for clock drift on our own uploads
  if (localChanged && remoteChanged) return 'ask';
  if (remoteChanged) return 'download';
  if (localChanged) return 'upload';
  return 'nothing';
}
