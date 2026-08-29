import { useState } from 'react';
import { isValidEmail, signInWithEmail, storedAccount } from '../auth/providers';
import { useStore } from '../state/store';

/**
 * Email sign-in, honest about its limits: the account exists on this device
 * only. There is no server, so there is no verification and no password reset,
 * and the screen says so rather than showing a "Forgot password?" link that
 * could not do anything.
 */
export function EmailAuthScreen() {
  const { dispatch } = useStore();
  const existing = storedAccount();
  const [mode, setMode] = useState<'signUp' | 'signIn'>(existing ? 'signIn' : 'signUp');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = isValidEmail(email) && password.length >= 6;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setError(null);
    setBusy(true);
    const result = await signInWithEmail(email, password);
    setBusy(false);
    if (result.status === 'ok') dispatch({ type: 'signedIn', account: result.account });
    else if (result.status === 'error') setError(result.message);
  };

  return (
    <div className="screen emailauth">
      <header className="lobby__head">
        <button className="lobby__back" onClick={() => dispatch({ type: 'back' })}>‹</button>
        <div className="grow">
          <h1 className="title">{mode === 'signUp' ? 'Create your account' : 'Welcome back'}</h1>
          <p className="subtitle">
            {mode === 'signUp'
              ? 'Email and a password. Nothing else.'
              : 'Sign in to pick up where you left off.'}
          </p>
        </div>
      </header>

      <form className="emailauth__form" onSubmit={submit}>
        <label className="field">
          <span className="eyebrow">EMAIL</span>
          <input
            className="field__input"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email"
          />
        </label>

        <label className="field">
          <span className="eyebrow">PASSWORD</span>
          <input
            className="field__input"
            type="password"
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            aria-label="Password"
          />
        </label>

        {error && <p className="welcome__error">{error}</p>}

        <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={!ready || busy}>
          {busy ? 'One sec…' : mode === 'signUp' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <button
        className="emailauth__switch"
        onClick={() => { setMode(mode === 'signUp' ? 'signIn' : 'signUp'); setError(null); }}
      >
        {mode === 'signUp'
          ? 'Already have an account? Sign in'
          : 'New here? Create an account'}
      </button>

      <div className="emailauth__note">
        <span aria-hidden>🔒</span>
        <p className="tiny">
          Prototype build: this account is stored on this device only. There is no server yet, so
          there is no email verification and no password reset — signing out erases it.
        </p>
      </div>
    </div>
  );
}
