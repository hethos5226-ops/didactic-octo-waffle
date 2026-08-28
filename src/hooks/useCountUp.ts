import { useEffect, useRef, useState } from 'react';

/** Animate a number upwards. `duration = 0` skips straight to the value. */
export function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(duration === 0 ? target : 0);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (duration === 0) { setValue(target); return; }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic: fast reveal, gentle landing.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [target, duration]);

  return value;
}
