import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase connection, and the question of whether there is one.
 *
 * The app has to run in two situations: connected to a real project, and not
 * connected to anything at all. The second is not a courtesy — it is the state
 * the app is in right now, before any project exists, and it is what lets the
 * prototype keep working while the backend is being set up.
 *
 * Everything downstream branches on `isBackendConfigured()`. Nothing pretends:
 * when there is no project, data is device-local and the UI says so.
 *
 * Only the anon key belongs here. It is public by design and safe to ship —
 * row-level security is what actually protects the data, which is why every
 * table in the migration has policies. The service-role key bypasses RLS
 * entirely and must never appear in client code.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export function isBackendConfigured(): boolean {
  return url.length > 0 && anonKey.length > 0;
}

let cached: SupabaseClient | null = null;

/**
 * Returns null rather than throwing when unconfigured, so callers branch on it
 * instead of wrapping every call in a try/catch.
 */
export function supabase(): SupabaseClient | null {
  if (!isBackendConfigured()) return null;
  if (!cached) {
    cached = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // OAuth returns to the app with the session in the URL fragment;
        // this is what picks it up and then cleans the address bar.
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return cached;
}

/**
 * Where an email confirmation, a password reset or an OAuth return should come
 * back to.
 *
 * Resolved against the current page rather than the origin, which is what
 * makes a subpath deploy work. GitHub Pages serves a project site from
 * /<repo>/, and `base` is './' (see vite.config.ts), so resolving against the
 * origin would produce https://user.github.io/ — dropping the repo and landing
 * every confirmation link on a 404.
 */
export function authRedirectUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.href).toString();
}
