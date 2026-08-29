import { useStore } from '../state/store';
import type { Tab } from '../state/types';

interface TabDef {
  id: Tab;
  label: string;
  icon: string;
  activeIcon: string;
}

/**
 * The five permanent destinations.
 *
 * Create sits in the middle and is styled as a raised button rather than a
 * fifth equal tab: it is an action, not a place, and every app of this shape
 * signals that the same way.
 */
const TABS: TabDef[] = [
  { id: 'home', label: 'Home', icon: '🏠', activeIcon: '🏠' },
  { id: 'discover', label: 'Discover', icon: '🔍', activeIcon: '🔎' },
  { id: 'create', label: 'Create', icon: '＋', activeIcon: '＋' },
  { id: 'activity', label: 'Activity', icon: '🔔', activeIcon: '🔔' },
  { id: 'profile', label: 'Profile', icon: '👤', activeIcon: '👤' },
];

export function TabBar() {
  const { state, dispatch } = useStore();
  const unread = state.profile?.notifications.filter((n) => !n.read).length ?? 0;

  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((tab) => {
        const active = state.tab === tab.id;
        if (tab.id === 'create') {
          return (
            <button
              key={tab.id}
              className="tabbar__create"
              onClick={() => dispatch({ type: 'setTab', tab: 'create' })}
              aria-label="Create"
            >
              <span aria-hidden>{tab.icon}</span>
            </button>
          );
        }
        return (
          <button
            key={tab.id}
            className={`tabbar__item${active ? ' is-on' : ''}`}
            onClick={() => dispatch({ type: 'setTab', tab: tab.id })}
            aria-current={active ? 'page' : undefined}
          >
            <span className="tabbar__icon" aria-hidden>
              {active ? tab.activeIcon : tab.icon}
              {tab.id === 'activity' && unread > 0 && (
                <span className="tabbar__badge">{unread > 9 ? '9+' : unread}</span>
              )}
            </span>
            <span className="tabbar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
