/**
 * The things that change without the app changing.
 *
 * Social links, the contact address and the version live here so that setting
 * up an Instagram account later is editing one line, not touching a screen.
 * Everything is a plain constant — no remote config service, because that is a
 * dependency and a cost for something that changes twice a year.
 */

/** Shown in Settings. Kept in step with package.json by hand; it is one line. */
export const APP_VERSION = '0.1.0';

export const APP_NAME = 'SCROLL';

/**
 * Official accounts.
 *
 * `null` means the account does not exist yet, and the row is hidden rather
 * than linking somewhere broken — an official link that 404s is worse than no
 * link. Filling one in is all that is needed to make it appear.
 */
export const SOCIAL_LINKS: { instagram: string | null; tiktok: string | null } = {
  instagram: null,
  tiktok: null,
};

/**
 * Where people reach a human.
 *
 * An app that takes reports and offers account deletion needs a contact route
 * that is not a form nobody reads — and both app stores require one before
 * they will list it.
 */
export const CONTACT_EMAIL: string | null = null;

/** Handy for the About screen and for anything that has to say "not yet". */
export function hasSocialLinks(): boolean {
  return Boolean(SOCIAL_LINKS.instagram || SOCIAL_LINKS.tiktok);
}
