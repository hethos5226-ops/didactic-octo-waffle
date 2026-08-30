/**
 * Advertising, switched off.
 *
 * SCROLLR will eventually need revenue, and advertising is a legitimate way to
 * get it. What this file exists to prevent is the version of that which is
 * easy to build and hard to undo: an ad system that watches what people do,
 * builds a profile, and sells it. Once behavioural targeting is in the data
 * model it is very difficult to take back out, because the business starts
 * depending on it.
 *
 * So the boundary is drawn now, while nothing depends on it. An ad placement
 * here knows the screen it is on and nothing about the person looking at it.
 * There is no user id in a request, no cross-session identifier, no interest
 * vector, no cookie. That constraint costs revenue per impression and it is a
 * deliberate trade — see PRIVACY.md.
 *
 * Nothing is active. There is no provider, no network call and no money.
 */

/** Where an ad may appear. Fixed and few, so frequency stays controllable. */
export type AdPlacement = 'session_break' | 'results_footer' | 'home_banner';

/**
 * What an ad request may carry.
 *
 * The absence is the design. Contextual signals only: which surface, and the
 * coarse locale needed to serve something in the right language and obey the
 * right rules. No identifier of any kind, which is what makes it impossible
 * for this to grow into a profile later without someone deliberately widening
 * the type — and a reviewer noticing.
 */
export interface AdContext {
  placement: AdPlacement;
  /** e.g. "en-AU". Coarse by construction; never a precise location. */
  locale: string;
}

export interface AdCreative {
  id: string;
  advertiser: string;
  headline: string;
  body: string;
  clickUrl: string;
  /** Always shown. An ad a person cannot identify as an ad is a dark pattern. */
  disclosure: 'Sponsored';
}

/** Counted in aggregate per creative. Never per person. */
export interface AdMetricsSink {
  impression(creativeId: string, placement: AdPlacement): void;
  click(creativeId: string, placement: AdPlacement): void;
}

export interface AdProvider {
  id: string;
  enabled: boolean;
  request(context: AdContext): Promise<AdCreative | null>;
}

/**
 * Frequency limits, decided locally.
 *
 * Kept on the device on purpose: capping how often someone sees an ad needs
 * only a count, and a count does not have to be uploaded to work. Doing it
 * server-side would mean logging every impression against a user, which is
 * the profile this file exists to avoid.
 */
export const AD_FREQUENCY = {
  minSecondsBetweenAds: 180,
  maxPerSession: 3,
} as const;

/** The only provider that exists: one that never returns an ad. */
const disabled: AdProvider = {
  id: 'none',
  enabled: false,
  async request() {
    return null;
  },
};

let provider: AdProvider = disabled;

export function adProvider(): AdProvider {
  return provider;
}

/**
 * Swapping in a real provider later.
 *
 * Deliberately a function rather than a build flag, so turning ads on is an
 * explicit act in code review. Any provider passed here must satisfy the
 * contextual-only contract above; a network that requires a stable user
 * identifier does not qualify, however good its rates are.
 */
export function setAdProvider(next: AdProvider): void {
  provider = next;
}

export function adsEnabled(): boolean {
  return provider.enabled;
}
