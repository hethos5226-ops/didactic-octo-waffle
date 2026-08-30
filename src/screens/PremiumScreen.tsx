import { useState } from 'react';
import { Confetti } from '../components/Overlays';
import { useStore } from '../state/store';

interface Perk {
  emoji: string;
  title: string;
  body: string;
}

const PERKS: Perk[] = [
  {
    emoji: '🚫',
    title: 'No ads, anywhere',
    body: 'No banner on the home screen, nothing between rounds. Just the feed.',
  },
  {
    emoji: '👑',
    title: 'Scroll first',
    body: "Claim the opening round in any lobby instead of waiting for the shuffle. Everyone else keeps their order behind you.",
  },
  {
    emoji: '✨',
    title: 'Premium badge',
    body: 'A crown on your avatar in every lobby, and on your profile.',
  },
  {
    emoji: '📈',
    title: 'Double XP weekends',
    body: 'Level up twice as fast from Friday night through Sunday.',
  },
];

const PLANS = [
  { id: 'monthly', label: 'Monthly', price: '£3.99', per: 'per month', note: null },
  { id: 'yearly', label: 'Yearly', price: '£24.99', per: 'per year', note: 'SAVE 48%' },
] as const;

export function PremiumScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const [plan, setPlan] = useState<(typeof PLANS)[number]['id']>('yearly');

  if (profile.premium) {
    return (
      <div className="screen premium">
        <Confetti count={22} />
        <header className="lobby__head">
          <button className="lobby__back" onClick={() => dispatch({ type: 'back' })}>‹</button>
          <div className="grow">
            <h1 className="title">👑 You're Premium</h1>
            <p className="subtitle">Ads are gone and the first turn is yours to take.</p>
          </div>
        </header>

        <div className="premium__active">
          <span className="premium__active-crown" aria-hidden>👑</span>
          <div>
            <div className="premium__active-title">SCROLLR PREMIUM</div>
            <p className="tiny">Active — renews automatically.</p>
          </div>
        </div>

        <ul className="premium__perks">
          {PERKS.map((perk) => (
            <li key={perk.title} className="premium__perk">
              <span className="premium__perk-emoji" aria-hidden>{perk.emoji}</span>
              <div>
                <div className="premium__perk-title">{perk.title}</div>
                <p className="tiny">{perk.body}</p>
              </div>
              <span className="premium__tick" aria-hidden>✓</span>
            </li>
          ))}
        </ul>

        <button
          className="btn btn--ghost btn--block"
          onClick={() => dispatch({ type: 'cancelPremium' })}
        >
          Cancel Premium
        </button>
        <p className="tiny premium__legal">
          Prototype build — nothing is charged and no payment details are collected.
        </p>
      </div>
    );
  }

  return (
    <div className="screen premium">
      <header className="lobby__head">
        <button className="lobby__back" onClick={() => dispatch({ type: 'back' })}>‹</button>
        <div className="grow">
          <span className="eyebrow">SCROLLR PREMIUM</span>
          <h1 className="title">Lose the ads.<br />Go first.</h1>
        </div>
      </header>

      <div className="premium__hero">
        <div className="premium__hero-glow" aria-hidden />
        <span className="premium__hero-crown bob" aria-hidden>👑</span>
      </div>

      <ul className="premium__perks">
        {PERKS.map((perk) => (
          <li key={perk.title} className="premium__perk">
            <span className="premium__perk-emoji" aria-hidden>{perk.emoji}</span>
            <div>
              <div className="premium__perk-title">{perk.title}</div>
              <p className="tiny">{perk.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="premium__plans">
        {PLANS.map((p) => (
          <button
            key={p.id}
            className={`premium__plan${plan === p.id ? ' is-on' : ''}`}
            onClick={() => setPlan(p.id)}
            aria-pressed={plan === p.id}
          >
            {p.note && <span className="premium__plan-note">{p.note}</span>}
            <span className="premium__plan-label">{p.label}</span>
            <span className="premium__plan-price">{p.price}</span>
            <span className="tiny">{p.per}</span>
          </button>
        ))}
      </div>

      <button
        className="btn btn--primary btn--lg btn--block"
        onClick={() => dispatch({ type: 'buyPremium' })}
      >
        Get Premium 👑
      </button>
      <p className="tiny premium__legal">
        Prototype build — nothing is charged and no payment details are collected.
      </p>
    </div>
  );
}
