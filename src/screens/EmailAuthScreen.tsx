import { useState } from 'react';
import {
  isBackendConfigured, isValidEmail, sendPasswordReset, signInWithEmail, signUpWithEmail,
} from '../backend';
import { useStore } from '../state/store';

/**
 * Email sign-in and sign-up through Supabase Auth.
 *
 * Sign-up and sign-in are separate calls, not one guess: creating an account
 * for someone who mistyped their password on an existing one is a bad failure,
 * and Supabase treats them as different operations. Password reset only shows
 * once there is a backend to send the mail — a dead "Forgot password?" link is
 * worse than none.
 */
export function EmailAuthScreen() {
  const { dispatch } = useStore();
  const connected = isBackendConfigured();
  const [mode, setMode] = useState<'signUp' | 'signIn'>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = isValidEmail(email) && password.length >= 6;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setError(null);
    setBusy(true);
    const result = mode === 'signUp'
      ? await signUpWithEmail(email, password)
      : await signInWithEmail(email, password);
    setBusy(false);
    if (result.status === 'ok') dispatch({ type: 'signedIn', account: result.account });
    else if (result.status === 'error') setError(result.message);
    else if (result.status === 'not_configured') {
      setError('No backend is connected yet — see the README to set one up.');
    }
  };

  const resetPassword = async () => {
    if (!isValidEmail(email)) { setError('Enter your email first.'); return; }
    setBusy(true);
    const result = await sendPasswordReset(email);
    setBusy(false);
    if (result.status === 'error') setError(result.message);
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

      {connected && mode === 'signIn' && (
        <button className="emailauth__switch" onClick={resetPassword} disabled={busy}>
          Forgot your password?
        </button>
      )}

      <div className="emailauth__note">
        <span aria-hidden>🔒</span>
        <p className="tiny">
          {connected
            ? 'Your account is stored on the server, so it follows you between devices. Depending on the project settings you may need to confirm your email before signing in.'
            : 'No backend is connected yet, so this account would live on this device only. See the README for how to connect one.'}
        </p>
      </div>
    </div>
  );
}
