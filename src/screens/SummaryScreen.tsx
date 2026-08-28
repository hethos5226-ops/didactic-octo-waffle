import { Avatar } from '../components/Avatar';
import { LevelBadge } from '../components/LevelBadge';
import { Confetti } from '../components/Overlays';
import { useStore } from '../state/store';

/**
 * The end of a session is the only moment where adding someone feels natural:
 * you have just spent ten minutes laughing at their feed. Ask here or don't
 * ask at all.
 */
export function SummaryScreen() {
  const { state, dispatch } = useStore();
  const session = state.session!;
  const profile = state.profile!;
  const others = session.members.filter((m) => !m.isMe);
  const best = [...session.results].sort((a, b) => b.feedScore - a.feedScore)[0];

  return (
    <div className="screen summary">
      <Confetti count={30} />

      <header className="summary__head">
        <span className="eyebrow">SESSION COMPLETE</span>
        <h1 className="title">That was a good one 🎉</h1>
        <p className="subtitle">
          {session.results.length} rounds · {session.members.length} people ·{' '}
          {session.results.reduce((n, r) => n + r.totalReactions, 0)} reactions
        </p>
      </header>

      {best && (
        <div className="summary__winner">
          <div className="summary__crown" aria-hidden>👑</div>
          <div>
            <span className="eyebrow">BEST FEED OF THE NIGHT</span>
            <div className="summary__winner-name">
              {best.isMe ? 'You!' : `@${best.scrollerHandle}`}
            </div>
          </div>
          <div className="summary__winner-score">{best.feedScore}</div>
        </div>
      )}

      <div className="summary__rounds">
        {session.results.map((r, i) => (
          <div key={r.scrollerId} className="summary__round">
            <span className="summary__round-num">R{i + 1}</span>
            <span className="grow">{r.isMe ? 'you' : `@${r.scrollerHandle}`}</span>
            <span className="summary__round-score">⭐ {r.feedScore}</span>
          </div>
        ))}
      </div>

      <h2 className="summary__title">Keep in touch? 👀</h2>
      <ul className="summary__people">
        {others.map((m) => {
          const liked = session.liked.includes(m.id);
          const friended = profile.friends.includes(m.id);
          return (
            <li key={m.id} className="summary__person">
              <Avatar emoji={m.avatar} colour={m.colour} flag={m.flag} size={50} />
              <div className="grow">
                <div className="summary__person-handle">@{m.handle}</div>
                <LevelBadge level={m.level} size="sm" />
              </div>
              <button
                className={`summary__like${liked ? ' is-on' : ''}`}
                onClick={() => dispatch({ type: 'likePerson', id: m.id })}
                aria-label={`Like @${m.handle}'s profile`}
                aria-pressed={liked}
              >
                {liked ? '❤️' : '🤍'}
              </button>
              <button
                className={`btn ${friended ? 'btn--ghost' : 'btn--zap'} summary__add`}
                onClick={() => dispatch({ type: 'addFriend', id: m.id })}
                disabled={friended}
              >
                {friended ? '✓ Friends' : '+ Add'}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="summary__actions">
        <button
          className="btn btn--primary btn--lg btn--block"
          onClick={() => dispatch({ type: 'finishSession' })}
        >
          Done ✌️
        </button>
      </div>
    </div>
  );
}
