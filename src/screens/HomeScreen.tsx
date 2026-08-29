import { progressionFromXp, titleForLevel } from '../data/levels';
import { feedScoreFrom, percentages } from '../state/scoring';
import { useStore } from '../state/store';
import { Avatar } from '../components/Avatar';
import { AdSlot } from '../components/AdSlot';
import type { GroupSize } from '../state/types';

const MODES: { size: GroupSize; emoji: string; label: string; hint: string }[] = [
  { size: 1, emoji: '👤', label: 'SOLO', hint: '1 v 1' },
  { size: 2, emoji: '👥', label: 'DUO', hint: '2 v 2' },
  { size: 3, emoji: '👥👥', label: 'TRIO', hint: '3 v 3' },
];

export function HomeScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const progress = progressionFromXp(profile.xp);
  const title = titleForLevel(progress.level);
  const score = feedScoreFrom(percentages(profile.tallies));
  const unread = profile.notifications.filter((n) => !n.read).length;

  return (
    <div className="screen home">
      <header className="home__head">
        <h1 className="wordmark">SCROLL</h1>
        <div className="row home__head-actions">
        <button
          className="home__bell"
          onClick={() => dispatch({ type: 'go', route: 'notifications' })}
          aria-label={unread > 0 ? `Activity, ${unread} new` : 'Activity'}
        >
          🔔
          {unread > 0 && <span className="home__bell-dot">{unread > 9 ? '9+' : unread}</span>}
        </button>

        <button
          className="home__me"
          onClick={() => dispatch({ type: 'viewPerson', id: null })}
          aria-label="Your profile"
        >
          <Avatar
            emoji={profile.avatar}
            photo={profile.photo}
            colour={profile.colour}
            flag={profile.flag}
            size={42}
            premium={profile.premium}
          />
        </button>
        </div>
      </header>

      {/* RANDOM — the headline action. Deliberately the biggest, brightest
          thing on the screen; everything else is secondary to "meet someone". */}
      <section className="home__random">
        <div className="home__random-glow" aria-hidden />
        <div className="home__random-top">
          <span className="home__globe bob" aria-hidden>🌎</span>
          <div>
            <h2 className="home__random-title">RANDOM</h2>
            <p className="home__random-sub">Meet someone. Watch their FYP.</p>
          </div>
        </div>

        <div className="home__modes">
          {MODES.map((m) => (
            <button
              key={m.size}
              className="mode-btn"
              onClick={() => dispatch({ type: 'startMatchmaking', size: m.size })}
            >
              <span className="mode-btn__emoji">{m.emoji}</span>
              <span className="mode-btn__label">{m.label}</span>
              <span className="mode-btn__hint">{m.hint}</span>
            </button>
          ))}
        </div>

        <div className="home__online">
          <span className="home__online-dot" />
          <strong>12,480</strong> people scrolling right now
        </div>
      </section>

      <section className="home__private">
        <div className="row">
          <span className="home__lock" aria-hidden>🔒</span>
          <div className="grow">
            <h3 className="home__private-title">PRIVATE LOBBY</h3>
            <p className="tiny">Create a room and invite your friends.</p>
          </div>
        </div>
        <div className="row home__private-actions">
          <button
            className="btn btn--zap grow"
            onClick={() => dispatch({ type: 'go', route: 'createLobby' })}
          >
            CREATE LOBBY
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => dispatch({ type: 'go', route: 'joinLobby' })}
          >
            Join code
          </button>
        </div>
      </section>

      {/* Your card sits at the bottom as a reward, not a settings entry —
          it is where the level and score you just earned show up. */}
      <button
        className="home__profile"
        onClick={() => dispatch({ type: 'viewPerson', id: null })}
      >
        <Avatar
          emoji={profile.avatar}
          photo={profile.photo}
          colour={profile.colour}
          flag={profile.flag}
          size={56}
          premium={profile.premium}
        />
        <div className="grow home__profile-body">
          <div className="home__profile-handle">@{profile.handle}</div>
          <div className="home__profile-level">
            {title.emoji} LEVEL {progress.level} · {title.title}
          </div>
          <div className="meter home__profile-meter">
            <div
              className="meter__fill"
              style={{ width: `${progress.fraction * 100}%`, background: 'var(--grad-sun)' }}
            />
          </div>
        </div>
        <div className="home__profile-score">
          <span className="home__profile-score-num">{score}</span>
          <span className="tiny">FEED</span>
        </div>
      </button>

      {!profile.premium && (
        <button
          className="home__premium"
          onClick={() => dispatch({ type: 'go', route: 'premium' })}
        >
          <span className="home__premium-crown" aria-hidden>👑</span>
          <div className="grow">
            <div className="home__premium-title">GO PREMIUM</div>
            <p className="tiny">No ads, and scroll first in any lobby.</p>
          </div>
          <span className="home__premium-arrow" aria-hidden>›</span>
        </button>
      )}

      <AdSlot />

      <button
        className="home__friends"
        onClick={() => dispatch({ type: 'go', route: 'friends' })}
      >
        {profile.friends.length > 0
          ? `👥 ${profile.friends.length} ${profile.friends.length === 1 ? 'friend' : 'friends'} — invite them to a lobby →`
          : '👥 Find friends — search people and see who you might know →'}
        {profile.incomingRequests.length > 0 && (
          <span className="home__friends-badge">{profile.incomingRequests.length}</span>
        )}
      </button>
    </div>
  );
}
