import { supabase } from './client';
import {
  profileToRow, rowToDirectoryPerson, rowToProfile,
  type DirectoryPerson, type ProfileRow,
} from './mapping';
import type { AppNotification, MatchSummary, Profile } from '../state/types';
import type { AuthAccount } from './auth';

/**
 * Reading and writing the signed-in user's profile, and looking other people
 * up.
 *
 * A profile is assembled from several tables — the row itself plus friends,
 * requests, follows, notifications and matches — because those are
 * relationships, and a relationship belongs between two rows rather than
 * inside one. They are fetched together so the app still sees the single
 * `Profile` object the UI is built around.
 */

const PROFILE_COLUMNS =
  'id, handle, display_name, bio, avatar, photo_url, colour, country, flag, vibes, ' +
  'hashtags, premium, xp, tallies, profile_likes, follower_count, sessions_played, ' +
  'rounds_scrolled, reactions_sent, reactions_received, onboarded, created_at';

/** Null means "signed in but has not finished onboarding yet". */
export async function fetchProfile(account: AuthAccount): Promise<Profile | null> {
  const client = supabase();
  if (!client) return null;

  const { data: row, error } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', account.userId)
    .maybeSingle();

  if (error || !row) return null;

  const [friends, requests, following, notifications, matches] = await Promise.all([
    fetchFriendIds(account.userId),
    fetchRequests(account.userId),
    fetchFollowing(account.userId),
    fetchNotifications(account.userId),
    fetchMatches(account.userId),
  ]);

  return rowToProfile(row as unknown as ProfileRow, {
    friends,
    incomingRequests: requests.incoming,
    sentRequests: requests.sent,
    following,
    notifications,
    matchHistory: matches,
    authProvider: account.provider,
    email: account.email,
  });
}

/** Creates the row on first onboarding, and updates it thereafter. */
export async function saveProfile(profile: Profile): Promise<{ error: string | null }> {
  const client = supabase();
  if (!client) return { error: null };

  const { error } = await client
    .from('profiles')
    .upsert({ id: profile.id, ...profileToRow(profile) }, { onConflict: 'id' });

  if (!error) return { error: null };
  // The handle has a unique index, so a race between two people claiming the
  // same one surfaces here rather than silently overwriting.
  if (error.code === '23505') return { error: 'That username was just taken. Try another.' };
  return { error: error.message };
}

/**
 * Case-insensitive, because @Charley and @charley are the same person to
 * everyone except a database.
 */
export async function isHandleAvailable(handle: string, selfId?: string): Promise<boolean | null> {
  const client = supabase();
  if (!client) return null;
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .ilike('handle', handle)
    .limit(1);
  if (error) return null;
  if (!data || data.length === 0) return true;
  return selfId ? data[0].id === selfId : false;
}

// ── Directory ─────────────────────────────────────────────────────────────

/** Search by handle, display name or interest. */
export async function searchPeople(query: string, excludeId: string): Promise<DirectoryPerson[]> {
  const client = supabase();
  if (!client) return [];
  const q = query.trim().replace(/^[@#]/, '');
  if (!q) return [];

  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%,hashtags.cs.{${q}}`)
    .neq('id', excludeId)
    .limit(20);

  if (error || !data) return [];
  return (data as unknown as ProfileRow[]).map(rowToDirectoryPerson);
}

/**
 * People you might know, ranked by shared interests.
 *
 * Mutual-friend ranking is done client-side against the ids already loaded,
 * because computing it in the query would need a join across friend_requests
 * in both directions — worth a database function later, but not while the
 * directory is small enough to rank in memory.
 */
export async function suggestedPeople(
  selfId: string,
  myHashtags: string[],
  exclude: string[],
  limit = 12,
): Promise<DirectoryPerson[]> {
  const client = supabase();
  if (!client) return [];

  const skip = [selfId, ...exclude];
  let query = client.from('profiles').select(PROFILE_COLUMNS).eq('onboarded', true);

  // Overlapping interests first; if none match we still want a list, so this
  // falls back to a plain page of profiles below.
  if (myHashtags.length > 0) query = query.overlaps('hashtags', myHashtags);

  const { data } = await query.limit(limit * 2);
  let rows = ((data ?? []) as unknown as ProfileRow[]).filter((r) => !skip.includes(r.id));

  if (rows.length < limit) {
    const { data: more } = await client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('onboarded', true)
      .limit(limit * 2);
    const extra = ((more ?? []) as unknown as ProfileRow[]).filter(
      (r) => !skip.includes(r.id) && !rows.some((existing) => existing.id === r.id),
    );
    rows = [...rows, ...extra];
  }

  return rows.slice(0, limit).map(rowToDirectoryPerson);
}

export async function fetchPeopleByIds(ids: string[]): Promise<DirectoryPerson[]> {
  const client = supabase();
  if (!client || ids.length === 0) return [];
  const { data } = await client.from('profiles').select(PROFILE_COLUMNS).in('id', ids);
  return ((data ?? []) as unknown as ProfileRow[]).map(rowToDirectoryPerson);
}

// ── Relationships ─────────────────────────────────────────────────────────

async function fetchFriendIds(selfId: string): Promise<string[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client
    .from('friend_requests')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${selfId},addressee_id.eq.${selfId}`);
  return (data ?? []).map((r) => (r.requester_id === selfId ? r.addressee_id : r.requester_id));
}

async function fetchRequests(selfId: string): Promise<{ incoming: string[]; sent: string[] }> {
  const client = supabase();
  if (!client) return { incoming: [], sent: [] };
  const { data } = await client
    .from('friend_requests')
    .select('requester_id, addressee_id')
    .eq('status', 'pending')
    .or(`requester_id.eq.${selfId},addressee_id.eq.${selfId}`);
  const incoming: string[] = [];
  const sent: string[] = [];
  for (const row of data ?? []) {
    if (row.addressee_id === selfId) incoming.push(row.requester_id);
    else sent.push(row.addressee_id);
  }
  return { incoming, sent };
}

async function fetchFollowing(selfId: string): Promise<string[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client.from('follows').select('following_id').eq('follower_id', selfId);
  return (data ?? []).map((r) => r.following_id);
}

async function fetchNotifications(selfId: string): Promise<AppNotification[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client
    .from('notifications')
    .select('id, kind, actor_id, read, created_at')
    .eq('user_id', selfId)
    .order('created_at', { ascending: false })
    .limit(40);
  return (data ?? []).map((r, i) => ({
    id: i + 1,
    kind: r.kind as AppNotification['kind'],
    fromId: r.actor_id,
    at: new Date(r.created_at).getTime(),
    read: r.read,
  }));
}

async function fetchMatches(selfId: string): Promise<MatchSummary[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client
    .from('matches')
    .select('*')
    .eq('user_id', selfId)
    .order('played_at', { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => ({
    id: r.id,
    at: new Date(r.played_at).getTime(),
    mode: r.mode,
    players: r.players ?? [],
    rounds: r.rounds ?? [],
    myFeedScore: r.my_feed_score,
    bestHandle: r.best_handle,
    bestScore: r.best_score,
    totalReactions: r.total_reactions,
    xpEarned: r.xp_earned,
  }));
}

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Notifications are no longer written from here.
 *
 * They used to be inserted alongside the event, which meant a client could
 * assert an event that never happened — "I accepted your friend request" to
 * someone who never sent one — and could do it without limit. A database
 * trigger now generates each notification from the real row, so forging one
 * requires performing the real thing first, and the real things are bounded by
 * their own unique constraints. See 0005_audit_fixes.sql.
 */
export async function sendFriendRequest(selfId: string, targetId: string): Promise<void> {
  await supabase()?.from('friend_requests').upsert(
    { requester_id: selfId, addressee_id: targetId, status: 'pending' },
    { onConflict: 'requester_id,addressee_id' },
  );
}

export async function respondToRequest(
  selfId: string,
  requesterId: string,
  accept: boolean,
): Promise<void> {
  const client = supabase();
  if (!client) return;
  await client
    .from('friend_requests')
    .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
    .eq('requester_id', requesterId)
    .eq('addressee_id', selfId);
}

export async function setFollowing(selfId: string, targetId: string, follow: boolean): Promise<void> {
  const client = supabase();
  if (!client) return;
  if (follow) {
    await client.from('follows').upsert({ follower_id: selfId, following_id: targetId });
  } else {
    await client.from('follows').delete().eq('follower_id', selfId).eq('following_id', targetId);
  }
}

export async function markNotificationsRead(selfId: string): Promise<void> {
  await supabase()?.from('notifications').update({ read: true }).eq('user_id', selfId).eq('read', false);
}

export async function recordMatch(selfId: string, match: MatchSummary): Promise<void> {
  await supabase()?.from('matches').insert({
    user_id: selfId,
    played_at: new Date(match.at).toISOString(),
    mode: match.mode,
    players: match.players,
    rounds: match.rounds,
    my_feed_score: match.myFeedScore,
    best_handle: match.bestHandle,
    best_score: match.bestScore,
    total_reactions: match.totalReactions,
    xp_earned: match.xpEarned,
  });
}

export type { DirectoryPerson };

/**
 * Records what a finished session earned.
 *
 * XP and the play counters are server-owned — a client that can write its own
 * XP can write any XP — so they do not travel with `saveProfile`, which sends
 * the whole profile row and has those columns held at their stored values.
 * This is the sanctioned path: an increment, applied to the caller, capped
 * server-side at more than a real session could produce.
 *
 * Without this the guard introduced in 0002 would silently discard every XP
 * gain, and a signed-in player's level would reset on every reload. That is
 * exactly what happened, and it is why the regression test in
 * supabase/tests/rls_test.sql asserts the increment lands.
 */
export async function recordSessionResult(result: {
  xp: number;
  rounds: number;
  reactionsSent: number;
  reactionsReceived: number;
}): Promise<void> {
  const client = supabase();
  if (!client) return;
  // Clamped here too, so a bug in the caller becomes a smaller number rather
  // than a rejected call that loses the whole session.
  const clamp = (n: number, max: number) => Math.max(0, Math.min(Math.round(n), max));
  await client.rpc('apply_session_result', {
    p_xp: clamp(result.xp, 2000),
    p_rounds: clamp(result.rounds, 50),
    p_reactions_sent: clamp(result.reactionsSent, 500),
    p_reactions_received: clamp(result.reactionsReceived, 500),
  });
}
