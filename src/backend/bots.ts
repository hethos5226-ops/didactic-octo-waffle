import { supabase } from './client';

/**
 * Bots.
 *
 * A bot is a character, not an account. It has no row in auth.users, no
 * password, no session and no way to sign in — which is what makes 200 of them
 * cost effectively nothing and what makes it impossible for one to be mistaken
 * for a person by any query. The roster is ~200 short rows, read once and
 * cached; there is no bot process running anywhere, and a bot consumes nothing
 * at all until a lobby seats it.
 *
 * Two rules hold everywhere they appear:
 *
 *   1. A bot is never counted as a real user. The database enforces this: a
 *      lobby seat holds either a `user_id` or a `bot_id`, so the real count is
 *      a property of the schema rather than a filter to remember.
 *   2. A bot never pretends to be human. `isBot` travels with the identity and
 *      the UI is expected to show it.
 */

export interface Bot {
  id: string;
  handle: string;
  displayName: string;
  avatar: string;
  colour: string;
  country: string;
  flag: string;
  level: number;
  vibes: string[];
  hashtags: string[];
  chatter: string[];
  /** Always true. Present so a Bot and a person can share one rendering path
   *  without the call site having to know which it was handed. */
  readonly isBot: true;
}

interface BotRow {
  id: string;
  handle: string;
  display_name: string;
  avatar: string;
  colour: string;
  country: string;
  flag: string;
  level: number;
  vibes: string[] | null;
  hashtags: string[] | null;
  chatter: string[] | null;
}

function toBot(row: BotRow): Bot {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatar: row.avatar,
    colour: row.colour,
    country: row.country,
    flag: row.flag,
    level: row.level,
    vibes: row.vibes ?? [],
    hashtags: row.hashtags ?? [],
    chatter: row.chatter ?? [],
    isBot: true,
  };
}

// The roster changes about as often as a deploy, so one read per session is
// plenty and saves a query on every lobby.
let cache: Bot[] | null = null;

export async function fetchBots(): Promise<Bot[]> {
  if (cache) return cache;
  const client = supabase();
  if (!client) return [];

  const { data, error } = await client
    .from('bots')
    .select('id, handle, display_name, avatar, colour, country, flag, level, vibes, hashtags, chatter')
    .eq('active', true)
    .order('id');

  if (error || !data) return [];
  cache = (data as BotRow[]).map(toBot);
  return cache;
}

/**
 * Picks bots to fill a lobby, deterministically for a given lobby.
 *
 * Deterministic so a lobby's cast does not reshuffle between renders — a bot
 * that changed name mid-session would read as a different person joining.
 */
export function chooseBots(bots: Bot[], lobbyId: string, count: number): Bot[] {
  if (count <= 0 || bots.length === 0) return [];
  let h = 2166136261;
  for (let i = 0; i < lobbyId.length; i++) {
    h ^= lobbyId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const start = Math.abs(h) % bots.length;
  const step = 7;
  const picked: Bot[] = [];
  for (let i = 0; i < Math.min(count, bots.length); i++) {
    picked.push(bots[(start + i * step) % bots.length]);
  }
  return picked;
}
