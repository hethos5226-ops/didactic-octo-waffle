import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { RoamingLight } from '../components/Overlays';
import { memberFromProfile, memberFromPerson, strangers, useStore } from '../state/store';
import type { Member } from '../state/types';

const SEARCH_LINES = [
  'Scanning the globe 🌎',
  'Finding someone with a weird algorithm…',
  'Checking who is actually awake 😴',
  'Matching your chaos levels 💀',
  'Almost there…',
];

/**
 * Matchmaking is dead time, so it is treated as a set piece: people arrive one
 * at a time with their flag and their vibes, which is already a small
 * preview of the feed you are about to sit through.
 */
export function MatchmakingScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const size = state.matchmakingSize;
  const needed = size * 2 - 1;

  const roster = useMemo(
    () => strangers(needed, [profile.handle]),
    [needed, profile.handle],
  );
  const [found, setFound] = useState<Member[]>([]);
  const [line, setLine] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const timers: number[] = [];

    roster.forEach((person, i) => {
      timers.push(
        window.setTimeout(() => {
          if (cancelled.current) return;
          // First half of the roster (after you) fills out your side.
          const yourSideRemaining = size - 1;
          const team = i < yourSideRemaining ? 'yours' : 'theirs';
          setFound((prev) => [...prev, memberFromPerson(person, team)]);
        }, 900 + i * 720),
      );
    });

    const total = 900 + roster.length * 720 + 1100;
    timers.push(
      window.setTimeout(() => {
        if (cancelled.current) return;
        const me = memberFromProfile(profile);
        const others = roster.map((p, i) =>
          memberFromPerson(p, i < size - 1 ? 'yours' : 'theirs'),
        );
        dispatch({ type: 'matchFound', members: [me, ...others] });
      }, total),
    );

    const lineTimer = window.setInterval(
      () => setLine((l) => (l + 1) % SEARCH_LINES.length),
      1400,
    );

    return () => {
      cancelled.current = true;
      timers.forEach(clearTimeout);
      clearInterval(lineTimer);
    };
  }, [roster, size, profile, dispatch]);

  return (
    <div className="screen matchmaking">
      <RoamingLight tint="rgba(34, 225, 255, 0.26)" />
      <div className="mm__radar" aria-hidden>
        <span className="mm__ring" />
        <span className="mm__ring" style={{ animationDelay: '0.7s' }} />
        <span className="mm__ring" style={{ animationDelay: '1.4s' }} />
        <span className="mm__globe">🌎</span>
      </div>

      <h1 className="mm__title">Finding your people…</h1>
      <p className="mm__line" key={line}>{SEARCH_LINES[line]}</p>

      <div className="mm__slots">
        <div className="mm__slot mm__slot--me">
          <Avatar
            emoji={profile.avatar}
            photo={profile.photo}
            colour={profile.colour}
            flag={profile.flag}
            size={54}
          />
          <span className="mm__slot-name">you</span>
        </div>
        {Array.from({ length: needed }, (_, i) => {
          const member = found[i];
          return member ? (
            <div className="mm__slot pop" key={member.id}>
              <Avatar
                emoji={member.avatar}
                photo={member.photo}
                colour={member.colour}
                flag={member.flag}
                size={54}
              />
              <span className="mm__slot-name">{member.handle}</span>
            </div>
          ) : (
            <div className="mm__slot mm__slot--empty" key={`empty-${i}`}>
              <span className="mm__pending" />
              <span className="mm__slot-name">…</span>
            </div>
          );
        })}
      </div>

      {found.length > 0 && (
        <div className="mm__found pop">
          <strong>{found[found.length - 1].flag} {found[found.length - 1].handle}</strong> joined
        </div>
      )}

      <button
        className="btn btn--ghost mm__cancel"
        onClick={() => dispatch({ type: 'go', route: 'home' })}
      >
        Cancel
      </button>
    </div>
  );
}
