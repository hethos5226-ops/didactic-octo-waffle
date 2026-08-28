import type { VibeId } from './vibes';

/**
 * Hashtags are how people say what they're actually into, in their own words.
 * Vibes shape what a feed *looks* like; hashtags are what you have in common
 * with the stranger sitting in the lobby with you — and "you both like #dogs"
 * is a far better reason to add someone than a matching category chip.
 *
 * Each suggestion carries the vibe it feeds, so picking #dogs also nudges the
 * generated feed towards animals. Typed tags that match nothing still count
 * for matching, they just don't steer the feed.
 */
export interface HashtagSuggestion {
  tag: string;
  vibe: VibeId;
}

export const HASHTAG_SUGGESTIONS: HashtagSuggestion[] = [
  { tag: 'dogs', vibe: 'animals' },
  { tag: 'cats', vibe: 'animals' },
  { tag: 'brainrot', vibe: 'brainrot' },
  { tag: 'football', vibe: 'sports' },
  { tag: 'nba', vibe: 'sports' },
  { tag: 'gym', vibe: 'gym' },
  { tag: 'cooking', vibe: 'cooking' },
  { tag: 'baking', vibe: 'cooking' },
  { tag: 'gaming', vibe: 'gaming' },
  { tag: 'minecraft', vibe: 'gaming' },
  { tag: 'fashion', vibe: 'fits' },
  { tag: 'thrifting', vibe: 'fits' },
  { tag: 'music', vibe: 'music' },
  { tag: 'rap', vibe: 'music' },
  { tag: 'cars', vibe: 'cars' },
  { tag: 'f1', vibe: 'cars' },
  { tag: 'conspiracy', vibe: 'conspiracy' },
  { tag: 'space', vibe: 'conspiracy' },
  { tag: 'cozy', vibe: 'cozy' },
  { tag: 'plants', vibe: 'cozy' },
  { tag: 'chaos', vibe: 'chaos' },
  { tag: 'pranks', vibe: 'chaos' },
  { tag: 'anime', vibe: 'gaming' },
  { tag: 'skincare', vibe: 'fits' },
  { tag: 'memes', vibe: 'brainrot' },
  { tag: 'travel', vibe: 'cozy' },
  { tag: 'horror', vibe: 'conspiracy' },
  { tag: 'comedy', vibe: 'chaos' },
];

/** Strip decoration and whitespace so `#Dogs ` and `dogs` are the same tag. */
export function normaliseTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .slice(0, 20);
}

/** Tags two people share, in the order the first person listed them. */
export function sharedTags(mine: string[], theirs: string[]): string[] {
  const other = new Set(theirs.map(normaliseTag));
  return mine.filter((t) => other.has(normaliseTag(t)));
}

/** The vibes implied by a set of hashtags, most-picked first. */
export function vibesFromTags(tags: string[]): VibeId[] {
  const counts = new Map<VibeId, number>();
  for (const tag of tags) {
    const match = HASHTAG_SUGGESTIONS.find((s) => s.tag === normaliseTag(tag));
    if (!match) continue;
    counts.set(match.vibe, (counts.get(match.vibe) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([vibe]) => vibe);
}

/**
 * The vibes a profile should carry, given its hashtags.
 *
 * Vibes drive feed generation, so this must always return something usable
 * even when someone picks three tags that all map to one vibe (or three tags
 * that map to none). Recognised tags come first, in popularity order, then
 * defaults pad it out to a mix worth watching.
 */
export function vibesForProfile(tags: string[]): VibeId[] {
  const picked = vibesFromTags(tags);
  const padding: VibeId[] = ['chaos', 'brainrot', 'animals', 'music'];
  for (const vibe of padding) {
    if (picked.length >= 3) break;
    if (!picked.includes(vibe)) picked.push(vibe);
  }
  return picked.slice(0, 4);
}
