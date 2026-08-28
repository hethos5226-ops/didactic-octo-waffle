/**
 * A "vibe" is a slice of somebody's algorithm.
 *
 * The whole point of the app is that another person's FYP feels different from
 * yours, so a feed is not a random shuffle of stock clips: every user carries a
 * handful of vibes, and their feed is generated from those. Watch Charley's
 * feed twice and you will recognise it as *hers*.
 *
 * Nothing here is real short-form content. These are synthetic placeholder
 * "videos" that stand in for a screen share — see docs in the README.
 */

export type VibeId =
  | 'chaos'
  | 'animals'
  | 'cooking'
  | 'gym'
  | 'music'
  | 'gaming'
  | 'fits'
  | 'brainrot'
  | 'cars'
  | 'conspiracy'
  | 'cozy'
  | 'sports';

export interface Vibe {
  id: VibeId;
  label: string;
  emoji: string;
  /** Two-stop gradient used for every "video" drawn from this vibe. */
  gradient: [string, string];
  /** Emoji cast that gets animated inside the fake video frame. */
  cast: string[];
  /** Caption fragments, combined at generation time. */
  captions: string[];
  sounds: string[];
  creators: string[];
}

export const VIBES: Record<VibeId, Vibe> = {
  chaos: {
    id: 'chaos',
    label: 'Pure Chaos',
    emoji: '💀',
    gradient: ['#FF2E93', '#FF9F1C'],
    cast: ['💀', '🤡', '🔥', '😳', '🚨'],
    captions: [
      'he did NOT have to do that',
      'why is this my life',
      'bro said "trust me"',
      'this took 4 hours to set up',
      'no thoughts just vibes',
      'the last one got me',
    ],
    sounds: ['original sound - chaosdept', 'oh no oh no oh no no no', 'sped up + reverb'],
    creators: ['@unhinged.hours', '@nightshiftt', '@certified.menace'],
  },
  animals: {
    id: 'animals',
    label: 'Animals',
    emoji: '🐈',
    gradient: ['#22E1FF', '#7B2FF7'],
    cast: ['🐈', '🐕', '🦆', '🦥', '🐸'],
    captions: [
      'he thinks he is people',
      'she has been like this since tuesday',
      'the betrayal in his eyes',
      'day 4 of the standoff',
      'nobody taught him this',
    ],
    sounds: ['cute animal bgm', 'original sound - pet.diary', 'lofi cat beats'],
    creators: ['@dailydoseofdog', '@catlord.exe', '@theduckguy'],
  },
  cooking: {
    id: 'cooking',
    label: 'Food',
    emoji: '🍳',
    gradient: ['#FF9F1C', '#FFE03D'],
    cast: ['🍳', '🍜', '🧄', '🥐', '🔥'],
    captions: [
      'you are putting WHAT in it',
      '3 ingredients, 12 minutes',
      'restaurant said no. we make at home.',
      'do not skip the resting step',
      'this is illegal in 4 countries',
    ],
    sounds: ['kitchen asmr', 'original sound - lowandslow', 'that one cooking song'],
    creators: ['@lowandslow', '@fridge.raid', '@nonna.would.cry'],
  },
  gym: {
    id: 'gym',
    label: 'Gym',
    emoji: '🏋️',
    gradient: ['#C6FF3D', '#22E1FF'],
    cast: ['🏋️', '💪', '🧊', '⛓️', '📈'],
    captions: [
      'week 6 vs week 26',
      'form check, be honest',
      'PR or ER',
      'nobody is looking at you',
      'the secret is showing up bored',
    ],
    sounds: ['phonk gym mix', 'original sound - liftlogic', 'hard beat 140bpm'],
    creators: ['@liftlogic', '@quietprogress', '@formcheck.daily'],
  },
  music: {
    id: 'music',
    label: 'Music',
    emoji: '🎧',
    gradient: ['#7B2FF7', '#FF2E93'],
    cast: ['🎧', '🎸', '🎹', '🎤', '🪩'],
    captions: [
      'the drop at 0:14',
      'made this in one sitting',
      'name a better bridge, ill wait',
      'played it for my mum, she cried',
      'unreleased, be nice',
    ],
    sounds: ['original sound - bedroomtapes', 'demo v3 FINAL final', 'live loop'],
    creators: ['@bedroomtapes', '@four.on.the.floor', '@synthgremlin'],
  },
  gaming: {
    id: 'gaming',
    label: 'Gaming',
    emoji: '🎮',
    gradient: ['#22E1FF', '#C6FF3D'],
    cast: ['🎮', '🕹️', '🏆', '👾', '🧩'],
    captions: [
      '0.4 seconds left',
      'i have 900 hours and still do this',
      'clutch or kick',
      'the physics in this game',
      'ranked is a scam',
    ],
    sounds: ['clip audio', 'original sound - lategamer', 'hype horn'],
    creators: ['@lategamer', '@one.more.round', '@pixel.panic'],
  },
  fits: {
    id: 'fits',
    label: 'Fits',
    emoji: '🧥',
    gradient: ['#FF2E93', '#7B2FF7'],
    cast: ['🧥', '👟', '🕶️', '💅', '🪞'],
    captions: [
      'rate it 1-10 be honest',
      'thrifted the whole thing',
      'shoes ruined it and i know',
      'one outfit, five ways',
      'i wore this to the shops',
    ],
    sounds: ['runway audio', 'original sound - fitcheck.daily', 'slowed + reverb'],
    creators: ['@fitcheck.daily', '@thrift.goblin', '@mirrorselfie'],
  },
  brainrot: {
    id: 'brainrot',
    label: 'Brainrot',
    emoji: '🧠',
    gradient: ['#C6FF3D', '#FF2E93'],
    cast: ['🧠', '🫠', '📉', '🌀', '🥴'],
    captions: [
      'i have not blinked in 40 minutes',
      'this is what my brain does at 2am',
      'subway surfers under this',
      'zero information, maximum sound',
      'why did i watch this 6 times',
    ],
    sounds: ['ambient screaming', 'original sound - scrollrot', 'that sound again'],
    creators: ['@scrollrot', '@2am.thoughts', '@no.notes'],
  },
  cars: {
    id: 'cars',
    label: 'Cars',
    emoji: '🏎️',
    gradient: ['#FF9F1C', '#FF2E93'],
    cast: ['🏎️', '🔧', '🛞', '⛽', '🧰'],
    captions: [
      'she is finally running',
      '£200 fix, watch',
      'that noise is not supposed to happen',
      'project car day 143',
      'do not buy this car',
    ],
    sounds: ['engine bay asmr', 'original sound - garagediary', 'heavy bass'],
    creators: ['@garagediary', '@rustbucket.rescue', '@one.more.mod'],
  },
  conspiracy: {
    id: 'conspiracy',
    label: 'Deep Lore',
    emoji: '🛸',
    gradient: ['#7B2FF7', '#22E1FF'],
    cast: ['🛸', '🔭', '📼', '🗺️', '🕯️'],
    captions: [
      'part 4 of 9, start at part 1',
      'nobody talks about this',
      'i am not saying aliens but',
      'the timeline does not add up',
      'they deleted the original',
    ],
    sounds: ['dramatic strings', 'original sound - deep.lore', 'ominous hum'],
    creators: ['@deep.lore', '@unsolved.tonight', '@archive.tapes'],
  },
  cozy: {
    id: 'cozy',
    label: 'Cozy',
    emoji: '🕯️',
    gradient: ['#FFE03D', '#FF9F1C'],
    cast: ['🕯️', '☕', '🧶', '🪴', '📚'],
    captions: [
      'slow morning, no talking',
      'reset the flat with me',
      'rain on the window for 30 seconds',
      'my whole personality in one shelf',
      'nothing happens in this video',
    ],
    sounds: ['rain + piano', 'original sound - slowsunday', 'soft lofi'],
    creators: ['@slowsunday', '@tinyflat', '@one.plant.more'],
  },
  sports: {
    id: 'sports',
    label: 'Sports',
    emoji: '⚽',
    gradient: ['#22E1FF', '#FF9F1C'],
    cast: ['⚽', '🏀', '🥅', '🏉', '📣'],
    captions: [
      'watch the defender give up',
      'from the halfway line',
      'commentator lost his mind',
      'still not over this',
      'the crowd reaction is everything',
    ],
    sounds: ['stadium audio', 'original sound - lastminute', 'commentary clip'],
    creators: ['@lastminute.fc', '@bench.cam', '@fullsend.sports'],
  },
};

export const VIBE_LIST: Vibe[] = Object.values(VIBES);
