import {
  createContext, useContext, useEffect, useMemo, useReducer,
  type Dispatch, type ReactNode,
} from 'react';
import { PEOPLE, type Person } from '../data/people';
import { REACTIONS } from '../data/reactions';
import { XP, progressionFromXp, type XpAward } from '../data/levels';
import type { VibeId } from '../data/vibes';
import {
  applyRatings, emptyTallies, feedScoreFrom, percentages, ratingFromReactions,
} from './scoring';
import type {
  AppState, CategoryId, GroupSize, LobbyMode, Member, Profile, RoundResult, Route,
} from './types';

const STORAGE_KEY = 'scroll.profile.v1';

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    if (!parsed?.handle) return null;
    // The profile shape has grown; backfill anything a stored one predates so
    // an existing player is never dropped back to the sign-up screen.
    parsed.tallies = { ...emptyTallies(), ...parsed.tallies };
    parsed.hashtags = parsed.hashtags ?? [];
    parsed.photo = parsed.photo ?? null;
    parsed.premium = parsed.premium ?? false;
    return parsed;
  } catch {
    return null;
  }
}

function saveProfile(profile: Profile | null) {
  try {
    if (profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Private browsing, quota — the prototype still works, it just forgets. */
  }
}

export function newProfile(input: {
  handle: string; avatar: string; photo: string | null; colour: string;
  country: string; flag: string; vibes: VibeId[]; hashtags: string[];
}): Profile {
  return {
    id: 'me',
    handle: input.handle,
    avatar: input.avatar,
    photo: input.photo,
    colour: input.colour,
    country: input.country,
    flag: input.flag,
    vibes: input.vibes,
    hashtags: input.hashtags,
    premium: false,
    xp: 0,
    tallies: emptyTallies(),
    profileLikes: 0,
    friends: [],
    sessionsPlayed: 0,
    roundsScrolled: 0,
    reactionsSent: 0,
    reactionsReceived: 0,
    createdAt: Date.now(),
  };
}

function memberFromPerson(p: Person, team: 'yours' | 'theirs'): Member {
  return {
    id: p.id, handle: p.handle, avatar: p.avatar, photo: null, colour: p.colour,
    country: p.country, flag: p.flag, level: p.level, feedScore: p.feedScore,
    vibes: p.vibes, hashtags: p.hashtags, premium: p.level >= 25,
    isMe: false, team, ready: true,
  };
}

function memberFromProfile(profile: Profile): Member {
  const { level } = progressionFromXp(profile.xp);
  return {
    id: 'me', handle: profile.handle, avatar: profile.avatar, photo: profile.photo,
    colour: profile.colour, country: profile.country, flag: profile.flag, level,
    feedScore: feedScoreFrom(percentages(profile.tallies)),
    vibes: profile.vibes, hashtags: profile.hashtags, premium: profile.premium,
    isMe: true, team: 'yours', ready: true,
  };
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Pick strangers, never repeating anyone already in the lobby.
 *
 * `exclude` is matched against both ids and handles: the cast contains a
 * @charley, and a lobby listing two of them reads as a bug, so the player's
 * own handle is excluded too.
 */
export function strangers(count: number, exclude: string[] = []): Person[] {
  const blocked = new Set(exclude.map((e) => e.toLowerCase()));
  return shuffled(
    PEOPLE.filter((p) => !blocked.has(p.id.toLowerCase()) && !blocked.has(p.handle.toLowerCase())),
  ).slice(0, count);
}

export function makeLobbyCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `FYP-${code}`;
}

export type Action =
  | { type: 'signUp'; profile: Profile }
  | { type: 'signOut' }
  | { type: 'go'; route: Route }
  | { type: 'back' }
  | { type: 'viewPerson'; id: string | null }
  | { type: 'startMatchmaking'; size: GroupSize }
  | { type: 'matchFound'; members: Member[] }
  | { type: 'openLobby'; mode: LobbyMode; members: Member[]; code: string | null }
  | { type: 'memberJoined'; member: Member }
  | { type: 'memberLeft'; id: string }
  | { type: 'beginSession' }
  | { type: 'enterSession' }
  | { type: 'react'; reactionId: string; fromId: string }
  | { type: 'chat'; fromId: string; text: string }
  | { type: 'nextVideo' }
  | { type: 'endRound' }
  | { type: 'submitRating'; ratings: Record<CategoryId, number>[] }
  | { type: 'nextRound' }
  | { type: 'finishSession' }
  | { type: 'leaveSession' }
  | { type: 'toggleMute' }
  | { type: 'setVolume'; value: number }
  | { type: 'likePerson'; id: string }
  | { type: 'addFriend'; id: string }
  | { type: 'dismissLevelUp' }
  | { type: 'dismissToast' }
  | { type: 'buyPremium' }
  | { type: 'cancelPremium' }
  | { type: 'claimFirstTurn' }
  | { type: 'updateProfile'; changes: Partial<Pick<Profile, 'handle' | 'avatar' | 'photo' | 'colour' | 'country' | 'flag' | 'hashtags' | 'vibes'>> };

export const initialState: AppState = {
  profile: null,
  route: 'auth',
  history: [],
  viewingPersonId: null,
  matchmakingSize: 1,
  session: null,
  levelUpTo: null,
  toast: null,
};

let liveId = 0;
let toastId = 0;

const MAX_HISTORY = 12;

function pushHistory(state: AppState): Route[] {
  return [...state.history, state.route].slice(-MAX_HISTORY);
}

function toast(emoji: string, text: string) {
  return { emoji, text, id: ++toastId };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'signUp':
      return { ...state, profile: action.profile, route: 'home', history: [] };

    case 'signOut':
      return { ...initialState };

    case 'go':
      if (action.route === state.route) return state;
      return { ...state, route: action.route, history: pushHistory(state) };

    case 'back': {
      const history = [...state.history];
      const previous = history.pop();
      return { ...state, route: previous ?? 'home', history };
    }

    case 'viewPerson':
      return {
        ...state,
        viewingPersonId: action.id,
        route: 'profile',
        history: state.route === 'profile' ? state.history : pushHistory(state),
      };

    case 'startMatchmaking':
      return { ...state, matchmakingSize: action.size, route: 'matchmaking' };

    case 'matchFound': {
      return {
        ...state,
        route: 'lobby',
        session: {
          mode: 'random',
          groupSize: state.matchmakingSize,
          code: null,
          members: action.members,
          order: shuffled(action.members.map((m) => m.id)),
          roundIndex: 0,
          videosPerRound: 10,
          videoIndex: 0,
          reactions: [],
          chat: [],
          micMuted: false,
          volume: 0.8,
          results: [],
          liked: [],
          friended: [],
          claimedFirst: false,
        },
      };
    }

    case 'openLobby':
      return {
        ...state,
        route: 'lobby',
        session: {
          mode: action.mode,
          groupSize: 1,
          code: action.code,
          members: action.members,
          order: shuffled(action.members.map((m) => m.id)),
          roundIndex: 0,
          videosPerRound: 10,
          videoIndex: 0,
          reactions: [],
          chat: [],
          micMuted: false,
          volume: 0.8,
          results: [],
          liked: [],
          friended: [],
          claimedFirst: false,
        },
      };

    case 'memberJoined': {
      if (!state.session) return state;
      if (state.session.members.some((m) => m.id === action.member.id)) return state;
      const members = [...state.session.members, action.member];
      return {
        ...state,
        session: { ...state.session, members, order: shuffled(members.map((m) => m.id)) },
        toast: toast(action.member.avatar, `${action.member.handle} joined`),
      };
    }

    case 'memberLeft': {
      if (!state.session) return state;
      const members = state.session.members.filter((m) => m.id !== action.id);
      return {
        ...state,
        session: {
          ...state.session,
          members,
          order: state.session.order.filter((id) => id !== action.id),
        },
      };
    }

    case 'beginSession':
      return { ...state, route: 'announce' };

    case 'enterSession': {
      if (!state.session) return state;
      return {
        ...state,
        route: 'session',
        session: { ...state.session, videoIndex: 0, reactions: [], chat: [] },
      };
    }

    case 'react': {
      if (!state.session) return state;
      const reaction = { id: ++liveId, reactionId: action.reactionId, fromId: action.fromId, at: Date.now() };
      const profile = state.profile && action.fromId === 'me'
        ? { ...state.profile, reactionsSent: state.profile.reactionsSent + 1 }
        : state.profile;
      return {
        ...state,
        profile,
        session: { ...state.session, reactions: [...state.session.reactions, reaction] },
      };
    }

    case 'chat': {
      if (!state.session) return state;
      const message = { id: ++liveId, fromId: action.fromId, text: action.text, at: Date.now() };
      return {
        ...state,
        session: { ...state.session, chat: [...state.session.chat.slice(-40), message] },
      };
    }

    case 'nextVideo': {
      if (!state.session) return state;
      const videoIndex = state.session.videoIndex + 1;
      if (videoIndex >= state.session.videosPerRound) {
        return { ...state, route: 'rating', session: { ...state.session, videoIndex: state.session.videosPerRound } };
      }
      return { ...state, session: { ...state.session, videoIndex } };
    }

    case 'endRound':
      return { ...state, route: 'rating' };

    case 'submitRating': {
      if (!state.session || !state.profile) return state;
      const session = state.session;
      const scrollerId = session.order[session.roundIndex];
      const scroller = session.members.find((m) => m.id === scrollerId);
      if (!scroller) return state;

      const counts: Record<string, number> = {};
      for (const r of session.reactions) counts[r.reactionId] = (counts[r.reactionId] ?? 0) + 1;
      const totalReactions = session.reactions.length;
      const topReaction =
        Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'funny';

      // Live reactions count as one extra ballot alongside everyone's ratings.
      const ballots = [...action.ratings, ratingFromReactions(counts)];
      const merged = {} as Record<CategoryId, number>;
      for (const key of ['funny', 'chaotic', 'fire', 'wtf', 'good'] as CategoryId[]) {
        merged[key] = Math.round(
          ballots.reduce((sum, b) => sum + (b[key] ?? 0), 0) / ballots.length,
        );
      }
      const feedScore = feedScoreFrom(merged);

      const levelBefore = progressionFromXp(state.profile.xp).level;
      const awards: XpAward[] = [];
      const iScrolled = scroller.isMe;

      if (iScrolled) {
        awards.push({ label: 'Shared your FYP', emoji: '🎬', amount: XP.finishRoundAsScroller });
        const received = session.reactions.filter((r) => r.fromId !== 'me').length;
        if (received > 0) {
          awards.push({
            label: `${received} reactions to your feed`,
            emoji: '✨',
            amount: received * XP.perReactionReceived,
          });
        }
      } else {
        awards.push({ label: 'Watched a full round', emoji: '👀', amount: XP.finishRoundAsViewer });
        const sent = session.reactions.filter((r) => r.fromId === 'me').length;
        if (sent > 0) {
          awards.push({
            label: `${sent} reactions sent`,
            emoji: '💜',
            amount: sent * XP.perReactionSent,
          });
        }
      }

      const xpTotal = awards.reduce((sum, a) => sum + a.amount, 0);
      let profile: Profile = {
        ...state.profile,
        xp: state.profile.xp + xpTotal,
        reactionsReceived: iScrolled
          ? state.profile.reactionsReceived + session.reactions.filter((r) => r.fromId !== 'me').length
          : state.profile.reactionsReceived,
        roundsScrolled: iScrolled ? state.profile.roundsScrolled + 1 : state.profile.roundsScrolled,
      };
      if (iScrolled) {
        profile = { ...profile, tallies: applyRatings(profile.tallies, ballots) };
      }
      const levelAfter = progressionFromXp(profile.xp).level;

      const result: RoundResult = {
        scrollerId,
        scrollerHandle: scroller.handle,
        isMe: iScrolled,
        percentages: merged,
        feedScore,
        reactionCounts: counts,
        totalReactions,
        topReaction,
        xpAwards: awards,
        xpTotal,
        levelBefore,
        levelAfter,
      };

      return {
        ...state,
        profile,
        route: 'results',
        levelUpTo: levelAfter > levelBefore ? levelAfter : null,
        session: { ...session, results: [...session.results, result] },
      };
    }

    case 'nextRound': {
      if (!state.session) return state;
      const roundIndex = state.session.roundIndex + 1;
      if (roundIndex >= state.session.order.length) {
        return { ...state, route: 'summary' };
      }
      return {
        ...state,
        route: 'announce',
        session: { ...state.session, roundIndex, videoIndex: 0, reactions: [], chat: [] },
      };
    }

    case 'finishSession': {
      if (!state.profile) return state;
      const levelBefore = progressionFromXp(state.profile.xp).level;
      const profile = {
        ...state.profile,
        xp: state.profile.xp + XP.sessionComplete,
        sessionsPlayed: state.profile.sessionsPlayed + 1,
      };
      const levelAfter = progressionFromXp(profile.xp).level;
      return {
        ...state,
        profile,
        session: null,
        route: 'home',
        history: [],
        levelUpTo: levelAfter > levelBefore ? levelAfter : state.levelUpTo,
      };
    }

    case 'leaveSession':
      return { ...state, session: null, route: 'home', history: [] };

    case 'toggleMute': {
      if (!state.session) return state;
      return { ...state, session: { ...state.session, micMuted: !state.session.micMuted } };
    }

    case 'setVolume': {
      if (!state.session) return state;
      return { ...state, session: { ...state.session, volume: action.value } };
    }

    case 'likePerson': {
      if (!state.session || !state.profile) return state;
      if (state.session.liked.includes(action.id)) return state;
      const person = state.session.members.find((m) => m.id === action.id);
      return {
        ...state,
        // A like you give comes back as XP because it costs you nothing and
        // rewards the loop that makes people add each other.
        profile: { ...state.profile, xp: state.profile.xp + 5 },
        session: { ...state.session, liked: [...state.session.liked, action.id] },
        toast: toast('❤️', `You liked @${person?.handle ?? action.id}'s profile`),
      };
    }

    case 'addFriend': {
      if (!state.session || !state.profile) return state;
      if (state.profile.friends.includes(action.id)) return state;
      const person = state.session.members.find((m) => m.id === action.id);
      const levelBefore = progressionFromXp(state.profile.xp).level;
      const profile = {
        ...state.profile,
        friends: [...state.profile.friends, action.id],
        profileLikes: state.profile.profileLikes + 1,
        xp: state.profile.xp + XP.friendAdded + XP.profileLikeReceived,
      };
      const levelAfter = progressionFromXp(profile.xp).level;
      return {
        ...state,
        profile,
        levelUpTo: levelAfter > levelBefore ? levelAfter : state.levelUpTo,
        session: { ...state.session, friended: [...state.session.friended, action.id] },
        toast: toast('🤝', `You and @${person?.handle ?? action.id} are friends!`),
      };
    }

    case 'buyPremium': {
      if (!state.profile) return state;
      return {
        ...state,
        profile: { ...state.profile, premium: true },
        route: state.history[state.history.length - 1] ?? 'home',
        history: state.history.slice(0, -1),
        toast: toast('👑', 'Premium unlocked — no more ads!'),
      };
    }

    case 'cancelPremium': {
      if (!state.profile) return state;
      return {
        ...state,
        profile: { ...state.profile, premium: false },
        toast: toast('👋', 'Premium cancelled'),
      };
    }

    case 'claimFirstTurn': {
      // A Premium perk: jump the shuffle and take the opening round. It only
      // moves you to the front — everyone else keeps their relative order, so
      // it is a head start, not a reshuffle of somebody else's session.
      if (!state.session || !state.profile?.premium) return state;
      if (state.session.claimedFirst) return state;
      const order = ['me', ...state.session.order.filter((id) => id !== 'me')];
      return {
        ...state,
        session: { ...state.session, order, claimedFirst: true },
        toast: toast('👑', "You're scrolling first"),
      };
    }

    case 'updateProfile': {
      if (!state.profile) return state;
      return { ...state, profile: { ...state.profile, ...action.changes } };
    }

    case 'dismissLevelUp':
      return { ...state, levelUpTo: null };

    case 'dismissToast':
      return { ...state, toast: null };

    default:
      return state;
  }
}

interface Store {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const profile = loadProfile();
    return {
      ...initialState,
      profile,
      route: profile ? ('home' as Route) : ('auth' as Route),
      history: [],
    };
  });

  useEffect(() => { saveProfile(state.profile); }, [state.profile]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

/** Convenience selectors used all over the UI. */
export function useProfile(): Profile {
  const { state } = useStore();
  if (!state.profile) throw new Error('No profile yet');
  return state.profile;
}

export function currentScroller(state: AppState): Member | null {
  const s = state.session;
  if (!s) return null;
  const id = s.order[s.roundIndex];
  return s.members.find((m) => m.id === id) ?? null;
}

export function reactionById(id: string) {
  return REACTIONS.find((r) => r.id === id) ?? REACTIONS[0];
}

export { memberFromPerson, memberFromProfile };
