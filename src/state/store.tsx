import {
  createContext, useContext, useEffect, useMemo, useReducer, useRef,
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
  AppNotification, AppState, CategoryId, GroupSize, LobbyMode, Member, Profile,
  MatchSummary, RoundResult, Route, SessionState, Tab,
} from './types';
import {
  currentAccount, fetchProfile, isBackendConfigured, markNotificationsRead,
  onAuthChange, recordMatch, recordSessionResult, respondToRequest,
  saveProfile as saveProfileRemote,
  sendFriendRequest, setFollowing, signOut as signOutRemote, uploadAvatar,
  type AuthAccount,
} from '../backend';

const STORAGE_KEY = 'scroll.profile.v1';

/**
 * Persistence has two modes, and the app must work in both.
 *
 * With a Supabase project configured, the database is the record and
 * localStorage is only a cache that makes the first paint instant. Without
 * one — which is the state until a project exists — localStorage *is* the
 * record, exactly as it was before. Branching here rather than at every call
 * site keeps the reducer, and every screen, unchanged.
 */
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
    parsed.incomingRequests = parsed.incomingRequests ?? [];
    parsed.sentRequests = parsed.sentRequests ?? [];
    parsed.notifications = parsed.notifications ?? [];
    parsed.displayName = parsed.displayName || parsed.handle;
    parsed.bio = parsed.bio ?? '';
    parsed.authProvider = parsed.authProvider ?? null;
    parsed.email = parsed.email ?? null;
    parsed.following = parsed.following ?? [];
    parsed.followerCount = parsed.followerCount ?? 0;
    parsed.matchHistory = parsed.matchHistory ?? [];
    parsed.onboarded = parsed.onboarded ?? true;
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
  /**
   * The auth user's id. This has to be the profile's primary key: the RLS
   * policy on `profiles` is `auth.uid() = id`, so a row with any other id is
   * rejected by the database rather than silently written.
   */
  id: string;
  handle: string; displayName: string; bio: string;
  avatar: string; photo: string | null; colour: string;
  country: string; flag: string; vibes: VibeId[]; hashtags: string[];
  authProvider: Profile['authProvider']; email: string | null;
}): Profile {
  return {
    id: input.id,
    handle: input.handle,
    displayName: input.displayName || input.handle,
    bio: input.bio,
    authProvider: input.authProvider,
    email: input.email,
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
    // A new account starts with an empty inbox, and that is what it shows.
    // There used to be two invented friend requests here so the bell had
    // something in it — which meant SCROLL greeted every new person by
    // claiming two strangers had asked to be their friend. An empty inbox is
    // honest, and the first real request will mean something.
    incomingRequests: [],
    sentRequests: [],
    notifications: [],
    following: [],
    followerCount: 0,
    matchHistory: [],
    onboarded: true,
    sessionsPlayed: 0,
    roundsScrolled: 0,
    reactionsSent: 0,
    reactionsReceived: 0,
    createdAt: Date.now(),
  };
}

let notificationId = 0;

function notify(kind: AppNotification['kind'], fromId: string): AppNotification {
  return { id: ++notificationId, kind, fromId, at: Date.now(), read: false };
}

/** Turn a finished session into the record that outlives it. */
function summariseMatch(session: SessionState): MatchSummary {
  const rounds = session.results.map((r) => ({
    handle: r.scrollerHandle,
    isMe: r.isMe,
    feedScore: r.feedScore,
  }));
  const best = [...rounds].sort((a, b) => b.feedScore - a.feedScore)[0];
  const mine = rounds.find((r) => r.isMe);
  return {
    id: `m_${Date.now().toString(36)}`,
    at: Date.now(),
    mode: session.mode,
    players: session.members.map((m) => ({
      id: m.id, handle: m.handle, avatar: m.avatar, colour: m.colour, isMe: m.isMe,
    })),
    rounds,
    myFeedScore: mine?.feedScore ?? null,
    bestHandle: best?.handle ?? '',
    bestScore: best?.feedScore ?? 0,
    totalReactions: session.results.reduce((n, r) => n + r.totalReactions, 0),
    xpEarned: session.results.reduce((n, r) => n + r.xpTotal, 0) + XP.sessionComplete,
  };
}

function memberFromPerson(p: Person, team: 'yours' | 'theirs'): Member {
  return {
    id: p.id, handle: p.handle, avatar: p.avatar, photo: null, colour: p.colour,
    country: p.country, flag: p.flag, level: p.level, feedScore: p.feedScore,
    // Not Premium. Nobody in the built-in cast bought a subscription, and a
    // crown derived from a level is a badge that means nothing.
    vibes: p.vibes, hashtags: p.hashtags, premium: false,
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
  | { type: 'signedIn'; account: AuthAccount }
  | { type: 'hydrate'; profile: Profile; account: AuthAccount }
  | { type: 'setTab'; tab: Tab }
  | { type: 'toggleFollow'; id: string }
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
  | { type: 'sendFriendRequest'; id: string }
  | { type: 'acceptFriendRequest'; id: string }
  | { type: 'declineFriendRequest'; id: string }
  | { type: 'remoteAcceptedRequest'; id: string }
  | { type: 'markNotificationsRead' }
  | { type: 'updateProfile'; changes: Partial<Pick<Profile, 'handle' | 'avatar' | 'photo' | 'colour' | 'country' | 'flag' | 'hashtags' | 'vibes'>> };

export const initialState: AppState = {
  profile: null,
  account: null,
  route: 'welcome',
  tab: 'home',
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
      return { ...state, profile: action.profile, route: 'home', tab: 'home', history: [] };

    case 'signOut':
      // The remote sign-out is fired by the mirror; this clears the local copy.
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
      if (!state.profile || !state.session) return state;
      const levelBefore = progressionFromXp(state.profile.xp).level;
      const summary = summariseMatch(state.session);
      const profile = {
        ...state.profile,
        xp: state.profile.xp + XP.sessionComplete,
        sessionsPlayed: state.profile.sessionsPlayed + 1,
        // Capped: a history that grows forever would eventually blow the
        // localStorage budget the profile shares with the photo.
        matchHistory: [summary, ...state.profile.matchHistory].slice(0, 20),
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

    case 'sendFriendRequest': {
      if (!state.profile) return state;
      const { friends, sentRequests, incomingRequests } = state.profile;
      if (friends.includes(action.id) || sentRequests.includes(action.id)) return state;

      // If they already asked you, sending back is just accepting.
      if (incomingRequests.includes(action.id)) {
        return reducer(state, { type: 'acceptFriendRequest', id: action.id });
      }
      const person = PEOPLE.find((p) => p.id === action.id);
      return {
        ...state,
        profile: { ...state.profile, sentRequests: [...sentRequests, action.id] },
        toast: toast('📨', `Request sent to @${person?.handle ?? action.id}`),
      };
    }

    case 'acceptFriendRequest': {
      if (!state.profile) return state;
      if (state.profile.friends.includes(action.id)) return state;
      const person = PEOPLE.find((p) => p.id === action.id);
      const levelBefore = progressionFromXp(state.profile.xp).level;
      const profile: Profile = {
        ...state.profile,
        friends: [...state.profile.friends, action.id],
        incomingRequests: state.profile.incomingRequests.filter((id) => id !== action.id),
        sentRequests: state.profile.sentRequests.filter((id) => id !== action.id),
        profileLikes: state.profile.profileLikes + 1,
        xp: state.profile.xp + XP.friendAdded,
        notifications: state.profile.notifications.map((n) =>
          n.kind === 'request' && n.fromId === action.id ? { ...n, read: true } : n,
        ),
      };
      const levelAfter = progressionFromXp(profile.xp).level;
      return {
        ...state,
        profile,
        levelUpTo: levelAfter > levelBefore ? levelAfter : state.levelUpTo,
        toast: toast('🤝', `You and @${person?.handle ?? action.id} are friends!`),
      };
    }

    case 'declineFriendRequest': {
      if (!state.profile) return state;
      return {
        ...state,
        profile: {
          ...state.profile,
          incomingRequests: state.profile.incomingRequests.filter((id) => id !== action.id),
          notifications: state.profile.notifications.filter(
            (n) => !(n.kind === 'request' && n.fromId === action.id),
          ),
        },
      };
    }

    case 'remoteAcceptedRequest': {
      // Stands in for the other person tapping accept on their phone.
      if (!state.profile) return state;
      if (!state.profile.sentRequests.includes(action.id)) return state;
      return {
        ...state,
        profile: {
          ...state.profile,
          friends: [...state.profile.friends, action.id],
          sentRequests: state.profile.sentRequests.filter((id) => id !== action.id),
          xp: state.profile.xp + XP.friendAdded,
          notifications: [notify('accepted', action.id), ...state.profile.notifications].slice(0, 30),
        },
      };
    }

    case 'markNotificationsRead': {
      if (!state.profile) return state;
      return {
        ...state,
        profile: {
          ...state.profile,
          notifications: state.profile.notifications.map((n) => ({ ...n, read: true })),
        },
      };
    }

    case 'hydrate':
      // The server's copy wins over whatever was cached locally.
      return {
        ...state,
        profile: action.profile,
        account: action.account,
        route: action.profile.onboarded ? 'home' : 'onboarding',
        tab: 'home',
        history: [],
      };

    case 'signedIn': {
      // A returning account already has a profile, so onboarding is skipped.
      const hasProfile = Boolean(state.profile);
      return {
        ...state,
        account: action.account,
        route: hasProfile ? 'home' : 'onboarding',
        tab: 'home',
        history: [],
      };
    }

    case 'setTab': {
      const routeForTab: Record<Tab, Route> = {
        home: 'home',
        profile: 'profile',
        // PLAY is an action, handled by the tab bar itself; it never routes.
        play: 'home',
        activity: 'notifications',
        settings: 'settings',
      };
      return {
        ...state,
        tab: action.tab,
        route: routeForTab[action.tab],
        // Tabs are roots, not stops on a journey — switching clears the stack
        // so back never walks sideways through tabs.
        history: [],
        viewingPersonId: action.tab === 'profile' ? null : state.viewingPersonId,
      };
    }

    case 'toggleFollow': {
      if (!state.profile) return state;
      const following = state.profile.following.includes(action.id);
      const person = PEOPLE.find((p) => p.id === action.id);
      return {
        ...state,
        profile: {
          ...state.profile,
          following: following
            ? state.profile.following.filter((id) => id !== action.id)
            : [...state.profile.following, action.id],
        },
        toast: following ? null : toast('➕', `Following @${person?.handle ?? action.id}`),
      };
    }

    case 'buyPremium': {
      if (!state.profile) return state;
      // A local preview of the Premium interface, and nothing more.
      //
      // No payment provider is connected, and the database will not accept
      // this: `profiles.premium` is server-owned, mirrored from the
      // `entitlements` table, and a write from the client is coerced back to
      // the stored value. So this flag lives until the next reload, at which
      // point the real entitlement reasserts itself.
      //
      // That is the correct behaviour rather than a shortcoming. Premium has
      // to be a fact a billing system determined — see FUTURE_FEATURES.md for
      // how App Store and Play Store receipts will write it.
      const previewOnly = isBackendConfigured();
      return {
        ...state,
        profile: { ...state.profile, premium: true },
        route: state.history[state.history.length - 1] ?? 'home',
        history: state.history.slice(0, -1),
        toast: previewOnly
          ? toast('👑', 'Premium preview — payments are not connected yet')
          : toast('👑', 'Premium unlocked — no more ads!'),
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

/**
 * Mirrors relationship actions into the database.
 *
 * These live outside the reducer because a reducer must stay pure — it is
 * called during render and may run twice. The action is applied locally first
 * so the UI responds immediately, and the write follows.
 */
function mirrorToBackend(action: Action, state: AppState) {
  if (!isBackendConfigured() || !state.profile) return;
  const selfId = state.profile.id;

  switch (action.type) {
    case 'sendFriendRequest':
      void sendFriendRequest(selfId, action.id);
      break;
    case 'acceptFriendRequest':
      void respondToRequest(selfId, action.id, true);
      break;
    case 'declineFriendRequest':
      void respondToRequest(selfId, action.id, false);
      break;
    case 'toggleFollow':
      void setFollowing(selfId, action.id, !state.profile.following.includes(action.id));
      break;
    case 'markNotificationsRead':
      void markNotificationsRead(selfId);
      break;
    case 'finishSession': {
      // The summary is built by the reducer, so read it back after the fact.
      const summary = state.session ? summariseMatch(state.session) : null;
      if (summary) {
        void recordMatch(selfId, summary);
        // XP and the counters are server-owned, so they cannot ride along with
        // the profile save — that write is held at the stored value by design.
        // This is the increment the database will actually accept.
        const rounds = state.session?.results.length ?? 0;
        void recordSessionResult({
          xp: summary.xpEarned,
          rounds,
          reactionsSent: state.session?.reactions.length ?? 0,
          reactionsReceived: summary.totalReactions,
        });
      }
      break;
    }
    case 'signOut':
      void signOutRemote();
      break;
    default:
      break;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    // A stored profile means both signed in and onboarded, so a returning
    // user lands straight on Home.
    const profile = loadProfile();
    return {
      ...initialState,
      profile,
      account: profile
        ? {
            userId: profile.id,
            provider: profile.authProvider ?? 'email',
            email: profile.email,
            suggestedName: profile.displayName,
          }
        : null,
      route: profile ? ('home' as Route) : ('welcome' as Route),
      history: [],
    };
  });

  // The local copy is written on every change: it is the record when there is
  // no backend, and the warm-start cache when there is.
  useEffect(() => { saveProfile(state.profile); }, [state.profile]);

  useBackendSync(state, dispatch);

  // The state at the time of dispatch is what the mirror needs (to know, for
  // example, whether a follow is being added or removed), so it is captured
  // through a ref rather than read after the reducer has already run.
  const latest = useRef(state);
  latest.current = state;

  const dispatchAndMirror = useMemo<Dispatch<Action>>(
    () => (action: Action) => {
      mirrorToBackend(action, latest.current);
      dispatch(action);
    },
    [],
  );

  const value = useMemo(
    () => ({ state, dispatch: dispatchAndMirror }),
    [state, dispatchAndMirror],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/**
 * Keeps the database in step with the store.
 *
 * Deliberately one-directional and debounced: the reducer stays synchronous
 * and the UI never waits on the network, which is what allows the existing
 * screens to work untouched. A failed write is not fatal — the local copy
 * still holds it, and the next change retries the whole profile.
 */
function useBackendSync(state: AppState, dispatch: Dispatch<Action>) {
  const profile = state.profile;
  const hydrated = useRef(false);

  // On boot, and on OAuth return, adopt whatever the server has.
  useEffect(() => {
    if (!isBackendConfigured()) return;
    let cancelled = false;

    const adopt = async (account: AuthAccount | null) => {
      if (cancelled) return;
      if (!account) {
        hydrated.current = false;
        return;
      }
      const remote = await fetchProfile(account);
      if (cancelled) return;
      hydrated.current = true;
      if (remote) dispatch({ type: 'hydrate', profile: remote, account });
      else dispatch({ type: 'signedIn', account });
    };

    currentAccount().then(adopt);
    const unsubscribe = onAuthChange(adopt);
    return () => { cancelled = true; unsubscribe(); };
  }, [dispatch]);

  // Push profile changes back, coalesced so a burst of reducer updates during
  // a session becomes one write rather than dozens.
  useEffect(() => {
    if (!isBackendConfigured() || !profile || !hydrated.current) return;
    const timer = window.setTimeout(async () => {
      // A freshly picked photo is still a data URL; move it to Storage first
      // so the row holds a link rather than a base64 payload.
      if (profile.photo?.startsWith('data:')) {
        const url = await uploadAvatar(profile.id, profile.photo);
        if (url) {
          dispatch({ type: 'updateProfile', changes: { photo: url } });
          return;
        }
      }
      await saveProfileRemote(profile);
    }, 700);
    return () => clearTimeout(timer);
  }, [profile, dispatch]);

  return null;
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
