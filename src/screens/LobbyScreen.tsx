import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { LevelBadge } from '../components/LevelBadge';
import { VIBES } from '../data/vibes';
import { useStore } from '../state/store';

export function LobbyScreen() {
  const { state, dispatch } = useStore();
  const session = state.session!;
  const isPrivate = session.mode === 'private';
  const [copied, setCopied] = useState(false);

  // In a private lobby you are waiting on people; in a random one the match is
  // already made, so the button is live immediately.
  const canStart = session.members.length >= 2;

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
            <Avatar emoji={m.avatar} colour={m.colour} flag={m.flag} size={50} />
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
            </div>
            {!m.isMe && session.mode === 'random' && (
              <span className={`lobby__team lobby__team--${m.team}`}>
                {m.team === 'yours' ? 'your side' : 'them'}
              </span>
            )}
          </li>
        ))}
      </ul>

      {isPrivate && session.members.length < 2 && (
        <p className="lobby__waiting">Waiting for someone to join… 👀</p>
      )}

      <div className="lobby__order card">
        <span className="eyebrow">SCROLLER ORDER</span>
        <div className="lobby__order-list">
          {session.order.map((id, i) => {
            const m = session.members.find((x) => x.id === id)!;
            return (
              <div key={id} className="lobby__order-item">
                <span className="lobby__order-num">{i + 1}</span>
                <span aria-hidden>{m.avatar}</span>
                <span className="tiny">{m.isMe ? 'you' : m.handle}</span>
              </div>
            );
          })}
        </div>
        <p className="tiny">Shuffled again every session. 10 videos each.</p>
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
