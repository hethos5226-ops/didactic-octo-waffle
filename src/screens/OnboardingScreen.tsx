import { useState } from 'react';
import { AVATARS, COUNTRIES, PEOPLE } from '../data/people';
import { vibesForProfile } from '../data/hashtags';
import { AvatarPicker } from '../components/AvatarPicker';
import { HashtagPicker } from '../components/HashtagPicker';
import { newProfile, useStore } from '../state/store';

const COLOURS = ['#ff2e93', '#7b2ff7', '#22e1ff', '#c6ff3d', '#ffe03d', '#ff9f1c'];
const STEPS = ['You', 'Face', 'Interests', 'How it works'];

/**
 * Account setup, after sign-in.
 *
 * Split by *kind* of decision rather than by field count: who you are, what you
 * look like, what you're into, then what the app actually does. The intro is
 * last because it lands better once there is a profile to apply it to, and it
 * is skippable — nobody reads a tutorial before they have seen the thing.
 */
export function OnboardingScreen() {
  const { state, dispatch } = useStore();
  const account = state.account;

  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState(account?.suggestedName?.replace(/[^a-z0-9._]/gi, '') ?? '');
  const [displayName, setDisplayName] = useState(account?.suggestedName ?? '');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [colour, setColour] = useState(COLOURS[0]);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [intro, setIntro] = useState(0);

  const cleanHandle = handle.trim().replace(/^@+/, '').replace(/\s+/g, '').toLowerCase();
  const taken = PEOPLE.some((p) => p.handle.toLowerCase() === cleanHandle);
  const handleOk = cleanHandle.length >= 2 && !taken;

  const canContinue =
    step === 0 ? handleOk
      : step === 1 ? true
        : step === 2 ? tags.length >= 3
          : true;

  const finish = () => {
    dispatch({
      type: 'signUp',
      profile: newProfile({
        handle: cleanHandle,
        displayName: displayName.trim() || cleanHandle,
        bio: bio.trim(),
        avatar, photo, colour,
        country: country.name, flag: country.flag,
        vibes: vibesForProfile(tags),
        hashtags: tags,
        authProvider: account?.provider ?? null,
        email: account?.email ?? null,
      }),
    });
  };

  const next = () => {
    if (step < 3) { setStep(step + 1); return; }
    if (intro < INTRO.length - 1) { setIntro(intro + 1); return; }
    finish();
  };

  return (
    <div className="screen onboarding">
      <div className="onboarding__progress" aria-hidden>
        {STEPS.map((label, i) => (
          <span key={label} className={`onboarding__tick${i <= step ? ' is-on' : ''}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="stack pop">
          <div>
            <h1 className="title">What should we call you?</h1>
            <p className="subtitle">Your @username is how people find you. It has to be unique.</p>
          </div>

          <div className="card">
            <span className="eyebrow">USERNAME</span>
            <div className="auth__handle">
              <span className="auth__at">@</span>
              <input
                className="auth__input"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="yourname"
                maxLength={18}
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                aria-label="Username"
              />
              {cleanHandle.length >= 2 && (
                <span className={`onboarding__check${taken ? ' is-bad' : ''}`}>
                  {taken ? '✕' : '✓'}
                </span>
              )}
            </div>
            {taken && <p className="onboarding__warn">@{cleanHandle} is taken — try another.</p>}
          </div>

          <div className="card">
            <span className="eyebrow">DISPLAY NAME</span>
            <input
              className="field__input onboarding__name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={cleanHandle || 'Your name'}
              maxLength={30}
              aria-label="Display name"
            />
            <p className="tiny">Shown above your username. You can change it later.</p>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="stack pop">
          <div>
            <h1 className="title">Pick a face 📸</h1>
            <p className="subtitle">A photo, or an emoji if you'd rather not show one.</p>
          </div>

          <div className="card">
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
            <span className="eyebrow">BIO — OPTIONAL</span>
            <textarea
              className="field__input onboarding__bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="chronically online. ask me about my algorithm."
              maxLength={120}
              rows={3}
              aria-label="Bio"
            />
            <p className="tiny">{bio.length}/120</p>
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
      )}

      {step === 2 && (
        <div className="stack pop">
          <div>
            <h1 className="title">What's on your FYP? 👀</h1>
            <p className="subtitle">
              Tap at least 3, or add your own. These match you with people who watch the same
              stuff — and everyone sees what you have in common.
            </p>
          </div>
          <HashtagPicker tags={tags} onChange={setTags} />
        </div>
      )}

      {step === 3 && (
        <div className="stack pop onboarding__intro">
          <div className="onboarding__card" key={intro}>
            <span className="onboarding__card-emoji" aria-hidden>{INTRO[intro].emoji}</span>
            <h1 className="title">{INTRO[intro].title}</h1>
            <p className="subtitle">{INTRO[intro].body}</p>
          </div>
          <div className="onboarding__dots" aria-hidden>
            {INTRO.map((card, i) => (
              <span key={card.title} className={`onboarding__dot${i === intro ? ' is-on' : ''}`} />
            ))}
          </div>
        </div>
      )}

      <div className="auth__actions">
        {(step > 0 || intro > 0) && (
          <button
            className="btn btn--ghost"
            onClick={() => (intro > 0 ? setIntro(intro - 1) : setStep(step - 1))}
          >
            Back
          </button>
        )}
        <button className="btn btn--primary btn--lg grow" disabled={!canContinue} onClick={next}>
          {step < 3 ? 'Continue →' : intro < INTRO.length - 1 ? 'Next' : "Let's go 🚀"}
        </button>
      </div>

      {step === 3 && intro < INTRO.length - 1 && (
        <button className="onboarding__skip" onClick={finish}>Skip intro</button>
      )}
    </div>
  );
}

const INTRO = [
  {
    emoji: '🌎',
    title: 'Meet someone random',
    body: 'Solo, duo or trio. You get matched with people anywhere in the world who like the same stuff you do.',
  },
  {
    emoji: '🎬',
    title: 'One person shares their feed',
    body: 'Whoever gets picked scrolls their FYP, and everyone watches the same thing at the same time. Then it rotates.',
  },
  {
    emoji: '😂',
    title: 'React together, out loud',
    body: 'Voice is always on, reactions float up the screen, and at the end everyone rates the feed. That score follows you around.',
  },
];
