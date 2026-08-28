import { useEffect } from 'react';
import { titleForLevel } from '../data/levels';
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
      <div className="announce__body">
        <div className="announce__round">ROUND {round} OF {totalRounds}</div>
        <div className="announce__avatar">
          <Avatar emoji={scroller.avatar} colour={scroller.colour} size={112} />
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
        <button className="btn btn--primary btn--lg" onClick={onDone}>Let's go 🚀</button>
      </div>
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
