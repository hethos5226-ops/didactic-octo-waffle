import { useEffect, useRef, useState } from 'react';
import type { Video } from '../data/content';

interface ReelPlayerProps {
  video: Video;
  /** Only the reel in view plays; the rest stay paused and silent. */
  active: boolean;
  muted: boolean;
  /** Reported so the parent can drive the progress bar. */
  onProgress: (fraction: number) => void;
  onTogglePlay: (playing: boolean) => void;
}

/**
 * One reel's video surface.
 *
 * A real `<video>` element rather than an animated stand-in, so autoplay,
 * pause, loop, seek and mute are the browser's own behaviour and not an
 * imitation of it. When `url` is null — content that exists in the data model
 * but has no file yet — it falls back to the poster or a gradient instead of
 * showing a broken frame.
 *
 * Autoplay only works muted. That is a browser rule, not a preference: an
 * unmuted `play()` from anything but a user gesture is rejected, so the feed
 * starts muted and the first tap on the speaker is what grants sound.
 */
export function ReelPlayer({ video, active, muted, onProgress, onTogglePlay }: ReelPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [stalled, setStalled] = useState(false);

  // Drive play/pause from `active` so only one reel is ever running. Scrolling
  // away resets to the start, which is what every short-form feed does.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) {
      el.currentTime = 0;
      const attempt = el.play();
      if (attempt) {
        attempt.then(() => onTogglePlay(true)).catch(() => setStalled(true));
      }
    } else {
      el.pause();
      el.currentTime = 0;
    }
    // onTogglePlay is stable enough; re-running on it would restart playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, video.id]);

  useEffect(() => {
    const el = ref.current;
    if (el) el.muted = muted;
  }, [muted]);

  if (!video.url) {
    return (
      <div
        className="reel__fallback"
        style={video.thumbnail ? { backgroundImage: `url(${video.thumbnail})` } : undefined}
      >
        <span className="reel__fallback-note">No file for this one yet</span>
      </div>
    );
  }

  return (
    <>
      <video
        ref={ref}
        className="reel__video"
        poster={video.thumbnail ?? undefined}
        loop
        muted={muted}
        playsInline
        preload="metadata"
        // Keeps the frame from being announced as an image to screen readers.
        aria-hidden
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) onProgress(el.currentTime / el.duration);
        }}
        onPlay={() => { setStalled(false); onTogglePlay(true); }}
        onPause={() => onTogglePlay(false)}
      >
        {/* MP4 first so Safari and iOS get hardware-decoded H.264; a browser
            without those codecs skips it and takes the WebM. */}
        <source src={video.url} type="video/mp4" />
        {video.urlWebm && <source src={video.urlWebm} type="video/webm" />}
      </video>
      {stalled && (
        <button
          className="reel__resume"
          onClick={() => ref.current?.play().then(() => setStalled(false)).catch(() => {})}
        >
          ▶ Tap to play
        </button>
      )}
    </>
  );
}

/** Imperative handle for the parent's tap-to-pause, kept out of React state. */
export function togglePlayback(container: HTMLElement | null): boolean | null {
  const el = container?.querySelector('video');
  if (!el) return null;
  if (el.paused) {
    el.play().catch(() => {});
    return true;
  }
  el.pause();
  return false;
}
