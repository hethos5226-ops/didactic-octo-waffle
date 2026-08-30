import { useState } from 'react';
import {
  isBackendConfigured, signInWithProvider, type AuthResult, type ProviderId,
} from '../backend';
import { useStore } from '../state/store';

type Doc = 'terms' | 'privacy' | null;

/**
 * First launch.
 *
 * Apple and Google go through Supabase Auth, which performs the token exchange
 * and Apple's client-secret signing server-side — the parts a browser cannot
 * do. Until a project is connected and the providers are switched on, tapping
 * one opens a sheet listing exactly what is missing. Nothing fakes a session.
 */
export function WelcomeScreen() {
  const { dispatch } = useStore();
  const [blocked, setBlocked] = useState<Extract<AuthResult, { status: 'not_configured' }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [doc, setDoc] = useState<Doc>(null);

  const useProvider = async (provider: 'apple' | 'google') => {
    setError(null);
    setBusy(provider);
    const result = await signInWithProvider(provider);
    if (result.status === 'redirecting') return; // The page is leaving.
    setBusy(null);
    if (result.status === 'not_configured') setBlocked(result);
    else if (result.status === 'error') setError(result.message);
    else if (result.status === 'ok') dispatch({ type: 'signedIn', account: result.account });
  };

  if (doc) {
    return (
      <div className="screen welcome-doc">
        <header className="lobby__head">
          <button className="lobby__back" onClick={() => setDoc(null)}>‹</button>
          <div className="grow">
            <h1 className="title">{doc === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</h1>
            <p className="subtitle">Placeholder for the prototype</p>
          </div>
        </header>
        <div className="card settings__doc">
          {(doc === 'terms' ? TERMS : PRIVACY).map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="screen welcome">
      <div className="welcome__glow" aria-hidden />

      <div className="welcome__brand">
        <div className="welcome__emoji-run" aria-hidden>
          {['😂', '💀', '🔥', '🤯', '😭', '❤️'].map((e, i) => (
            <span key={e} style={{ animationDelay: `${i * 0.18}s` }}>{e}</span>
          ))}
        </div>
        <h1 className="welcome__wordmark">SCROLLR</h1>
        <p className="welcome__tagline">
          Meet someone. Watch their FYP.<br />Laugh together. Rate their feed.
        </p>
      </div>

      <div className="welcome__actions">
        <button
          className="auth-btn auth-btn--apple"
          onClick={() => useProvider('apple')}
          disabled={busy !== null}
        >
          <span className="auth-btn__mark" aria-hidden>&#63743;</span>
          Continue with Apple
          {!isBackendConfigured() && <span className="auth-btn__note">Setup needed</span>}
        </button>

        <button
          className="auth-btn auth-btn--google"
          onClick={() => useProvider('google')}
          disabled={busy !== null}
        >
          <span className="auth-btn__mark auth-btn__mark--g" aria-hidden>G</span>
          Continue with Google
          {!isBackendConfigured() && <span className="auth-btn__note">Setup needed</span>}
        </button>

        <button
          className="auth-btn auth-btn--email"
          onClick={() => dispatch({ type: 'go', route: 'emailAuth' })}
          disabled={busy !== null}
        >
          <span className="auth-btn__mark" aria-hidden>✉️</span>
          Continue with Email
        </button>

        {error && <p className="welcome__error">{error}</p>}
      </div>

      <p className="welcome__legal">
        By continuing you agree to our{' '}
        <button className="welcome__link" onClick={() => setDoc('terms')}>Terms of Service</button>
        {' '}and{' '}
        <button className="welcome__link" onClick={() => setDoc('privacy')}>Privacy Policy</button>.
      </p>

      {blocked && (
        <div className="sheet" onClick={() => setBlocked(null)}>
          <div className="sheet__panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grip" aria-hidden />
            <h2 className="sheet__title">
              {blocked.provider === 'apple'
                ? 'Sign in with Apple'
                : blocked.provider === 'google'
                  ? 'Sign in with Google'
                  : 'Email sign-in'}{' '}
              isn't connected yet
            </h2>
            <p className="subtitle">
              The app is wired up for it — what's missing is set up outside the code. You'll need:
            </p>
            <ul className="sheet__list">
              {blocked.missing.map((item) => (
                <li key={item}><span aria-hidden>•</span>{item}</li>
              ))}
            </ul>
            <p className="tiny">Reference: {blocked.docs}</p>
            <button className="btn btn--primary btn--block" onClick={() => setBlocked(null)}>
              Got it
            </button>
            <button
              className="btn btn--ghost btn--block"
              onClick={() => { setBlocked(null); dispatch({ type: 'go', route: 'emailAuth' }); }}
            >
              Use email instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TERMS = [
  'This is an unreleased prototype shared for feedback. It is not a live service, nothing is charged, and no payment details are collected.',
  'The feeds you watch are generated. No TikTok, Reels or Shorts content is fetched, embedded, hosted or redistributed at any point.',
  'A real release needs proper terms covering acceptable use, what may be shown on a shared screen, moderation and reporting, account suspension, and the platform rules governing screen capture. Those are not written yet.',
];

const PRIVACY = [
  'SCROLLR collects the least it can. There is no behavioural tracking, no advertising profile, no analytics product, no contact upload and no location collection.',
  'When SCROLLR is connected to its database, your account holds your email address so you can sign in, your handle and profile, who you are friends with, who you follow, your notifications and a summary of matches you have played. Nothing about what you watch is kept.',
  'Your profile photo is cropped and shrunk on your device before it is uploaded, so the original never leaves your phone.',
  'You can delete your account from Settings at any time, which removes your profile, photo, friends, follows, notifications and match history.',
  'Sign in with Apple and Google are not connected yet, so no data is shared with either.',
  'This describes what the code does today rather than being reviewed legal copy. A public launch needs a policy written properly.',
];
