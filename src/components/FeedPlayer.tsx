import { useEffect, useMemo, useState } from 'react';
import type { FeedItem } from '../data/feed';
import { VIBES } from '../data/vibes';

interface FeedPlayerProps {
  item: FeedItem;
  /** Index of the clip within the round, 0-based. */
  index: number;
  total: number;
  /** True when the local user is the one holding the phone. */
  isScroller: boolean;
  scrollerHandle: string;
  scrollerFlag: string;
  onAdvance: () => void;
}

/**
 * A stand-in for the scroller's screen share.
 *
 * Real short-form content is never fetched, hosted or embedded here — this
 * draws a synthetic "clip" from the scroller's vibes so the shared-viewing
 * experience can be demonstrated without touching anyone's content. The frame,
 * the chrome and the interaction are the part being prototyped.
 */
export function FeedPlayer({
  item, index, total, isScroller, scrollerHandle, scrollerFlag, onAdvance,
}: FeedPlayerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 100);
    return () => clearInterval(timer);
  }, [item.id]);

  const vibe = VIBES[item.vibe];
  const progress = Math.min(1, elapsed / item.duration);

  // Lay the emoji cast out as a scene: one hero subject in the upper middle
  // where a face would be, the rest spread to the corners. A flat gradient with
  // three emoji huddled in one spot does not read as a video.
  const scene = useMemo(() => {
    const seed = item.id.split('-').reduce((n, part) => n + part.length + part.charCodeAt(0), 0);
    const spots = [
      { left: 50, top: 34, size: 132 },
      { left: 20, top: 62, size: 68 },
      { left: 78, top: 20, size: 58 },
      { left: 26, top: 16, size: 52 },
      { left: 72, top: 58, size: 62 },
    ];
    return item.cast.map((emoji, i) => {
      const spot = spots[i % spots.length];
      return {
        emoji,
        left: spot.left + ((seed + i * 17) % 9) - 4,
        top: spot.top + ((seed + i * 23) % 9) - 4,
        size: spot.size,
        delay: ((seed + i * 7) % 20) / 10,
        duration: 3 + ((seed + i * 13) % 20) / 10,
      };
    });
  }, [item.id, item.cast]);

  return (
    <div className="player">
      {/* Which clip of the round we are on — the round has a shape, and
          everyone watching can see how far through it they are. */}
      <div className="player__ticks" aria-label={`Video ${index + 1} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`player__tick${i < index ? ' is-done' : ''}${i === index ? ' is-live' : ''}`}
          >
            {i === index && (
              <span className="player__tick-fill" style={{ width: `${progress * 100}%` }} />
            )}
          </span>
        ))}
      </div>

      <div
        className="player__stage"
        key={item.id}
        style={{
          background: `linear-gradient(160deg, ${item.gradient[0]}, ${item.gradient[1]})`,
        }}
      >
        <div className="player__grain" aria-hidden />

        {scene.map((s, i) => (
          <span
            key={i}
            className="player__cast"
            aria-hidden
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              fontSize: s.size,
              marginLeft: -s.size / 2,
              marginTop: -s.size / 2,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          >
            {s.emoji}
          </span>
        ))}

        <div className="player__live">
          <span className="player__live-dot" />
          {isScroller ? "YOU'RE SHARING" : `${scrollerFlag} @${scrollerHandle}'S SCREEN`}
        </div>

        <div className="player__vibe">{vibe.emoji} {vibe.label}</div>

        <div className="player__scrim" aria-hidden />

        <div className="player__meta">
          <div className="player__creator">{item.creator}</div>
          <div className="player__caption">{item.caption}</div>
          <div className="player__sound">
            <span aria-hidden>🎵</span>
            <span className="player__sound-text">{item.sound}</span>
          </div>
        </div>

        <div className="player__rail" aria-hidden>
          <div className="player__rail-item"><span>❤️</span><small>{item.likes}</small></div>
          <div className="player__rail-item"><span>💬</span><small>{(index + 3) * 417}</small></div>
          <div className="player__rail-item"><span>↗️</span><small>Share</small></div>
          <div className="player__rail-disc">💿</div>
        </div>

        {/* The pill is the affordance, but the whole frame advances — otherwise
            opening the chat would trap the scroller on one clip. */}
        {isScroller && (
          <button className="player__tap" onClick={onAdvance} aria-label="Next video" />
        )}

        {isScroller ? (
          <button className="player__swipe" onClick={onAdvance}>
            <span className="player__swipe-arrow" aria-hidden>⌃</span>
            Swipe for next
          </button>
        ) : (
          <div className="player__watching">
            👀 Watching @{scrollerHandle} — they control the feed
          </div>
        )}
      </div>
    </div>
  );
}
