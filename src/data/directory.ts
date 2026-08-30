import { PEOPLE, type Person } from './people';
import { sharedTags } from './hashtags';
import {
  fetchPeopleByIds, isBackendConfigured, searchPeople as searchRemote,
  suggestedPeople as suggestRemote, type DirectoryPerson,
} from '../backend';

/**
 * Finding people, from the database when there is one and from the built-in
 * cast when there is not.
 *
 * The cast is not going away yet, and that is deliberate rather than lazy:
 * the simulated players in a lobby exist because there is no matchmaking
 * service, and inventing one is a separate piece of work. What *does* change
 * here is the directory — search, suggestions and profile lookups now read
 * real rows once a project is connected, so the people you can find are real
 * users rather than fixtures.
 */

export interface Suggestion {
  person: DirectoryPerson;
  mutuals: DirectoryPerson[];
  shared: string[];
}

/** The built-in cast, in the shape the directory speaks. */
export function personToDirectory(p: Person): DirectoryPerson {
  return {
    id: p.id,
    handle: p.handle,
    displayName: p.handle,
    avatar: p.avatar,
    photo: null,
    colour: p.colour,
    country: p.country,
    flag: p.flag,
    hashtags: p.hashtags,
    vibes: p.vibes,
    // Zero, not a formula. The built-in cast are not real accounts and have
    // no real followers; a number derived from their level would look exactly
    // like a measurement and be entirely made up.
    followerCount: 0,
    premium: false,
    // The built-in cast are not accounts and have never played a round, so
    // every play statistic is genuinely unknown rather than zero.
    xp: null,
    tallies: null,
    profileLikes: null,
    roundsScrolled: null,
    reactionsReceived: null,
  };
}

const LOCAL_DIRECTORY = PEOPLE.map(personToDirectory);

/** Look someone up by id, wherever they came from. */
export async function lookupPeople(ids: string[]): Promise<DirectoryPerson[]> {
  if (ids.length === 0) return [];
  if (!isBackendConfigured()) {
    return LOCAL_DIRECTORY.filter((p) => ids.includes(p.id));
  }
  return fetchPeopleByIds(ids);
}

/** Synchronous lookup for the built-in cast, used by the simulated lobbies. */
export function localPerson(id: string): DirectoryPerson | undefined {
  return LOCAL_DIRECTORY.find((p) => p.id === id);
}

export async function searchDirectory(
  query: string,
  selfId: string,
): Promise<DirectoryPerson[]> {
  const q = query.trim().toLowerCase().replace(/^[@#]/, '');
  if (!q) return [];
  if (!isBackendConfigured()) {
    return LOCAL_DIRECTORY.filter(
      (p) =>
        p.id !== selfId &&
        (p.handle.toLowerCase().includes(q) ||
          p.displayName.toLowerCase().includes(q) ||
          p.country.toLowerCase().includes(q) ||
          p.hashtags.some((t) => t.includes(q))),
    );
  }
  return searchRemote(q, selfId);
}

/**
 * People you might know.
 *
 * Ranked by mutual friends first, then shared interests. Mutuals are the
 * strongest signal you actually know someone; interests carry the ranking on a
 * new account where nobody has any mutuals yet, which is exactly the list that
 * decides whether the feature feels useful at all.
 */
export async function suggestDirectory(opts: {
  selfId: string;
  myFriends: string[];
  myTags: string[];
  exclude?: string[];
  limit?: number;
}): Promise<Suggestion[]> {
  const { selfId, myFriends, myTags, exclude = [], limit = 8 } = opts;
  const skip = new Set([selfId, ...myFriends, ...exclude]);

  const candidates = isBackendConfigured()
    ? await suggestRemote(selfId, myTags, [...skip], limit * 2)
    : LOCAL_DIRECTORY.filter((p) => !skip.has(p.id));

  // Mutuals need each candidate's own friend list. The built-in cast carries
  // one; real profiles would need a second query per person, so for now the
  // remote path ranks on shared interests and mutuals resolve for the cast.
  const friendsOf = (id: string): string[] =>
    PEOPLE.find((p) => p.id === id)?.friends ?? [];

  return candidates
    .filter((p) => !skip.has(p.id))
    .map((person) => ({
      person,
      mutuals: myFriends
        .filter((friendId) => friendsOf(person.id).includes(friendId))
        .map((friendId) => LOCAL_DIRECTORY.find((p) => p.id === friendId))
        .filter((p): p is DirectoryPerson => Boolean(p)),
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

export function mutualsWith(myFriends: string[], personId: string): DirectoryPerson[] {
  const theirs = PEOPLE.find((p) => p.id === personId)?.friends ?? [];
  return myFriends
    .filter((id) => theirs.includes(id))
    .map((id) => LOCAL_DIRECTORY.find((p) => p.id === id))
    .filter((p): p is DirectoryPerson => Boolean(p));
}

export type { DirectoryPerson };
