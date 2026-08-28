import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { SCORE_CATEGORIES } from '../data/reactions';
import { currentScroller, useStore } from '../state/store';
import { ratingFromReactions } from '../state/scoring';
import type { CategoryId } from '../state/types';

const STEPS = ['nah', 'meh', 'yeah', 'big', 'MASSIVE'];
const STEP_VALUES = [15, 40, 62, 82, 100];

/**
 * Rating is deliberately not stars. "4 out of 5" says nothing about a feed;
 * "91% funny, 87% chaotic" is a personality, and a personality is something
 * people want to show off.
 */
export function RatingScreen() {
  const { state, dispatch } = useStore();
  const session = state.session!;
  const scroller = currentScroller(state)!;
  const iScrolled = scroller.isMe;

  const [values, setValues] = useState<Record<CategoryId, number>>({
    funny: 2, chaotic: 2, fire: 2, wtf: 2, good: 2,
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of session.reactions) c[r.reactionId] = (c[r.reactionId] ?? 0) + 1;
    return c;
  }, [session.reactions]);

  /** Everyone else's ballots. Nudged by what they actually reacted with. */
  const audienceBallots = useMemo(() => {
    const base = ratingFromReactions(counts);
    return session.members
      .filter((m) => m.id !== scroller.id && !m.isMe)
      .map(() => {
        const ballot = {} as Record<CategoryId, number>;
        for (const c of SCORE_CATEGORIES) {
          const jitter = Math.round((Math.random() - 0.45) * 26);
          ballot[c.id] = Math.max(5, Math.min(100, base[c.id] + jitter));
        }
        return ballot;
      });
  }, [counts, session.members, scroller.id]);

  const submit = () => {
    const mine = iScrolled
      ? []
      : [Object.fromEntries(
          SCORE_CATEGORIES.map((c) => [c.id, STEP_VALUES[values[c.id]]]),
        ) as Record<CategoryId, number>];
    dispatch({ type: 'submitRating', ratings: [...mine, ...audienceBallots] });
  };

  // When it was your feed, you do not rate yourself — you sit there while the
  // room decides. Short on purpose; the payoff is the next screen.
  useEffect(() => {
    if (!iScrolled) return;
    const timer = setTimeout(submit, 2600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iScrolled]);

  if (iScrolled) {
    return (
      <div className="screen rating rating--waiting">
        <div className="rating__waitdots" aria-hidden>
          {session.members.filter((m) => !m.isMe).map((m, i) => (
            <span key={m.id} style={{ animationDelay: `${i * 0.18}s` }}>{m.avatar}</span>
          ))}
        </div>
        <h1 className="title">The room is rating your feed 😬</h1>
        <p className="subtitle">{session.reactions.length} reactions landed on that round.</p>
        <div className="rating__bar"><span /></div>
      </div>
    );
  }

  return (
    <div className="screen rating">
      <header className="rating__head">
        <Avatar emoji={scroller.avatar} colour={scroller.colour} flag={scroller.flag} size={62} />
        <div>
          <span className="eyebrow">RATE THE FEED</span>
          <h1 className="title">How was @{scroller.handle}'s FYP?</h1>
        </div>
      </header>

      <div className="stack">
        {SCORE_CATEGORIES.map((c) => (
          <div key={c.id} className="rate-row">
            <div className="rate-row__top">
              <span className="rate-row__emoji" aria-hidden>{c.emoji}</span>
              <span className="rate-row__label" style={{ color: c.colour }}>{c.label}</span>
              <span className="rate-row__value">{STEPS[values[c.id]]}</span>
            </div>
            <div className="rate-row__steps" role="group" aria-label={c.label}>
              {STEPS.map((step, i) => (
                <button
                  key={step}
                  className={`rate-step${i <= values[c.id] ? ' is-on' : ''}`}
                  style={i <= values[c.id] ? { background: c.colour } : undefined}
                  onClick={() => setValues((v) => ({ ...v, [c.id]: i }))}
                  aria-label={`${c.label}: ${step}`}
                  aria-pressed={i === values[c.id]}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn--primary btn--lg btn--block rating__submit" onClick={submit}>
        Send rating ⚡
      </button>
    </div>
  );
}
