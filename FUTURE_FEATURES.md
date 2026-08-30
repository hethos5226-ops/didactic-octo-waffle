# SCROLL — future features

What is prepared but switched off, what is documented but unbuilt, and what
each thing actually requires.

Categories used throughout:

| Mark | Meaning |
|---|---|
| **Prepared** | Types, schema and boundaries exist; deliberately inactive |
| **Documented** | Not built; the requirements are worked out |
| **External** | Depends on a third party who must agree |
| **Costs money** | Would end the $0/month position |
| **Needs legal review** | Do not ship without advice |
| **Needs a native app** | Impossible in a browser |

---

## Video integrations

**External. Needs legal review.**

The honest headline, because it changes the original plan:

> **No platform offers an API that returns a user's personal recommendation
> feed.** Not Instagram, not TikTok, not YouTube. Not on any tier, not to
> partners, not for money.

The "sign in with Instagram and SCROLL mirrors your Reels feed" idea is not
available from anyone on any terms. It is not a matter of approval or budget;
the product does not exist. The only way to obtain such a feed would be
automating the app or scraping, which breaches terms, risks the user's account,
and exposes SCROLL legally.

This is why `src/video/` exists in the shape it does. SCROLL is designed around
*a* video source, not around any particular platform.

### Instagram — link-only

- **Available:** oEmbed for individual **public** posts, via an approved Meta
  app that has passed App Review. Basic Display API was deprecated in
  September 2024.
- **Not available:** the user's Reels feed, their For You content, or anything
  about what they watch.
- **To go further:** a Meta developer account, an app, App Review, and a privacy
  policy URL. Weeks of process for the ability to embed public posts.

### TikTok — link-only

- **Available:** an embed SDK for individual public videos. The Display API
  returns a user's **own posted videos** after they authorise it.
- **Not available:** the For You feed. What someone *posts* is a different thing
  from what they *watch*, and SCROLL is about the latter.
- **To go further:** TikTok for Developers registration and app review.

### YouTube — the realistic one

- **Available:** the IFrame Player API, documented and permitted for third-party
  sites, including Shorts. The Data API allows search and metadata within a
  generous free quota.
- **Not available:** a personal recommendation feed.
- **Why it is the first real integration worth building:** it is the only
  mainstream platform where embedding is unambiguously sanctioned, the adapter
  is straightforward, and **the bandwidth is YouTube's** — SCROLL pays nothing
  to serve the video.
- **Watch for:** ads inside the embed, playback restrictions some videos set,
  and autoplay rules on mobile browsers.

### What a session would actually do

Given that no feed API exists, the plausible designs are:

1. **Curated catalogue.** SCROLL maintains `video_refs` of embeddable content.
   Full control, no platform dependency, but someone has to curate.
2. **Host picks.** The host searches (YouTube Data API) and queues videos for
   the room. Closest to the original spirit — one person shows the others
   things — without needing a feed API.
3. **Shared queue.** Everyone contributes; the room votes.

Option 2 is probably the right first build. It preserves "watch what someone
else brings" without depending on anything that does not exist.

**Already prepared:** `video_sources`, `video_refs`, `lobby_rounds`, the
adapter interface, and `resolvePlayback()`. Adding YouTube is writing one
adapter and enabling one row.

---

## Real multiplayer sessions

**Prepared.**

Schema and service boundary exist (`0003`, `src/backend/lobbies.ts`), including
the parts that are easy to get wrong: one live seat per person, heartbeat-based
disconnect detection, cleanup of abandoned lobbies, non-enumerable private
lobbies, bots that cannot be counted as people.

**Not built:** shared game state and synchronised playback. The transport is
Supabase Realtime — usage-priced with a free allowance, so it costs nothing
while SCROLL is small, unlike a game server which costs the same at 3 players
as at 3,000.

**Design notes for later:**
- One Realtime channel per lobby. Subscribe only while the screen is open.
- The host is the clock. Broadcast `{videoIndex, startedAt}`; clients seek to
  match. Do not attempt frame-accurate sync — nobody notices 200 ms, and
  everybody notices a stall.
- Batch reactions. One message per tap is the obvious way to exceed the
  message allowance.
- Reconnection: rejoin the channel, read lobby state from the database, resume.
  The database is the truth; Realtime is only the notification.
- Host migration when the host leaves, or end the session cleanly.

---

## Premium subscriptions

**Prepared. Costs money (store fees). Needs a native app.**

`entitlements` is written only by the service role; the client reads and never
writes. That is the whole security property and it is already true and tested.

**How it will work:**

1. User subscribes through **Apple IAP** or **Google Play Billing**. Both are
   mandatory for digital goods in their apps — Stripe or bank transfer would be
   rejected. 15–30% commission.
2. The store notifies a server endpoint (App Store Server Notifications V2,
   Google RTDN via Pub/Sub).
3. A **Supabase Edge Function** validates the notification with Apple/Google
   using a key that never leaves the server, then writes `entitlements` with
   the service role.
4. The client reads its entitlement. Unchanged from today.

**Why a native app is required:** IAP is not available to a website. A browser
build cannot sell subscriptions on Apple's or Google's terms. Web-only payment
via Stripe is possible but cannot be offered *inside* an iOS app.

**Do not:** validate receipts on the client, trust a client-sent "I bought it",
or let any browser role write `entitlements`. All three are already impossible.

---

## Advertising

**Prepared. Needs legal review.**

`src/ads/index.ts` defines placements, a contextual-only request, creatives,
aggregate metrics and frequency caps. There is no provider and no network call.

The constraint worth defending: `AdContext` carries a placement and a coarse
locale, and **no identifier of any kind**. Contextual ads earn less than
behavioural ones. That is a deliberate trade, and the type is what enforces it.

**A privacy-respecting integration would:** use a contextual network, or sell
placements directly; keep frequency caps on-device; report impressions and
clicks per creative in aggregate; never pass a user identifier; label every ad.

**Do not:** add an ad SDK that requires a stable user id or device advertising
identifier. That is the moment SCROLL becomes a surveillance product, and it is
very hard to reverse once revenue depends on it.

---

## Reaction recording

**Documented. Needs a native app. Needs legal review.**

The idea: a host records their own reaction while watching, and can keep it.

**Requirements, all non-negotiable:**

- Explicit opt-in **per session**. Never a default, never remembered silently.
- A prominent, persistent recording indicator while active.
- Recording happens **locally on the device**. `MediaRecorder` can do this in a
  browser; the camera-roll save cannot, which is why this needs a native app.
- Saved to the camera roll **only when the user chooses**.
- **Never uploaded automatically.** SCROLL keeps no copy unless the user
  explicitly uploads one.
- Camera and microphone only after an OS permission prompt the user granted.
  `NSCameraUsageDescription` / `NSMicrophoneUsageDescription` must explain why,
  or App Review rejects.
- SCROLL never reads the camera roll — writing one file is not reading the
  library.

**Consent is the hard part, not the technology.** If other people are audible
or visible, recording them raises consent questions that vary by state. In
Australia, listening-device laws differ across states and several require all
parties to consent. **This needs advice before it ships.** The safest first
version records only the host's own camera and microphone, with everyone in
the session told that the host is recording.

**If uploading is ever added,** it changes SCROLL's cost and legal position
completely — see [SCALING.md](SCALING.md) on video, and the CSAM obligations in
[LEGAL_READINESS.md](LEGAL_READINESS.md). Recording locally does not create
those obligations. Hosting does.

---

## Creator rewards

**Documented. External. Needs legal review.**

The idea: a user whose SCROLL reaction video does well on social media receives
temporary Premium.

**The privacy-preserving shape:** the user submits a link to their own post;
SCROLL reads the **public** view count; if it passes a threshold, an Edge
Function grants a time-limited entitlement — which the existing `entitlements`
table already supports via `source = 'promo'` and `expires_at`.

**What to avoid:** connecting to their account and monitoring it; requiring
account linking; storing anything about their posting activity beyond the one
submitted link.

**Real difficulties:** view counts are trivially gamed (bought views, bot
farms); public counts are not always available via API; it is a promotion, so
Australian Consumer Law and possibly trade-promotion rules apply; and manual
verification does not scale.

Sensible first version: manual, small, and explicitly a promotion with terms.

---

## Connected accounts

**Documented.**

Settings → Connected accounts, for Instagram, Google, Apple. Optional,
revocable, and **never required to use SCROLL** — the email account stays the
main identity.

Worth being clear about what connecting would achieve: **not a feed**. Realistic
value is profile enrichment or finding friends who also use SCROLL. Worth
building only when there is a concrete reason.

---

## Account and data export

**Documented.**

Deletion exists; export does not. APP 12 gives individuals a right to access
their personal information, and GDPR's Article 20 goes further. A JSON export
of profile, friends, follows and match history is a small Edge Function.

---

## Moderation review

**Documented.**

`reports` and `blocks` exist with correct boundaries. Missing: a queue to
review, the ability to action a report, suspension tooling (the `status` column
is ready), an appeals path, and an audit trail.

Deliberately not built — a moderation platform for zero users is the definition
of premature. What matters is that the data is stored in the right shape now.

---

## Smaller things

- **Push notifications** — needs a native app.
- **Rate limiting** on friend requests and reports.
- **Trigram index** for directory search, when `ilike` gets slow.
- **`pg_cron`** for lobby cleanup, when opportunistic sweeps are not enough.
- **Dependabot** — free, not enabled.
- **Account deletion Edge Function** — completes the one gap in deletion.
- **Data region confirmation** — needed for the privacy policy.

---

## Explicitly not planned

Not because they are hard, but because they are not what SCROLL is:

- Video creation, editing, filters, effects.
- Video upload and hosting.
- A solo browsing feed. SCROLL is watching *together*.
- Reels, or any feed-mirroring of a third-party platform.
- Behavioural advertising.
- Selling data.
- Fake activity of any kind — invented online counts, fabricated friend
  requests, bot-inflated player numbers.
