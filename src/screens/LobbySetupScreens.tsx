import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { PEOPLE } from '../data/people';
import {
  makeLobbyCode, memberFromPerson, memberFromProfile, strangers, useStore,
} from '../state/store';

/**
 * Creating a private lobby. The code exists before anyone joins, because the
 * first thing people do is paste it into a group chat.
 */
export function CreateLobbyScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const [code] = useState(makeLobbyCode);
  const friends = PEOPLE.filter((p) => profile.friends.includes(p.id));
  const [invited, setInvited] = useState<string[]>([]);

  const open = () => {
    const me = memberFromProfile(profile);
    const guests = friends
      .filter((f) => invited.includes(f.id))
      .map((f) => memberFromPerson(f, 'yours'));
    dispatch({ type: 'openLobby', mode: 'private', members: [me, ...guests], code });
  };

  return (
    <div className="screen createlobby">
      <header className="lobby__head">
        <button className="lobby__back" onClick={() => dispatch({ type: 'back' })}>‹</button>
        <div className="grow">
          <h1 className="title">🔒 New lobby</h1>
          <p className="subtitle">Your room, your rules, your friends' terrible feeds.</p>
        </div>
      </header>

      <div className="invite invite--big">
        <span className="eyebrow">SHARE THIS CODE</span>
        <div className="invite__code">{code}</div>
        <p className="tiny invite__link">scroll.app/j/{code}</p>
      </div>

      {friends.length > 0 ? (
        <div className="card">
          <span className="eyebrow">INVITE FRIENDS</span>
          <ul className="createlobby__friends">
            {friends.map((f) => {
              const on = invited.includes(f.id);
              return (
                <li key={f.id}>
                  <Avatar emoji={f.avatar} colour={f.colour} flag={f.flag} size={42} />
                  <span className="grow">@{f.handle}</span>
                  <button
                    className={`chip${on ? ' chip--on' : ''}`}
                    onClick={() =>
                      setInvited((prev) =>
                        prev.includes(f.id) ? prev.filter((x) => x !== f.id) : [...prev, f.id],
                      )
                    }
                  >
                    {on ? '✓ Invited' : '+ Invite'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="card createlobby__empty">
          <p className="subtitle">
            No friends yet 👀 Play a <strong>Random</strong> session and add people at the end —
            they'll show up here.
          </p>
        </div>
      )}

      <button className="btn btn--primary btn--lg btn--block" onClick={open}>
        Open the lobby 🚪
      </button>
    </div>
  );
}

/** Joining by code. Any code works in the prototype — it fills the room. */
export function JoinLobbyScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  const valid = clean.replace('FYP', '').length >= 4;

  useEffect(() => {
    if (!joining) return;
    const timer = setTimeout(() => {
      const me = memberFromProfile(profile);
      const host = strangers(2, [profile.handle]).map((p, i) =>
        memberFromPerson(p, i === 0 ? 'yours' : 'theirs'),
      );
      const formatted = clean.startsWith('FYP') ? `FYP-${clean.slice(3)}` : `FYP-${clean}`;
      dispatch({ type: 'openLobby', mode: 'private', members: [me, ...host], code: formatted });
    }, 1400);
    return () => clearTimeout(timer);
  }, [joining, clean, profile, dispatch]);

  return (
    <div className="screen joinlobby">
      <header className="lobby__head">
        <button className="lobby__back" onClick={() => dispatch({ type: 'back' })}>‹</button>
        <div className="grow">
          <h1 className="title">Join a lobby</h1>
          <p className="subtitle">Got a code from a mate? Drop it in.</p>
        </div>
      </header>

      <div className="join__box">
        <span className="join__prefix">FYP-</span>
        <input
          className="join__input"
          value={clean.startsWith('FYP') ? clean.slice(3) : clean}
          onChange={(e) => setCode(e.target.value)}
          placeholder="XXXX"
          maxLength={4}
          autoFocus
          aria-label="Lobby code"
        />
      </div>

      <button
        className="btn btn--primary btn--lg btn--block"
        disabled={!valid || joining}
        onClick={() => setJoining(true)}
      >
        {joining ? 'Knocking… 🚪' : 'Join lobby'}
      </button>
    </div>
  );
}

/** Your social graph — the thing that quietly forms out of random sessions. */
export function FriendsScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const friends = PEOPLE.filter((p) => profile.friends.includes(p.id));

  return (
    <div className="screen friends">
      <header className="lobby__head">
        <button className="lobby__back" onClick={() => dispatch({ type: 'back' })}>‹</button>
        <div className="grow">
          <h1 className="title">👥 Friends</h1>
          <p className="subtitle">
            {friends.length} {friends.length === 1 ? 'person' : 'people'} you met by scrolling.
          </p>
        </div>
      </header>

      <ul className="friends__list">
        {friends.map((f) => (
          <li key={f.id} className="friends__item">
            <Avatar emoji={f.avatar} colour={f.colour} flag={f.flag} size={48} />
            <div className="grow">
              <div className="friends__handle">@{f.handle}</div>
              <div className="tiny">LV {f.level} · ⭐ {f.feedScore} feed score</div>
            </div>
            <button
              className="chip"
              onClick={() => dispatch({ type: 'viewPerson', id: f.id })}
            >
              View
            </button>
          </li>
        ))}
      </ul>

      {friends.length === 0 && (
        <p className="subtitle">Nobody yet. Go meet someone 🌎</p>
      )}

      <button
        className="btn btn--zap btn--block"
        onClick={() => dispatch({ type: 'go', route: 'createLobby' })}
      >
        🔒 Start an FYP night
      </button>
    </div>
  );
}
