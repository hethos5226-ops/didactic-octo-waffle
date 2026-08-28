import { useState } from 'react';
import { Avatar } from './Avatar';
import type { Member } from '../state/types';

interface VoiceBarProps {
  members: Member[];
  speakingId: string | null;
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
 * room. The controls stay to the three that actually matter mid-session.
 */
export function VoiceBar({
  members, speakingId, micMuted, volume, onToggleMute, onVolume, onLeave,
  chatOpen, chatCount, onToggleChat,
}: VoiceBarProps) {
  const [volumeOpen, setVolumeOpen] = useState(false);

  return (
    <div className="voicebar">
      <div className="voicebar__people">
        {members.map((m) => (
          <div key={m.id} className="voicebar__person" title={`@${m.handle}`}>
            <Avatar
              emoji={m.avatar}
              colour={m.colour}
              size={34}
              speaking={speakingId === m.id && !(m.isMe && micMuted)}
              dim={m.isMe && micMuted}
            />
            {m.isMe && micMuted && <span className="voicebar__muted" aria-hidden>🔇</span>}
          </div>
        ))}
      </div>

      <div className="spacer" />

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
