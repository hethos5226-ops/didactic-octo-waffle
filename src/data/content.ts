/**
 * The shape a piece of SCROLL content takes.
 *
 * This is deliberately the full shape a real backend would return, not the
 * subset today's placeholders need, so that swapping the mock source for an
 * API is a change of *where* the data comes from rather than a change of what
 * a video is. Counts are numbers rather than pre-formatted strings for the
 * same reason — the server sends 12480, the UI decides it reads "12.4K".
 */
export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  /** Null until real audio exists; the UI shows the title either way. */
  url: string | null;
}

export interface Video {
  id: string;
  creatorId: string;
  /**
   * Null means "no file yet" — the player falls back to a generated visual
   * rather than showing a broken frame, so the feed still works before any
   * upload pipeline exists.
   */
  url: string | null;
  /**
   * WebM/VP9 alongside the MP4. Not belt-and-braces: Safari and iOS need
   * H.264, while Chromium builds without proprietary codecs (which includes
   * plain Chromium and some Linux browsers) can only play VP9. Offering both
   * as <source> elements lets each browser choose the one it can decode.
   */
  urlWebm: string | null;
  thumbnail: string | null;
  caption: string;
  audio: AudioTrack;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  /** Epoch millis. */
  createdAt: number;
  hashtags: string[];
  /** Seconds; used for the progress bar before metadata loads. */
  durationSeconds: number;
}

/** What a viewer has done to a video. Kept apart from the video itself, since
 *  it is per-user state and a real API would return it separately. */
export interface VideoInteraction {
  liked: boolean;
  saved: boolean;
}

export const NO_INTERACTION: VideoInteraction = { liked: false, saved: false };

/** 12480 -> "12.4K". Counts are stored raw and formatted at the edge. */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `${n}`;
}

/** "3d", "2h" — the compact form a feed uses. */
export function timeSince(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}
