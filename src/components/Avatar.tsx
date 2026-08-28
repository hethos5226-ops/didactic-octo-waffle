interface AvatarProps {
  emoji: string;
  colour?: string;
  flag?: string;
  size?: number;
  speaking?: boolean;
  dim?: boolean;
}

export function Avatar({ emoji, colour, flag, size = 44, speaking, dim }: AvatarProps) {
  return (
    <div
      className={`avatar${speaking ? ' avatar--speaking' : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.52,
        background: colour ? `${colour}2e` : undefined,
        borderColor: colour ?? undefined,
        opacity: dim ? 0.45 : 1,
      }}
    >
      <span aria-hidden>{emoji}</span>
      {flag && <span className="avatar__flag" aria-hidden>{flag}</span>}
    </div>
  );
}
