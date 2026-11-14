/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://abcd1234.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key (sb_publishable_…) — safe to expose; access is limited by Row Level Security. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Older projects: the legacy "anon" public key works the same way. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
