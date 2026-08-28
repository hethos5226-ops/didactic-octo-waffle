interface AvatarProps {
  emoji: string;
  /** Data URL of a profile photo; falls back to the emoji face when absent. */
  photo?: string | null;
  colour?: string;
  flag?: string;
  size?: number;
  speaking?: boolean;
  dim?: boolean;
  premium?: boolean;
}

export function Avatar({
  emoji, photo, colour, flag, size = 44, speaking, dim, premium,
}: AvatarProps) {
  return (
    <div
      className={`avatar${speaking ? ' avatar--speaking' : ''}${photo ? ' avatar--photo' : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.52,
        background: colour ? `${colour}2e` : undefined,
        borderColor: colour ?? undefined,
        opacity: dim ? 0.45 : 1,
      }}
    >
      {photo ? (
        <img className="avatar__img" src={photo} alt="" draggable={false} />
      ) : (
        <span aria-hidden>{emoji}</span>
      )}
      {flag && <span className="avatar__flag" aria-hidden>{flag}</span>}
      {premium && (
        <span className="avatar__crown" aria-hidden style={{ fontSize: Math.max(11, size * 0.26) }}>
          👑
        </span>
      )}
    </div>
  );
}
