import { useCountUp } from '../hooks/useCountUp';

interface FeedScoreRingProps {
  score: number;
  size?: number;
  animate?: boolean;
  label?: string;
}

/**
 * The headline number. Draws as a ring because a bar reads as "progress
 * towards something", and a feed score is not something you complete.
 */
export function FeedScoreRing({ score, size = 132, animate = false, label = 'FEED SCORE' }: FeedScoreRingProps) {
  const shown = useCountUp(score, animate ? 1400 : 0);
  const stroke = size * 0.09;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - shown / 100);

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <defs>
          <linearGradient id="score-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffe03d" />
            <stop offset="50%" stopColor="#ff2e93" />
            <stop offset="100%" stopColor="#7b2ff7" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="url(#score-grad)" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 240ms linear' }}
        />
      </svg>
      <div className="score-ring__inner">
        <span className="score-ring__value" style={{ fontSize: size * 0.3 }}>{shown}</span>
        <span className="score-ring__label">{label}</span>
      </div>
    </div>
  );
}
