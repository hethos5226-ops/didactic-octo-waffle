import { Avatar } from '../components/Avatar';
import { FeedScoreRing } from '../components/FeedScoreRing';
import { useEffect, useState } from 'react';
import { lookupPeople, mutualsWith, type DirectoryPerson } from '../data/directory';
import { SCORE_CATEGORIES } from '../data/reactions';
import { LEVEL_TITLES, progressionFromXp, titleForLevel } from '../data/levels';
import { VIBES } from '../data/vibes';
import { sharedTags } from '../data/hashtags';
import { formatCount } from '../data/content';
import { feedScoreFrom, percentages } from '../state/scoring';
import { useStore } from '../state/store';
import type { CategoryId } from '../state/types';

export function ProfileScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const viewingId = state.viewingPersonId;

  // Somebody else's profile comes from the directory, so it is a real row once
  // a backend is connected and the built-in cast when it is not.
  const [other, setOther] = useState<DirectoryPerson | null>(null);
  useEffect(() => {
    if (!viewingId) { setOther(null); return; }
    let live = true;
    lookupPeople([viewingId]).then((people) => {
      if (live) setOther(people[0] ?? null);
    });
    return () => { live = false; };
  }, [viewingId]);

  // While the lookup is in flight there is nothing to render for them.
  if (viewingId && !other) {
    return (
      <div className="screen profile">
        <header className="profile__nav">
          <button className="lobby__back" onClick={() => dispatch({ type: 'back' })}>‹</button>
          <span className="eyebrow">PROFILE</span>
        </header>
        <p className="subtitle profile__private">Loading…</p>
      </div>
    );
  }

  const isMe = !other;
  const level = isMe ? progressionFromXp(profile.xp).level : levelFrom(other!.id);
  const progress = progressionFromXp(profile.xp);
  const title = titleForLevel(level);

  // Somebody else's percentages are derived from their feed score so the
  // numbers on their card hang together instead of looking random.
  const pcts: Record<CategoryId, number> = isMe
    ? percentages(profile.tallies)
    : {
        funny: clamp(scoreFrom(other!.id) + spread(other!.id, 0)),
        chaotic: clamp(scoreFrom(other!.id) + spread(other!.id, 1)),
        fire: clamp(scoreFrom(other!.id) + spread(other!.id, 2)),
        wtf: clamp(scoreFrom(other!.id) + spread(other!.id, 3)),
        good: clamp(scoreFrom(other!.id) + spread(other!.id, 4)),
      };
  const score = isMe ? feedScoreFrom(pcts) : scoreFrom(other!.id);
  const vibes = isMe ? profile.vibes : other!.vibes;
  const tags = isMe ? profile.hashtags : other!.hashtags;
  const common = isMe ? [] : sharedTags(profile.hashtags, other!.hashtags);

  const nextTitle = LEVEL_TITLES.find((t) => t.level > level);
  // Both counts are whatever is actually stored. `followerCount` is maintained
  // by a database trigger on the follows table, so it reflects real follows;
  // the other person's following count is not something the client can know
  // without asking, and inventing one from their level would render exactly
  // like a real figure.
  const followerCount = isMe ? profile.followerCount : other!.followerCount;
  const followingCount = isMe ? profile.following.length : null;
  const isFollowing = !isMe && profile.following.includes(other!.id);

  // Somebody else's profile is the natural place to act on them.
  const isFriend = !isMe && profile.friends.includes(other!.id);
  const requested = !isMe && profile.sentRequests.includes(other!.id);
  const asked = !isMe && profile.incomingRequests.includes(other!.id);
  const mutuals = isMe ? [] : mutualsWith(profile.friends, other!.id);

  return (
    <div className="screen profile">
      <header className="profile__nav">
        {/* Your own profile is a tab root, reached by tapping the tab — there
            is nowhere "back" means, so the arrow only shows for someone
            else's profile, which you genuinely navigated into. */}
        {!isMe && (
          <button className="lobby__back" onClick={() => dispatch({ type: 'back' })}>‹</button>
        )}
        <span className="eyebrow">{isMe ? 'YOUR PROFILE' : 'PROFILE'}</span>
        <div className="spacer" />
        {isMe && (
          <div className="row profile__nav-actions">
            <button className="profile__edit" onClick={() => dispatch({ type: 'go', route: 'editProfile' })}>
              Edit
            </button>
          </div>
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
          photo={isMe ? profile.photo : other!.photo}
          colour={isMe ? profile.colour : other!.colour}
          flag={isMe ? profile.flag : other!.flag}
          size={96}
          premium={isMe ? profile.premium : other!.premium}
        />
        <h1 className="profile__display">
          {isMe ? profile.displayName || profile.handle : other!.handle}
        </h1>
        <div className="profile__handle">@{isMe ? profile.handle : other!.handle}</div>
        {isMe && profile.bio && <p className="profile__bio">{profile.bio}</p>}
        {!isMe && (
          <p className="profile__bio">
            {other!.vibes.map((v) => VIBES[v].label).join(' · ')}
          </p>
        )}
        <div className="profile__level-pill">
          <span aria-hidden>{title.emoji}</span> LEVEL {level} · {title.title}
        </div>
        {(isMe ? profile.premium : other!.premium) && (
          <div className="profile__premium-pill">👑 PREMIUM</div>
        )}
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

      <div className="profile__counts profile__counts--two">
        <button
          className="profile__count"
          onClick={() => isMe && dispatch({ type: 'go', route: 'friends' })}
        >
          <span className="profile__count-num">{formatCount(followerCount)}</span>
          <span className="profile__count-label">Followers</span>
        </button>
        <button
          className="profile__count"
          onClick={() => isMe && dispatch({ type: 'go', route: 'friends' })}
        >
          <span className="profile__count-num">{formatCount(followingCount)}</span>
          <span className="profile__count-label">Following</span>
        </button>
      </div>

      {isMe ? (
        <div className="row profile__cta">
          <button
            className="btn btn--ghost grow"
            onClick={() => dispatch({ type: 'go', route: 'editProfile' })}
          >
            Edit profile
          </button>
          <button
            className="btn btn--ghost grow"
            onClick={() => dispatch({ type: 'go', route: 'friends' })}
          >
            Find people
          </button>
        </div>
      ) : (
        <div className="row profile__cta">
          <button
            className={`btn grow ${isFollowing ? 'btn--ghost' : 'btn--primary'}`}
            onClick={() => dispatch({ type: 'toggleFollow', id: other!.id })}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>
      )}

      <div className="profile__stats">
        <Stat emoji="❤️" value={isMe ? profile.profileLikes : other!.followerCount} label="Profile likes" />
        <Stat
          emoji="👥"
          value={isMe ? profile.friends.length : levelFrom(other!.id) * 2}
          label="Friends"
          onClick={isMe ? () => dispatch({ type: 'go', route: 'friends' }) : undefined}
        />
        <Stat emoji="🎬" value={isMe ? profile.roundsScrolled : levelFrom(other!.id) * 4} label="Rounds scrolled" />
        <Stat
          emoji="✨"
          value={isMe ? profile.reactionsReceived : levelFrom(other!.id) * 180}
          label="Reactions got"
        />
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

      {!isMe && (
        <div className="profile__actions">
          {mutuals.length > 0 && (
            <p className="profile__mutuals">
              👥 {mutuals.length} mutual {mutuals.length === 1 ? 'friend' : 'friends'} ·{' '}
              {mutuals.map((m) => `@${m.handle}`).join(', ')}
            </p>
          )}

          {isFriend ? (
            <div className="profile__friend-state">✓ You're friends</div>
          ) : asked ? (
            <div className="row profile__accept-row">
              <button
                className="btn btn--ghost grow"
                onClick={() => dispatch({ type: 'declineFriendRequest', id: other!.id })}
              >
                Ignore
              </button>
              <button
                className="btn btn--primary grow"
                onClick={() => dispatch({ type: 'acceptFriendRequest', id: other!.id })}
              >
                Accept request
              </button>
            </div>
          ) : requested ? (
            <div className="profile__friend-state is-pending">📨 Request sent</div>
          ) : (
            <button
              className="btn btn--primary btn--lg btn--block"
              onClick={() => dispatch({ type: 'sendFriendRequest', id: other!.id })}
            >
              + Add friend
            </button>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <div className="card profile__tags-card">
          <span className="eyebrow">{isMe ? "WHAT YOU'RE INTO" : "WHAT THEY'RE INTO"}</span>
          {common.length > 0 && (
            <p className="profile__common">
              🤝 You both like {common.map((t) => `#${t}`).join(', ')}
            </p>
          )}
          <div className="wrap profile__tags">
            {tags.map((t) => (
              <span
                key={t}
                className={`tag${common.includes(t) ? ' tag--common' : ''}`}
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      {isMe && !profile.premium && (
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

      {isMe && profile.premium && (
        <button className="btn btn--ghost btn--block" onClick={() => dispatch({ type: 'go', route: 'premium' })}>
          👑 Manage Premium
        </button>
      )}


    </div>
  );
}

interface StatProps {
  emoji: string;
  value: number;
  label: string;
  /** Given a handler, the tile becomes the way into that thing. */
  onClick?: () => void;
}

function Stat({ emoji, value, label, onClick }: StatProps) {
  const content = (
    <>
      <span className="stat__emoji" aria-hidden>{emoji}</span>
      <span className="stat__value">{value.toLocaleString()}</span>
      <span className="stat__label">{label}</span>
    </>
  );
  if (!onClick) return <div className="stat">{content}</div>;
  return (
    <button className="stat stat--tappable" onClick={onClick}>
      {content}
      <span className="stat__chevron" aria-hidden>›</span>
    </button>
  );
}

/**
 * Level and feed score for someone else.
 *
 * Both are earned by playing, and there is no shared game state yet — so
 * rather than showing a blank, they are derived from the person's id. Stable
 * per person, and replaced the moment matches are recorded against real
 * accounts.
 */
function levelFrom(id: string): number {
  return 4 + (hash(id) % 44);
}

function scoreFrom(id: string): number {
  return 62 + (hash(id) % 34);
}

function hash(seed: string): number {
  let h = 0;
  for (let n = 0; n < seed.length; n++) h = (h * 31 + seed.charCodeAt(n)) % 9973;
  return h;
}

function spread(seed: string, i: number): number {
  let h = 0;
  for (let n = 0; n < seed.length; n++) h = (h * 31 + seed.charCodeAt(n)) % 997;
  return ((h + i * 137) % 26) - 13;
}

function clamp(n: number): number {
  return Math.max(20, Math.min(99, Math.round(n)));
}
