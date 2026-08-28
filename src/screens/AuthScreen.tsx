import { useState } from 'react';
import { AVATARS, COUNTRIES } from '../data/people';
import { VIBE_LIST, type VibeId } from '../data/vibes';
import { newProfile, useStore } from '../state/store';

const COLOURS = ['#ff2e93', '#7b2ff7', '#22e1ff', '#c6ff3d', '#ffe03d', '#ff9f1c'];

/**
 * Sign-up is three taps and a name. Nothing here asks for an email, because the
 * fastest way to lose someone is to put a form between them and the thing they
 * came to try. The vibes step earns its place: it is what makes *your* feed
 * look like yours in the very first session.
 */
export function AuthScreen() {
  const { dispatch } = useStore();
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [colour, setColour] = useState(COLOURS[0]);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [vibes, setVibes] = useState<VibeId[]>([]);

  const cleanHandle = handle.trim().replace(/^@+/, '').replace(/\s+/g, '');
  const canContinue = step === 0 ? cleanHandle.length >= 2 : vibes.length >= 2;

  const toggleVibe = (id: VibeId) => {
    setVibes((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : prev.length >= 3 ? prev : [...prev, id],
    );
  };

  const finish = () => {
    dispatch({
      type: 'signUp',
      profile: newProfile({
        handle: cleanHandle, avatar, colour,
        country: country.name, flag: country.flag, vibes,
      }),
    });
  };

  return (
    <div className="screen auth">
      <div className="auth__hero">
        <div className="auth__emoji-run" aria-hidden>
          {['😂', '💀', '🔥', '🤯', '😭', '❤️'].map((e, i) => (
            <span key={e} style={{ animationDelay: `${i * 0.18}s` }}>{e}</span>
          ))}
        </div>
        <h1 className="auth__wordmark">SCROLL</h1>
        <p className="auth__tagline">
          Meet someone. Watch their FYP.<br />Laugh together. Rate their feed.
        </p>
      </div>

      {step === 0 ? (
        <div className="stack pop">
          <div className="card">
            <span className="eyebrow">PICK A HANDLE</span>
            <div className="auth__handle">
              <span className="auth__at">@</span>
              <input
                className="auth__input"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="yourname"
                maxLength={18}
                autoFocus
                aria-label="Handle"
              />
            </div>
          </div>

          <div className="card">
            <span className="eyebrow">YOUR FACE</span>
            <div className="auth__avatars">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  className={`auth__avatar${a === avatar ? ' is-on' : ''}`}
                  onClick={() => setAvatar(a)}
                  style={a === avatar ? { borderColor: colour, background: `${colour}33` } : undefined}
                  aria-label={`Avatar ${a}`}
                  aria-pressed={a === avatar}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="auth__colours">
              {COLOURS.map((c) => (
                <button
                  key={c}
                  className={`auth__colour${c === colour ? ' is-on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColour(c)}
                  aria-label={`Colour ${c}`}
                  aria-pressed={c === colour}
                />
              ))}
            </div>
          </div>

          <div className="card">
            <span className="eyebrow">WHERE YOU SCROLL FROM</span>
            <div className="wrap auth__countries">
              {COUNTRIES.map((c) => (
                <button
                  key={c.name}
                  className={`chip${c.name === country.name ? ' chip--on' : ''}`}
                  onClick={() => setCountry(c)}
                >
                  {c.flag} {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="stack pop">
          <div>
            <h2 className="title">What's on your FYP? 👀</h2>
            <p className="subtitle">
              Pick 2–3. This is what other people will see when it's your turn to scroll.
            </p>
          </div>
          <div className="auth__vibes">
            {VIBE_LIST.map((v) => {
              const on = vibes.includes(v.id);
              return (
                <button
                  key={v.id}
                  className={`vibe-card${on ? ' is-on' : ''}`}
                  onClick={() => toggleVibe(v.id)}
                  aria-pressed={on}
                  style={on
                    ? { background: `linear-gradient(135deg, ${v.gradient[0]}, ${v.gradient[1]})` }
                    : undefined}
                >
                  <span className="vibe-card__emoji">{v.emoji}</span>
                  <span className="vibe-card__label">{v.label}</span>
                </button>
              );
            })}
          </div>
          <p className="tiny">{vibes.length}/3 selected</p>
        </div>
      )}

      <div className="auth__actions">
        {step === 1 && (
          <button className="btn btn--ghost" onClick={() => setStep(0)}>Back</button>
        )}
        <button
          className="btn btn--primary btn--lg grow"
          disabled={!canContinue}
          onClick={() => (step === 0 ? setStep(1) : finish())}
        >
          {step === 0 ? 'Continue →' : "Let's go 🚀"}
        </button>
      </div>

      <p className="auth__legal tiny">
        Prototype build. No real accounts, no real feeds — everything you see is simulated.
      </p>
    </div>
  );
}
