#!/usr/bin/env node
/**
 * Checks that the Supabase project is reachable and the migration has been
 * applied. Run with `npm run check:backend`.
 *
 * Everything here uses the public anon key only. It never asks for, reads, or
 * accepts the service-role key or the database password — and it actively
 * refuses to run if it detects one, because a service key in a client env file
 * is a real problem worth stopping for rather than warning about.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const OFF = '\x1b[0m';

let failed = 0;
const pass = (msg, detail) => console.log(`${GREEN}  PASS${OFF}  ${msg}${detail ? `${DIM}  ${detail}${OFF}` : ''}`);
const fail = (msg, detail) => { failed++; console.log(`${RED}  FAIL${OFF}  ${msg}${detail ? `\n        ${detail}` : ''}`); };
const warn = (msg, detail) => console.log(`${YELLOW}  WARN${OFF}  ${msg}${detail ? `\n        ${detail}` : ''}`);

/** Minimal .env parser — no dependency, and Vite is not running here. */
function readEnvFile(path) {
  const out = {};
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip matching quotes, which people paste in without thinking about it.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * A legacy Supabase key is a JWT whose payload names the role in clear text,
 * so the dangerous case can be detected without any secret knowledge.
 */
function keyRole(key) {
  if (key.startsWith('sb_secret_')) return 'service_role';
  if (key.startsWith('sb_publishable_')) return 'anon';
  if (!key.startsWith('eyJ')) return 'unknown';
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString('utf8'));
    return payload.role ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

console.log('\nSCROLL — backend check\n');

const env = { ...readEnvFile('.env.local'), ...readEnvFile('.env'), ...process.env };
const url = (env.VITE_SUPABASE_URL ?? '').trim();
const key = (env.VITE_SUPABASE_ANON_KEY ?? '').trim();

if (!url || !key) {
  fail(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not both set',
    'Create .env.local (copy .env.example) and fill both in from\n        Supabase → Project Settings → API.',
  );
  console.log('\nNothing else can be checked without them.\n');
  process.exit(1);
}
pass('environment variables found', '.env.local');

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  warn('VITE_SUPABASE_URL does not look like a Supabase project URL', `got: ${url}`);
} else {
  pass('project URL looks right', url);
}

const role = keyRole(key);
if (role === 'service_role') {
  fail(
    'That is the SERVICE ROLE key, not the anon key',
    'The service-role key bypasses row-level security completely and must never\n' +
    '        be in a client app. Remove it from .env.local, rotate it in the Supabase\n' +
    '        dashboard, and use the anon / publishable key instead.',
  );
  console.log('\nStopping — this needs fixing before anything else.\n');
  process.exit(1);
}
if (role === 'anon') pass('key is the anon / publishable key', 'safe to ship in a client');
else warn('could not identify the key type', 'carry on, but make sure it is the anon key, not service role');

const supabase = createClient(url, key, { auth: { persistSession: false } });

// ── Reachability ──────────────────────────────────────────────────────────
try {
  const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, { headers: { apikey: key } });
  if (res.ok) pass('auth service reachable');
  else fail(`auth service returned HTTP ${res.status}`, 'Check the URL and that the project is not paused.');
} catch (e) {
  fail('cannot reach the project', `${e.message}\n        Check the URL, and that the project is running (free projects pause when idle).`);
  console.log('');
  process.exit(1);
}

// ── Schema ────────────────────────────────────────────────────────────────
const TABLES = ['profiles', 'friend_requests', 'follows', 'notifications', 'matches'];
for (const table of TABLES) {
  const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  // A missing table is reported by PostgREST as 42P01; anything else here is
  // a policy or transport problem, not a missing migration.
  if (!error) pass(`table "${table}" exists and is readable`);
  else if (error.code === '42P01') {
    fail(`table "${table}" is missing`, 'Run supabase/migrations/0001_init.sql in the SQL Editor.');
  } else if (error.code === '42501' || /permission|policy/i.test(error.message)) {
    // Expected for the private tables when signed out — that is RLS working.
    pass(`table "${table}" exists`, 'not readable while signed out (row-level security)');
  } else {
    fail(`table "${table}": ${error.message}`, `code: ${error.code ?? 'none'}`);
  }
}

// ── Storage ───────────────────────────────────────────────────────────────
{
  const { error } = await supabase.storage.from('avatars').list('', { limit: 1 });
  if (!error) pass('storage bucket "avatars" exists');
  else if (/not found|does not exist/i.test(error.message)) {
    fail('storage bucket "avatars" is missing', 'Re-run the migration; it creates the bucket.');
  } else {
    warn(`storage check inconclusive: ${error.message}`);
  }
}

// ── Row-level security ────────────────────────────────────────────────────
// A signed-out client must not be able to create a profile. If this succeeds,
// the policies are not doing their job and the data is open to anyone.
{
  const { error } = await supabase
    .from('profiles')
    .insert({ id: '00000000-0000-0000-0000-000000000000', handle: 'rlsprobe' });
  if (error) pass('row-level security is rejecting anonymous writes', error.code ?? '');
  else {
    fail(
      'an anonymous client was able to INSERT into profiles',
      'Row-level security is not protecting the table. Re-run the migration and\n' +
      '        check that RLS is enabled on public.profiles.',
    );
    // Clean up so a failed check does not leave a stray row behind.
    await supabase.from('profiles').delete().eq('handle', 'rlsprobe');
  }
}

// ── Providers ─────────────────────────────────────────────────────────────
for (const provider of ['google', 'apple']) {
  try {
    const res = await fetch(
      `${url.replace(/\/$/, '')}/auth/v1/authorize?provider=${provider}`,
      { redirect: 'manual', headers: { apikey: key } },
    );
    // A configured provider redirects to the vendor; an unconfigured one
    // answers with an error rather than a redirect.
    if (res.status >= 300 && res.status < 400) pass(`${provider} sign-in is enabled`);
    else console.log(`${DIM}  ----  ${provider} sign-in is not enabled yet (expected until you configure it)${OFF}`);
  } catch {
    warn(`could not check the ${provider} provider`);
  }
}

console.log('');
if (failed === 0) {
  console.log(`${GREEN}Backend is connected and the schema is in place.${OFF}`);
  console.log(`${DIM}Next: npm run dev, then create an account with Continue with Email.${OFF}\n`);
} else {
  console.log(`${RED}${failed} check${failed === 1 ? '' : 's'} failed — see above.${OFF}\n`);
  process.exit(1);
}
