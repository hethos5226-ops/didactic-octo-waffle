import { useState } from 'react';
import { AvatarPicker } from '../components/AvatarPicker';
import { HashtagPicker } from '../components/HashtagPicker';
import { COUNTRIES } from '../data/people';
import { useStore } from '../state/store';

const COLOURS = ['#ff2e93', '#7b2ff7', '#22e1ff', '#c6ff3d', '#ffe03d', '#ff9f1c'];

/** Change your face, your colour and what you're into after sign-up. */
export function EditProfileScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;

  const [avatar, setAvatar] = useState(profile.avatar);
  const [photo, setPhoto] = useState<string | null>(profile.photo);
  const [colour, setColour] = useState(profile.colour);
  const [country, setCountry] = useState(
    COUNTRIES.find((c) => c.name === profile.country) ?? COUNTRIES[0],
  );
  const [tags, setTags] = useState<string[]>(profile.hashtags);

  const save = () => {
    dispatch({
      type: 'updateProfile',
      changes: {
        avatar, photo, colour,
        country: country.name, flag: country.flag,
        hashtags: tags,
      },
    });
    dispatch({ type: 'back' });
  };

  return (
    <div className="screen editprofile">
      <header className="lobby__head">
        <button className="lobby__back" onClick={() => dispatch({ type: 'back' })}>‹</button>
        <div className="grow">
          <h1 className="title">Edit profile</h1>
          <p className="subtitle">@{profile.handle}</p>
        </div>
      </header>

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
        <span className="eyebrow">WHERE YOU SCROLLR FROM</span>
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

      <div className="card">
        <span className="eyebrow">WHAT YOU'RE INTO</span>
        <HashtagPicker tags={tags} onChange={setTags} />
      </div>

      <button className="btn btn--primary btn--lg btn--block" onClick={save}>
        Save changes
      </button>
    </div>
  );
}
