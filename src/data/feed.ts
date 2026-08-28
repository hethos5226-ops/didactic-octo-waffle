import { VIBES, type VibeId } from './vibes';

/**
 * A stand-in for one short-form video.
 *
 * The prototype never touches real TikTok/Reels content. A `FeedItem` is a
 * procedurally generated card that a screen share *would* be showing, so the
 * interface and the social loop can be demonstrated honestly.
 */
export interface FeedItem {
  id: string;
  vibe: VibeId;
  caption: string;
  creator: string;
  sound: string;
  cast: string[];
  gradient: [string, string];
  likes: string;
  /** Seconds the clip "runs" before the scroller usually moves on. */
  duration: number;
}

/** Small deterministic PRNG so a given seed always rebuilds the same feed. */
function makeRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

function likeCount(rand: () => number): string {
  const n = Math.floor(rand() * 2_400_000) + 800;
  if (n > 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n > 1000) return `${(n / 1000).toFixed(0)}K`;
  return `${n}`;
}

/**
 * Build somebody's feed from their vibes. The mix is weighted towards their
 * first vibe — an algorithm has a favourite, and that is what makes a feed
 * recognisable as theirs.
 */
export function generateFeed(seed: string, vibes: VibeId[], count: number): FeedItem[] {
  const rand = makeRandom(seed);
  const pool: VibeId[] = [];
  vibes.forEach((v, i) => {
    const weight = i === 0 ? 4 : i === 1 ? 3 : 2;
    for (let n = 0; n < weight; n++) pool.push(v);
  });
  if (pool.length === 0) pool.push('chaos');

  const items: FeedItem[] = [];
  for (let i = 0; i < count; i++) {
    const vibeId = pick(rand, pool);
    const vibe = VIBES[vibeId];
    const castSize = 2 + Math.floor(rand() * 3);
    const cast: string[] = [];
    for (let c = 0; c < castSize; c++) cast.push(pick(rand, vibe.cast));
    items.push({
      id: `${seed}-${i}`,
      vibe: vibeId,
      caption: pick(rand, vibe.captions),
      creator: pick(rand, vibe.creators),
      sound: pick(rand, vibe.sounds),
      cast,
      gradient: vibe.gradient,
      likes: likeCount(rand),
      duration: 5 + Math.floor(rand() * 5),
    });
  }
  return items;
}
