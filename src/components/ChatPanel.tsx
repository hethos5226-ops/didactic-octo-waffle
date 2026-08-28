import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Member } from '../state/types';

interface ChatPanelProps {
  open: boolean;
  messages: ChatMessage[];
  members: Member[];
  onSend: (text: string) => void;
  onClose: () => void;
}

const QUICK_EMOJI = ['😂', '💀', '🔥', '😭', '🤯', '❤️', '👀', '🤨'];

export function ChatPanel({ open, messages, members, onSend, onClose }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, open]);

  if (!open) return null;

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft('');
  };

  return (
    <div className="chat">
      <div className="chat__head">
        <span className="eyebrow">LOBBY CHAT</span>
        <button className="chat__close" onClick={onClose} aria-label="Close chat">✕</button>
      </div>

      <div className="chat__list scroll-y">
        {messages.length === 0 && (
          <p className="tiny chat__empty">Say something 👀</p>
        )}
        {messages.map((m) => {
          const from = members.find((x) => x.id === m.fromId);
          return (
            <div key={m.id} className={`chat__msg${from?.isMe ? ' is-me' : ''}`}>
              <span className="chat__who" style={{ color: from?.colour }}>
                {from?.avatar} {from?.isMe ? 'you' : from?.handle}
              </span>
              <span className="chat__text">{m.text}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="chat__quick">
        {QUICK_EMOJI.map((e) => (
          <button key={e} className="chat__quick-btn" onClick={() => send(e)}>{e}</button>
        ))}
      </div>

      <form
        className="chat__form"
        onSubmit={(e) => { e.preventDefault(); send(draft); }}
      >
        <input
          className="chat__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type something…"
          maxLength={140}
          aria-label="Chat message"
        />
        <button className="chat__send" type="submit" disabled={!draft.trim()}>➤</button>
      </form>
    </div>
  );
}
