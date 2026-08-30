import { useEffect, useState } from 'react';
import { isBackendConfigured, watchOnlineCount } from '../backend';

/**
 * The number of real people with SCROLLR open, or null when that is not known.
 *
 * Null is the important half. Without it the only options are a fabricated
 * number or a confident zero, and a confident zero shown while the count is
 * still loading is its own small lie. A caller that gets null shows nothing.
 *
 * Bots never appear here. They hold no session and no socket, so there is no
 * path by which one could be counted — see src/backend/presence.ts.
 */
export function useOnlineCount(userId: string | null): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!userId || !isBackendConfigured()) {
      setCount(null);
      return;
    }
    const handle = watchOnlineCount(userId, setCount);
    return () => handle.stop();
  }, [userId]);

  return count;
}
