import { useRef, useState } from 'react';
import { AVATARS } from '../data/people';
import { PhotoError, photoFromFile } from '../data/photo';
import { Avatar } from './Avatar';

interface AvatarPickerProps {
  emoji: string;
  photo: string | null;
  colour: string;
  flag?: string;
  onEmoji: (emoji: string) => void;
  onPhoto: (photo: string | null) => void;
}

/**
 * Your face, either way you want it: a real photo, or an emoji if you'd rather
 * not show one. The emoji grid stays available even after a photo is picked,
 * because "actually, take that down" needs to be one tap.
 */
export function AvatarPicker({
  emoji, photo, colour, flag, onEmoji, onPhoto,
}: AvatarPickerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onPhoto(await photoFromFile(file));
    } catch (err) {
      setError(err instanceof PhotoError ? err.message : "Couldn't use that image");
    } finally {
      setBusy(false);
      // Clear the input so picking the same file twice still fires a change.
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="picker">
      <div className="picker__top">
        <Avatar emoji={emoji} photo={photo} colour={colour} flag={flag} size={78} />
        <div className="picker__actions">
          <button
            className="btn btn--ghost picker__upload"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            {busy ? 'Loading…' : photo ? '🔄 Change photo' : '📷 Add a photo'}
          </button>
          {photo && (
            <button className="picker__remove" onClick={() => onPhoto(null)}>
              Remove photo
            </button>
          )}
          {!photo && <p className="tiny">or pick an emoji face below</p>}
        </div>
      </div>

      <input
        ref={fileInput}
        className="picker__file"
        type="file"
        accept="image/*"
        onChange={(e) => pick(e.target.files?.[0])}
        aria-label="Upload a profile photo"
      />

      {error && <p className="picker__error">{error}</p>}

      <div className="auth__avatars">
        {AVATARS.map((a) => {
          const on = a === emoji && !photo;
          return (
            <button
              key={a}
              className={`auth__avatar${on ? ' is-on' : ''}`}
              onClick={() => { onEmoji(a); onPhoto(null); }}
              style={on ? { borderColor: colour, background: `${colour}33` } : undefined}
              aria-label={`Avatar ${a}`}
              aria-pressed={on}
            >
              {a}
            </button>
          );
        })}
      </div>
    </div>
  );
}
