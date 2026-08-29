/**
 * What a privileged Supabase key looks like.
 *
 * One definition, used by both the backend check and the build guard, because
 * two copies of this would eventually disagree — and the copy that drifted
 * would be the one that let a service-role key through.
 *
 * Supabase has issued two shapes: the newer `sb_secret_` keys, and the older
 * JWTs carrying "role":"service_role" in the payload. Either one bypasses
 * row-level security completely.
 */
export function looksPrivileged(value) {
  if (!value) return false;
  if (value.startsWith('sb_secret_')) return 'a `sb_secret_` secret key';
  const parts = value.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') return 'a service_role JWT';
    } catch { /* not a JWT we can read; nothing to conclude */ }
  }
  return false;
}
