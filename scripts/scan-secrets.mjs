#!/usr/bin/env node
/**
 * Scans the repository for a privileged Supabase key.
 *
 * The build guard only sees what a build emitted, so a secret committed to a
 * file the bundle never imports would sail past it. This looks at the tracked
 * files themselves.
 *
 * Not a grep, deliberately. A pattern like `service_role` matches this
 * project's own security documentation — the first version of this check was a
 * grep in the CI workflow and it failed on the comment in privileged-key.mjs
 * explaining what to look for. Matching *prose about* secrets rather than
 * secrets is worse than useless: it trains you to ignore the alarm.
 *
 * So it reuses the same detector the build guard and the backend check use.
 * A JWT is only flagged once its payload decodes and actually says
 * service_role, and an `sb_secret_` prefix is only flagged when real key
 * material follows it.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { looksPrivileged } from './privileged-key.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Only tracked files. Anything untracked cannot have been committed, and
// .env.local is deliberately untracked.
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const findings = [];

for (const file of files) {
  const path = resolve(root, file);
  try {
    if (statSync(path).size > 2_000_000) continue;
  } catch {
    continue;
  }

  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    continue; // binary, or unreadable
  }

  // A prefix followed by actual key material, not the bare prefix that appears
  // in documentation and in supabase-js's own key-format detection.
  for (const hit of text.match(/sb_secret_[A-Za-z0-9_-]{8,}/g) ?? []) {
    findings.push({ file, what: `${hit.slice(0, 18)}…` });
  }

  // JWT-shaped tokens, confirmed by decoding rather than by pattern.
  for (const token of text.match(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g) ?? []) {
    const kind = looksPrivileged(token);
    if (kind) findings.push({ file, what: kind });
  }
}

if (findings.length) {
  console.error('A privileged key is committed to this repository:');
  for (const f of findings) console.error(`  ${f.file}: ${f.what}`);
  console.error('');
  console.error('Rotate it now: Supabase -> Project Settings -> API Keys.');
  console.error('A key in git history stays in git history even after the file changes.');
  process.exit(1);
}

console.log(`Secret scan: ${files.length} tracked files, no privileged keys.`);
