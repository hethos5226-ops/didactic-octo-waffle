import { useEffect, useState } from 'react';
import { reactionById } from '../state/store';
import type { LiveReaction } from '../state/types';

interface Bubble extends LiveReaction {
  left: number;
  drift: number;
  scale: number;
  duration: number;
}

interface ReactionBubblesProps {
  reactions: LiveReaction[];
  /** Resolve a member id to their handle, for the little name tag. */
  nameFor: (id: string) => string;
}

const LIFETIME = 3400;

/**
 * Reactions float up from the bottom of the feed. They are the loudest thing
 * on screen on purpose — the reaction *is* the conversation, and a room where
 * six people are spamming 💀 should look like it.
 */
export function ReactionBubbles({ reactions, nameFor }: ReactionBubblesProps) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    const fresh = reactions.filter((r) => r.id > seen);
    if (fresh.length === 0) return;
    setSeen(reactions[reactions.length - 1].id);
    setBubbles((prev) => [
      ...prev,
      ...fresh.map((r) => ({
        ...r,
        left: 6 + Math.random() * 62,
        drift: -40 + Math.random() * 80,
        scale: 0.85 + Math.random() * 0.5,
        duration: LIFETIME + Math.random() * 900,
      })),
    ]);
  }, [reactions, seen]);

  useEffect(() => {
    if (bubbles.length === 0) return;
    const timer = setInterval(() => {
      const cutoff = Date.now() - LIFETIME - 1000;
      setBubbles((prev) => prev.filter((b) => b.at > cutoff));
    }, 900);
    return () => clearInterval(timer);
  }, [bubbles.length]);

  return (
    <div className="bubbles" aria-hidden>
      {bubbles.map((b) => {
        const kind = reactionById(b.reactionId);
        return (
          <span
            key={b.id}
            className="bubble"
            style={{
              left: `${b.left}%`,
              ['--drift' as string]: `${b.drift}px`,
              ['--scale' as string]: b.scale,
              animationDuration: `${b.duration}ms`,
              background: `${kind.colour}26`,
              borderColor: `${kind.colour}88`,
              boxShadow: `0 0 22px -4px ${kind.colour}`,
            }}
          >
            <span className="bubble__emoji">{kind.emoji}</span>
            <span className="bubble__who">{nameFor(b.fromId)}</span>
          </span>
        );
      })}
    </div>
  );
}
