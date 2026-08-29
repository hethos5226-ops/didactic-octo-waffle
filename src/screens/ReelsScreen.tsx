import { useEffect, useRef, useState } from 'react';
import { ReelPlayer, togglePlayback } from '../components/ReelPlayer';
import { Avatar } from '../components/Avatar';
import { REELS } from '../data/reels';
import { PEOPLE } from '../data/people';
import { formatCount, timeSince } from '../data/content';
import { useStore } from '../state/store';

/**
 * The full-screen vertical viewer.
 *
 * Reached from a profile's grid — SCROLL has no solo For You feed, because
 * watching alone is a different app. This is "look at what this person
 * posted", and it is the surface the shared in-session feed will be built on.
 *
 * Paging is CSS scroll-snap over a native scroller rather than a JS-driven
 * transform: it inherits the platform's own momentum, rubber-banding and
 * accessibility, which is most of what makes a feed feel right and all of
 * which is tedious and fragile to rebuild by hand. An IntersectionObserver
 * decides which reel is "in view", and only that one plays.
 */
export function ReelsScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const scroller = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [burst, setBurst] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<string | null>(null);

  // Whichever reel is more than half on screen is the active one.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            setActiveIndex(index);
            setProgress(0);
          }
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll('.reel').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const flash = (id: string) => {
    setBurst(id);
    window.setTimeout(() => setBurst((b) => (b === id ? null : b)), 500);
  };

  const like = (videoId: string) => {
    dispatch({ type: 'toggleLike', videoId });
    if (!profile.likedVideos.includes(videoId)) flash(`like-${videoId}`);
  };

  return (
    <div className="reels">
      <header className="reels__top">
        <button className="reels__back" onClick={() => dispatch({ type: 'back' })} aria-label="Back">
          ‹
        </button>
        <div className="reels__tabs">
          <span className="reels__tab is-on">Posts</span>
        </div>
        <button
          className="reels__mute"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </header>

      <div className="reels__scroller scroll-y" ref={scroller}>
        {REELS.map((video, index) => {
          const creator = PEOPLE.find((p) => p.id === video.creatorId);
          const liked = profile.likedVideos.includes(video.id);
          const saved = profile.savedVideos.includes(video.id);
          const following = profile.following.includes(video.creatorId);
          const active = index === activeIndex;

          return (
            <section className="reel" key={video.id} data-index={index}>
              <div
                className="reel__surface"
                onClick={(e) => {
                  const next = togglePlayback(e.currentTarget);
                  if (next !== null) setPlaying(next);
                }}
              >
                <ReelPlayer
                  video={video}
                  active={active}
                  muted={muted}
                  onProgress={(f) => active && setProgress(f)}
                  onTogglePlay={(p) => active && setPlaying(p)}
                />
                <div className="reel__scrim" aria-hidden />

                {active && !playing && (
                  <div className="reel__paused" aria-hidden>▶</div>
                )}

                {burst === `like-${video.id}` && (
                  <span className="reel__heart-burst" aria-hidden>❤️</span>
                )}
              </div>

              {/* ── Right rail: the actions ─────────────────────────── */}
              <div className="reel__rail">
                <button
                  className="reel__creator"
                  onClick={() => dispatch({ type: 'viewPerson', id: video.creatorId })}
                  aria-label={`@${creator?.handle}'s profile`}
                >
                  <Avatar
                    emoji={creator?.avatar ?? '👤'}
                    colour={creator?.colour}
                    size={46}
                  />
                  {!following && (
                    <span
                      className="reel__follow"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: 'toggleFollow', id: video.creatorId });
                      }}
                      aria-hidden
                    >
                      +
                    </span>
                  )}
                </button>

                <RailButton
                  emoji={liked ? '❤️' : '🤍'}
                  label={formatCount(video.likes + (liked ? 1 : 0))}
                  on={liked}
                  onClick={() => like(video.id)}
                  aria={liked ? 'Unlike' : 'Like'}
                />
                <RailButton
                  emoji="💬"
                  label={formatCount(video.comments)}
                  onClick={() => setCommentsFor(video.id)}
                  aria="Comments"
                />
                <RailButton
                  emoji={saved ? '🔖' : '🏷️'}
                  label={formatCount(video.saves + (saved ? 1 : 0))}
                  on={saved}
                  onClick={() => dispatch({ type: 'toggleSave', videoId: video.id })}
                  aria={saved ? 'Unsave' : 'Save'}
                />
                <RailButton
                  emoji="↗️"
                  label={formatCount(video.shares)}
                  onClick={() => setShareFor(video.id)}
                  aria="Share"
                />

                <div className="reel__disc" aria-hidden>💿</div>
              </div>

              {/* ── Bottom: who made it, and what it is ─────────────── */}
              <div className="reel__meta">
                <button
                  className="reel__handle"
                  onClick={() => dispatch({ type: 'viewPerson', id: video.creatorId })}
                >
                  @{creator?.handle}
                  {creator && creator.level >= 25 && <span className="reel__verified">✓</span>}
                  <span className="reel__age">· {timeSince(video.createdAt)}</span>
                </button>

                {!following && (
                  <button
                    className="reel__follow-btn"
                    onClick={() => dispatch({ type: 'toggleFollow', id: video.creatorId })}
                  >
                    Follow
                  </button>
                )}

                <p className="reel__caption">{video.caption}</p>

                <div className="reel__tags">
                  {video.hashtags.map((t) => (
                    <span key={t} className="reel__tag">#{t}</span>
                  ))}
                </div>

                <div className="reel__audio">
                  <span className="reel__audio-icon" aria-hidden>🎵</span>
                  <span className="reel__audio-text">
                    {video.audio.title} · {video.audio.artist}
                  </span>
                </div>
              </div>

              {active && (
                <div className="reel__progress" aria-hidden>
                  <span style={{ width: `${progress * 100}%` }} />
                </div>
              )}
            </section>
          );
        })}
      </div>

      {commentsFor && (
        <CommentsSheet
          count={REELS.find((r) => r.id === commentsFor)?.comments ?? 0}
          onClose={() => setCommentsFor(null)}
        />
      )}

      {shareFor && <ShareSheet onClose={() => setShareFor(null)} />}
    </div>
  );
}

interface RailButtonProps {
  emoji: string;
  label: string;
  on?: boolean;
  aria: string;
  onClick: () => void;
}

function RailButton({ emoji, label, on, aria, onClick }: RailButtonProps) {
  return (
    <button className={`reel__action${on ? ' is-on' : ''}`} onClick={onClick} aria-label={aria}>
      <span className="reel__action-icon">{emoji}</span>
      <span className="reel__action-label">{label}</span>
    </button>
  );
}

/**
 * Comments are structurally present — the count is in the data model and the
 * sheet opens — but there are no comment bodies yet, and inventing a thread
 * would be pretending a feature exists.
 */
function CommentsSheet({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet__panel sheet__panel--tall" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" aria-hidden />
        <h2 className="sheet__title">{formatCount(count)} comments</h2>
        <div className="sheet__empty">
          <span aria-hidden>💬</span>
          <p className="subtitle">
            Comments aren't built yet. The count is real in the data model — the thread, posting
            and moderation come with the backend.
          </p>
        </div>
        <button className="btn btn--ghost btn--block" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function ShareSheet({ onClose }: { onClose: () => void }) {
  const targets = [
    { emoji: '🔗', label: 'Copy link' },
    { emoji: '💬', label: 'Message' },
    { emoji: '👥', label: 'Send to a friend' },
    { emoji: '🔒', label: 'Watch in a lobby' },
  ];
  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet__panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" aria-hidden />
        <h2 className="sheet__title">Share</h2>
        <div className="share__grid">
          {targets.map((t) => (
            <button key={t.label} className="share__target" onClick={onClose}>
              <span className="share__emoji" aria-hidden>{t.emoji}</span>
              <span className="tiny">{t.label}</span>
            </button>
          ))}
        </div>
        <p className="tiny">Sharing needs the backend before it can actually send anything.</p>
        <button className="btn btn--ghost btn--block" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
