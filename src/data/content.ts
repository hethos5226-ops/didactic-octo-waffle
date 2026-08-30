/**
 * Small formatting helpers shared across the app.
 *
 * This file used to carry the Video/AudioTrack model for a solo reel feed.
 * That feature is gone — SCROLL is a game played by watching someone else's
 * feed, not a place to browse one — so only the number formatting survives.
 */

/**
 * 12480 -> "12.4K". Counts are stored raw and formatted at the edge.
 *
 * `null` means the number is genuinely not known, and renders as an em dash
 * rather than as zero. Showing 0 for "we did not ask" is a small lie that
 * looks exactly like a real measurement.
 */
export function formatCount(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `${n}`;
}
