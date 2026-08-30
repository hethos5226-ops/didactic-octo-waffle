import { supabase } from './client';

/**
 * How many real people are here right now.
 *
 * SCROLLR must never overstate this. A number invented to make a prototype look
 * busy is a lie told to the first person who trusts it, and it is the easiest
 * lie in the world to ship — a constant in a template renders identically to a
 * real count. So the rule is absolute: this returns what is actually true, or
 * it returns null and the screen says nothing at all. Zero is a legitimate
 * answer and gets displayed as zero.
 *
 * Built on Supabase Realtime Presence, which is the cheap way to know this:
 * presence is held in memory on the server and disappears when a socket
 * closes, so there is no table to write to, nothing to clean up, and no cost
 * when nobody is online. A browser that is closed stops being counted without
 * having to announce anything.
 *
 * Bots are not here and cannot be. A bot has no session and no socket — it
 * exists only as a row the client renders — so there is no code path by which
 * one could join this channel. The separation is structural rather than a
 * filter someone has to remember to apply.
 */

const CHANNEL = 'scroll:presence';

export interface PresenceHandle {
  stop(): void;
}

/**
 * Subscribes to the live count of signed-in people with SCROLLR open.
 *
 * `onCount` receives null until the count is actually known, so a caller can
 * tell "nobody is online" apart from "we have not found out yet" and show
 * nothing in the second case rather than a confident zero.
 */
export function watchOnlineCount(
  userId: string,
  onCount: (count: number | null) => void,
): PresenceHandle {
  const client = supabase();
  if (!client) {
    onCount(null);
    return { stop() {} };
  }

  // The key is the user id, so two tabs belonging to one person count once.
  const channel = client.channel(CHANNEL, { config: { presence: { key: userId } } });

  const report = () => {
    const state = channel.presenceState();
    onCount(Object.keys(state).length);
  };

  channel
    .on('presence', { event: 'sync' }, report)
    .on('presence', { event: 'join' }, report)
    .on('presence', { event: 'leave' }, report)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Nothing personal is published — being present is the entire payload.
        // A presence record carrying a handle or a location would turn a
        // headcount into a "who is online right now" list nobody asked for.
        await channel.track({});
        report();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onCount(null);
      }
    });

  return {
    stop() {
      client.removeChannel(channel);
    },
  };
}
