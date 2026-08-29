import { useState } from 'react';
import { useStore } from '../state/store';

type Doc = 'privacy' | 'terms' | 'about' | null;

/**
 * The drawer for everything that is not the app itself: the account, the legal
 * pages, and the way out. It sits behind a gear on the profile rather than in
 * the main flow, because nothing here is part of a session.
 *
 * The policy text below is placeholder wording for a prototype, not reviewed
 * legal copy — a real launch needs both documents written properly, especially
 * given the app handles screen sharing and voice between strangers.
 */
export function SettingsScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const [openDoc, setOpenDoc] = useState<Doc>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  if (openDoc) {
    return (
      <div className="screen settings">
        <header className="lobby__head">
          <button className="lobby__back" onClick={() => setOpenDoc(null)}>‹</button>
          <div className="grow">
            <h1 className="title">{DOCS[openDoc].title}</h1>
            <p className="subtitle">{DOCS[openDoc].updated}</p>
          </div>
        </header>
        <div className="card settings__doc">
          {DOCS[openDoc].body.map((para) => (
            <p key={para.slice(0, 24)}>{para}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="screen settings">
      <header className="lobby__head">
        <button className="lobby__back" onClick={() => dispatch({ type: 'back' })}>‹</button>
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
        <Row
          emoji="👥"
          label="Friends"
          hint={`${profile.friends.length} ${profile.friends.length === 1 ? 'person' : 'people'}`}
          onClick={() => dispatch({ type: 'go', route: 'friends' })}
        />
      </section>

      <section className="settings__group">
        <span className="eyebrow">LEGAL</span>
        <Row emoji="🔒" label="Privacy policy" onClick={() => setOpenDoc('privacy')} />
        <Row emoji="📄" label="Terms of service" onClick={() => setOpenDoc('terms')} />
        <Row emoji="💜" label="About SCROLL" onClick={() => setOpenDoc('about')} />
      </section>

      <section className="settings__group">
        <span className="eyebrow">DANGER ZONE</span>
        {confirmingSignOut ? (
          <div className="settings__confirm">
            <p className="subtitle">
              Signing out erases this profile — your level, Feed Score and
              friends live on this device only, so they will not come back.
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
            hint="Erases this device-local profile"
            danger
            onClick={() => setConfirmingSignOut(true)}
          />
        )}
      </section>

      <p className="tiny settings__version">SCROLL prototype · v0.1.0</p>
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
    updated: 'Placeholder for the prototype',
    body: [
      'This build stores everything on your device. Your handle, photo, hashtags, level, Feed Score and friends live in this browser’s local storage and are never uploaded, because there is no server to upload them to.',
      'Your profile photo is cropped and shrunk on your device before it is saved. It never leaves the browser.',
      'Nobody else can see your profile in this build. The people you meet are simulated locally, not real accounts.',
      'A real release would need to say a great deal more: what a shared screen is recorded or not recorded as, how voice is transmitted, how long anything is retained, who processes it, how to request deletion, and how reports of abuse are handled. None of that is written yet, and this page is a placeholder rather than a policy.',
    ],
  },
  terms: {
    title: 'Terms of service',
    updated: 'Placeholder for the prototype',
    body: [
      'This is an unreleased prototype shared for feedback. It is not a live service, nothing is charged, and no payment details are collected anywhere in the app.',
      'The feeds you watch are generated. No TikTok, Reels or Shorts content is fetched, embedded, hosted or redistributed at any point.',
      'A real release would need proper terms covering acceptable use, what may be shown on a shared screen, moderation and reporting, account suspension, and the platform rules that govern screen capture. Those are not written yet.',
    ],
  },
  about: {
    title: 'About SCROLL',
    updated: 'Prototype build',
    body: [
      'Meet someone. Watch their FYP. Laugh together. Rate their feed.',
      'You get matched with strangers, one person shares their short-form feed, and everyone watches and reacts to it together. The content is not the product — reacting to somebody else’s algorithm is.',
      'Everything in this build is simulated: the people, the feeds, the matchmaking and the Premium purchase. It exists to show how the experience feels, not to be a working service.',
    ],
  },
};
