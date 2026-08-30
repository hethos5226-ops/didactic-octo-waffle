# SCROLL — privacy

What SCROLL stores, why each thing is needed, and what it deliberately does not
collect.

This is an engineering document describing what the code actually does. It is
not a published privacy policy — see [LEGAL_READINESS.md](LEGAL_READINESS.md)
for what a launch requires.

The governing principle: **collect what the app needs to work, and nothing
because it might be useful later.** Data that is never collected cannot leak,
cannot be subpoenaed, cannot be sold by a future owner, and cannot be stolen.

---

## What SCROLL does not collect

None of the following exists anywhere in the codebase. This is not a roadmap
item; it is a boundary.

- **Behavioural tracking.** No record of what you watched, for how long, or
  what you scrolled past.
- **Advertising profiles.** No interest vectors, no segments, no cross-session
  identifiers. `src/ads/index.ts` cannot carry a user identifier — see below.
- **Tracking pixels, third-party analytics, session recording, heatmaps.**
  There is no analytics product. No third-party script is loaded at all.
- **Contact upload or phone-contact syncing.**
- **Precise location.** No geolocation API call. `country` is a value you pick
  from a list on your profile.
- **Browsing history**, of SCROLL or anything else.
- **Device fingerprinting.** No device identifiers, advertising IDs, or
  fingerprinting.
- **Camera-roll contents.** SCROLL never enumerates or reads your photo
  library. Choosing a profile photo goes through the OS file picker, which
  hands over exactly one file you selected.
- **Automatic uploads.** Nothing is uploaded without you doing something that
  uploads it.
- **Recording.** Nothing is recorded. There is no reaction recording, no voice
  capture, no screen capture.
- **Sold or shared data.** None, to anyone, for any purpose.

Verifiable, not just asserted: there are no third-party network destinations in
the build. The only host the app contacts is your own Supabase project.

---

## What SCROLL stores, and why

### Identity — Supabase Auth

| Data | Why |
|---|---|
| Email address | The credential you sign in with, and the route for password reset |
| Password (hashed) | Never stored or seen by SCROLL; Supabase Auth handles it |
| Session token | Kept in browser storage so you stay signed in |

Google and Apple sign-in are wired but not configured. When enabled, the
provider returns an email and a display name and nothing else — no contact
list, no friends graph, no posts.

### Profile — `profiles`

Handle, display name, bio, avatar emoji, colour, country, flag, vibes,
hashtags. All of it is self-description you typed or chose, and all of it is
publicly readable: SCROLL is a directory you have to be findable in to be
matched with anyone.

`photo_url` points at one image in the `avatars` bucket. **The photo is cropped
and downscaled on your device before upload** (`src/data/photo.ts`), so the
original never leaves the phone — only the smaller version is stored.

Server-owned columns you cannot write: `premium`, `xp`, `follower_count`,
`profile_likes`, the play counters, `status`, `is_bot`.

### Social graph — `friend_requests`, `follows`, `profile_likes`, `blocks`

Who you asked to be friends with, who you follow, whose profile you liked, who
you blocked. All necessary for the features they drive.

Your **block list is private to you.** It is readable only by the blocker,
because publishing it would tell the blocked person they were blocked — which
is the one thing blocking must not do.

### Notifications — `notifications`

Who did what to you, and whether you have read it.

### Play history — `matches`, `lobby_rounds`

A summary per match: who was in it, the round scores, totals, XP. Readable only
by you.

**Reactions are stored as counts, not as events.** `lobby_rounds.reaction_counts`
holds `{"😂": 4, "💀": 2}` for a round — no author, no timestamp. Storing who
reacted to what and when would build precisely the behavioural record this
document says SCROLL does not keep, and the game needs none of it: the results
screen shows totals.

### Presence — nothing stored

The online count uses Supabase Realtime Presence, which lives in memory and
disappears when a socket closes. Nothing is written to a table. **The presence
payload is empty** — being present is the entire message. Publishing handles
would turn a headcount into a "who is online right now" list nobody asked for.

### Entitlements — `entitlements`

Subscription tier, status, expiry, and which store it came from. Readable only
by you, writable by no browser role. No payment details ever reach SCROLL: when
subscriptions are real, Apple and Google process payment and SCROLL sees only
whether you are entitled.

### Moderation — `reports`

Who filed it, about whom or what, the reason, free text you wrote, and status.
Necessary for safety, and the retention exception is deliberate — see below.

### On your device only

Draft profile edits, the local prototype account when no backend is configured,
and ad frequency counts. Frequency capping needs only a count, and a count does
not have to be uploaded to work; doing it server-side would mean logging every
impression against a user, which is the profile we are avoiding.

---

## Local processing

Where something can be done on the device, it is:

- **Photo cropping and downscaling** happen in the browser. The full-resolution
  original is never transmitted.
- **Ad frequency limits** are counted locally.
- **Feed generation** is local and procedural. Nothing is fetched.
- **Score calculation** is local. Only the summary is stored.

---

## Deletion

Settings → Delete account, which calls `delete_my_account()`.

**Removed immediately:** profile row, avatar file, friend requests, follows,
notifications, match history, profile likes, blocks, lobby seats, entitlement.
Foreign keys cascade from `profiles`, so nothing is left orphaned. The test
suite asserts each of these is gone.

**Two deliberate exceptions, stated plainly:**

1. **The `auth.users` row survives, briefly.** Deleting an authentication
   record requires the service role, which must never be in a browser. The
   request is queued in `deletion_requests` for an Edge Function to complete.
   Until that function is deployed, the account is stripped of all personal
   data but the login record remains. This is a real gap and it is written
   down rather than glossed over.

2. **Reports you filed are kept, detached.** If deleting your account erased
   your reports, deletion would become a way to erase evidence of harassment.
   Nothing identifying you stays attached to them.

---

## Advertising

No advertising is active. The boundary in `src/ads/index.ts` exists so that
when it is, it cannot become surveillance:

```ts
interface AdContext {
  placement: AdPlacement;  // which surface
  locale: string;          // e.g. "en-AU"
}
```

That is the entire request. No user id, no session id, no interest data, no
cookie. Contextual advertising earns less per impression than behavioural
advertising; that is a deliberate trade, and the type is the enforcement — it
cannot grow into a profile without someone widening it and a reviewer noticing.

---

## Bots

Bots are labelled as bots and never counted as real users. They are characters,
not accounts: no `auth.users` row, no session. A bot cannot see your data
because a bot is not a client — nothing runs on its behalf.

---

## Future features, and their privacy conditions

**Reaction recording** (not implemented). If built: explicit opt-in per
session, a visible recording indicator, capture local to the device, saved to
the camera roll only when the user chooses, and **never uploaded automatically**.
SCROLL keeps no copy unless the user explicitly uploads one. Camera and
microphone only after an OS permission prompt the user granted.

**Connected accounts** (not implemented). Optional, revocable, and never
required to use SCROLL. Read-only scopes, storing only the tokens needed and
nothing about what you watched there.

**Creator rewards** (not implemented). Would need view counts from a platform.
The privacy-preserving shape is the user submitting a link and SCROLL reading a
public count — not SCROLL monitoring their account.

---

## Australian context

SCROLL is being built in Australia. The Privacy Act 1988 and the Australian
Privacy Principles are the relevant framework. Small businesses under $3m
turnover are currently often exempt, but that exemption is under active reform
and should not be relied on. Building to the APPs now costs little; retrofitting
costs a great deal. See [LEGAL_READINESS.md](LEGAL_READINESS.md).

---

## Reviewing this

If a change adds a column, a table, or a network destination, it belongs in
this document — and if it is hard to justify here, that is the signal to
reconsider it rather than to write a vaguer sentence.
