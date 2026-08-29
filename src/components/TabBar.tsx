import { useState } from 'react';
import { useStore } from '../state/store';
import type { GroupSize, Tab } from '../state/types';

interface TabDef {
  id: Exclude<Tab, 'play'>;
  label: string;
  icon: string;
}

const LEFT: TabDef[] = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

const RIGHT: TabDef[] = [
  { id: 'activity', label: 'Activity', icon: '🔔' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const MODES: { size: GroupSize; emoji: string; label: string; hint: string }[] = [
  { size: 1, emoji: '👤', label: 'SOLO', hint: '1 v 1' },
  { size: 2, emoji: '👥', label: 'DUO', hint: '2 v 2' },
  { size: 3, emoji: '👥👥', label: 'TRIO', hint: '3 v 3' },
];

/**
 * PLAY sits in the middle and is the loudest thing in the bar, because
 * starting a game is what the app is for — everything else is somewhere you
 * go between games. It opens the modes as a sheet rather than routing to a
 * screen, so you can start a game from wherever you are without losing your
 * place.
 */
export function TabBar() {
  const { state, dispatch } = useStore();
  const [playOpen, setPlayOpen] = useState(false);
  const unread = state.profile?.notifications.filter((n) => !n.read).length ?? 0;

  const start = (size: GroupSize) => {
    setPlayOpen(false);
    dispatch({ type: 'startMatchmaking', size });
  };

  const item = (tab: TabDef) => {
    const active = state.tab === tab.id;
    return (
      <button
        key={tab.id}
        className={`tabbar__item${active ? ' is-on' : ''}`}
        onClick={() => dispatch({ type: 'setTab', tab: tab.id })}
        aria-current={active ? 'page' : undefined}
      >
        <span className="tabbar__icon" aria-hidden>
          {tab.icon}
          {tab.id === 'activity' && unread > 0 && (
            <span className="tabbar__badge">{unread > 9 ? '9+' : unread}</span>
          )}
        </span>
        <span className="tabbar__label">{tab.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav className="tabbar" aria-label="Main">
        {LEFT.map(item)}

        <button className="tabbar__play" onClick={() => setPlayOpen(true)} aria-label="Play">
          <span className="tabbar__play-glow" aria-hidden />
          <span className="tabbar__play-text">PLAY!</span>
        </button>

        {RIGHT.map(item)}
      </nav>

      {playOpen && (
        <div className="sheet" onClick={() => setPlayOpen(false)}>
          <div className="sheet__panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grip" aria-hidden />
            <h2 className="sheet__title">🌎 Meet someone. Watch their FYP.</h2>
            <p className="subtitle">
              One person gets picked to share their feed. Everyone watches it together, reacts, and
              rates it at the end. Then it's someone else's turn.
            </p>

            <div className="play__modes">
              {MODES.map((m) => (
                <button key={m.size} className="mode-btn play__mode" onClick={() => start(m.size)}>
                  <span className="mode-btn__emoji">{m.emoji}</span>
                  <span className="mode-btn__label">{m.label}</span>
                  <span className="mode-btn__hint">{m.hint}</span>
                </button>
              ))}
            </div>

            <button
              className="btn btn--zap btn--block"
              onClick={() => { setPlayOpen(false); dispatch({ type: 'go', route: 'createLobby' }); }}
            >
              🔒 Private lobby with friends
            </button>
            <button className="btn btn--ghost btn--block" onClick={() => setPlayOpen(false)}>
              Not now
            </button>
          </div>
        </div>
      )}
    </>
  );
}
