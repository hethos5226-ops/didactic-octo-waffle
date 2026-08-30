import { supabase } from './client';

/**
 * Reporting, blocking, and deleting your account.
 *
 * Deliberately small. A moderation platform is a large piece of work and SCROLLR
 * has nothing to moderate yet; what it needs now is for these actions to exist
 * in the right shape, so that building the review side later is additive
 * rather than a migration of data stored the wrong way round.
 *
 * Two decisions worth naming, both enforced in the database:
 *
 *   * A block list is private to the person who made it. Publishing it would
 *     tell the blocked person they were blocked, which is the one thing
 *     blocking must not do.
 *   * Blocking actually stops something. A blocked person cannot open a friend
 *     request or a follow in either direction — checked by policy, not by the
 *     client choosing to hide a button.
 */

export type ReportReason =
  | 'harassment' | 'hate' | 'sexual' | 'violence'
  | 'spam' | 'self_harm' | 'underage' | 'copyright' | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'hate', label: 'Hate speech' },
  { id: 'sexual', label: 'Sexual content' },
  { id: 'violence', label: 'Violence or threats' },
  { id: 'self_harm', label: 'Self-harm' },
  { id: 'underage', label: 'Underage user' },
  { id: 'spam', label: 'Spam or scam' },
  { id: 'copyright', label: 'Copyright' },
  { id: 'other', label: 'Something else' },
];

export async function reportUser(
  reporterId: string,
  subjectUserId: string,
  reason: ReportReason,
  details = '',
): Promise<{ error: string | null }> {
  const client = supabase();
  if (!client) return { error: 'Reporting needs a connection.' };
  const { error } = await client.from('reports').insert({
    reporter_id: reporterId,
    subject_user_id: subjectUserId,
    reason,
    details: details.slice(0, 1000),
  });
  return { error: error?.message ?? null };
}

export async function reportVideo(
  reporterId: string,
  videoRefId: string,
  reason: ReportReason,
  details = '',
): Promise<{ error: string | null }> {
  const client = supabase();
  if (!client) return { error: 'Reporting needs a connection.' };
  const { error } = await client.from('reports').insert({
    reporter_id: reporterId,
    subject_video_id: videoRefId,
    reason,
    details: details.slice(0, 1000),
  });
  return { error: error?.message ?? null };
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  await supabase()?.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await supabase()
    ?.from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
}

export async function blockedIds(blockerId: string): Promise<string[]> {
  const client = supabase();
  if (!client) return [];
  const { data, error } = await client
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', blockerId);
  if (error || !data) return [];
  return data.map((r: { blocked_id: string }) => r.blocked_id);
}

/**
 * Deleting the account, and being honest about the part that cannot finish
 * here.
 *
 * The RPC removes the profile and everything cascading from it — friend
 * requests, follows, notifications, match history, likes, blocks, lobby seats
 * and the avatar object. What it cannot remove is the row in auth.users:
 * deleting an authentication record needs the service role, and the service
 * role must never be in a browser. That is queued, and PRIVACY.md says so
 * plainly rather than implying the account has vanished entirely.
 */
export async function deleteMyAccount(userId: string): Promise<{ error: string | null }> {
  const client = supabase();
  if (!client) return { error: 'Deleting your account needs a connection.' };

  // Remove the stored file first. The RPC clears the object row, but the bytes
  // live in Storage and only the Storage API removes those.
  await client.storage.from('avatars').remove([`${userId}/avatar.jpg`]);

  const { error } = await client.rpc('delete_my_account');
  if (error) return { error: error.message };

  await client.auth.signOut();
  return { error: null };
}
