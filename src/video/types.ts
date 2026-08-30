/**
 * What a video is, as far as SCROLL is concerned.
 *
 * SCROLL is not a video platform and this abstraction exists to keep it from
 * accidentally becoming one. The shared experience — everyone watching the
 * same thing, reacting together, the round ending and the next one starting —
 * is the product. Where the pixels came from is an implementation detail of
 * one adapter, and the session system is built so it can never learn the
 * difference.
 *
 * Concretely: nothing in a lobby, a round, a reaction or a result may branch
 * on `source`. If a screen needs to know whether something is an Instagram
 * post to work, the abstraction has failed and the fix belongs here, not in
 * the screen.
 *
 * That constraint is what makes SCROLL independent of any one platform. An
 * integration that becomes possible is a new adapter; one that disappears —
 * an API closing, terms changing — is a source switched off, with sessions,
 * scores and history unaffected.
 */

/** Registered providers. Adding one is a new adapter, not a schema change. */
export type VideoSourceId = 'sample' | 'scroll' | 'youtube' | 'instagram' | 'tiktok';

/**
 * What SCROLL is permitted to do with content from a source.
 *
 * This is a legal fact, not a technical one, and it is deliberately part of
 * the type: an adapter cannot be written without stating it, and the player
 * cannot embed something marked `link_only` by accident.
 */
export type PlaybackRights =
  /** SCROLL owns or licenses it and may play it directly. */
  | 'owned'
  /** The platform publishes an embed player and its terms permit using it. */
  | 'embed_permitted'
  /** Only a link out is permitted. No embedding, no proxying, no scraping. */
  | 'link_only';

/**
 * A reference to a video. Not the video.
 *
 * SCROLL stores where something lives and how to attribute it, and nothing
 * else. It does not hold the bytes, and the difference is the whole cost
 * model — see SCALING.md.
 */
export interface VideoRef {
  id: string;
  source: VideoSourceId;
  /** The provider's own id, unique within that provider. */
  externalId: string;
  rights: PlaybackRights;
  title: string;
  /** Who published it, for attribution. Never a SCROLL user id. */
  authorHandle: string;
  url: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
}

/**
 * How a round plays a reference.
 *
 * Returned by the adapter and consumed by the player, so the player never
 * inspects `source` either — it renders whatever kind it is handed.
 */
export type Playback =
  /** Render locally: the built-in demo content the prototype already plays. */
  | { kind: 'builtin'; vibeId: string }
  /** Drop the provider's own player in an iframe. Only for embed_permitted. */
  | { kind: 'embed'; url: string; aspect: number }
  /** Cannot be played in place; offer the viewer a link. */
  | { kind: 'link'; url: string; reason: string }
  /** The reference is known but nothing can be shown right now. */
  | { kind: 'unavailable'; reason: string };

/**
 * An adapter for one provider.
 *
 * Deliberately small. An adapter turns a reference into something playable and
 * says whether it is usable at all; it does not get to touch session state,
 * scoring or reactions, which is what stops a provider integration from
 * leaking into the parts of SCROLL that matter.
 */
export interface VideoSourceAdapter {
  id: VideoSourceId;
  name: string;
  /**
   * Off until an integration is both built and permitted. A disabled source
   * still resolves existing references — history stays readable — but yields
   * nothing new.
   */
  enabled: boolean;
  rights: PlaybackRights;
  /** Why it is off, shown in developer-facing surfaces rather than guessed at. */
  disabledReason?: string;
  toPlayback(ref: VideoRef): Playback;
}
