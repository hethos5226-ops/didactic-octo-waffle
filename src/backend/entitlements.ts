import { supabase } from './client';

/**
 * Premium, as a fact rather than a claim.
 *
 * The client reads this and never writes it. That is enforced in the database
 * — `entitlements` has a select policy and no others, so any browser role is
 * refused — and it is the reason Premium is trustworthy: a subscription is
 * something a billing system determined, not something the app decided about
 * itself.
 *
 * Nothing here talks to a payment provider, because none is connected. When
 * one is, it changes only who writes the row: the App Store or Play Store
 * notifies a server function, that function validates the receipt with Apple
 * or Google using a key that never leaves it, and writes the entitlement with
 * the service role. The client keeps reading exactly this. See
 * FUTURE_FEATURES.md.
 */

export type EntitlementTier = 'free' | 'premium';
export type EntitlementStatus = 'none' | 'active' | 'grace' | 'expired' | 'cancelled';

export interface Entitlement {
  tier: EntitlementTier;
  status: EntitlementStatus;
  source: 'none' | 'app_store' | 'play_store' | 'promo' | 'manual';
  expiresAt: Date | null;
}

export const FREE: Entitlement = {
  tier: 'free',
  status: 'none',
  source: 'none',
  expiresAt: null,
};

/**
 * The signed-in user's entitlement.
 *
 * Falls back to free rather than throwing. An entitlement that cannot be read
 * — offline, or no backend configured — must never fail open into Premium.
 */
export async function fetchEntitlement(): Promise<Entitlement> {
  const client = supabase();
  if (!client) return FREE;

  const { data, error } = await client
    .from('entitlements')
    .select('tier, status, source, expires_at')
    .maybeSingle();

  if (error || !data) return FREE;

  const expiresAt = data.expires_at ? new Date(data.expires_at) : null;

  // Expiry is checked here as well as in the database, so a stale row cannot
  // present as Premium in the moment before the server catches up.
  const live = (data.status === 'active' || data.status === 'grace')
    && (!expiresAt || expiresAt.getTime() > Date.now());

  return {
    tier: live && data.tier === 'premium' ? 'premium' : 'free',
    status: data.status as EntitlementStatus,
    source: data.source as Entitlement['source'],
    expiresAt,
  };
}

export function isPremium(entitlement: Entitlement): boolean {
  return entitlement.tier === 'premium';
}
