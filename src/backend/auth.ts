import { authRedirectUrl, isBackendConfigured, supabase } from './client';

/**
 * Authentication.
 *
 * Apple and Google go through Supabase Auth, which is what makes them real
 * without a server of our own: Supabase performs the OAuth token exchange and
 * the Apple client-secret signing on its side, which is the part that cannot
 * be done in a browser. What is still needed is the provider set up in the
 * Supabase dashboard — see README "Connecting the backend".
 *
 * With no project configured, Apple and Google report that plainly — those
 * cannot be faked, and a fake sign-in hides the work still to do. Email falls
 * back to a device-local account so the app remains usable while the backend
 * is being set up; the UI says which of the two is in force rather than
 * implying the local one is a real account.
 */

export type ProviderId = 'apple' | 'google' | 'email';

export interface AuthAccount {
  userId: string;
  provider: ProviderId;
  email: string | null;
  suggestedName: string | null;
}

export type AuthResult =
  | { status: 'ok'; account: AuthAccount }
  | { status: 'redirecting' }
  | { status: 'not_configured'; provider: ProviderId; missing: string[]; docs: string }
  | { status: 'error'; message: string };

const DOCS: Record<ProviderId, string> = {
  apple: 'https://supabase.com/docs/guides/auth/social-login/auth-apple',
  google: 'https://supabase.com/docs/guides/auth/social-login/auth-google',
  email: 'https://supabase.com/docs/guides/auth/passwords',
};

const BACKEND_MISSING = [
  'A Supabase project (free tier is enough to start)',
  'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local',
  'The migration in supabase/migrations/0001_init.sql run against it',
];

export const PROVIDER_SETUP: Record<'apple' | 'google', string[]> = {
  apple: [
    'An Apple Developer Program membership (paid) — there is no free tier',
    'A Services ID with "Sign in with Apple" enabled',
    'A private key (.p8), its Key ID, and your Team ID',
    'Those pasted into Supabase → Authentication → Providers → Apple',
    'Supabase’s callback URL added to the Services ID’s Return URLs',
  ],
  google: [
    'A Google Cloud project with an OAuth consent screen',
    'An OAuth 2.0 Client ID and secret',
    'Those pasted into Supabase → Authentication → Providers → Google',
    'Supabase’s callback URL added to the client’s Authorised redirect URIs',
  ],
};

/**
 * Turns transport failures into something a person can act on. A raw "Failed
 * to fetch" tells the user nothing and, during setup, usually means the URL is
 * wrong rather than that they are offline.
 */
function readable(message: string): string {
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Could not reach the server. Check your connection, and that VITE_SUPABASE_URL is correct.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'That email and password do not match an account.';
  }
  if (/user already registered/i.test(message)) {
    return 'There is already an account with that email. Try signing in.';
  }
  return message;
}

function accountFromUser(user: {
  id: string;
  email?: string | null;
  app_metadata?: { provider?: string };
  user_metadata?: Record<string, unknown>;
}): AuthAccount {
  const provider = (user.app_metadata?.provider ?? 'email') as ProviderId;
  const meta = user.user_metadata ?? {};
  const name =
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    user.email?.split('@')[0] ??
    null;
  return {
    userId: user.id,
    provider: provider === 'apple' || provider === 'google' ? provider : 'email',
    email: user.email ?? null,
    suggestedName: name,
  };
}

/** The signed-in account, if a session survived a reload or an OAuth return. */
export async function currentAccount(): Promise<AuthAccount | null> {
  const client = supabase();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.user) return null;
  return accountFromUser(data.session.user);
}

/**
 * Starts the OAuth redirect. On success the browser leaves the page, so a
 * `redirecting` result is the good outcome — the session is picked up on the
 * way back in by `detectSessionInUrl`.
 */
export async function signInWithProvider(provider: 'apple' | 'google'): Promise<AuthResult> {
  const client = supabase();
  if (!client) {
    return {
      status: 'not_configured',
      provider,
      missing: [...BACKEND_MISSING, ...PROVIDER_SETUP[provider]],
      docs: DOCS[provider],
    };
  }

  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: authRedirectUrl() },
  });

  if (error) {
    // Supabase says so explicitly when the provider is switched off, which is
    // the likely case on a fresh project — worth telling apart from a fault.
    const disabled = /provider is not enabled|not enabled/i.test(error.message);
    if (disabled) {
      return {
        status: 'not_configured',
        provider,
        missing: PROVIDER_SETUP[provider],
        docs: DOCS[provider],
      };
    }
    return { status: 'error', message: readable(error.message) };
  }
  return { status: 'redirecting' };
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Device-local account, for when no project is connected.
 *
 * This is not authentication — there is nothing to authenticate against. It
 * exists so the app can be used and demonstrated before the backend is set up,
 * and the sign-in screen says as much.
 */
const LOCAL_KEY = 'scroll.account.v1';

function localSignIn(email: string): AuthResult {
  const clean = email.trim().toLowerCase();
  let account: AuthAccount;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const stored = raw ? (JSON.parse(raw) as AuthAccount) : null;
    account = stored?.email === clean
      ? stored
      : {
          userId: `local_${Math.random().toString(36).slice(2, 10)}`,
          provider: 'email',
          email: clean,
          suggestedName: clean.split('@')[0],
        };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(account));
  } catch {
    return { status: 'error', message: 'This browser is blocking storage, so no account can be kept.' };
  }
  return { status: 'ok', account };
}

export function clearLocalAccount() {
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* nothing to clear */ }
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const client = supabase();
  const clean = email.trim().toLowerCase();
  if (!isValidEmail(clean)) return { status: 'error', message: 'That does not look like an email address.' };
  if (password.length < 6) return { status: 'error', message: 'Use at least 6 characters.' };
  if (!client) return localSignIn(clean);
  const { data, error } = await client.auth.signUp({
    email: clean,
    password,
    options: { emailRedirectTo: authRedirectUrl() },
  });
  if (error) return { status: 'error', message: readable(error.message) };

  // With "Confirm email" on (the Supabase default), signUp returns a user but
  // no session — nothing is signed in until the link is clicked. Saying so
  // beats a spinner that never resolves.
  if (!data.session) {
    return {
      status: 'error',
      message: 'Check your email for a confirmation link, then sign in.',
    };
  }
  return { status: 'ok', account: accountFromUser(data.user!) };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const client = supabase();
  const clean = email.trim().toLowerCase();
  if (!isValidEmail(clean)) return { status: 'error', message: 'That does not look like an email address.' };
  if (!client) return localSignIn(clean);

  const { data, error } = await client.auth.signInWithPassword({ email: clean, password });
  if (error) return { status: 'error', message: readable(error.message) };
  return { status: 'ok', account: accountFromUser(data.user) };
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const client = supabase();
  if (!client) {
    return { status: 'not_configured', provider: 'email', missing: BACKEND_MISSING, docs: DOCS.email };
  }
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: authRedirectUrl(),
  });
  if (error) return { status: 'error', message: readable(error.message) };
  return { status: 'error', message: 'Reset link sent — check your email.' };
}

export async function signOut(): Promise<void> {
  clearLocalAccount();
  await supabase()?.auth.signOut();
}

/** Fires when a session appears or disappears, including on OAuth return. */
export function onAuthChange(handler: (account: AuthAccount | null) => void): () => void {
  const client = supabase();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    handler(session?.user ? accountFromUser(session.user) : null);
  });
  return () => data.subscription.unsubscribe();
}

export { isBackendConfigured };
