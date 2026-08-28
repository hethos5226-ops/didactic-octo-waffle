import { useEffect } from 'react';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MatchmakingScreen } from './screens/MatchmakingScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { SessionScreen } from './screens/SessionScreen';
import { RatingScreen } from './screens/RatingScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { CreateLobbyScreen, JoinLobbyScreen, FriendsScreen } from './screens/LobbySetupScreens';
import { PremiumScreen } from './screens/PremiumScreen';
import { EditProfileScreen } from './screens/EditProfileScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LevelUpOverlay, ScrollerAnnouncement, Toast } from './components/Overlays';
import { currentScroller, StoreProvider, useStore } from './state/store';

function Router() {
  const { state, dispatch } = useStore();
  const { route, session } = state;

  // A session can only be entered with a profile behind it; guard the routes
  // that assume one rather than letting a refresh land on a broken screen.
  useEffect(() => {
    if (!state.profile && route !== 'auth') dispatch({ type: 'go', route: 'auth' });
    const needsSession = ['lobby', 'announce', 'session', 'rating', 'results', 'summary'];
    if (!session && needsSession.includes(route)) dispatch({ type: 'go', route: 'home' });
  }, [state.profile, session, route, dispatch]);

  if (!state.profile) return <AuthScreen />;

  switch (route) {
    case 'home': return <HomeScreen />;
    case 'matchmaking': return <MatchmakingScreen />;
    case 'lobby': return session ? <LobbyScreen /> : <HomeScreen />;
    case 'session': return session ? <SessionScreen /> : <HomeScreen />;
    case 'rating': return session ? <RatingScreen /> : <HomeScreen />;
    case 'results': return session ? <ResultsScreen /> : <HomeScreen />;
    case 'summary': return session ? <SummaryScreen /> : <HomeScreen />;
    case 'profile': return <ProfileScreen />;
    case 'friends': return <FriendsScreen />;
    case 'createLobby': return <CreateLobbyScreen />;
    case 'joinLobby': return <JoinLobbyScreen />;
    case 'premium': return <PremiumScreen />;
    case 'editProfile': return <EditProfileScreen />;
    case 'settings': return <SettingsScreen />;
    case 'announce': return session ? <SessionScreen /> : <HomeScreen />;
    default: return <HomeScreen />;
  }
}

function Shell() {
  const { state, dispatch } = useStore();
  const scroller = currentScroller(state);

  return (
    <>
      <div className="app-backdrop" aria-hidden />
      <div className="phone">
        <Router />

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
