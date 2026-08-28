/** The quick-fire reactions available while a feed is playing. */
export interface ReactionKind {
  id: string;
  emoji: string;
  label: string;
  colour: string;
  /** Which feed-score category this reaction feeds into. */
  scores: 'funny' | 'chaotic' | 'fire' | 'wtf' | 'good' | null;
}

export const REACTIONS: ReactionKind[] = [
  { id: 'funny', emoji: '😂', label: 'Funny', colour: '#FFE03D', scores: 'funny' },
  { id: 'dead', emoji: '💀', label: 'Dead', colour: '#C6FF3D', scores: 'chaotic' },
  { id: 'crying', emoji: '😭', label: "I'm crying", colour: '#22E1FF', scores: 'funny' },
  { id: 'love', emoji: '❤️', label: 'Good one', colour: '#FF2E93', scores: 'good' },
  { id: 'wtf', emoji: '🤯', label: 'WTF', colour: '#7B2FF7', scores: 'wtf' },
  { id: 'confused', emoji: '🤨', label: 'What am I watching', colour: '#FF9F1C', scores: 'wtf' },
  { id: 'fire', emoji: '🔥', label: 'Fire', colour: '#FF6B1C', scores: 'fire' },
  { id: 'skip', emoji: '👎', label: 'Skip', colour: '#8A7BB8', scores: null },
];

/** The categories people rate a whole feed on once a round ends. */
export interface ScoreCategory {
  id: 'funny' | 'chaotic' | 'fire' | 'wtf' | 'good';
  emoji: string;
  label: string;
  colour: string;
}

export const SCORE_CATEGORIES: ScoreCategory[] = [
  { id: 'funny', emoji: '😂', label: 'FUNNY', colour: '#FFE03D' },
  { id: 'chaotic', emoji: '💀', label: 'CHAOTIC', colour: '#C6FF3D' },
  { id: 'fire', emoji: '🔥', label: 'FIRE', colour: '#FF6B1C' },
  { id: 'wtf', emoji: '🤯', label: 'WTF', colour: '#7B2FF7' },
  { id: 'good', emoji: '❤️', label: 'GOOD FYP', colour: '#FF2E93' },
];
