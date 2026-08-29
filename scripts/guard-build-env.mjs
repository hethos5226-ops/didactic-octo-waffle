#!/usr/bin/env node
/**
 * Guards the Pages build.
 *
 * `vite build` bakes every VITE_ variable into the JavaScript it emits, so
 * whatever is in the environment at build time is published to everyone who
 * opens the site. That is fine and intended for the publishable key, which is
 * public by design and backed by row-level security. It would be a disaster
 * for a service-role key, and the mistake is an easy one: the two live side by
 * side in the same Supabase screen, and pasting the wrong one into a GitHub
 * secret produces a build that looks completely normal.
 *
 * So the key is inspected before the build, and the emitted bundle is scanned
 * afterwards. The second pass is not redundant: it catches a privileged key
 * arriving from anywhere, not just from the variable this script knows about.
 *
 * Two modes:
 *   node scripts/guard-build-env.mjs             before the build
 *   node scripts/guard-build-env.mjs --scan-dist after it
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { looksPrivileged } from './privileged-key.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scanning = process.argv.includes('--scan-dist');

function die(lines) {
  console.error('');
  for (const line of lines) console.error(line);
  console.error('');
  process.exit(1);
}

// -- after the build: read what was actually published --------------------
if (scanning) {
  const dist = resolve(root, 'dist');
  const offenders = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!/\.(js|mjs|css|html|json|map)$/i.test(entry)) continue;

      const text = readFileSync(path, 'utf8');

      // Deliberately not a bare `includes('sb_secret_')`. supabase-js carries
      // that prefix as a string literal in its own key-format detection, so a
      // substring search flags every build that bundles the library. What
      // matters is a prefix followed by actual key material.
      for (const candidate of text.match(/sb_secret_[A-Za-z0-9_-]{8,}/g) ?? []) {
        offenders.push(`${path.replace(`${root}/`, '')} contains ${candidate.slice(0, 18)}...`);
      }
      // A service-role JWT, found by its payload rather than by guessing at
      // the surrounding punctuation in minified output.
      for (const candidate of text.match(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g) ?? []) {
        const kind = looksPrivileged(candidate);
        if (kind) offenders.push(`${path.replace(`${root}/`, '')} contains ${kind}`);
      }
    }
  };

  try {
    walk(dist);
  } catch (error) {
    die([`Could not scan dist/: ${error.message}`]);
  }

  if (offenders.length) {
    die([
      'REFUSING TO PUBLISH: a privileged key is in the built bundle.',
      '',
      ...offenders.map((o) => `  ${o}`),
      '',
      'This build must not be deployed. Rotate that key in Supabase now:',
      '  Project Settings -> API Keys',
      '',
      'Then correct the VITE_SUPABASE_ANON_KEY repository secret so it holds',
      'the publishable key instead.',
    ]);
  }

  console.log('Bundle scan: no privileged keys in dist/.');
  process.exit(0);
}

// -- before the build: inspect what the build will bake in ----------------
const url = (process.env.VITE_SUPABASE_URL || '').trim();
const key = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();

const kind = looksPrivileged(key);
if (kind) {
  die([
    'REFUSING TO BUILD: VITE_SUPABASE_ANON_KEY holds a privileged key.',
    '',
    `It contains ${kind}.`,
    '',
    'A VITE_ variable is compiled into the JavaScript every visitor of the',
    'published site downloads. That key bypasses row-level security, so',
    'publishing it would hand the whole database to anyone who looked.',
    '',
    'Set the secret to the publishable key instead:',
    '  Supabase -> Project Settings -> API Keys -> Publishable key',
    '',
    'If this key was ever committed or deployed, rotate it in that screen.',
  ]);
}

// Neither variable set is a valid, deliberate state: the app runs
// device-locally, exactly as it did before a project existed. Worth saying
// clearly in the log, because the resulting site looks fine and a person
// checking whether the secret took effect has no other signal.
if (!url && !key) {
  console.log('No Supabase variables set -- building in device-local mode.');
  console.log('To connect the deployed site, set the repository variable');
  console.log('VITE_SUPABASE_URL and the repository secret VITE_SUPABASE_ANON_KEY.');
  process.exit(0);
}

// Half-configured is the quiet failure worth catching. The app treats one
// missing value as "no backend", so the build would succeed and the site
// would silently stay device-local.
if (!url || !key) {
  die([
    'Supabase is half-configured, so the deployed site would silently fall',
    'back to device-local accounts.',
    '',
    `  VITE_SUPABASE_URL       ${url ? 'set' : 'MISSING (repository variable)'}`,
    `  VITE_SUPABASE_ANON_KEY  ${key ? 'set' : 'MISSING (repository secret)'}`,
    '',
    'Set both, or neither.',
  ]);
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url.replace(/\/+$/, ''))) {
  die([
    `VITE_SUPABASE_URL does not look like a Supabase project URL: ${url}`,
    '',
    'Expected https://<project-ref>.supabase.co, copied from',
    '  Supabase -> Project Settings -> API',
  ]);
}

if (!key.startsWith('sb_publishable_') && key.split('.').length !== 3) {
  die([
    'VITE_SUPABASE_ANON_KEY is not a shape this project recognises.',
    '',
    'Expected a key starting `sb_publishable_` (or a legacy anon JWT).',
    'Check the secret was pasted whole, with no quotes or trailing spaces.',
  ]);
}

// The key itself is never printed. It is public by design, but the log is a
// different audience from the bundle and there is no reason to put it there.
console.log(`Supabase configured -- building against ${url}`);
console.log(`Key shape: ${key.startsWith('sb_publishable_') ? 'publishable' : 'legacy anon JWT'}.`);
