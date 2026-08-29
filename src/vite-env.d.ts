/// <reference types="vite/client" />

/**
 * Only VITE_-prefixed variables reach the client, which is what we want: these
 * are PUBLIC identifiers. Row-level security is what protects the data — see
 * supabase/migrations/0001_init.sql.
 *
 * Apple and Google are configured in the Supabase dashboard rather than here,
 * because Supabase performs the OAuth token exchange and Apple's client-secret
 * signing server-side. No provider secret belongs in this app.
 */
interface ImportMetaEnv {
  readonly BASE_URL: string;
  /** Project Settings → API → Project URL. */
  readonly VITE_SUPABASE_URL?: string;
  /** Project Settings → API → anon / publishable key. Never the service role. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
