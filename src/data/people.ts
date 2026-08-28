import type { VibeId } from './vibes';

export interface Person {
  id: string;
  handle: string;
  avatar: string;
  colour: string;
  country: string;
  flag: string;
  level: number;
  feedScore: number;
  vibes: VibeId[];
  /** Lines this person says in voice chat / text chat while watching. */
  chatter: string[];
}

/**
 * The strangers you get matched with. In a real build these come from the
 * matchmaking service; here they are the cast that makes a demo session feel
 * populated instead of empty.
 */
export const PEOPLE: Person[] = [
  {
    id: 'charley',
    handle: 'charley',
    avatar: '🦊',
    colour: '#FF9F1C',
    country: 'Australia',
    flag: '🇦🇺',
    level: 24,
    feedScore: 89,
    vibes: ['chaos', 'animals', 'cooking'],
    chatter: [
      'BRO WHAT IS THIS 😂',
      'nah skip this one',
      'wait wait wait watch this bit',
      'this is genuinely my whole feed',
      'i swear i did not search for this',
      'ok that one was good',
    ],
  },
  {
    id: 'jake',
    handle: 'jakeeey',
    avatar: '🐻',
    colour: '#22E1FF',
    country: 'United States',
    flag: '🇺🇸',
    level: 11,
    feedScore: 74,
    vibes: ['gaming', 'sports', 'brainrot'],
    chatter: [
      'HELP 💀',
      'my algorithm would never',
      'bro your fyp is unwell',
      'replay that',
      'why is it always the same guy',
      'ok ok ok this is fire',
    ],
  },
  {
    id: 'sarah',
    handle: 'sarahsaidwhat',
    avatar: '🐙',
    colour: '#FF2E93',
    country: 'United Kingdom',
    flag: '🇬🇧',
    level: 37,
    feedScore: 93,
    vibes: ['fits', 'music', 'cozy'],
    chatter: [
      'im crying 😭',
      'the editing on this actually',
      'no because WHY',
      'send me that',
      'this is unhinged behaviour',
      'ok your fyp is elite',
    ],
  },
  {
    id: 'noor',
    handle: 'noorish',
    avatar: '🦉',
    colour: '#C6FF3D',
    country: 'Canada',
    flag: '🇨🇦',
    level: 8,
    feedScore: 68,
    vibes: ['cozy', 'cooking', 'animals'],
    chatter: [
      'this is so calming compared to jakes',
      'i need the recipe',
      'awwww',
      'wait i follow her',
      'genuinely lovely feed',
    ],
  },
  {
    id: 'diego',
    handle: 'diegoo',
    avatar: '🐲',
    colour: '#7B2FF7',
    country: 'Spain',
    flag: '🇪🇸',
    level: 19,
    feedScore: 81,
    vibes: ['cars', 'music', 'chaos'],
    chatter: [
      'que 😭',
      'that engine sound though',
      'nah this is a classic',
      'skip skip skip',
      'my feed is 90% this',
    ],
  },
  {
    id: 'mika',
    handle: 'mikamika',
    avatar: '🐰',
    colour: '#FFE03D',
    country: 'Japan',
    flag: '🇯🇵',
    level: 45,
    feedScore: 96,
    vibes: ['brainrot', 'gaming', 'music'],
    chatter: [
      '🤯🤯🤯',
      'this is peak internet',
      'how did you find this',
      'chronically online detected',
      'i have seen this 40 times',
    ],
  },
  {
    id: 'tomas',
    handle: 'tomtom',
    avatar: '🐺',
    colour: '#22E1FF',
    country: 'Brazil',
    flag: '🇧🇷',
    level: 15,
    feedScore: 77,
    vibes: ['sports', 'gym', 'chaos'],
    chatter: [
      'GOLAÇO',
      'bro fell 😂',
      'run that back',
      'my gym feed is nothing like this',
      'respect honestly',
    ],
  },
  {
    id: 'ada',
    handle: 'adaonline',
    avatar: '🐨',
    colour: '#FF2E93',
    country: 'Nigeria',
    flag: '🇳🇬',
    level: 29,
    feedScore: 87,
    vibes: ['conspiracy', 'brainrot', 'fits'],
    chatter: [
      'part 4 of 9 he says 💀',
      'no shot you believe this',
      'ok but what if',
      'this man has a WHITEBOARD',
      'im invested now',
    ],
  },
  {
    id: 'ellis',
    handle: 'ellis.exe',
    avatar: '🦖',
    colour: '#C6FF3D',
    country: 'Ireland',
    flag: '🇮🇪',
    level: 6,
    feedScore: 62,
    vibes: ['gaming', 'chaos', 'gym'],
    chatter: [
      'wait im new to this',
      'LOL',
      'this app is so funny',
      'my feed is embarrassing dont judge',
      'add me after this',
    ],
  },
  {
    id: 'yuki',
    handle: 'yukiwoke',
    avatar: '🐼',
    colour: '#7B2FF7',
    country: 'Germany',
    flag: '🇩🇪',
    level: 33,
    feedScore: 91,
    vibes: ['music', 'cozy', 'fits'],
    chatter: [
      'the transition 🔥',
      'saving that sound',
      'your taste is unmatched',
      'nah keep scrolling',
      'this is a comfort feed',
    ],
  },
];

export const AVATARS = [
  '🦊', '🐻', '🐙', '🦉', '🐲', '🐰', '🐺', '🐨', '🦖', '🐼',
  '🐸', '🦄', '👽', '🤖', '🦆', '🐧', '🦩', '🐯', '🦥', '🐷',
];

export const COUNTRIES = [
  { name: 'Australia', flag: '🇦🇺' },
  { name: 'United States', flag: '🇺🇸' },
  { name: 'United Kingdom', flag: '🇬🇧' },
  { name: 'Canada', flag: '🇨🇦' },
  { name: 'Ireland', flag: '🇮🇪' },
  { name: 'Spain', flag: '🇪🇸' },
  { name: 'Germany', flag: '🇩🇪' },
  { name: 'France', flag: '🇫🇷' },
  { name: 'Brazil', flag: '🇧🇷' },
  { name: 'Japan', flag: '🇯🇵' },
  { name: 'South Korea', flag: '🇰🇷' },
  { name: 'Nigeria', flag: '🇳🇬' },
  { name: 'India', flag: '🇮🇳' },
  { name: 'Mexico', flag: '🇲🇽' },
  { name: 'Sweden', flag: '🇸🇪' },
  { name: 'New Zealand', flag: '🇳🇿' },
];
