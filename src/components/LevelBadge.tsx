import { titleForLevel } from '../data/levels';

interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
}

export function LevelBadge({ level, size = 'md' }: LevelBadgeProps) {
  const title = titleForLevel(level);
  return (
    <div className={`level-badge level-badge--${size}`}>
      <span className="level-badge__emoji" aria-hidden>{title.emoji}</span>
      <span className="level-badge__num">LV {level}</span>
      {size !== 'sm' && <span className="level-badge__title">{title.title}</span>}
    </div>
  );
}
