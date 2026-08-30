import type { Profile, Tallies } from '../state/types';
import { emptyTallies } from '../state/scoring';
import type { VibeId } from '../data/vibes';

/**
 * Translation between the database row and the shape the app already uses.
 *
 * The app's `Profile` predates the database and the UI is built around it, so
 * the row bends to it rather than the other way round: snake_case columns map
 * to the existing camelCase fields, and nothing in the screens has to change.
 *
 * Relationship data (friends, requests, following, notifications, matches)
 * lives in its own tables and is loaded separately, so it is absent here.
 */

export interface ProfileRow {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  avatar: string;
  photo_url: string | null;
  colour: string;
  country: string;
  flag: string;
  vibes: string[];
  hashtags: string[];
  premium: boolean;
  xp: number;
  tallies: Record<string, { points: number; votes: number }>;
  profile_likes: number;
  follower_count: number;
  sessions_played: number;
  rounds_scrolled: number;
  reactions_sent: number;
  reactions_received: number;
  onboarded: boolean;
  created_at: string;
}

/** A row plus the relationships, assembled into the app's Profile. */
export function rowToProfile(
  row: ProfileRow,
  extras: Pick<
    Profile,
    'friends' | 'incomingRequests' | 'sentRequests' | 'notifications' | 'following' | 'matchHistory'
  > & { authProvider: Profile['authProvider']; email: string | null },
): Profile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name || row.handle,
    bio: row.bio ?? '',
    authProvider: extras.authProvider,
    email: extras.email,
    avatar: row.avatar,
    photo: row.photo_url,
    colour: row.colour,
    country: row.country,
    flag: row.flag,
    vibes: (row.vibes ?? []) as VibeId[],
    hashtags: row.hashtags ?? [],
    premium: row.premium,
    xp: row.xp,
    // A row written before a category existed would be missing it; the
    // baseline fills the gap rather than showing 0%.
    tallies: { ...emptyTallies(), ...(row.tallies ?? {}) } as Profile['tallies'],
    profileLikes: row.profile_likes,
    friends: extras.friends,
    incomingRequests: extras.incomingRequests,
    sentRequests: extras.sentRequests,
    notifications: extras.notifications,
    following: extras.following,
    followerCount: row.follower_count,
    matchHistory: extras.matchHistory,
    onboarded: row.onboarded,
    sessionsPlayed: row.sessions_played,
    roundsScrolled: row.rounds_scrolled,
    reactionsSent: row.reactions_sent,
    reactionsReceived: row.reactions_received,
    createdAt: new Date(row.created_at).getTime(),
  };
}

/**
 * The columns a profile update writes. Deliberately excludes the id and
 * anything relationship-shaped: those are separate tables, and follower_count
 * is maintained by a trigger rather than by the client.
 */
export function profileToRow(profile: Profile): Omit<ProfileRow, 'id' | 'created_at' | 'follower_count'> {
  return {
    handle: profile.handle,
    display_name: profile.displayName,
    bio: profile.bio,
    avatar: profile.avatar,
    photo_url: profile.photo,
    colour: profile.colour,
    country: profile.country,
    flag: profile.flag,
    vibes: profile.vibes,
    hashtags: profile.hashtags,
    premium: profile.premium,
    xp: profile.xp,
    tallies: profile.tallies,
    profile_likes: profile.profileLikes,
    sessions_played: profile.sessionsPlayed,
    rounds_scrolled: profile.roundsScrolled,
    reactions_sent: profile.reactionsSent,
    reactions_received: profile.reactionsReceived,
    onboarded: profile.onboarded,
  };
}

/** The public view of somebody else — what the directory and lobbies need. */
export interface DirectoryPerson {
  id: string;
  handle: string;
  displayName: string;
  avatar: string;
  photo: string | null;
  colour: string;
  country: string;
  flag: string;
  hashtags: string[];
  vibes: VibeId[];
  followerCount: number;
  premium: boolean;
  /**
   * Real, stored play statistics — or null when they are genuinely unknown,
   * which is the case for the built-in local cast.
   *
   * These used to be absent, and the profile screen filled the gap by deriving
   * numbers from a hash of the person's id: a feed score of `62 + hash % 34`,
   * a level, a friend count, a reaction count. They rendered exactly like
   * measurements. With a database connected they were being attributed to real
   * people, which is the thing SCROLLR most needs not to do.
   */
  xp: number | null;
  tallies: Tallies | null;
  profileLikes: number | null;
  roundsScrolled: number | null;
  reactionsReceived: number | null;
}

/** A stored tally set, or null when the row has never recorded a round. */
function talliesFromRow(raw: ProfileRow['tallies']): Tallies | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  return { ...emptyTallies(), ...raw } as Tallies;
}

export function rowToDirectoryPerson(row: ProfileRow): DirectoryPerson {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name || row.handle,
    avatar: row.avatar,
    photo: row.photo_url,
    colour: row.colour,
    country: row.country,
    flag: row.flag,
    hashtags: row.hashtags ?? [],
    vibes: (row.vibes ?? []) as VibeId[],
    followerCount: row.follower_count,
    premium: row.premium,
    xp: row.xp,
    tallies: talliesFromRow(row.tallies),
    profileLikes: row.profile_likes,
    roundsScrolled: row.rounds_scrolled,
    reactionsReceived: row.reactions_received,
  };
}
