import type { VibeId } from '../data/vibes';
import type { XpAward } from '../data/levels';
import type { AuthAccount } from '../auth/providers';

export type CategoryId = 'funny' | 'chaotic' | 'fire' | 'wtf' | 'good';

/** Running tally behind a feed-score percentage. */
export interface CategoryTally {
  points: number;
  votes: number;
}

export type Tallies = Record<CategoryId, CategoryTally>;

export interface Profile {
  id: string;
  /** @username — unique, lowercase, no spaces. */
  handle: string;
  /** The name shown above the handle; free-form, may repeat across accounts. */
  displayName: string;
  bio: string;
  /** Which provider the account came from, for the settings screen. */
  authProvider: 'apple' | 'google' | 'email' | null;
  email: string | null;
  /** Emoji face — always set, and the fallback whenever a photo is missing. */
  avatar: string;
  /** Optional profile photo as a downscaled data URL. */
  photo: string | null;
  colour: string;
  country: string;
  flag: string;
  vibes: VibeId[];
  /** Free-form interests, normalised without the leading '#'. */
  hashtags: string[];
  premium: boolean;
  xp: number;
  tallies: Tallies;
  profileLikes: number;
  friends: string[];
  /** People who have asked to be your friend and are waiting on you. */
  incomingRequests: string[];
  /** People you have asked, still waiting on them. */
  sentRequests: string[];
  notifications: AppNotification[];

  /* ── Content graph ──────────────────────────────────────────────────
     Following is separate from friends on purpose: friends are who you
     watch WITH (lobbies, invites), following is whose content you see.
     Collapsing them would mean following a stranger's reel also put them
     in your lobby invite list. */
  following: string[];
  /** Simulated inbound count; there is no server to compute a real one. */
  followerCount: number;
  likedVideos: string[];
  savedVideos: string[];
  uploadedVideos: string[];
  /** True once the intro cards have been through, so returning users skip. */
  onboarded: boolean;
  /** People who liked or friended you, newest first — shown on the profile. */
  sessionsPlayed: number;
  roundsScrolled: number;
  reactionsSent: number;
  reactionsReceived: number;
  createdAt: number;
}

export type NotificationKind = 'request' | 'accepted' | 'liked';

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  fromId: string;
  at: number;
  read: boolean;
}

export type LobbyMode = 'random' | 'private';
export type GroupSize = 1 | 2 | 3;

export interface Member {
  id: string;
  handle: string;
  avatar: string;
  photo: string | null;
  colour: string;
  country: string;
  flag: string;
  level: number;
  feedScore: number;
  vibes: VibeId[];
  hashtags: string[];
  premium: boolean;
  isMe: boolean;
  /** Which side of a duo/trio match this member arrived on. */
  team: 'yours' | 'theirs';
  ready: boolean;
}

export interface LiveReaction {
  id: number;
  reactionId: string;
  fromId: string;
  at: number;
}

export interface ChatMessage {
  id: number;
  fromId: string;
  text: string;
  at: number;
}

export interface RoundResult {
  scrollerId: string;
  scrollerHandle: string;
  isMe: boolean;
  percentages: Record<CategoryId, number>;
  feedScore: number;
  reactionCounts: Record<string, number>;
  totalReactions: number;
  topReaction: string;
  xpAwards: XpAward[];
  xpTotal: number;
  levelBefore: number;
  levelAfter: number;
}

export interface SessionState {
  mode: LobbyMode;
  groupSize: GroupSize;
  code: string | null;
  members: Member[];
  /** Scroller rotation — every member takes a turn. */
  order: string[];
  roundIndex: number;
  videosPerRound: number;
  videoIndex: number;
  reactions: LiveReaction[];
  chat: ChatMessage[];
  micMuted: boolean;
  volume: number;
  results: RoundResult[];
  /** Person ids this session that have been liked / friend-requested. */
  liked: string[];
  friended: string[];
  /** Set when a Premium member claims the first turn before the session starts. */
  claimedFirst: boolean;
}

/** The five permanent destinations. Everything else opens over the top. */
export type Tab = 'home' | 'discover' | 'create' | 'activity' | 'profile';

export type Route =
  | 'welcome'
  | 'emailAuth'
  | 'onboarding'
  | 'discover'
  | 'create'
  | 'reels'
  | 'auth'
  | 'home'
  | 'matchmaking'
  | 'lobby'
  | 'announce'
  | 'session'
  | 'rating'
  | 'results'
  | 'summary'
  | 'profile'
  | 'friends'
  | 'createLobby'
  | 'joinLobby'
  | 'premium'
  | 'editProfile'
  | 'settings'
  | 'notifications';

export interface AppState {
  profile: Profile | null;
  /** Set by sign-in, before onboarding has produced a profile. */
  account: AuthAccount | null;
  route: Route;
  tab: Tab;
  /**
   * Where "back" goes. Hard-coding each screen's back target meant Settings ▸
   * Get Premium ▸ back landed on the profile rather than back in Settings —
   * a screen reachable from two places cannot know where it came from.
   */
  history: Route[];
  /** Profile being viewed on the profile screen; null means "me". */
  viewingPersonId: string | null;
  matchmakingSize: GroupSize;
  session: SessionState | null;
  levelUpTo: number | null;
  toast: { emoji: string; text: string; id: number } | null;
}
