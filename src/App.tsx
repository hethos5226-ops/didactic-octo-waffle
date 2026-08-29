import { useEffect } from 'react';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { EmailAuthScreen } from './screens/EmailAuthScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ReelsScreen } from './screens/ReelsScreen';
import { MatchmakingScreen } from './screens/MatchmakingScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { SessionScreen } from './screens/SessionScreen';
import { RatingScreen } from './screens/RatingScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { CreateLobbyScreen, JoinLobbyScreen } from './screens/LobbySetupScreens';
import { FriendsScreen } from './screens/FriendsScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { PremiumScreen } from './screens/PremiumScreen';
import { EditProfileScreen } from './screens/EditProfileScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TabBar } from './components/TabBar';
import { LevelUpOverlay, ScrollerAnnouncement, Toast } from './components/Overlays';
import { currentScroller, StoreProvider, useStore } from './state/store';
import type { Route } from './state/types';

/**
 * Routes that show the tab bar. Everything else — a session, a sheet, a
 * stranger's profile — takes the whole screen, because a tab bar under an
 * immersive video or a live lobby is a way to lose people mid-experience.
 */
const TAB_ROUTES: Route[] = ['home', 'notifications', 'settings'];

/** These need a session in state; landing on one without is a broken screen. */
const SESSION_ROUTES: Route[] = ['lobby', 'announce', 'session', 'rating', 'results', 'summary'];

function Router() {
  const { state, dispatch } = useStore();
  const { route, session } = state;

  // Guard the routes that assume state they may not have, so a refresh or a
  // stale history entry lands somewhere coherent instead of on a blank screen.
  useEffect(() => {
    if (!state.profile) {
      const preAuth: Route[] = ['welcome', 'emailAuth', 'onboarding'];
      if (!preAuth.includes(route)) {
        dispatch({ type: 'go', route: state.account ? 'onboarding' : 'welcome' });
      }
      return;
    }
    if (!session && SESSION_ROUTES.includes(route)) dispatch({ type: 'go', route: 'home' });
  }, [state.profile, state.account, session, route, dispatch]);

  if (!state.profile) {
    switch (route) {
      case 'emailAuth': return <EmailAuthScreen />;
      case 'onboarding': return <OnboardingScreen />;
      default: return <WelcomeScreen />;
    }
  }

  switch (route) {
    case 'home': return <HomeScreen />;
    case 'reels': return <ReelsScreen />;
    case 'matchmaking': return <MatchmakingScreen />;
    case 'lobby': return session ? <LobbyScreen /> : <HomeScreen />;
    case 'announce':
    case 'session': return session ? <SessionScreen /> : <HomeScreen />;
    case 'rating': return session ? <RatingScreen /> : <HomeScreen />;
    case 'results': return session ? <ResultsScreen /> : <HomeScreen />;
    case 'summary': return session ? <SummaryScreen /> : <HomeScreen />;
    case 'profile': return <ProfileScreen />;
    case 'friends': return <FriendsScreen />;
    case 'notifications': return <NotificationsScreen />;
    case 'createLobby': return <CreateLobbyScreen />;
    case 'joinLobby': return <JoinLobbyScreen />;
    case 'premium': return <PremiumScreen />;
    case 'editProfile': return <EditProfileScreen />;
    case 'settings': return <SettingsScreen />;
    default: return <HomeScreen />;
  }
}

function Shell() {
  const { state, dispatch } = useStore();
  const scroller = currentScroller(state);
  const pending = state.profile?.sentRequests ?? [];

  // Stands in for the other person tapping accept on their phone. Without it a
  // sent request would sit as "Requested" forever and the loop would never
  // close. In a real build this arrives over the wire.
  useEffect(() => {
    if (pending.length === 0) return;
    const timers = pending.map((id, i) =>
      window.setTimeout(
        () => dispatch({ type: 'remoteAcceptedRequest', id }),
        4000 + i * 2500 + Math.random() * 3000,
      ),
    );
    return () => timers.forEach(clearTimeout);
    // Keyed on the ids, so an unrelated re-render does not restart the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.join(','), dispatch]);

  // Your own profile is a tab root; somebody else's is a page you opened.
  const showTabs =
    Boolean(state.profile) &&
    (TAB_ROUTES.includes(state.route) ||
      (state.route === 'profile' && state.viewingPersonId === null));

  return (
    <>
      <div className="app-backdrop" aria-hidden />
      <div className={`phone${showTabs ? ' phone--tabbed' : ''}`}>
        <Router />

        {showTabs && <TabBar />}

        {state.route === 'announce' && state.session && scroller && (
          <ScrollerAnnouncement
            scroller={scroller}
            round={state.session.roundIndex + 1}
            totalRounds={state.session.order.length}
            onDone={() => dispatch({ type: 'enterSession' })}
          />
        )}

        {state.levelUpTo !== null && (
          <LevelUpOverlay
            level={state.levelUpTo}
            onDone={() => dispatch({ type: 'dismissLevelUp' })}
          />
        )}

        {state.toast && (
          <Toast
            key={state.toast.id}
            emoji={state.toast.emoji}
            text={state.toast.text}
            onDone={() => dispatch({ type: 'dismissToast' })}
          />
        )}
      </div>
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
