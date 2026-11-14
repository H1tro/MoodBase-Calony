// Cloud saves with Supabase. The browser's local save stays the source of truth
// while playing; when a player is signed in, it is mirrored to their own row in
// the `saves` table (see supabase/schema.sql). Without configuration the game
// simply runs offline.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { decideSync } from './systems/cloudDecide';
import { afterSave, CHECKPOINT_KEY, SAVE_KEY } from './systems/save';
import { afterProfileSave, PROFILE_KEY } from './systems/profile';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
const LAST_SYNC_KEY = 'moonbase-v3-cloud-last-sync';
const UPLOAD_DELAY = 5000;

export const cloudConfigured = !!(URL && KEY);
const supabase: SupabaseClient | null = cloudConfigured ? createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

export type CloudStatus = 'disabled' | 'signed-out' | 'link-sent' | 'syncing' | 'synced' | 'conflict' | 'error';

export interface SaveSummary { difficulty: string | null; cycle: number | null; hours: number | null; updatedAt: number }
export interface CloudState {
  status: CloudStatus;
  email: string | null;
  lastSync: number | null;
  error: string | null;
  /** Both sides changed: details for the "which save?" choice. */
  conflict: { local: SaveSummary; remote: SaveSummary } | null;
}

let state: CloudState = {
  status: cloudConfigured ? 'signed-out' : 'disabled',
  email: null,
  lastSync: readLastSync(),
  error: null,
  conflict: null,
};
const listeners = new Set<() => void>();
let uploadTimer: ReturnType<typeof setTimeout> | null = null;
let userId: string | null = null;
/** Called after a download so the game reloads from local storage. */
let onDownloaded: () => void = () => undefined;

function set(patch: Partial<CloudState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}
export const getCloud = () => state;
export function subscribeCloud(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function ls(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function readLastSync(): number | null {
  const v = ls(LAST_SYNC_KEY);
  return v ? Number(v) : null;
}
function markSynced() {
  const now = Date.now();
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(now));
  } catch {
    /* ignore */
  }
  set({ status: 'synced', lastSync: now, error: null, conflict: null });
}

function summarize(json: unknown, updatedAt: number): SaveSummary {
  const c = (json ?? {}) as { difficulty?: string; cycle?: { index?: number }; time?: number };
  return { difficulty: c.difficulty ?? null, cycle: c.cycle?.index != null ? c.cycle.index + 1 : null, hours: c.time != null ? Math.round(c.time) : null, updatedAt };
}
function localColony(): { json: unknown; savedAt: number } | null {
  const raw = ls(SAVE_KEY);
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { savedAt?: number };
    return { json: j, savedAt: j.savedAt ?? 0 };
  } catch {
    return null;
  }
}

// ---------------- Auth ----------------
export async function initCloud(reload: () => void) {
  onDownloaded = reload;
  if (!supabase) return;
  afterSave.add(scheduleUpload);
  afterProfileSave.add(scheduleUpload);
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    userId = data.session.user.id;
    set({ email: data.session.user.email ?? null, status: 'syncing' });
    await reconcile();
  }
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session && session.user.id !== userId) {
      userId = session.user.id;
      set({ email: session.user.email ?? null, status: 'syncing' });
      void reconcile();
    }
    if (event === 'SIGNED_OUT') {
      userId = null;
      set({ email: null, status: 'signed-out', conflict: null });
    }
  });
}

export async function sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Cloud save is not configured.' };
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  if (error) return { ok: false, error: error.message };
  set({ status: 'link-sent', email, error: null });
  return { ok: true };
}

export async function signOut() {
  if (!supabase) return;
  if (uploadTimer) clearTimeout(uploadTimer);
  await supabase.auth.signOut();
}

// ---------------- Sync ----------------
async function fetchRemote() {
  const { data, error } = await supabase!.from('saves').select('colony, checkpoint, profile, updated_at').eq('user_id', userId!).maybeSingle();
  if (error) throw error;
  return data as { colony: unknown; checkpoint: unknown; profile: unknown; updated_at: string } | null;
}

/** On sign-in: decide whether to upload, download or ask. */
export async function reconcile() {
  if (!supabase || !userId) return;
  try {
    set({ status: 'syncing', error: null });
    const remote = await fetchRemote();
    const local = localColony();
    const remoteAt = remote?.colony ? Date.parse(remote.updated_at) : null;
    const action = decideSync({ localSavedAt: local?.savedAt ?? null, remoteUpdatedAt: remoteAt, lastSyncAt: readLastSync() });
    if (action === 'upload') await uploadNow();
    else if (action === 'download' && remote) applyRemote(remote);
    else if (action === 'ask' && remote && local) {
      set({ status: 'conflict', conflict: { local: summarize(local.json, local.savedAt), remote: summarize(remote.colony, remoteAt!) } });
    } else if (!remote && ls(PROFILE_KEY)) await uploadNow();
    else markSynced();
  } catch (e) {
    set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

/** Mirror the local saves to the player's cloud row now. */
export async function uploadNow() {
  if (!supabase || !userId) return;
  try {
    set({ status: 'syncing', error: null });
    const parse = (k: string) => {
      const raw = ls(k);
      try {
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };
    const colony = parse(SAVE_KEY);
    const { error } = await supabase.from('saves').upsert({
      user_id: userId,
      colony,
      checkpoint: parse(CHECKPOINT_KEY),
      profile: parse(PROFILE_KEY),
      difficulty: colony?.difficulty ?? null,
      version: colony?.version ?? 3,
    });
    if (error) throw error;
    markSynced();
  } catch (e) {
    set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

/** Download the cloud save into this browser and reload the game from it. */
export async function downloadNow() {
  if (!supabase || !userId) return;
  try {
    set({ status: 'syncing', error: null });
    const remote = await fetchRemote();
    if (remote) applyRemote(remote);
    else markSynced();
  } catch (e) {
    set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

function applyRemote(remote: { colony: unknown; checkpoint: unknown; profile: unknown }) {
  try {
    if (remote.colony) localStorage.setItem(SAVE_KEY, JSON.stringify({ ...(remote.colony as object), savedAt: Date.now() }));
    if (remote.checkpoint) localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(remote.checkpoint));
    if (remote.profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(remote.profile));
  } catch {
    /* storage full: keep playing locally */
  }
  markSynced();
  onDownloaded();
}

/** Called after every local save: upload a few seconds later (batched). */
export function scheduleUpload() {
  if (!supabase || !userId || state.status === 'conflict') return;
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(() => void uploadNow(), UPLOAD_DELAY);
}

/** Resolve a conflict: keep this device's save (upload) or the cloud's (download). */
export async function resolveConflict(keep: 'local' | 'cloud') {
  set({ conflict: null });
  if (keep === 'local') await uploadNow();
  else await downloadNow();
}
