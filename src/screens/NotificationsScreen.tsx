import { useEffect } from 'react';
import { Avatar } from '../components/Avatar';
import { PEOPLE } from '../data/people';
import { useStore } from '../state/store';
import type { AppNotification, MatchSummary } from '../state/types';

/** Friend activity: who asked, who accepted, who liked your profile. */
export function NotificationsScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;

  // Opening the screen is what marks them read — the badge should clear
  // because you looked, not because you tapped every row.
  useEffect(() => {
    if (profile.notifications.some((n) => !n.read)) {
      dispatch({ type: 'markNotificationsRead' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = [...profile.notifications].sort((a, b) => b.at - a.at);
  const matches = profile.matchHistory;

  return (
    <div className="screen notifications">
      <header className="lobby__head">
        <div className="grow">
          <h1 className="title">🔔 Activity</h1>
          <p className="subtitle">How your last games went, and who's asking.</p>
        </div>
      </header>

      {matches.length > 0 && (
        <section className="activity__section">
          <span className="eyebrow">YOUR LAST GAMES</span>
          <ul className="activity__matches">
            {matches.slice(0, 5).map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </ul>
        </section>
      )}

      <section className="activity__section">
        <span className="eyebrow">FRIEND ACTIVITY</span>
      {items.length === 0 ? (
        <div className="card notifications__empty">
          <span className="notifications__empty-emoji" aria-hidden>🔕</span>
          <p className="subtitle">
            Nothing yet. Play a 🌎 Random session and add the people you liked —
            their replies land here.
          </p>
        </div>
      ) : (
        <ul className="notifications__list">
          {items.map((n) => (
            <Row key={n.id} notification={n} />
          ))}
        </ul>
      )}

      </section>

      <button
        className="btn btn--ghost btn--block"
        onClick={() => dispatch({ type: 'go', route: 'friends' })}
      >
        👥 Find people to add
      </button>
    </div>
  );
}

/**
 * What happened last time you played. This is the thing the app is actually
 * for, so it sits above friend requests rather than under them.
 */
function MatchCard({ match }: { match: MatchSummary }) {
  const rounds = [...match.rounds].sort((a, b) => b.feedScore - a.feedScore);
  return (
    <li className="activity__match">
      <div className="activity__match-top">
        <span className="activity__match-mode">
          {match.mode === 'private' ? '🔒 Private' : '🌎 Random'}
        </span>
        <span className="tiny">{timeAgo(match.at)}</span>
      </div>

      <div className="activity__match-players">
        {match.players.map((p) => (
          <span
            key={p.id}
            className="activity__match-face"
            style={{ borderColor: p.colour }}
            title={p.isMe ? 'you' : `@${p.handle}`}
          >
            {p.avatar}
          </span>
        ))}
        <span className="tiny activity__match-count">
          {match.players.length} played · {match.rounds.length} rounds
        </span>
      </div>

      <div className="activity__match-scores">
        {rounds.map((r, i) => (
          <div key={`${r.handle}-${i}`} className={`activity__score${r.isMe ? ' is-me' : ''}`}>
            <span className="activity__score-rank">{i === 0 ? '👑' : `${i + 1}`}</span>
            <span className="grow">{r.isMe ? 'you' : `@${r.handle}`}</span>
            <span className="activity__score-num">⭐ {r.feedScore}</span>
          </div>
        ))}
      </div>

      <div className="activity__match-foot">
        {match.myFeedScore !== null && (
          <span>Your feed scored <strong>{match.myFeedScore}</strong></span>
        )}
        <span className="tiny">
          {match.totalReactions} reactions · +{match.xpEarned} XP
        </span>
      </div>
    </li>
  );
}

function Row({ notification }: { notification: AppNotification }) {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const person = PEOPLE.find((p) => p.id === notification.fromId);
  if (!person) return null;

  const stillPending =
    notification.kind === 'request' && profile.incomingRequests.includes(person.id);

  return (
    <li className={`notifications__item${notification.read ? '' : ' is-unread'}`}>
      <button
        className="notifications__open"
        onClick={() => dispatch({ type: 'viewPerson', id: person.id })}
      >
        <Avatar emoji={person.avatar} colour={person.colour} flag={person.flag} size={44} />
        <span className="grow notifications__body">
          <span className="notifications__text">
            <strong>@{person.handle}</strong> {TEXT[notification.kind]}
          </span>
          <span className="tiny">{timeAgo(notification.at)}</span>
        </span>
      </button>

      {stillPending && (
        <div className="row notifications__actions">
          <button
            className="btn btn--ghost friends__decline"
            onClick={() => dispatch({ type: 'declineFriendRequest', id: person.id })}
          >
            Ignore
          </button>
          <button
            className="btn btn--zap friends__accept"
            onClick={() => dispatch({ type: 'acceptFriendRequest', id: person.id })}
          >
            Accept
          </button>
        </div>
      )}
    </li>
  );
}

const TEXT: Record<AppNotification['kind'], string> = {
  request: 'wants to be friends',
  accepted: 'accepted your friend request',
  liked: 'liked your profile',
};

function timeAgo(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
