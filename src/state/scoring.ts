import { SCORE_CATEGORIES, REACTIONS } from '../data/reactions';
import type { CategoryId, Tallies } from './types';

/**
 * A new profile starts with a soft baseline rather than 0%, so the first
 * profile you ever see is not a wall of zeroes. Real votes quickly outweigh it.
 */
const BASELINE_VOTES = 4;
const BASELINE_POINTS = 4 * 60;

export function emptyTallies(): Tallies {
  const t = {} as Tallies;
  for (const c of SCORE_CATEGORIES) {
    t[c.id] = { points: BASELINE_POINTS, votes: BASELINE_VOTES };
  }
  return t;
}

export function percentageFor(tallies: Tallies, id: CategoryId): number {
  const t = tallies[id];
  if (!t || t.votes === 0) return 0;
  return Math.round(Math.min(100, Math.max(0, t.points / t.votes)));
}

export function percentages(tallies: Tallies): Record<CategoryId, number> {
  const out = {} as Record<CategoryId, number>;
  for (const c of SCORE_CATEGORIES) out[c.id] = percentageFor(tallies, c.id);
  return out;
}

/**
 * The headline number. A feed is not "good" because it scores high on every
 * category — a chaotic feed and a cosy feed can both be great — so the score
 * leans on how strongly people felt overall, with GOOD FYP weighted highest
 * because it is the one category that means "I'd watch this again".
 */
export function feedScoreFrom(p: Record<CategoryId, number>): number {
  const weighted =
    p.good * 0.3 + p.funny * 0.25 + p.fire * 0.2 + p.chaotic * 0.15 + p.wtf * 0.1;
  return Math.round(Math.min(100, weighted));
}

export function applyRatings(
  tallies: Tallies,
  ratings: Record<CategoryId, number>[],
): Tallies {
  const next: Tallies = { ...tallies };
  for (const c of SCORE_CATEGORIES) next[c.id] = { ...tallies[c.id] };
  for (const rating of ratings) {
    for (const c of SCORE_CATEGORIES) {
      const value = rating[c.id];
      if (typeof value !== 'number') continue;
      next[c.id].points += value;
      next[c.id].votes += 1;
    }
  }
  return next;
}

/**
 * Live reactions during a round nudge the categories too, so a round where
 * everybody spammed 💀 shows up as chaotic even before anyone rates it.
 */
export function ratingFromReactions(
  counts: Record<string, number>,
): Record<CategoryId, number> {
  const totals: Record<CategoryId, number> = {
    funny: 0, chaotic: 0, fire: 0, wtf: 0, good: 0,
  };
  let total = 0;
  for (const r of REACTIONS) {
    const n = counts[r.id] ?? 0;
    total += n;
    if (r.scores) totals[r.scores] += n;
  }
  const out = {} as Record<CategoryId, number>;
  for (const key of Object.keys(totals) as CategoryId[]) {
    // Scale share-of-reactions into a 0-100 feel, with a floor so a quiet
    // round is not read as a bad one.
    const share = total === 0 ? 0 : totals[key] / total;
    out[key] = Math.round(Math.min(100, 35 + share * 130));
  }
  return out;
}
