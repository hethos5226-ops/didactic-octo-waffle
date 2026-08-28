/**
 * Levels exist to make coming back feel like it counts. The curve is gentle
 * early (a first session should land you a level or two) and stretches out
 * later, so "Algorithm God" means something.
 */

export interface LevelTitle {
  level: number;
  emoji: string;
  title: string;
}

export const LEVEL_TITLES: LevelTitle[] = [
  { level: 1, emoji: '🐣', title: 'New Scroller' },
  { level: 5, emoji: '📱', title: 'FYP Rookie' },
  { level: 10, emoji: '😎', title: 'Certified Scroller' },
  { level: 25, emoji: '🔥', title: 'FYP Addict' },
  { level: 50, emoji: '👑', title: 'Algorithm God' },
  { level: 100, emoji: '💀', title: 'Chronically Online' },
];

export function titleForLevel(level: number): LevelTitle {
  let current = LEVEL_TITLES[0];
  for (const t of LEVEL_TITLES) if (level >= t.level) current = t;
  return current;
}

/** XP needed to get *from* `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return 100 + (level - 1) * 40;
}

export interface Progression {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  fraction: number;
}

/** Resolve a lifetime XP total into a level and a progress bar. */
export function progressionFromXp(totalXp: number): Progression {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (level < 100 && remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level += 1;
  }
  const xpForNext = xpForNextLevel(level);
  return {
    level,
    xpIntoLevel: remaining,
    xpForNext,
    fraction: Math.min(1, remaining / xpForNext),
  };
}

export const XP = {
  finishRoundAsViewer: 40,
  finishRoundAsScroller: 90,
  perReactionReceived: 6,
  perReactionSent: 2,
  profileLikeReceived: 25,
  friendAdded: 60,
  sessionComplete: 75,
} as const;

export interface XpAward {
  label: string;
  emoji: string;
  amount: number;
}
