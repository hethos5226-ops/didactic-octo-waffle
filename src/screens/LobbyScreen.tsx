import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { LevelBadge } from '../components/LevelBadge';
import { PEOPLE } from '../data/people';
import { VIBES } from '../data/vibes';
import { sharedTags } from '../data/hashtags';
import { memberFromPerson, strangers, useStore } from '../state/store';

export function LobbyScreen() {
  const { state, dispatch } = useStore();
  const session = state.session!;
  const isPrivate = session.mode === 'private';
  const [copied, setCopied] = useState(false);

  // In a private lobby you are waiting on people; in a random one the match is
  // already made, so the button is live immediately.
  const canStart = session.members.length >= 2;

  // Somebody has to walk through the door, or a private lobby is a code and a
  // dead end. These stand in for the friends who tapped your invite link:
  // people you have actually added come first, then the wider cast.
  const arrivals = useRef(false);
  useEffect(() => {
    if (!isPrivate || arrivals.current) return;
    arrivals.current = true;
    const already = session.members.map((m) => m.id);
    const invitedFriends = PEOPLE.filter(
      (p) => state.profile!.friends.includes(p.id) && !already.includes(p.id),
    );
    const queue = [...invitedFriends, ...strangers(3, [
      ...already, state.profile!.handle, ...invitedFriends.map((f) => f.id),
    ])]
      .slice(0, Math.max(0, 3 - session.members.length));

    const timers = queue.map((person, i) =>
      window.setTimeout(
        () => dispatch({ type: 'memberJoined', member: memberFromPerson(person, 'yours') }),
        2200 + i * 2600,
      ),
    );
    return () => timers.forEach(clearTimeout);
    // Runs once when the lobby opens; later joins would arrive over the wire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrivate]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyInvite = async () => {
    const link = `https://scroll.app/j/${session.code}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* Clipboard blocked — the code is on screen to type anyway. */
    }
    setCopied(true);
  };

  return (
    <div className="screen lobby">
      <header className="lobby__head">
        <button className="lobby__back" onClick={() => dispatch({ type: 'leaveSession' })}>‹</button>
        <div className="grow">
          <h1 className="title">
            {isPrivate ? '🔒 Private lobby' : '🌎 Matched!'}
          </h1>
          <p className="subtitle">
            {isPrivate
              ? 'Invite your friends, then start the FYP night.'
              : `${session.members.length} people, ${session.members.length} rounds. Everyone scrolls once.`}
          </p>
        </div>
      </header>

      {isPrivate && session.code && (
        <div className="invite">
          <span className="eyebrow">INVITE CODE</span>
          <div className="invite__code">{session.code}</div>
          <button className="btn btn--zap btn--block" onClick={copyInvite}>
            {copied ? '✅ Link copied!' : '🔗 Copy invite link'}
          </button>
          <p className="tiny invite__link">scroll.app/j/{session.code}</p>
        </div>
      )}

      <div className="lobby__count">
        <span className="lobby__count-num">{session.members.length}</span>
        <span className="eyebrow">IN THE LOBBY</span>
      </div>

      <ul className="lobby__list">
        {session.members.map((m, i) => (
          <li key={m.id} className="lobby__member pop" style={{ animationDelay: `${i * 70}ms` }}>
            <Avatar
              emoji={m.avatar}
              photo={m.photo}
              colour={m.colour}
              flag={m.flag}
              size={50}
              premium={m.premium}
            />
            <div className="grow">
              <div className="lobby__member-top">
                <span className="lobby__handle">
                  @{m.handle}{m.isMe && <span className="lobby__you">YOU</span>}
                </span>
              </div>
              <div className="row lobby__member-meta">
                <LevelBadge level={m.level} size="sm" />
                <span className="tiny">⭐ {m.feedScore}</span>
              </div>
              <div className="lobby__vibes">
                {m.vibes.map((v) => (
                  <span key={v} className="lobby__vibe">
                    {VIBES[v].emoji} {VIBES[v].label}
                  </span>
                ))}
              </div>
              {!m.isMe && (() => {
                const common = sharedTags(state.profile!.hashtags, m.hashtags);
                return common.length > 0 ? (
                  <div className="lobby__common">
                    🤝 {common.map((t) => `#${t}`).join(' ')}
                  </div>
                ) : null;
              })()}
            </div>
            {!m.isMe && session.mode === 'random' && (
              <span className={`lobby__team lobby__team--${m.team}`}>
                {m.team === 'yours' ? 'your side' : 'them'}
              </span>
            )}
          </li>
        ))}
      </ul>

      {isPrivate && session.members.length < 3 && (
        <p className="lobby__waiting">Waiting for people to tap your link… 👀</p>
      )}

      <div className="lobby__order card">
        <span className="eyebrow">SCROLLER ORDER</span>
        <div className="lobby__order-list">
          {session.order.map((id, i) => {
            const m = session.members.find((x) => x.id === id)!;
            return (
              <div key={id} className="lobby__order-item">
                <span className="lobby__order-num">{i + 1}</span>
                {m.photo
                  ? <img className="lobby__order-img" src={m.photo} alt="" />
                  : <span aria-hidden>{m.avatar}</span>}
                <span className="tiny">{m.isMe ? 'you' : m.handle}</span>
              </div>
            );
          })}
        </div>
        <p className="tiny">Shuffled again every session. 10 videos each.</p>

        {state.profile!.premium ? (
          <button
            className="lobby__claim"
            disabled={session.claimedFirst}
            onClick={() => dispatch({ type: 'claimFirstTurn' })}
          >
            {session.claimedFirst ? "👑 You're going first" : '👑 Scroll first (Premium)'}
          </button>
        ) : (
          <button
            className="lobby__claim lobby__claim--locked"
            onClick={() => dispatch({ type: 'go', route: 'premium' })}
          >
            🔒 Want to go first? Get Premium 👑
          </button>
        )}
      </div>

      <div className="lobby__actions">
        <button
          className="btn btn--primary btn--lg btn--block"
          disabled={!canStart}
          onClick={() => dispatch({ type: 'beginSession' })}
        >
          🎬 START SCROLLING
        </button>
        <button className="btn btn--danger btn--block" onClick={() => dispatch({ type: 'leaveSession' })}>
          🚫 Leave
        </button>
      </div>
    </div>
  );
}
