import { Avatar } from '../components/Avatar';
import { FeedScoreRing } from '../components/FeedScoreRing';
import { PEOPLE } from '../data/people';
import { SCORE_CATEGORIES } from '../data/reactions';
import { LEVEL_TITLES, progressionFromXp, titleForLevel } from '../data/levels';
import { VIBES } from '../data/vibes';
import { feedScoreFrom, percentages } from '../state/scoring';
import { useStore } from '../state/store';
import type { CategoryId } from '../state/types';

export function ProfileScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const viewingId = state.viewingPersonId;
  const other = viewingId ? PEOPLE.find((p) => p.id === viewingId) : null;

  const isMe = !other;
  const level = isMe ? progressionFromXp(profile.xp).level : other!.level;
  const progress = progressionFromXp(profile.xp);
  const title = titleForLevel(level);

  // Somebody else's percentages are derived from their feed score so the
  // numbers on their card hang together instead of looking random.
  const pcts: Record<CategoryId, number> = isMe
    ? percentages(profile.tallies)
    : {
        funny: clamp(other!.feedScore + spread(other!.id, 0)),
        chaotic: clamp(other!.feedScore + spread(other!.id, 1)),
        fire: clamp(other!.feedScore + spread(other!.id, 2)),
        wtf: clamp(other!.feedScore + spread(other!.id, 3)),
        good: clamp(other!.feedScore + spread(other!.id, 4)),
      };
  const score = isMe ? feedScoreFrom(pcts) : other!.feedScore;
  const vibes = isMe ? profile.vibes : other!.vibes;

  const nextTitle = LEVEL_TITLES.find((t) => t.level > level);

  return (
    <div className="screen profile">
      <header className="profile__nav">
        <button className="lobby__back" onClick={() => dispatch({ type: 'go', route: 'home' })}>‹</button>
        <span className="eyebrow">{isMe ? 'YOUR PROFILE' : 'PROFILE'}</span>
        <div className="spacer" />
        {isMe && (
          <button className="profile__signout" onClick={() => dispatch({ type: 'signOut' })}>
            Sign out
          </button>
        )}
      </header>

      <div className="profile__hero">
        <div
          className="profile__glow"
          style={{ background: `radial-gradient(circle, ${isMe ? profile.colour : other!.colour}66, transparent 70%)` }}
          aria-hidden
        />
        <Avatar
          emoji={isMe ? profile.avatar : other!.avatar}
          colour={isMe ? profile.colour : other!.colour}
          flag={isMe ? profile.flag : other!.flag}
          size={96}
        />
        <h1 className="profile__handle">@{isMe ? profile.handle : other!.handle}</h1>
        <div className="profile__level-pill">
          <span aria-hidden>{title.emoji}</span> LEVEL {level} · {title.title}
        </div>
      </div>

      {isMe && (
        <div className="profile__xp">
          <div className="row row--between tiny">
            <span>{progress.xpIntoLevel} / {progress.xpForNext} XP</span>
            {nextTitle && <span>Next: {nextTitle.emoji} {nextTitle.title} at LV {nextTitle.level}</span>}
          </div>
          <div className="meter">
            <div
              className="meter__fill"
              style={{ width: `${progress.fraction * 100}%`, background: 'var(--grad-sun)' }}
            />
          </div>
        </div>
      )}

      <div className="profile__score">
        <FeedScoreRing score={score} size={128} animate />
        <div className="profile__cats">
          {SCORE_CATEGORIES.map((c) => (
            <div key={c.id} className="profile__cat">
              <div className="row row--between">
                <span className="profile__cat-label">{c.emoji} {c.label}</span>
                <strong style={{ color: c.colour }}>{pcts[c.id]}%</strong>
              </div>
              <div className="meter" style={{ height: 7 }}>
                <div className="meter__fill" style={{ width: `${pcts[c.id]}%`, background: c.colour }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="profile__stats">
        <Stat emoji="❤️" value={isMe ? profile.profileLikes : 1284} label="Profile likes" />
        <Stat emoji="👥" value={isMe ? profile.friends.length : 48} label="Friends" />
        <Stat emoji="🎬" value={isMe ? profile.roundsScrolled : 96} label="Rounds scrolled" />
        <Stat emoji="✨" value={isMe ? profile.reactionsReceived : 5401} label="Reactions got" />
      </div>

      <div className="card profile__vibes">
        <span className="eyebrow">{isMe ? 'YOUR ALGORITHM' : 'THEIR ALGORITHM'}</span>
        <div className="wrap">
          {vibes.map((v) => (
            <span
              key={v}
              className="profile__vibe"
              style={{ background: `linear-gradient(135deg, ${VIBES[v].gradient[0]}, ${VIBES[v].gradient[1]})` }}
            >
              {VIBES[v].emoji} {VIBES[v].label}
            </span>
          ))}
        </div>
      </div>

      {isMe && profile.friends.length > 0 && (
        <button className="btn btn--ghost btn--block" onClick={() => dispatch({ type: 'go', route: 'friends' })}>
          👥 See your {profile.friends.length} {profile.friends.length === 1 ? 'friend' : 'friends'}
        </button>
      )}
    </div>
  );
}

function Stat({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <div className="stat">
      <span className="stat__emoji" aria-hidden>{emoji}</span>
      <span className="stat__value">{value.toLocaleString()}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

function spread(seed: string, i: number): number {
  let h = 0;
  for (let n = 0; n < seed.length; n++) h = (h * 31 + seed.charCodeAt(n)) % 997;
  return ((h + i * 137) % 26) - 13;
}

function clamp(n: number): number {
  return Math.max(20, Math.min(99, Math.round(n)));
}
