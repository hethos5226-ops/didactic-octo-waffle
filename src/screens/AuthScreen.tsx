import { useState } from 'react';
import { AVATARS, COUNTRIES } from '../data/people';
import { vibesForProfile } from '../data/hashtags';
import { AvatarPicker } from '../components/AvatarPicker';
import { HashtagPicker } from '../components/HashtagPicker';
import { newProfile, useStore } from '../state/store';

const COLOURS = ['#ff2e93', '#7b2ff7', '#22e1ff', '#c6ff3d', '#ffe03d', '#ff9f1c'];

/**
 * Sign-up is two screens and a name. Nothing here asks for an email, because
 * the fastest way to lose someone is to put a form between them and the thing
 * they came to try.
 *
 * There used to be a third screen picking vibe categories, which said the same
 * thing as the hashtags a screen later. Hashtags won: they are what someone
 * would actually type, they double as the thing you have in common with a
 * stranger, and the feed's vibes are derived from them.
 */
export function AuthScreen() {
  const { dispatch } = useStore();
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [colour, setColour] = useState(COLOURS[0]);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [tags, setTags] = useState<string[]>([]);

  const cleanHandle = handle.trim().replace(/^@+/, '').replace(/\s+/g, '');
  const canContinue = step === 0 ? cleanHandle.length >= 2 : tags.length >= 3;

  const finish = () => {
    dispatch({
      type: 'signUp',
      profile: newProfile({
        handle: cleanHandle, avatar, photo, colour,
        country: country.name, flag: country.flag,
        // The feed's vibes come from the hashtags, so there is nothing extra
        // to pick and the two can never disagree.
        vibes: vibesForProfile(tags),
        hashtags: tags,
      }),
    });
  };

  return (
    <div className="screen auth">
      <div className={`auth__hero${step > 0 ? ' auth__hero--compact' : ''}`}>
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
            <AvatarPicker
              emoji={avatar}
              photo={photo}
              colour={colour}
              flag={country.flag}
              onEmoji={setAvatar}
              onPhoto={setPhoto}
            />
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
            <div className="auth__countries">
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
              Tap at least 3, or add your own. These match you with people who
              watch the same stuff — and everyone sees what you have in common.
            </p>
          </div>
          <HashtagPicker tags={tags} onChange={setTags} />
        </div>
      )}

      <div className="auth__actions">
        {step > 0 && (
          <button className="btn btn--ghost" onClick={() => setStep(step - 1)}>Back</button>
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
