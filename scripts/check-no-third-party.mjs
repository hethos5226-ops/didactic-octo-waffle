#!/usr/bin/env node
/**
 * Fails the build if the site would contact anyone but its own backend.
 *
 * SCROLL's privacy policy tells people there is no third-party tracking, no
 * analytics and no external script. That promise is only worth anything if
 * something checks it, because the way it gets broken is not malice — it is a
 * font tag, an icon CDN, an embed snippet, each of which looks harmless and
 * each of which quietly hands every visitor's IP address and User-Agent to a
 * company they never chose.
 *
 * That is exactly what happened here: a `<link>` to fonts.googleapis.com sat in
 * index.html while PRIVACY.md said the only host contacted was the project's
 * own Supabase. The font is now self-hosted, and this exists so the gap cannot
 * reopen without someone deliberately editing the allowlist.
 *
 * Run over the built output, because what matters is what ships.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

/**
 * Hosts the shipped site may legitimately reach.
 *
 * Deliberately tiny, and deliberately not a pattern. Adding an entry should
 * take a moment's thought and show up in a diff — that friction is the point.
 */
const ALLOWED = [
  // The project's own Supabase. The hostname varies by project, so the shape
  // is matched rather than one specific ref.
  /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i,
  // Not a network destination: the XML namespace URN in inline SVG. Browsers
  // never fetch it.
  /^http:\/\/www\.w3\.org$/i,
  // Vite's dev-server placeholder, which never appears in a served page.
  /^http:\/\/localhost$/i,
];

/**
 * Hosts that appear only in human-readable text — documentation links in the
 * legal pages, and comments. They are not fetched, but they are also not worth
 * silently ignoring, so they are listed rather than pattern-matched away.
 */
const TEXT_ONLY = [
  /^https:\/\/supabase\.com$/i,
  /^https:\/\/github\.com$/i,
  /^https:\/\/react\.dev$/i,
  /^https:\/\/scroll\.app$/i,
];

const isAllowed = (h) => ALLOWED.some((r) => r.test(h)) || TEXT_ONLY.some((r) => r.test(h));

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(js|mjs|css|html|json)$/i.test(entry)) files.push(path);
  }
};

try {
  walk(dist);
} catch {
  console.error('No dist/ to check. Run `npm run build` first.');
  process.exit(2);
}

const offenders = new Map();

for (const path of files) {
  const text = readFileSync(path, 'utf8');
  for (const match of text.match(/https?:\/\/[a-zA-Z0-9.-]+/g) ?? []) {
    if (isAllowed(match)) continue;
    const where = path.replace(`${root}/`, '');
    if (!offenders.has(match)) offenders.set(match, new Set());
    offenders.get(match).add(where);
  }
}

if (offenders.size) {
  console.error('');
  console.error('REFUSING TO SHIP: the build references a third-party host.');
  console.error('');
  for (const [host, where] of offenders) {
    console.error(`  ${host}`);
    for (const w of where) console.error(`      in ${w}`);
  }
  console.error('');
  console.error('Every host here receives the IP address and User-Agent of');
  console.error('anyone who opens SCROLL. PRIVACY.md promises that does not');
  console.error('happen, so either self-host the resource or, if the reference');
  console.error('is genuinely safe, add it to the allowlist in this file with');
  console.error('a comment saying why.');
  console.error('');
  process.exit(1);
}

console.log(`Third-party scan: ${files.length} files, no unexpected hosts.`);
