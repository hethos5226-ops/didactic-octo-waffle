/**
 * The backend boundary.
 *
 * Everything the app knows about persistence goes through here, so the
 * question "is there a database?" is answered in one place rather than at
 * every call site. With no project configured the app keeps working exactly as
 * it did — device-local — which is what lets the prototype stay usable while
 * the backend is being set up.
 */
export { isBackendConfigured, supabase, authRedirectUrl } from './client';
export * from './auth';
export * from './profiles';
export * from './storage';
export type { DirectoryPerson, ProfileRow } from './mapping';
