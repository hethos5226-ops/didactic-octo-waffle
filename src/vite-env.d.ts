/// <reference types="vite/client" />

/**
 * Only VITE_-prefixed variables reach the client, which is what we want: these
 * are public client identifiers. Secrets belong on a server — see
 * src/auth/providers.ts.
 */
interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly VITE_APPLE_CLIENT_ID?: string;
  readonly VITE_APPLE_REDIRECT_URI?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
