import { useState } from 'react';

interface VoiceBarProps {
  micMuted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolume: (value: number) => void;
  onLeave: () => void;
  chatOpen: boolean;
  chatCount: number;
  onToggleChat: () => void;
}

/**
 * Voice is the thing that turns "watching a video" into "hanging out". It is
 * always-on and ambient — no call to join, no ringing, you are just in the
 * room. Controls only: who is in the room is shown in the header, where it
 * costs the feed no height.
 */
export function VoiceBar({
  micMuted, volume, onToggleMute, onVolume, onLeave,
  chatOpen, chatCount, onToggleChat,
}: VoiceBarProps) {
  const [volumeOpen, setVolumeOpen] = useState(false);

  return (
    <div className="voicebar">
      <button
        className={`voicebar__btn voicebar__btn--chat${chatOpen ? ' is-on' : ''}`}
        onClick={onToggleChat}
        aria-label="Chat"
        aria-pressed={chatOpen}
      >
        💬
        {!chatOpen && chatCount > 0 && <span className="voicebar__badge">{chatCount}</span>}
      </button>

      <button
        className={`voicebar__btn${micMuted ? ' is-off' : ''}`}
        onClick={onToggleMute}
        aria-pressed={micMuted}
        aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        {micMuted ? '🔇' : '🎤'}
      </button>

      <div className="voicebar__volume-wrap">
        <button
          className="voicebar__btn"
          onClick={() => setVolumeOpen((v) => !v)}
          aria-label="Volume"
          aria-expanded={volumeOpen}
        >
          🔊
        </button>
        {volumeOpen && (
          <div className="voicebar__slider pop">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => onVolume(Number(e.target.value) / 100)}
              aria-label="Room volume"
            />
          </div>
        )}
      </div>

      <button className="voicebar__btn is-leave" onClick={onLeave} aria-label="Leave lobby">
        🚫
      </button>
    </div>
  );
}
