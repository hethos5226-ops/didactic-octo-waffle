import { useEffect, useMemo, useRef, useState } from 'react';
import { FeedPlayer } from '../components/FeedPlayer';
import { ReactionBubbles } from '../components/ReactionBubbles';
import { VoiceBar } from '../components/VoiceBar';
import { ChatPanel } from '../components/ChatPanel';
import { generateFeed } from '../data/feed';
import { PEOPLE } from '../data/people';
import { REACTIONS } from '../data/reactions';
import { currentScroller, useStore } from '../state/store';

/**
 * The session screen is the product. Everything else in the app exists to get
 * two or more people here and keep them coming back.
 *
 * Co-viewers are simulated locally: they react, they talk, and they take the
 * phone when it is their turn. In a real build these events arrive over the
 * wire — the shape of the state is the same either way.
 */
export function SessionScreen() {
  const { state, dispatch } = useStore();
  const session = state.session!;
  const scroller = currentScroller(state)!;
  const iAmScrolling = scroller.isMe;
  // The screen mounts under the "X is scrolling!" takeover. Nothing should
  // actually be running until that clears, or the first clip of every round
  // burns three seconds behind the announcement.
  const live = state.route === 'session';

  const [chatOpen, setChatOpen] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const advanced = useRef(-1);

  const feed = useMemo(
    () => generateFeed(`${scroller.id}-${session.roundIndex}`, scroller.vibes, session.videosPerRound),
    [scroller.id, scroller.vibes, session.roundIndex, session.videosPerRound],
  );
  const item = feed[Math.min(session.videoIndex, feed.length - 1)];

  const others = session.members.filter((m) => !m.isMe);

  // ── Simulated co-viewers ────────────────────────────────────────────────
  // Reactions land while a clip plays, weighted so the current clip's vibe
  // tends to draw the reaction it deserves.
  useEffect(() => {
    if (!item || !live) return;
    const timers: number[] = [];
    const audience = session.members.filter((m) => m.id !== scroller.id && !m.isMe);

    audience.forEach((member) => {
      const howMany = Math.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < howMany; i++) {
        timers.push(
          window.setTimeout(() => {
            const pool = REACTIONS.filter((r) => r.id !== 'skip');
            const reaction = pool[Math.floor(Math.random() * pool.length)];
            dispatch({ type: 'react', reactionId: reaction.id, fromId: member.id });
          }, 700 + Math.random() * (item.duration * 1000 - 900)),
        );
      }
    });

    // Somebody says something about every other clip.
    if (audience.length > 0 && Math.random() < 0.55) {
      const talker = audience[Math.floor(Math.random() * audience.length)];
      const person = PEOPLE.find((p) => p.id === talker.id);
      if (person) {
        timers.push(
          window.setTimeout(() => {
            dispatch({
              type: 'chat',
              fromId: talker.id,
              text: person.chatter[Math.floor(Math.random() * person.chatter.length)],
            });
          }, 1400 + Math.random() * 3000),
        );
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [item, live, session.members, scroller.id, dispatch]);

  // Whoever is holding the phone drives the feed. When that is not you, the
  // clip moves on by itself — you are watching their scroll, not your own.
  useEffect(() => {
    if (iAmScrolling || !item || !live) return;
    if (advanced.current === session.videoIndex) return;
    const timer = window.setTimeout(() => {
      advanced.current = session.videoIndex;
      dispatch({ type: 'nextVideo' });
    }, item.duration * 1000);
    return () => clearTimeout(timer);
  }, [iAmScrolling, item, live, session.videoIndex, dispatch]);

  // Ambient "who is talking" ring — voice is always on, so somebody usually is.
  useEffect(() => {
    const timer = setInterval(() => {
      const roll = Math.random();
      if (roll < 0.25) { setSpeakingId(null); return; }
      const pool = session.members;
      setSpeakingId(pool[Math.floor(Math.random() * pool.length)].id);
    }, 2200);
    return () => clearInterval(timer);
  }, [session.members]);

  const sendReaction = (id: string) => {
    dispatch({ type: 'react', reactionId: id, fromId: 'me' });
    setBurst(id);
    window.setTimeout(() => setBurst((b) => (b === id ? null : b)), 420);
  };

  const nameFor = (id: string) => {
    const m = session.members.find((x) => x.id === id);
    return m?.isMe ? 'you' : m?.handle ?? '';
  };

  if (!item) return null;

  return (
    <div className="screen screen--flush session">
      <div className="session__top">
        <div className="session__title">
          <span className="session__clap" aria-hidden>🎬</span>
          <div>
            <div className="session__who">
              {scroller.isMe ? 'YOUR FYP' : `${scroller.handle.toUpperCase()}'S FYP`}
            </div>
            <div className="session__sub">
              {scroller.flag} {scroller.isMe ? 'You are' : `${scroller.handle} is`} scrolling
            </div>
          </div>
        </div>
        <div className="session__counter">
          <span className="session__counter-num">{session.videoIndex + 1}</span>
          <span className="session__counter-total">/ {session.videosPerRound}</span>
        </div>
      </div>

      <div className="session__stage">
        <FeedPlayer
          item={item}
          index={session.videoIndex}
          total={session.videosPerRound}
          isScroller={iAmScrolling}
          scrollerHandle={scroller.handle}
          scrollerFlag={scroller.flag}
          onAdvance={() => dispatch({ type: 'nextVideo' })}
        />
        <ReactionBubbles reactions={session.reactions} nameFor={nameFor} />

        <div className="session__watchers">
          {others.map((m) => (
            <div key={m.id} className="session__watcher" title={`@${m.handle}`}>
              <span
                className={`session__watcher-face${speakingId === m.id ? ' is-speaking' : ''}`}
                style={{ borderColor: m.colour }}
              >
                {m.avatar}
              </span>
            </div>
          ))}
        </div>

        <ChatPanel
          open={chatOpen}
          messages={session.chat}
          members={session.members}
          onSend={(text) => dispatch({ type: 'chat', fromId: 'me', text })}
          onClose={() => setChatOpen(false)}
        />
      </div>

      <div className="session__reactions">
        {REACTIONS.map((r) => (
          <button
            key={r.id}
            className={`react-btn${burst === r.id ? ' is-burst' : ''}`}
            style={{ ['--react-colour' as string]: r.colour }}
            onClick={() => sendReaction(r.id)}
            aria-label={r.label}
            title={r.label}
          >
            {r.emoji}
          </button>
        ))}
      </div>

      <VoiceBar
        members={session.members}
        speakingId={speakingId}
        micMuted={session.micMuted}
        volume={session.volume}
        onToggleMute={() => dispatch({ type: 'toggleMute' })}
        onVolume={(v) => dispatch({ type: 'setVolume', value: v })}
        onLeave={() => dispatch({ type: 'leaveSession' })}
        chatOpen={chatOpen}
        chatCount={session.chat.length}
        onToggleChat={() => setChatOpen((c) => !c)}
      />
    </div>
  );
}
