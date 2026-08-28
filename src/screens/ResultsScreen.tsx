import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { FeedScoreRing } from '../components/FeedScoreRing';
import { Confetti } from '../components/Overlays';
import { AdSlot } from '../components/AdSlot';
import { SCORE_CATEGORIES, REACTIONS } from '../data/reactions';
import { progressionFromXp } from '../data/levels';
import { useCountUp } from '../hooks/useCountUp';
import { currentScroller, useStore } from '../state/store';

export function ResultsScreen() {
  const { state, dispatch } = useStore();
  const session = state.session!;
  const profile = state.profile!;
  const result = session.results[session.results.length - 1];
  const scroller = currentScroller(state)!;
  const [barsIn, setBarsIn] = useState(false);
  const xpShown = useCountUp(result.xpTotal, 1100);
  const progress = progressionFromXp(profile.xp);

  useEffect(() => {
    const timer = setTimeout(() => setBarsIn(true), 260);
    return () => clearTimeout(timer);
  }, []);

  const isLastRound = session.roundIndex >= session.order.length - 1;
  const topReaction = REACTIONS.find((r) => r.id === result.topReaction) ?? REACTIONS[0];

  return (
    <div className="screen results">
      {result.feedScore >= 85 && <Confetti count={28} />}

      <header className="results__head">
        <Avatar
          emoji={scroller.avatar}
          photo={scroller.photo}
          colour={scroller.colour}
          flag={scroller.flag}
          size={56}
        />
        <div>
          <span className="eyebrow">ROUND {session.roundIndex + 1} RESULTS</span>
          <h1 className="title">
            {result.isMe ? 'Your feed scored' : `@${result.scrollerHandle}'s feed`}
          </h1>
        </div>
      </header>

      <div className="results__ring">
        <FeedScoreRing score={result.feedScore} animate size={150} />
        <div className="results__verdict">{verdictFor(result.feedScore)}</div>
      </div>

      <div className="results__cats">
        {SCORE_CATEGORIES.map((c, i) => (
          <div key={c.id} className="results__cat">
            <div className="results__cat-top">
              <span aria-hidden>{c.emoji}</span>
              <span className="results__cat-label">{c.label}</span>
              <span className="results__cat-pct" style={{ color: c.colour }}>
                {result.percentages[c.id]}%
              </span>
            </div>
            <div className="meter">
              <div
                className="meter__fill"
                style={{
                  width: barsIn ? `${result.percentages[c.id]}%` : '0%',
                  background: c.colour,
                  transitionDelay: `${i * 90}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="results__reactions card">
        <span className="eyebrow">THE ROOM SAID</span>
        <div className="results__reaction-row">
          {REACTIONS.filter((r) => (result.reactionCounts[r.id] ?? 0) > 0).map((r) => (
            <div key={r.id} className="results__reaction">
              <span className="results__reaction-emoji">{r.emoji}</span>
              <span className="results__reaction-count">{result.reactionCounts[r.id]}</span>
            </div>
          ))}
          {result.totalReactions === 0 && <p className="tiny">Silence. Brutal. 💀</p>}
        </div>
        {result.totalReactions > 0 && (
          <p className="tiny">
            Most common: {topReaction.emoji} {topReaction.label} · {result.totalReactions} total
          </p>
        )}
      </div>

      <div className="results__xp card">
        <div className="row row--between">
          <span className="eyebrow">XP EARNED</span>
          <span className="results__xp-total">+{xpShown}</span>
        </div>
        <ul className="results__xp-list">
          {result.xpAwards.map((a) => (
            <li key={a.label}>
              <span aria-hidden>{a.emoji}</span>
              <span className="grow">{a.label}</span>
              <strong>+{a.amount}</strong>
            </li>
          ))}
        </ul>
        <div className="results__level">
          <div className="row row--between tiny">
            <span>LEVEL {progress.level}</span>
            <span>{progress.xpIntoLevel} / {progress.xpForNext} XP</span>
          </div>
          <div className="meter">
            <div
              className="meter__fill"
              style={{ width: `${progress.fraction * 100}%`, background: 'var(--grad-sun)' }}
            />
          </div>
        </div>
      </div>

      <AdSlot variant="panel" />

      <button
        className="btn btn--primary btn--lg btn--block"
        onClick={() => dispatch({ type: 'nextRound' })}
      >
        {isLastRound ? 'See the session wrap 🏁' : 'Next scroller →'}
      </button>
    </div>
  );
}

function verdictFor(score: number): string {
  if (score >= 92) return '👑 Elite algorithm';
  if (score >= 82) return '🔥 Genuinely great feed';
  if (score >= 70) return '😎 Solid FYP';
  if (score >= 58) return '🤨 Mixed reviews';
  if (score >= 45) return '😬 Rough round';
  return '💀 The algorithm has failed you';
}
