import { useRef, useState } from 'react';
import { firstEmoji } from '../data/emoji';
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
  const emojiInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState('');

  // Anything typed here comes from the device's own emoji keyboard, so the
  // grid only has to carry a handful of starters rather than every face.
  const useCustom = (raw: string) => {
    const picked = firstEmoji(raw);
    setCustom(picked);
    if (picked) {
      onEmoji(picked);
      onPhoto(null);
    }
  };

  const customIsActive = Boolean(custom) && custom === emoji && !photo;

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
              onClick={() => { onEmoji(a); onPhoto(null); setCustom(''); }}
              style={on ? { borderColor: colour, background: `${colour}33` } : undefined}
              aria-label={`Avatar ${a}`}
              aria-pressed={on}
            >
              {a}
            </button>
          );
        })}

        {/* Focuses the field below, which opens the device keyboard — switch
            to its emoji tab and any face at all is one tap away. */}
        <button
          className={`auth__avatar auth__avatar--more${customIsActive ? ' is-on' : ''}`}
          onClick={() => emojiInput.current?.focus()}
          style={customIsActive ? { borderColor: colour, background: `${colour}33` } : undefined}
          aria-label="Choose any emoji from your keyboard"
        >
          {customIsActive ? custom : '+'}
        </button>
      </div>

      <label className="picker__any">
        <span className="picker__any-label tiny">or any emoji from your keyboard</span>
        <input
          ref={emojiInput}
          className="picker__any-input"
          value={custom}
          onChange={(e) => useCustom(e.target.value)}
          placeholder="tap"
          autoComplete="off"
          aria-label="Any emoji from your keyboard"
        />
      </label>
    </div>
  );
}
