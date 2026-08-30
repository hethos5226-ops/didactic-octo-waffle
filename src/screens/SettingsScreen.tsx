import { useState } from 'react';
import { useStore } from '../state/store';
import { deleteMyAccount, isBackendConfigured } from '../backend';
import { APP_VERSION, CONTACT_EMAIL, SOCIAL_LINKS } from '../config/app';

type Doc = 'privacy' | 'terms' | 'about' | 'guidelines' | null;

/**
 * The drawer for everything that is not the app itself: the account, the legal
 * pages, and the way out. It sits behind a gear on the profile rather than in
 * the main flow, because nothing here is part of a session.
 *
 * The documents below are honest descriptions of what this build does, not
 * reviewed legal copy. That distinction matters: a placeholder that overstates
 * privacy is worse than no page at all, and the previous version of this file
 * said data "never leaves the browser" — which stopped being true the moment a
 * Supabase project was connected. LEGAL_READINESS.md lists what a real launch
 * actually requires.
 */
export function SettingsScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const [openDoc, setOpenDoc] = useState<Doc>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const connected = isBackendConfigured();

  const removeAccount = async () => {
    setDeleting(true);
    await deleteMyAccount(profile.id);
    dispatch({ type: 'signOut' });
  };

  if (openDoc) {
    const doc = DOCS[openDoc];
    return (
      <div className="screen settings">
        <header className="lobby__head">
          <button className="lobby__back" onClick={() => setOpenDoc(null)}>‹</button>
          <div className="grow">
            <h1 className="title">{doc.title}</h1>
            <p className="subtitle">{doc.updated}</p>
          </div>
        </header>
        <div className="card settings__doc">
          {doc.body.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
        </div>
      </div>
    );
  }

  return (
    <div className="screen settings">
      <header className="lobby__head">
        <div className="grow">
          <h1 className="title">Settings</h1>
          <p className="subtitle">@{profile.handle}</p>
        </div>
      </header>

      <section className="settings__group">
        <span className="eyebrow">ACCOUNT</span>
        <Row
          emoji="✏️"
          label="Edit profile"
          hint="Face, colour, country, hashtags"
          onClick={() => dispatch({ type: 'go', route: 'editProfile' })}
        />
        <Row
          emoji="👑"
          label={profile.premium ? 'Manage Premium' : 'Get Premium'}
          hint={profile.premium ? 'Active' : 'No ads, and scroll first'}
          onClick={() => dispatch({ type: 'go', route: 'premium' })}
        />
      </section>

      <section className="settings__group">
        <span className="eyebrow">ABOUT SCROLL</span>
        <Row emoji="💜" label="About SCROLL" onClick={() => setOpenDoc('about')} />
        <Row emoji="🤝" label="Community guidelines" onClick={() => setOpenDoc('guidelines')} />
        <Row emoji="🔒" label="Privacy policy" onClick={() => setOpenDoc('privacy')} />
        <Row emoji="📄" label="Terms of service" onClick={() => setOpenDoc('terms')} />
        {CONTACT_EMAIL && (
          <Row
            emoji="✉️"
            label="Contact"
            hint={CONTACT_EMAIL}
            onClick={() => { window.location.href = `mailto:${CONTACT_EMAIL}`; }}
          />
        )}
        {/* Hidden until the accounts exist. An official link that goes nowhere
            is worse than no link, and filling one in is a one-line change in
            src/config/app.ts rather than an edit to this screen. */}
        {SOCIAL_LINKS.instagram && (
          <Row
            emoji="📷"
            label="Official Instagram"
            onClick={() => window.open(SOCIAL_LINKS.instagram!, '_blank', 'noopener,noreferrer')}
          />
        )}
        {SOCIAL_LINKS.tiktok && (
          <Row
            emoji="🎵"
            label="Official TikTok"
            onClick={() => window.open(SOCIAL_LINKS.tiktok!, '_blank', 'noopener,noreferrer')}
          />
        )}
      </section>

      <section className="settings__group">
        <span className="eyebrow">DANGER ZONE</span>
        {confirmingSignOut ? (
          <div className="settings__confirm">
            <p className="subtitle">
              {connected
                ? 'Signing out leaves your account and profile in place. You can sign back in with the same email.'
                : 'Signing out erases this profile — your level, Feed Score and friends live on this device only, so they will not come back.'}
            </p>
            <div className="row settings__confirm-actions">
              <button className="btn btn--ghost grow" onClick={() => setConfirmingSignOut(false)}>
                Cancel
              </button>
              <button className="btn btn--danger grow" onClick={() => dispatch({ type: 'signOut' })}>
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <Row
            emoji="🚪"
            label="Sign out"
            hint={connected ? 'Your account stays' : 'Erases this device-local profile'}
            danger
            onClick={() => setConfirmingSignOut(true)}
          />
        )}

        {confirmingDelete ? (
          <div className="settings__confirm">
            <p className="subtitle">
              This deletes your profile, photo, friends, follows, notifications
              and match history. It cannot be undone.
            </p>
            <div className="row settings__confirm-actions">
              <button
                className="btn btn--ghost grow"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button className="btn btn--danger grow" onClick={removeAccount} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete for good'}
              </button>
            </div>
          </div>
        ) : (
          <Row
            emoji="🗑️"
            label="Delete account"
            hint="Removes your data permanently"
            danger
            onClick={() => setConfirmingDelete(true)}
          />
        )}
      </section>

      <p className="tiny settings__version">SCROLL prototype · v{APP_VERSION}</p>
    </div>
  );
}

interface RowProps {
  emoji: string;
  label: string;
  hint?: string;
  danger?: boolean;
  onClick: () => void;
}

function Row({ emoji, label, hint, danger, onClick }: RowProps) {
  return (
    <button className={`settings__row${danger ? ' is-danger' : ''}`} onClick={onClick}>
      <span className="settings__row-emoji" aria-hidden>{emoji}</span>
      <span className="grow settings__row-body">
        <span className="settings__row-label">{label}</span>
        {hint && <span className="settings__row-hint">{hint}</span>}
      </span>
      <span className="settings__row-arrow" aria-hidden>›</span>
    </button>
  );
}

const DOCS: Record<Exclude<Doc, null>, { title: string; updated: string; body: string[] }> = {
  privacy: {
    title: 'Privacy policy',
    updated: 'Plain description of this build — not reviewed legal copy',
    body: [
      'SCROLL collects the least it can. There is no behavioural tracking, no advertising profile, no tracking pixel, no analytics product, no contact upload, no location collection and no device fingerprinting. Nothing about what you watch is sold or shared.',
      'When SCROLL is connected to its database, your account holds: your email address (so you can sign in), your handle and display name, and the profile you filled in — avatar, colour, country, bio, vibes and hashtags. Alongside that it stores who you are friends with, who you follow, your notifications, and a summary of matches you have played.',
      'Your profile photo is cropped and shrunk on your device before it is uploaded, so the original never leaves your phone. Only the smaller version is stored.',
      'Reactions are stored as counts for a round, not as a record of who reacted to what and when. SCROLL does not keep a history of what you watched.',
      'Deleting your account removes your profile, photo, friends, follows, notifications and match history. One thing survives: the login record itself, which needs an administrative key to remove and is queued for deletion rather than removed instantly. Reports you have filed about other people are kept but detached from you, so deleting an account cannot erase evidence of harassment.',
      'The people you play against are either real accounts or bots. Bots are labelled as bots and are never counted as real players.',
      'SCROLL does not use your camera or microphone, and does not read your photo library, unless you are explicitly asked and agree first. Nothing is recorded.',
      'This is a prototype, and this page describes what the code actually does today rather than being a reviewed legal document. A public launch needs one written properly.',
    ],
  },
  terms: {
    title: 'Terms of service',
    updated: 'Plain description of this build — not reviewed legal copy',
    body: [
      'This is an unreleased prototype shared for feedback. It is not a live service, nothing is charged, and no payment details are collected anywhere in the app. The Premium screen is an interface preview.',
      'The feeds you watch are generated by SCROLL itself. No TikTok, Reels or Shorts content is fetched, embedded, hosted or redistributed at any point.',
      'Be decent to the people you are matched with. Harassment, hate, sexual content involving minors, and threats are not acceptable, and accounts can be suspended.',
      'A real release needs proper terms covering acceptable use, moderation and reporting, suspension and appeals, subscriptions, and the platform rules that govern any shared screen. Those are not written yet.',
    ],
  },
  guidelines: {
    title: 'Community guidelines',
    updated: 'Plain description of this build — not reviewed legal copy',
    body: [
      'SCROLL puts you in a room with strangers to watch things together. That only works if the room is safe.',
      'Do not harass, threaten, demean or sexualise anyone. Do not share hate speech. Do not share sexual content, and never anything involving a minor.',
      'Do not share content you have no right to share, and do not use SCROLL to promote scams or spam.',
      'You can block someone from their profile, which stops them following you or sending you a friend request. You can report a person or a video with the reason that fits.',
      'Reports are recorded and reviewed. Accounts that break these rules can be suspended or removed.',
      'SCROLL is not intended for children. Age requirements are part of what a public launch has to settle — see LEGAL_READINESS.md in the repository.',
    ],
  },
  about: {
    title: 'About SCROLL',
    updated: `Prototype build · v${APP_VERSION}`,
    body: [
      'Meet someone. Watch their FYP. Laugh together. Rate their feed.',
      'You get matched with people, one person shares their short-form feed, and everyone watches and reacts to it together. The content is not the product — reacting to somebody else’s algorithm is.',
      'SCROLL is not a place to make videos, upload them or host them. It never has been, and the architecture is deliberately built so it does not have to become one: a video is a reference to something that lives somewhere else, and the session does not care where.',
      'This build plays SCROLL’s own generated sample content. Accounts, profiles, friends and the directory are real when the database is connected; matchmaking and shared sessions are still being built, and lobbies are filled with bots that are labelled as bots.',
    ],
  },
};
