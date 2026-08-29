import { PEOPLE, type Person } from './people';
import { sharedTags } from './hashtags';

/**
 * Finding people to add.
 *
 * Ranking is deliberately not "most popular": mutual friends first, then
 * shared hashtags. Mutuals are the strongest signal that you actually know
 * someone, and hashtags carry the ranking on a brand-new account where nobody
 * has any mutuals yet — otherwise the very first suggestion list, the one that
 * decides whether the feature feels useful, would be in arbitrary order.
 */
export interface Suggestion {
  person: Person;
  mutuals: Person[];
  shared: string[];
}

export function mutualFriends(myFriends: string[], person: Person): Person[] {
  const theirs = new Set(person.friends);
  return myFriends
    .filter((id) => theirs.has(id))
    .map((id) => PEOPLE.find((p) => p.id === id))
    .filter((p): p is Person => Boolean(p));
}

interface SuggestOptions {
  myFriends: string[];
  myTags: string[];
  /** Already-sent requests are excluded so you cannot ask twice. */
  exclude?: string[];
  limit?: number;
}

export function suggestedPeople({
  myFriends, myTags, exclude = [], limit = 8,
}: SuggestOptions): Suggestion[] {
  const skip = new Set([...myFriends, ...exclude]);

  return PEOPLE.filter((p) => !skip.has(p.id))
    .map((person) => ({
      person,
      mutuals: mutualFriends(myFriends, person),
      shared: sharedTags(myTags, person.hashtags),
    }))
    .sort(
      (a, b) =>
        b.mutuals.length - a.mutuals.length ||
        b.shared.length - a.shared.length ||
        a.person.handle.localeCompare(b.person.handle),
    )
    .slice(0, limit);
}

/** Match on handle or on an interest, so "dogs" finds the dog people. */
export function searchPeople(query: string, exclude: string[] = []): Person[] {
  const q = query.trim().toLowerCase().replace(/^[@#]/, '');
  if (!q) return [];
  const skip = new Set(exclude);
  return PEOPLE.filter((p) => {
    if (skip.has(p.id)) return false;
    return (
      p.handle.toLowerCase().includes(q) ||
      p.country.toLowerCase().includes(q) ||
      p.hashtags.some((t) => t.includes(q))
    );
  });
}
