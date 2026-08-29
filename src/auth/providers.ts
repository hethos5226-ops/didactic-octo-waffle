/**
 * Sign-in providers.
 *
 * Apple and Google are wired up to the point where only credentials are
 * missing: the buttons, the call site, the result handling and the error
 * surface all exist. What they deliberately do NOT do is pretend to succeed.
 * Tapping them returns `not_configured` with the exact list of what is still
 * needed, which is shown in the UI, because a fake "signed in with Apple" is
 * worse than an honest wall — it hides the work still to do and it is the kind
 * of thing that quietly ships.
 *
 * Email is genuinely functional, but only on this device: the account lives in
 * localStorage and there is no server, no password reset and no verification.
 * The UI says so rather than implying otherwise.
 *
 * See README "Configuring real sign-in" for what to add.
 */

export type ProviderId = 'apple' | 'google' | 'email';

export interface ProviderConfig {
  /** Populated from build-time env; null means the provider is not set up. */
  clientId: string | null;
  redirectUri: string | null;
}

export interface AuthAccount {
  /** Stable id from the provider, or a local one for email. */
  userId: string;
  provider: ProviderId;
  email: string | null;
  /** Providers may supply a name; onboarding can pre-fill from it. */
  suggestedName: string | null;
}

export type AuthResult =
  | { status: 'ok'; account: AuthAccount }
  | { status: 'not_configured'; provider: ProviderId; missing: string[]; docs: string }
  | { status: 'error'; message: string };

/**
 * Vite exposes only VITE_-prefixed vars to the client, which is correct here:
 * these are public client identifiers. Client *secrets* must never reach this
 * file — the token exchange belongs on a server.
 */
const env = import.meta.env as Record<string, string | undefined>;

export const PROVIDER_CONFIG: Record<'apple' | 'google', ProviderConfig> = {
  apple: {
    clientId: env.VITE_APPLE_CLIENT_ID ?? null,
    redirectUri: env.VITE_APPLE_REDIRECT_URI ?? null,
  },
  google: {
    clientId: env.VITE_GOOGLE_CLIENT_ID ?? null,
    redirectUri: env.VITE_GOOGLE_REDIRECT_URI ?? null,
  },
};

export const REQUIRED_CONFIG: Record<'apple' | 'google', string[]> = {
  apple: [
    'An Apple Developer Program membership (paid)',
    'A Services ID configured for "Sign in with Apple"',
    'A private key (.p8) plus its Key ID and your Team ID',
    'VITE_APPLE_CLIENT_ID and VITE_APPLE_REDIRECT_URI',
    'A server endpoint to exchange the code for a token — the client secret is a signed JWT and must never live in the app',
  ],
  google: [
    'A Google Cloud project with an OAuth consent screen',
    'An OAuth 2.0 Client ID for iOS and/or Web',
    'VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_REDIRECT_URI',
    'Your redirect URI added to the client’s allowed list',
    'A server endpoint to verify the ID token before trusting it',
  ],
};

const DOCS: Record<'apple' | 'google', string> = {
  apple: 'https://developer.apple.com/sign-in-with-apple/',
  google: 'https://developers.google.com/identity/protocols/oauth2',
};

export function isConfigured(provider: 'apple' | 'google'): boolean {
  const config = PROVIDER_CONFIG[provider];
  return Boolean(config.clientId && config.redirectUri);
}

/**
 * Where the real OAuth flow will go. The redirect is intentionally not
 * attempted while unconfigured — sending someone to a broken consent screen is
 * a worse failure than telling them it is not set up.
 */
export async function signInWithProvider(provider: 'apple' | 'google'): Promise<AuthResult> {
  if (!isConfigured(provider)) {
    return {
      status: 'not_configured',
      provider,
      missing: REQUIRED_CONFIG[provider],
      docs: DOCS[provider],
    };
  }

  // Configured builds land here. The exchange must happen server-side, so this
  // starts the redirect and the app resumes from the callback.
  return {
    status: 'error',
    message:
      `${provider === 'apple' ? 'Apple' : 'Google'} is configured, but the ` +
      'server-side token exchange endpoint has not been built yet.',
  };
}

const EMAIL_KEY = 'scroll.account.v1';

interface StoredAccount extends AuthAccount {
  /** Never a real credential store — see the note at the top of this file. */
  passwordHint: string;
}

function readStored(): StoredAccount | null {
  try {
    const raw = localStorage.getItem(EMAIL_KEY);
    return raw ? (JSON.parse(raw) as StoredAccount) : null;
  } catch {
    return null;
  }
}

export function storedAccount(): AuthAccount | null {
  return readStored();
}

export function clearStoredAccount() {
  try {
    localStorage.removeItem(EMAIL_KEY);
  } catch {
    /* Private browsing; nothing to clear. */
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Device-local account creation. Real email auth needs a server for
 * verification, password storage and reset; this exists so the rest of the app
 * can be walked through without one.
 */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const clean = email.trim().toLowerCase();
  if (!isValidEmail(clean)) {
    return { status: 'error', message: 'That does not look like an email address.' };
  }
  if (password.length < 6) {
    return { status: 'error', message: 'Use at least 6 characters.' };
  }

  const existing = readStored();
  if (existing && existing.email === clean && existing.passwordHint !== hint(password)) {
    return { status: 'error', message: "That password doesn't match this device's account." };
  }

  const account: StoredAccount = existing?.email === clean
    ? existing
    : {
        userId: `local_${Math.random().toString(36).slice(2, 10)}`,
        provider: 'email',
        email: clean,
        suggestedName: clean.split('@')[0],
        passwordHint: hint(password),
      };

  try {
    localStorage.setItem(EMAIL_KEY, JSON.stringify(account));
  } catch {
    return { status: 'error', message: 'This browser is blocking storage, so the account cannot be kept.' };
  }
  return { status: 'ok', account };
}

/**
 * A length marker, NOT a password hash. It exists only so the same device
 * cannot sign in with a different password by accident. Nothing here is a
 * security boundary, and no password is stored.
 */
function hint(password: string): string {
  return `len:${password.length}`;
}
