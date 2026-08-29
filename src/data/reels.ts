import type { Video } from './content';

/**
 * The placeholder feed.
 *
 * Six real H.264 files generated for this prototype — not sourced from
 * anywhere, so nothing here is anyone's content. They are genuine video files
 * rather than CSS animations on purpose: the player's autoplay, pause, seek,
 * loop and mute paths are the real ones, and swapping these for uploaded
 * videos changes only the URLs.
 *
 * `import.meta.env.BASE_URL` keeps the paths correct when the app is served
 * from a subpath such as a GitHub Pages project site.
 */
const base = import.meta.env.BASE_URL;

const day = 24 * 60 * 60 * 1000;

export const REELS: Video[] = [
  {
    id: 'reel-01',
    creatorId: 'charley',
    url: `${base}videos/reel-01.mp4`,
    urlWebm: `${base}videos/reel-01.webm`,
    thumbnail: `${base}videos/reel-01.jpg`,
    caption: 'nobody taught him this 😭 he just decided',
    audio: { id: 'aud-01', title: 'lofi cat beats', artist: '@catlord.exe', url: null },
    likes: 128_400,
    comments: 1_251,
    shares: 4_820,
    saves: 9_140,
    createdAt: Date.now() - 2 * day,
    hashtags: ['dogs', 'cats', 'memes'],
    durationSeconds: 6,
  },
  {
    id: 'reel-02',
    creatorId: 'mika',
    url: `${base}videos/reel-02.mp4`,
    urlWebm: `${base}videos/reel-02.webm`,
    thumbnail: `${base}videos/reel-02.jpg`,
    caption: 'i have not blinked in 40 minutes',
    audio: { id: 'aud-02', title: 'that sound again', artist: '@scrollrot', url: null },
    likes: 2_140_000,
    comments: 18_402,
    shares: 96_300,
    saves: 204_000,
    createdAt: Date.now() - 5 * 60 * 60 * 1000,
    hashtags: ['brainrot', 'memes'],
    durationSeconds: 6,
  },
  {
    id: 'reel-03',
    creatorId: 'tomas',
    url: `${base}videos/reel-03.mp4`,
    urlWebm: `${base}videos/reel-03.webm`,
    thumbnail: `${base}videos/reel-03.jpg`,
    caption: 'PR or ER. no in between',
    audio: { id: 'aud-03', title: 'phonk gym mix', artist: '@liftlogic', url: null },
    likes: 64_200,
    comments: 902,
    shares: 1_140,
    saves: 7_800,
    createdAt: Date.now() - 6 * day,
    hashtags: ['gym', 'football'],
    durationSeconds: 6,
  },
  {
    id: 'reel-04',
    creatorId: 'noor',
    url: `${base}videos/reel-04.mp4`,
    urlWebm: `${base}videos/reel-04.webm`,
    thumbnail: `${base}videos/reel-04.jpg`,
    caption: '3 ingredients, 12 minutes, do not skip the resting step',
    audio: { id: 'aud-04', title: 'kitchen asmr', artist: '@lowandslow', url: null },
    likes: 412_900,
    comments: 6_140,
    shares: 22_800,
    saves: 88_200,
    createdAt: Date.now() - 11 * day,
    hashtags: ['cooking', 'baking'],
    durationSeconds: 6,
  },
  {
    id: 'reel-05',
    creatorId: 'ada',
    url: `${base}videos/reel-05.mp4`,
    urlWebm: `${base}videos/reel-05.webm`,
    thumbnail: `${base}videos/reel-05.jpg`,
    caption: 'part 4 of 9. start at part 1 or none of this makes sense',
    audio: { id: 'aud-05', title: 'dramatic strings', artist: '@deep.lore', url: null },
    likes: 88_100,
    comments: 12_900,
    shares: 6_420,
    saves: 31_000,
    createdAt: Date.now() - 20 * 60 * 60 * 1000,
    hashtags: ['conspiracy', 'space', 'horror'],
    durationSeconds: 6,
  },
  {
    id: 'reel-06',
    creatorId: 'yuki',
    url: `${base}videos/reel-06.mp4`,
    urlWebm: `${base}videos/reel-06.webm`,
    thumbnail: `${base}videos/reel-06.jpg`,
    caption: 'slow morning. no talking. rain on the window.',
    audio: { id: 'aud-06', title: 'rain + piano', artist: '@slowsunday', url: null },
    likes: 301_500,
    comments: 2_880,
    shares: 14_100,
    saves: 120_400,
    createdAt: Date.now() - 3 * day,
    hashtags: ['cozy', 'plants', 'travel'],
    durationSeconds: 6,
  },
];

export function reelById(id: string): Video | undefined {
  return REELS.find((r) => r.id === id);
}

export function reelsByCreator(creatorId: string): Video[] {
  return REELS.filter((r) => r.creatorId === creatorId);
}
