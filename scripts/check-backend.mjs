#!/usr/bin/env node
/**
 * `npm run check:backend` -- does the Supabase project actually match what the
 * app expects?
 *
 * This exists because the failure modes at this stage are all quiet ones. A
 * missing table, a bucket that was never created, RLS left switched off, a key
 * pasted from the wrong row of the dashboard -- none of those announce
 * themselves. They surface later as a blank directory or, worse, as data
 * anyone can write to. So each of them gets checked here, out loud, before the
 * app is trusted with a real account.
 *
 * Everything it does is something an anonymous browser could do anyway. It
 * needs no privileged key, and it refuses to run if it finds one.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { looksPrivileged } from './privileged-key.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// -- output ---------------------------------------------------------------
const ESC = String.fromCharCode(27);
const tty = process.stdout.isTTY;
const paint = (code, s) => (tty ? `${ESC}[${code}m${s}${ESC}[0m` : s);
const bold = (s) => paint('1', s);
const dim = (s) => paint('2', s);
const green = (s) => paint('32', s);
const red = (s) => paint('31', s);
const yellow = (s) => paint('33', s);

let failures = 0;
let warnings = 0;

const pass = (label, detail) => console.log(`  ${green('PASS')} ${label}${detail ? dim(` -- ${detail}`) : ''}`);
const warn = (label, detail) => { warnings++; console.log(`  ${yellow('WARN')} ${label}${detail ? dim(` -- ${detail}`) : ''}`); };
const fail = (label, detail) => { failures++; console.log(`  ${red('FAIL')} ${label}${detail ? red(` -- ${detail}`) : ''}`); };
const skip = (label) => console.log(`  ${dim('....')} ${dim(label)}`);
const section = (title) => console.log(`\n${bold(title)}`);

/** Stops the run outright. Used only where continuing would be meaningless. */
function abort(title, lines) {
  console.log(`\n${red(bold(title))}`);
  for (const line of lines) console.log(`  ${line}`);
  console.log('');
  process.exit(1);
}

// -- environment ----------------------------------------------------------
/**
 * Reads .env.local the same way Vite does, minus the machinery. Deliberately
 * not using a dependency: this script has to be runnable before anyone has
 * thought about the dependency tree, and the format is four lines of parsing.
 */
function readEnvFile(name) {
  const path = resolve(root, name);
  if (!existsSync(path)) return null;
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return { path, values: out };
}

console.log(bold('\nSCROLL -- backend check'));

const file = readEnvFile('.env.local') ?? readEnvFile('.env');

section('Environment');
if (!file) {
  abort('No .env.local found.', [
    `Expected: ${resolve(root, '.env.local')}`,
    '',
    'Create it with:',
    dim('  cp .env.example .env.local'),
    '',
    'then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  ]);
}
pass('.env.local found', file.path.replace(`${root}/`, ''));

// The privileged-key guard runs before anything is sent anywhere.
for (const [key, value] of Object.entries(file.values)) {
  const kind = looksPrivileged(value);
  if (kind) {
    abort('Refusing to run: a privileged key is in your env file.', [
      `${key} contains ${kind}.`,
      '',
      'That key bypasses row-level security entirely. Anything holding it can',
      'read and write every row in the database, and a VITE_ variable is',
      'compiled into the JavaScript every visitor downloads.',
      '',
      'Replace it with the publishable key:',
      dim('  Supabase -> Project Settings -> API Keys -> Publishable key'),
      '',
      'Then rotate the exposed secret key in that same screen.',
    ]);
  }
}
pass('no service-role or secret key present');

const url = (file.values.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const anonKey = (file.values.VITE_SUPABASE_ANON_KEY || '').trim();

if (!url) {
  fail('VITE_SUPABASE_URL is empty');
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
  warn('VITE_SUPABASE_URL is an unusual shape', `expected https://<project-ref>.supabase.co, got ${url}`);
} else {
  pass('VITE_SUPABASE_URL set', url);
}

if (!anonKey) {
  fail('VITE_SUPABASE_ANON_KEY is empty', 'paste the publishable key into .env.local');
} else if (anonKey.startsWith('sb_publishable_')) {
  pass('VITE_SUPABASE_ANON_KEY set', 'publishable key');
} else if (anonKey.split('.').length === 3) {
  pass('VITE_SUPABASE_ANON_KEY set', 'legacy anon JWT');
} else {
  warn('VITE_SUPABASE_ANON_KEY is an unfamiliar shape', 'expected an sb_publishable_... key');
}

if (!url || !anonKey) {
  console.log('');
  console.log(red('Cannot continue without both values.'));
  console.log(dim('  Supabase -> Project Settings -> API Keys -> Publishable key'));
  console.log('');
  process.exit(1);
}

// -- requests -------------------------------------------------------------
const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

async function request(path, init = {}) {
  const started = Date.now();
  try {
    const res = await fetch(`${url}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not JSON; the text stands */ }
    return { ok: res.ok, status: res.status, text, json, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, status: 0, text: '', json: null, ms: Date.now() - started, error };
  }
}

// -- reachability ---------------------------------------------------------
section('Project');
const rootProbe = await request('/rest/v1/');

if (rootProbe.status === 0) {
  abort('Could not reach the project.', [
    String(rootProbe.error?.message ?? 'network error'),
    '',
    'Check your connection, and that VITE_SUPABASE_URL is exactly the',
    'Project URL from Supabase -> Project Settings -> API.',
  ]);
}
if (rootProbe.status === 401 || rootProbe.status === 403) {
  abort('The project is reachable, but rejected the key.', [
    `HTTP ${rootProbe.status}: ${rootProbe.json?.message ?? rootProbe.text.slice(0, 200)}`,
    '',
    'The key is probably from a different project, or lost characters when it',
    'was pasted. Copy it again from Project Settings -> API Keys.',
  ]);
}
if (!rootProbe.ok) {
  fail('unexpected response from the REST endpoint', `HTTP ${rootProbe.status}`);
} else {
  pass('project reachable and key accepted', `${rootProbe.ms} ms`);
}

// -- tables ---------------------------------------------------------------
// Every table the app reads or writes. A restrictive policy returns an empty
// array rather than an error, so 200 means "the table is there", which is the
// question being asked here.
section('Tables');
const TABLES = ['profiles', 'friend_requests', 'follows', 'notifications', 'matches'];

for (const table of TABLES) {
  const res = await request(`/rest/v1/${table}?select=id&limit=1`);
  if (res.ok) {
    pass(table);
  } else if (res.status === 404 || res.json?.code === 'PGRST205') {
    fail(table, 'not found -- has supabase/migrations/0001_init.sql been run?');
  } else if (res.status === 401 || res.status === 403) {
    // Reachable but closed to anon. Expected on the private tables; not on
    // profiles, which the directory has to be able to read.
    if (table === 'profiles') fail(table, 'anonymous reads refused, but the directory needs them');
    else pass(table, 'present, closed to anonymous reads');
  } else {
    fail(table, `HTTP ${res.status}: ${res.json?.message ?? res.text.slice(0, 120)}`);
  }
}

// -- storage --------------------------------------------------------------
section('Storage');
const bucket = await request('/storage/v1/object/list/avatars', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prefix: '', limit: 1 }),
});

if (bucket.ok) {
  pass('avatars bucket exists and is readable');
} else if (/bucket not found/i.test(bucket.text)) {
  fail('avatars bucket missing', 'the migration creates it; profile photos fail without it');
} else if (bucket.status === 400 || bucket.status === 401 || bucket.status === 403) {
  warn('avatars bucket not listable anonymously', `HTTP ${bucket.status} -- uploads may still work once signed in`);
} else {
  fail('avatars bucket check failed', `HTTP ${bucket.status}: ${bucket.text.slice(0, 120)}`);
}

// -- row-level security ---------------------------------------------------
// The check that matters most. PostgREST puts the database on the public
// internet; if RLS is not doing its job then the key in the bundle is a write
// key for the whole table, and nothing in the app would reveal that.
section('Row-level security');

const publicRead = await request('/rest/v1/profiles?select=handle&limit=1');
if (publicRead.ok) pass('profiles are publicly readable', 'the directory needs this');
else fail('profiles are not publicly readable', `HTTP ${publicRead.status}`);

const probeId = crypto.randomUUID();
const anonWrite = await request('/rest/v1/profiles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ id: probeId, handle: `rlsprobe.${probeId.slice(0, 6)}` }),
});

if (anonWrite.ok) {
  fail('an anonymous write SUCCEEDED', 'RLS is not protecting profiles -- anyone can create rows');
  console.log(`    ${red(`Remove the stray row: delete from public.profiles where id = '${probeId}';`)}`);
  console.log(`    ${red('Then re-run supabase/migrations/0001_init.sql.')}`);
} else if (anonWrite.json?.code === '42501' || anonWrite.status === 401 || anonWrite.status === 403) {
  pass('anonymous writes to profiles are refused', 'RLS is enforcing');
} else if (anonWrite.json?.code === '23503') {
  // The foreign key to auth.users stopped it first. The write was still
  // refused, but not by the policy, so this is not proof that RLS is on.
  warn('anonymous write blocked by the foreign key, not the policy', 'inconclusive; confirm RLS is enabled on profiles');
} else {
  warn('anonymous write refused for an unexpected reason', `HTTP ${anonWrite.status}: ${anonWrite.json?.message ?? anonWrite.text.slice(0, 120)}`);
}

// -- auth providers -------------------------------------------------------
section('Authentication');
const settings = await request('/auth/v1/settings');

if (!settings.ok) {
  warn('could not read auth settings', `HTTP ${settings.status}`);
} else {
  const s = settings.json ?? {};
  const external = s.external ?? {};

  if (external.email === false) fail('email provider is disabled', 'Authentication -> Providers -> Email');
  else pass('email provider enabled');

  if (s.disable_signup === true) {
    fail('signups are disabled', 'Authentication -> Providers -> allow new users to sign up');
  } else {
    pass('new signups allowed');
  }

  // Not a fault either way -- but it decides whether creating an account ends
  // signed in or ends with a link to click, which is worth knowing before the
  // first real sign-up rather than during it.
  if (s.mailer_autoconfirm === true) {
    pass('email confirmation off', 'sign-up signs you straight in');
  } else {
    pass('email confirmation on', 'sign-up sends a link; the app tells you to click it');
  }

  for (const provider of ['google', 'apple']) {
    const label = provider === 'google' ? 'Google' : 'Apple';
    if (external[provider]) pass(`${label} provider enabled`);
    else skip(`${label} provider not enabled yet -- expected for now`);
  }
}

// -- verdict --------------------------------------------------------------
console.log('');
if (failures > 0) {
  console.log(red(bold(`${failures} check${failures === 1 ? '' : 's'} failed`)) + (warnings ? dim(`, ${warnings} warning${warnings === 1 ? '' : 's'}`) : ''));
  console.log('');
  process.exit(1);
}
console.log(green(bold('All checks passed.')) + (warnings ? yellow(` ${warnings} warning${warnings === 1 ? '' : 's'} above.`) : ''));
console.log(dim('The backend is ready for a real email sign-up.'));
console.log('');
