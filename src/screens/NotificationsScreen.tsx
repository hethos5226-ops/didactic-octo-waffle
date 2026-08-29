import { useEffect } from 'react';
import { Avatar } from '../components/Avatar';
import { PEOPLE } from '../data/people';
import { useStore } from '../state/store';
import type { AppNotification } from '../state/types';

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

  return (
    <div className="screen notifications">
      <header className="lobby__head">
        <button className="lobby__back" onClick={() => dispatch({ type: 'back' })}>‹</button>
        <div className="grow">
          <h1 className="title">🔔 Activity</h1>
          <p className="subtitle">Friend requests and what people did.</p>
        </div>
      </header>

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

      <button
        className="btn btn--ghost btn--block"
        onClick={() => dispatch({ type: 'go', route: 'friends' })}
      >
        👥 Find people to add
      </button>
    </div>
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
