import type { Playback, VideoRef, VideoSourceAdapter, VideoSourceId } from './types';

/**
 * The registry of video sources.
 *
 * Every provider SCROLL might ever play from is declared here, including the
 * ones that are switched off, because a declared-and-disabled source is honest
 * about the shape of the work while an undeclared one invites a session screen
 * to special-case a provider later. Each carries the reason it is off, and
 * those reasons are the real technical and legal limits rather than a
 * placeholder — FUTURE_FEATURES.md goes into them properly.
 *
 * Only `sample` is on. That is not a limitation to be fixed quickly: hosting
 * or embedding third-party video is where the costs and the terms-of-service
 * risk both live, and SCROLL works without either.
 */

/** The built-in demo content the prototype already plays. */
const sample: VideoSourceAdapter = {
  id: 'sample',
  name: 'Built-in sample content',
  enabled: true,
  rights: 'owned',
  toPlayback(ref: VideoRef): Playback {
    // `externalId` is a vibe id — the procedurally generated cards in
    // src/data/feed.ts. Nothing is fetched and nothing is third-party.
    return { kind: 'builtin', vibeId: ref.externalId };
  },
};

/**
 * Video SCROLL would host itself.
 *
 * Off because hosting is the one architectural decision that turns a free
 * prototype into a monthly bill: storage grows and never shrinks, and egress
 * is charged per view, so cost scales with popularity rather than with
 * revenue. Nothing about SCROLL needs it — the shared experience does not
 * depend on owning the pixels.
 */
const scrollHosted: VideoSourceAdapter = {
  id: 'scroll',
  name: 'SCROLL-hosted',
  enabled: false,
  rights: 'owned',
  disabledReason:
    'Hosting video means storage and per-view egress costs. Not needed for the shared-viewing experience.',
  toPlayback(): Playback {
    return { kind: 'unavailable', reason: 'SCROLL does not host video.' };
  },
};

/**
 * YouTube.
 *
 * The most realistic first real integration, and the only mainstream platform
 * with a documented embed player whose terms permit third-party sites to use
 * it. Still off because "permitted" is not "implemented", and because Shorts
 * playback inside an iframe has its own constraints worth confirming before
 * anything depends on it.
 */
const youtube: VideoSourceAdapter = {
  id: 'youtube',
  name: 'YouTube',
  enabled: false,
  rights: 'embed_permitted',
  disabledReason: 'Adapter not built. The IFrame Player API is the sanctioned route.',
  toPlayback(ref: VideoRef): Playback {
    if (!ref.embedUrl) return { kind: 'unavailable', reason: 'No embed URL on this reference.' };
    return { kind: 'embed', url: ref.embedUrl, aspect: 9 / 16 };
  },
};

/**
 * Instagram.
 *
 * The original idea was for SCROLL to reflect someone's own Reels feed. That
 * is not something the platform offers: there is no API, public or partner,
 * that returns a user's personal recommendation feed, and obtaining one by
 * automating the app would breach Meta's terms and put both SCROLL and its
 * users at risk. What does exist is oEmbed for *public* posts, behind an
 * approved Meta app and App Review.
 *
 * So the honest position is link-only until an approved app exists, and even
 * then it is individual public posts, never a feed.
 */
const instagram: VideoSourceAdapter = {
  id: 'instagram',
  name: 'Instagram',
  enabled: false,
  rights: 'link_only',
  disabledReason:
    'No API returns a personal Reels feed. Public-post oEmbed needs an approved Meta app and App Review.',
  toPlayback(ref: VideoRef): Playback {
    return ref.url
      ? { kind: 'link', url: ref.url, reason: 'Instagram posts open on Instagram.' }
      : { kind: 'unavailable', reason: 'No link on this reference.' };
  },
};

/**
 * TikTok.
 *
 * Same shape as Instagram: an embed SDK exists for individual public videos,
 * and nothing exists for reading a person's For You feed. The Display API
 * returns a user's *own* posted videos after they authorise it, which is a
 * different thing from what they watch.
 */
const tiktok: VideoSourceAdapter = {
  id: 'tiktok',
  name: 'TikTok',
  enabled: false,
  rights: 'link_only',
  disabledReason:
    'No API exposes a For You feed. The Display API covers a user’s own posts only, after they authorise it.',
  toPlayback(ref: VideoRef): Playback {
    return ref.url
      ? { kind: 'link', url: ref.url, reason: 'TikTok videos open on TikTok.' }
      : { kind: 'unavailable', reason: 'No link on this reference.' };
  },
};

const ADAPTERS: Record<VideoSourceId, VideoSourceAdapter> = {
  sample,
  scroll: scrollHosted,
  youtube,
  instagram,
  tiktok,
};

export function videoSource(id: VideoSourceId): VideoSourceAdapter {
  return ADAPTERS[id] ?? scrollHosted;
}

export function allVideoSources(): VideoSourceAdapter[] {
  return Object.values(ADAPTERS);
}

export function enabledVideoSources(): VideoSourceAdapter[] {
  return allVideoSources().filter((s) => s.enabled);
}

/**
 * Turn a reference into something the player can show.
 *
 * The single entry point the session system uses, and the reason it never
 * needs to know which provider it is dealing with. A reference from a source
 * that has since been switched off resolves to `unavailable` rather than
 * throwing, so old history stays readable when an integration goes away.
 */
export function resolvePlayback(ref: VideoRef): Playback {
  const adapter = videoSource(ref.source);
  if (!adapter.enabled) {
    return {
      kind: 'unavailable',
      reason: adapter.disabledReason ?? `${adapter.name} is not enabled.`,
    };
  }
  if (adapter.rights === 'link_only' && ref.url) {
    return { kind: 'link', url: ref.url, reason: `${adapter.name} does not permit embedding.` };
  }
  return adapter.toPlayback(ref);
}

/** The reference shape for the built-in content the prototype plays today. */
export function builtinRef(vibeId: string): VideoRef {
  return {
    id: `sample:${vibeId}`,
    source: 'sample',
    externalId: vibeId,
    rights: 'owned',
    title: '',
    authorHandle: '',
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationSeconds: null,
  };
}
