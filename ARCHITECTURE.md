# SCROLLR — architecture

What SCROLLR is, how it is put together, and which parts are real.

SCROLLR is a social experience: people watch short-form video together and react
to it. It is not a video creation app, not a video host, and not another
TikTok or Instagram. **The shared viewing is the product. The video is only the
thing being watched.** Almost every decision below follows from that sentence.

Everything is marked as one of:

| Mark | Meaning |
|---|---|
| **Now** | Implemented and working |
| **Prepared** | Schema, types and boundaries exist; deliberately switched off |
| **Later** | Not built; documented so it can be |

---

## Shape

```
Browser (React + Vite, static files on GitHub Pages)
        |
        |  HTTPS, publishable key, every request untrusted
        v
Supabase
  ├── Auth        email now; Google and Apple wired, awaiting configuration
  ├── PostgREST   the database, exposed directly, guarded by RLS
  ├── Realtime    presence and (later) session sync
  └── Storage     avatars only
```

There is no application server, and that is deliberate rather than a stage to
grow out of. A server would be a fixed monthly cost at every scale, including
zero users. Supabase's free tier plus a static site means SCROLLR currently
costs nothing to run, and the parts that would eventually cost money are the
parts that only activate under real load — see [SCALING.md](SCALING.md).

The consequence is the thing to internalise: **there is no trusted middle
layer**. PostgREST puts the tables on the public internet and the key that
reaches them ships inside the JavaScript every visitor downloads. Row-level
security is not one defence among several; it is the only one.

---

## Trust

The client is an attacker's tool. It can send any request the publishable key
permits, so the design assumes it will.

**Now.** Three mechanisms, in order of importance:

1. **Row ownership** — every table has RLS, and every policy ties writes to
   `auth.uid()`. You cannot write a row that belongs to someone else.
2. **Column ownership** — owning a row is not owning every column in it. This
   was the hole `0001` left: the app upserts whole profile rows, so "you may
   write your own row" also meant "you may set `premium = true`, any `xp`, any
   `follower_count`". `0002_ownership_and_entitlements.sql` splits the row in
   two. Self-description (display name, bio, avatar, country, vibes, hashtags)
   stays writable. Outcomes (`premium`, `xp`, counters, `status`, `is_bot`) are
   held at their stored values by a trigger.
3. **Narrow write paths** — where the client legitimately needs to change a
   server-owned value, it calls a `SECURITY DEFINER` function that does one
   bounded thing: `apply_session_result` increments, capped; it cannot set.

Coercion rather than rejection is a deliberate choice for the guard. The client
round-trips the whole profile on every save, so raising an exception would turn
an ordinary profile edit into a failure whenever a counter was merely stale.
Silently holding the stored value keeps honest saves working and makes
dishonest ones a no-op.

**Tested, not assumed.** `supabase/tests/` runs the real migrations against a
real PostgreSQL and executes the attacks: forging requests, accepting other
people's friend requests, granting yourself Premium, reading other people's
notifications, uploading into someone else's avatar folder, inventing
notifications, overfilling lobbies, fabricating rounds. Every vulnerability
found in the audit has a test that reproduces it, run on every push by
`.github/workflows/ci.yml`. Reading a policy tells you what
its author intended; running it tells you what the database does.

**Later.** Server-authoritative sessions. `apply_session_result` stops the
one-request jump to any XP value, but a determined player can still call it
repeatedly. Closing that properly means the server deciding what happened in a
round, which is only worth building when there is a leaderboard worth cheating
on.

---

## Data model

`supabase/migrations/`, applied in order.

**Now — `0001_init.sql`**
`profiles`, `friend_requests`, `follows`, `notifications`, `matches`, and the
`avatars` storage bucket. Friendship is one table: an accepted request. Two
tables would have to be kept consistent with each other and would tell us
nothing extra.

**Now — `0002_ownership_and_entitlements.sql`**
`entitlements` (readable by its owner, writable by nobody through the browser),
`profile_likes` as a real table with a counting trigger, `profiles.status` and
`profiles.is_bot`, the column guard, and `apply_session_result`.

**Now — `0003_bots_and_matchmaking.sql`**
`bots`, `lobbies`, `lobby_members`, and the lobby RPCs.

**Now — `0004_video_moderation_and_deletion.sql`**
`video_sources`, `video_refs`, `lobby_rounds`, `blocks`, `reports`,
`deletion_requests`, and `delete_my_account`.

**Now — `0005_audit_fixes.sql`**
The pre-pause audit, which found seven real problems by executing attacks
rather than reading policies: `blocked_between` answered questions about two
strangers, disclosing private blocks; `touch_lobby_presence` let anyone extend
any lobby's life; lobbies had no capacity at all (a 1v1 lobby took three
players and 24 bots); a host could attribute a round to someone who was never
present; notifications could be invented and flooded; reports and match history
grew without limit. It also fixed a regression `0002` had introduced — XP was
server-owned but nothing called the sanctioned write path, so no player's
progress persisted.

---

## Real people, bots, and counting

This is the part of SCROLLR most worth getting right, because the failure mode
is so easy and so tempting: a constant in a template renders exactly like a
measurement.

**The rule.** SCROLLR never displays a number that is not true. If nobody is
online it shows zero. If four people are online it shows four. Bots are never
included.

**Now — how the schema enforces it.** A lobby seat holds either a `user_id` or
a `bot_id`, never both, enforced by a check constraint. So "how many real
players" is `count(*) where user_id is not null` — a property of the schema
rather than a filter someone has to remember. `real_member_count()` exists so
no screen has to write that clause itself. The test suite asserts the exact
case: 2 people + 3 bots reports **2**.

**Now — bots.** 200 identities, generated deterministically by `seed_bots()`.
A bot has no `auth.users` row, no password, no session and no socket. It is a
description of a character, ~144 kB for the whole roster. There is no bot
process anywhere; a bot consumes nothing until a lobby seats it, and the table
is readable by everyone and writable by no browser role, so a user cannot
invent one and a bot cannot be edited into looking like a person. `is_bot`
travels with the identity and the UI is expected to show it. Bots never
pretend to be human.

**Now — online count.** Supabase Realtime Presence, in
`src/backend/presence.ts`. Presence lives in memory and vanishes when a socket
closes, so there is nothing to store and nothing to clean up. The hook returns
`number | null`, and null means *not known yet* — the caller renders nothing
rather than a confident zero. The presence payload is empty: being present is
the whole message, because publishing handles would turn a headcount into a
"who is online right now" list nobody asked for.

**What was removed.** A hardcoded `12,480 people scrolling right now`; two
fabricated friend requests handed to every new account; follower counts derived
from a level (`4_200 + level * 1_137`); a following count of `180 + level * 3`.

And, found in the final pass, an entire fabricated statistics layer on the
profile screen. Viewing anyone else invented their Feed Score
(`62 + hash(id) % 34`), their per-category breakdown, their level, their friend
count, their rounds scrolled and their reactions received — all from a hash of
their id, all rendering exactly like measurements. Once a database was
connected these were being shown against **real people's names**. The row the
directory reads already contained the true values; `rowToDirectoryPerson` was
simply discarding them. It now carries them, and where a number is genuinely
unknown the UI shows an em dash and says "no Feed Score yet" rather than
inventing one. A crown that appeared on any simulated co-viewer above level 25
went too — nobody in the built-in cast bought a subscription.

### The name

The project was renamed from **SCROLL** to **SCROLLR** on 30 August 2026.
Everything a person can see says SCROLLR: the wordmark, the page title, every
document, every string in the app.

Four internal identifiers deliberately still read `scroll`, because renaming
them costs something and gains nothing visible:

| Identifier | Why it stayed |
|---|---|
| `scroll.account.v1`, `scroll.profile.v1` | Browser storage keys. Changing them orphans the local profile on every device that already has one — a silent data loss for no benefit. |
| `scroll.server_write` | The transaction-local flag the column guard reads. It is referenced across three migrations; missing one occurrence would silently stop counters updating, and nobody would notice until the numbers were wrong. |
| `video_sources.id = 'scroll'` | A primary key that may already exist in the deployed database. Its display name is "SCROLLR-hosted"; the key is invisible. |
| `VideoSourceId = 'scroll'` | Must match the database key above. |

If any of these is ever renamed, do it as a deliberate migration rather than a
find-and-replace — particularly `scroll.server_write`, where a partial rename
fails quietly.

Note also that `scrolling`, `scroller`, `scrolled` and `rounds_scrolled` are the
ordinary English verb and the name of a role in the game. They were never the
brand and must not be renamed.

### Known gaps, which are product decisions rather than bugs

Two things remain honestly imperfect, and both need a decision rather than a
guess:

1. **In-session XP does not fully persist.** Session XP does (`0005` wired the
   sanctioned increment) and so does social XP from real events (`0006` awards
   it by trigger). What does not is the XP granted for liking or friending a
   **simulated** co-viewer during a local session — those are not real people,
   no row is written, and the server never hears. Local XP therefore drifts
   slightly above the stored value and settles back on reload. Resolving it
   means deciding whether interacting with a bot should earn real progression;
   it disappears on its own once sessions are real.

2. **Simulated co-viewers in a session are not labelled as bots.** The
   database-backed roster carries `is_bot` and is honest everywhere it appears.
   The local prototype session still renders the built-in cast as ordinary
   people. Labelling them is a change to the session UI, which this pass was
   asked not to touch. Worth doing before anyone outside the project plays it.

---

## Matchmaking

**Now.** The service boundary and the database rules, in
`src/backend/lobbies.ts` and `0003`. The screens still run their local session
— rewiring gameplay would mean redesigning the part that already works, which
is explicitly out of scope for this pass.

The hard parts are already decided and already enforced:

- **One live seat per person**, by unique index, not by clients behaving.
- **Disconnects.** A closed browser sends nothing, so liveness is a heartbeat
  and silence is the signal. `cleanup_stale_lobbies()` releases seats after 90
  seconds of silence and abandons lobbies with nobody real left.
- **The empty-lobby race.** A lobby is necessarily empty between being created
  and its host taking a seat. Sweeping it in that window would make creating a
  lobby a race the host can lose, so emptiness only counts after two minutes.
  This bug was found by the test suite, not by reading the SQL.
- **Private lobbies are not enumerable.** Joining by code is an RPC, not a
  query. A policy permitting select-by-code would make the code space
  walkable.

Cleanup is called opportunistically from the client rather than by a scheduler,
which keeps it free. `pg_cron` can take it over later without any caller
changing.

**Later.** Shared game state and synchronised playback over Realtime — priced
per message with a free allowance, so it costs nothing while SCROLLR is small,
unlike a game server that costs the same at three players as at three thousand.

---

## Video

**The constraint that matters:** nothing in a lobby, round, reaction or result
may branch on which provider a video came from. If a screen needs to know it is
Instagram to work, the abstraction has failed and the fix belongs in the
adapter.

```
VideoRef (source + external id + rights)
    -> resolvePlayback()
    -> Playback: builtin | embed | link | unavailable
    -> the player renders whatever it is handed
```

**Now.** `src/video/types.ts` and `src/video/sources.ts`, plus `video_sources`
and `video_refs`. SCROLLR stores a *reference* — where something lives, who
published it, what SCROLLR may do with it — never the bytes. `sample` is the
only enabled source: the generated cards the prototype already plays.

**Prepared, off.** `youtube` (embed permitted, adapter not built — the most
realistic first integration), `instagram` and `tiktok` (link-only), `scroll`
(self-hosting, off because it is the decision that turns a free prototype into
a monthly bill).

`rights` is part of the type, so an adapter cannot be written without stating
what is permitted, and the player cannot embed something marked `link_only` by
accident.

This is what keeps SCROLLR independent. A platform that becomes available is a
new adapter; one that disappears is a source switched off, with sessions,
scores and history unaffected. See [FUTURE_FEATURES.md](FUTURE_FEATURES.md) for
what each platform actually permits — the short version is that **no platform
offers an API returning a user's personal recommendation feed**, so the
original "mirror your Reels" idea is not available from anyone on any terms.

---

## Premium

**Now.** `entitlements` is the source of truth. It has a select policy for its
owner and no write policy at all, so no browser role can write it. A trigger
mirrors it into `profiles.premium` for cheap reads. `has_premium()` treats a
past expiry as not-Premium, so a lapsed subscription lapses without anything
running on a timer.

The Premium screen still flips a local flag — an interface preview. The
database refuses it and the real entitlement reasserts on reload, and the toast
now says so.

**Later.** App Store and Play Store subscriptions. The client never validates a
receipt; the store notifies a server function, which validates with Apple or
Google using a key that never leaves it, and writes the entitlement with the
service role. The client keeps reading exactly what it reads now.

---

## Advertising

**Prepared, off.** `src/ads/index.ts`. There is no provider, no network call
and no money.

The boundary is drawn now, while nothing depends on it, because the easy
version is hard to undo: once behavioural targeting is in the data model the
business starts depending on it. So `AdContext` carries a placement and a
coarse locale — **no identifier of any kind**. It cannot grow into a profile
without someone widening the type and a reviewer noticing. Frequency caps are
counted on the device, because capping needs only a count and a count does not
have to be uploaded.

---

## Moderation and deletion

**Now.** `blocks` (private to the blocker — publishing it would tell the
blocked person, which is the one thing blocking must not do), `reports`
(insert and read your own; no update, so a subject cannot dismiss a report
about themselves), and `profiles.status`, which an account cannot change for
itself.

Blocking actually stops something: a blocked person cannot open a friend
request or a follow in either direction, checked by policy rather than by the
client hiding a button.

`delete_my_account()` removes the profile and everything cascading from it,
plus the avatar object. Two deliberate exceptions: reports the person filed are
kept but detached, because deletion must not become a way to erase evidence of
harassment; and the `auth.users` row needs the service role, so it is queued in
`deletion_requests` for an Edge Function. [PRIVACY.md](PRIVACY.md) says this
plainly rather than implying the account has vanished entirely.

**Later.** The review side, and the Edge Function that completes deletion.

---

## Deployment

Static build to GitHub Pages, from `main` only — the `github-pages` environment
rejects other branches. `VITE_SUPABASE_URL` is a repository *variable*,
`VITE_SUPABASE_ANON_KEY` a repository *secret*; Vite bakes both into the
bundle, which is correct for a publishable key and catastrophic for a
service-role key. `scripts/guard-build-env.mjs` refuses to build with a
privileged key and rescans the emitted bundle afterwards, so nothing is
uploaded or deployed if one appears from anywhere.

---

## Where things live

```
src/
  backend/    the only place that talks to Supabase
  video/      provider-agnostic video references and adapters
  ads/        advertising boundary (disabled)
  config/     links, version, contact — changed without touching a screen
  state/      the store; screens read and dispatch, never query
  screens/    UI. Should never import @supabase/supabase-js directly.
supabase/
  migrations/ applied in order
  tests/      the RLS suite
scripts/      check:backend, the build guard, the RLS runner
```

The rule worth keeping: **screens do not talk to the database.** Everything
goes through `src/backend`, so the question "what can a client do?" has one
place to look.
