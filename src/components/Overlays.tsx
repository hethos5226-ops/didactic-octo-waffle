import { useEffect } from 'react';
import { LEVEL_TITLES, titleForLevel } from '../data/levels';
import { Avatar } from './Avatar';
import type { Member } from '../state/types';

interface ScrollerAnnouncementProps {
  scroller: Member;
  round: number;
  totalRounds: number;
  onDone: () => void;
}

/**
 * The moment the session turns over to a new person. It is deliberately loud
 * and takes over the whole screen: this is the beat that tells everyone
 * "we're about to see inside someone else's head".
 */
export function ScrollerAnnouncement({ scroller, round, totalRounds, onDone }: ScrollerAnnouncementProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2900);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="announce" onClick={onDone}>
      <div className="announce__rays" aria-hidden />
      <RoamingLight />
      <div className="announce__body">
        <div className="announce__round">ROUND {round} OF {totalRounds}</div>
        <div className="announce__avatar">
          <Avatar
            emoji={scroller.avatar}
            photo={scroller.photo}
            colour={scroller.colour}
            size={112}
            premium={scroller.premium}
          />
        </div>
        <h1 className="announce__name">
          🎬 {scroller.isMe ? "YOU'RE" : `${scroller.handle.toUpperCase()} IS`} SCROLLING!
        </h1>
        <p className="announce__sub">
          {scroller.flag} {scroller.isMe
            ? 'Show them what your algorithm thinks of you 😅'
            : `Get ready for their FYP 😂`}
        </p>
        <div className="announce__vibes">
          {scroller.vibes.map((v) => <span key={v} className="announce__vibe">{v}</span>)}
        </div>
      </div>
      <div className="announce__tap">tap to skip</div>
    </div>
  );
}

interface LevelUpProps {
  level: number;
  onDone: () => void;
}

export function LevelUpOverlay({ level, onDone }: LevelUpProps) {
  const title = titleForLevel(level);
  // Levels 2, 3, 4 all read as "New Scroller", so the number alone can feel
  // like nothing changed. Point at the next title instead.
  const next = LEVEL_TITLES.find((t) => t.level > level);
  useEffect(() => {
    const timer = setTimeout(onDone, 4200);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="levelup" onClick={onDone}>
      <Confetti />
      <div className="levelup__body">
        <div className="levelup__eyebrow">LEVEL UP</div>
        <div className="levelup__emoji" aria-hidden>{title.emoji}</div>
        <div className="levelup__num">{level}</div>
        <div className="levelup__title">{title.title}</div>
        {next && (
          <div className="levelup__next">
            {next.emoji} {next.title} at level {next.level}
          </div>
        )}
        <button className="btn btn--primary btn--lg" onClick={onDone}>Let's go 🚀</button>
      </div>
    </div>
  );
}

/**
 * A soft beam that wanders around the screen. It exists for the waiting beats —
 * while a lobby is filling, while the room rates you, and while everyone sits
 * through the "X is scrolling!" takeover waiting for the feed to come up. A
 * still screen reads as frozen; a moving light reads as loading.
 */
export function RoamingLight({ tint = 'rgba(255, 255, 255, 0.34)' }: { tint?: string }) {
  return (
    <div className="roam" aria-hidden>
      <span className="roam__beam" style={{ background: `radial-gradient(circle, ${tint}, transparent 68%)` }} />
      <span
        className="roam__beam roam__beam--alt"
        style={{ background: `radial-gradient(circle, ${tint}, transparent 70%)` }}
      />
    </div>
  );
}

const CONFETTI_COLOURS = ['#ff2e93', '#7b2ff7', '#22e1ff', '#c6ff3d', '#ffe03d', '#ff9f1c'];

export function Confetti({ count = 44 }: { count?: number }) {
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="confetti__bit"
          style={{
            left: `${(i * 97) % 100}%`,
            background: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
            animationDelay: `${(i % 11) * 0.13}s`,
            animationDuration: `${2.2 + ((i * 7) % 14) / 10}s`,
            width: 6 + (i % 4) * 3,
            height: 10 + (i % 5) * 4,
          }}
        />
      ))}
    </div>
  );
}

interface ToastProps {
  emoji: string;
  text: string;
  onDone: () => void;
}

export function Toast({ emoji, text, onDone }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [onDone, text]);

  return (
    <div className="toast" role="status">
      <span className="toast__emoji" aria-hidden>{emoji}</span>
      <span>{text}</span>
    </div>
  );
}
