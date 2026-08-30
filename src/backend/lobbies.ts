import { supabase } from './client';

/**
 * Matchmaking: the service boundary, not the game.
 *
 * The screens still run their local session — this pass does not rewire the
 * gameplay, and doing so would mean redesigning the thing that already works.
 * What exists here is the seam the real multiplayer session will attach to,
 * with the hard parts already decided and already enforced by the database:
 *
 *   * A seat belongs to a person or a bot, never both, so real counts cannot
 *     drift (`0003_bots_and_matchmaking.sql`).
 *   * A person holds one live seat anywhere, enforced by a unique index rather
 *     than by clients behaving.
 *   * A closed browser sends nothing, so liveness is a heartbeat and silence
 *     is the signal. `sweepStaleLobbies` is what stops abandoned games living
 *     forever, and it is called opportunistically rather than by a scheduler,
 *     which keeps it free.
 *
 * Realtime is the transport when synchronised playback lands: it is priced per
 * message and per concurrent connection with a free allowance, so it costs
 * nothing while SCROLLR is small and grows with actual use — unlike a game
 * server, which costs the same at three players as at three thousand.
 */

export type LobbyMode = 'random' | 'private';
export type LobbyStatus = 'open' | 'starting' | 'active' | 'finished' | 'abandoned';

export interface Lobby {
  id: string;
  code: string | null;
  hostId: string;
  mode: LobbyMode;
  groupSize: number;
  status: LobbyStatus;
}

export interface LobbySeat {
  id: string;
  /** Exactly one of these is set. That is the point. */
  userId: string | null;
  botId: string | null;
  team: 'yours' | 'theirs';
  ready: boolean;
}

interface LobbyRow {
  id: string;
  code: string | null;
  host_id: string;
  mode: LobbyMode;
  group_size: number;
  status: LobbyStatus;
}

interface SeatRow {
  id: string;
  user_id: string | null;
  bot_id: string | null;
  team: 'yours' | 'theirs';
  ready: boolean;
}

const toLobby = (r: LobbyRow): Lobby => ({
  id: r.id,
  code: r.code,
  hostId: r.host_id,
  mode: r.mode,
  groupSize: r.group_size,
  status: r.status,
});

/** Six characters, unambiguous: no O/0 or I/1 to misread aloud to a friend. */
export function makeLobbyCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export async function createLobby(
  hostId: string,
  mode: LobbyMode,
  groupSize: number,
): Promise<Lobby | null> {
  const client = supabase();
  if (!client) return null;

  const { data, error } = await client
    .from('lobbies')
    .insert({
      host_id: hostId,
      mode,
      group_size: groupSize,
      code: mode === 'private' ? makeLobbyCode() : null,
    })
    .select('id, code, host_id, mode, group_size, status')
    .single();

  if (error || !data) return null;

  // The host takes their own seat; the policy only ever lets you seat yourself.
  await client.from('lobby_members').insert({ lobby_id: data.id, user_id: hostId });
  return toLobby(data as LobbyRow);
}

/**
 * Joining a private lobby by code goes through an RPC rather than a query.
 *
 * If a policy allowed selecting a lobby by code, private lobbies would be
 * enumerable — you could walk the code space. As an RPC the code is an
 * argument and the only thing that comes back is the lobby you named
 * correctly.
 */
export async function joinLobbyByCode(code: string): Promise<string | null> {
  const client = supabase();
  if (!client) return null;
  const { data, error } = await client.rpc('join_lobby_by_code', { p_code: code });
  if (error) return null;
  return data as string;
}

export async function listOpenLobbies(): Promise<Lobby[]> {
  const client = supabase();
  if (!client) return [];
  const { data, error } = await client
    .from('lobbies')
    .select('id, code, host_id, mode, group_size, status')
    .eq('mode', 'random')
    .eq('status', 'open')
    .order('created_at')
    .limit(20);
  if (error || !data) return [];
  return (data as LobbyRow[]).map(toLobby);
}

export async function lobbySeats(lobbyId: string): Promise<LobbySeat[]> {
  const client = supabase();
  if (!client) return [];
  const { data, error } = await client
    .from('lobby_members')
    .select('id, user_id, bot_id, team, ready')
    .eq('lobby_id', lobbyId)
    .is('left_at', null);
  if (error || !data) return [];
  return (data as SeatRow[]).map((r) => ({
    id: r.id,
    userId: r.user_id,
    botId: r.bot_id,
    team: r.team,
    ready: r.ready,
  }));
}

/**
 * How many of the seats are people.
 *
 * Computed from the seats rather than from their length, and named so that
 * using the wrong one reads as a mistake. This is the number SCROLLR shows.
 */
export function realPlayerCount(seats: LobbySeat[]): number {
  return seats.filter((s) => s.userId !== null).length;
}

export function botCount(seats: LobbySeat[]): number {
  return seats.filter((s) => s.botId !== null).length;
}

/** Only the host may do this, and it can only ever add bots. */
export async function fillWithBots(lobbyId: string, count: number): Promise<number> {
  const client = supabase();
  if (!client) return 0;
  const { data, error } = await client.rpc('fill_lobby_with_bots', {
    p_lobby: lobbyId,
    p_count: count,
  });
  if (error) return 0;
  return (data as number) ?? 0;
}

/** Called on a timer while a lobby screen is open. Silence means gone. */
export async function heartbeat(lobbyId: string): Promise<void> {
  await supabase()?.rpc('touch_lobby_presence', { p_lobby: lobbyId });
}

export async function leaveLobby(lobbyId: string, userId: string): Promise<void> {
  await supabase()
    ?.from('lobby_members')
    .update({ left_at: new Date().toISOString() })
    .eq('lobby_id', lobbyId)
    .eq('user_id', userId);
}

/**
 * Opportunistic cleanup.
 *
 * Cheap enough to call when someone opens matchmaking, which means abandoned
 * lobbies get swept by ordinary use instead of by a cron job or a worker.
 * pg_cron can take it over later without any caller changing.
 */
export async function sweepStaleLobbies(): Promise<void> {
  await supabase()?.rpc('cleanup_stale_lobbies');
}
