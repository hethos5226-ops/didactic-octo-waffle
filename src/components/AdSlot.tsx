import { useStore } from '../state/store';

interface AdSlotProps {
  /** `banner` sits in a scrolling screen; `panel` is the between-rounds break. */
  variant?: 'banner' | 'panel';
}

/**
 * The thing Premium removes. A placeholder rather than a real network — but a
 * real placeholder: it takes the space an ad would take, so removing it is a
 * visible difference rather than a promise.
 *
 * Renders nothing at all for Premium members.
 */
export function AdSlot({ variant = 'banner' }: AdSlotProps) {
  const { state, dispatch } = useStore();
  if (state.profile?.premium) return null;

  return (
    <div className={`ad ad--${variant}`}>
      <div className="ad__label">AD</div>
      <div className="grow">
        <div className="ad__title">
          {variant === 'panel' ? 'Your ad could be here' : 'Sponsored'}
        </div>
        <p className="tiny">
          {variant === 'panel'
            ? 'A short break between rounds.'
            : 'This is where a banner would sit.'}
        </p>
      </div>
      <button className="ad__remove" onClick={() => dispatch({ type: 'go', route: 'premium' })}>
        Remove ads 👑
      </button>
    </div>
  );
}
