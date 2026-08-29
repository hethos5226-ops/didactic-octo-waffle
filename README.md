# SCROLL

**Meet someone. Watch their FYP. Laugh together. Rate their feed.**

**SCROLL is a party game you play by watching reels.**

You get matched with people → one of you is picked as the Scroller → they share
their feed → everyone watches the same thing at once, reacts live and talks over
it → the room rates their feed → it rotates. Score, levels and friends all come
out of *playing*.

There is deliberately **no solo For You feed**. Watching alone is a different
app; the reels are the material the game is played with, not the product.

The content is not the product — **the reaction to someone else's algorithm
is**. Watching what the internet has decided a stranger in Osaka is like, with
that stranger listening to you laugh at it, is the whole idea.

---

## See it running

The repository is **private**, which affects the options:

**GitHub Codespaces** — works today, nothing to publish. On the repo page:
`Code ▸ Codespaces ▸ Create codespace`, then in its terminal:

```bash
npm install && npm run dev
```

Click the forwarded port when it pops up. Open the browser device toolbar and
pick an iPhone, or open the forwarded URL on your phone.

**GitHub Pages** — gives a permanent link, and `.github/workflows/pages.yml`
is ready for it. Turn it on once at `Settings ▸ Pages ▸ Source: GitHub Actions`.
Note that **Pages on a private repo needs a paid plan**; on the free plan the
repo has to be public first, which puts the prototype on the open internet — so
that is a deliberate choice, not a step to click through.

**Download the build** — the same workflow always uploads a `scroll-prototype`
artifact under the Actions tab, whether or not Pages is on. Unzip it and serve
it locally:

```bash
npx serve scroll-prototype
```

(It needs a server — browsers block ES modules opened over `file://`.)

---

## Connecting the backend

The app runs in **two modes**, and both are real:

| | No project configured | Project configured |
|---|---|---|
| Accounts | Device-local, one browser | Supabase Auth, follows you between devices |
| Apple / Google | Refuses, and says what is missing | Real OAuth through Supabase |
| Email | Works, device-local | Real sign-up, sign-in and password reset |
| Profiles, friends, matches | `localStorage` | Postgres with row-level security |
| Directory | The built-in cast | Real profiles |

The unconfigured mode is not a stub — it is the state the app is in until you
create a project, and keeping it working means the app stays demonstrable
throughout. The UI says which mode it is in rather than implying otherwise.

### 1. Create the project

1. Make a project at [supabase.com](https://supabase.com) — the free tier is enough.
2. **Project Settings → API**: copy the Project URL and the `anon` key.
3. `cp .env.example .env.local` and paste them in.
4. **SQL Editor**: paste and run `supabase/migrations/0001_init.sql`.

That is everything email sign-in needs. It creates the tables, the row-level
security policies, the follower-count trigger and the `avatars` storage bucket.

> The `anon` key is public and safe to ship. The **service-role key is not** —
> it bypasses row-level security completely and must never appear in the app.

Then confirm it actually worked:

```
npm run check:backend
```

It checks the environment variables, that the project answers, that every
table and the `avatars` bucket exist, that row-level security really does
refuse an anonymous write, and which auth providers are switched on. The
failures at this stage are quiet ones — a bucket that was never created, or
RLS left off — so it is worth asking before trusting the backend with a real
account. It refuses to run at all if it finds a service-role key.

### 1b. Connect the deployed site

`.env.local` only configures a local build. The GitHub Pages deploy is built
by Actions, so it reads its values from the repository instead — under
**Settings → Secrets and variables → Actions**:

| Where | Name | Value |
|---|---|---|
| **Variables** tab | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| **Secrets** tab | `VITE_SUPABASE_ANON_KEY` | the publishable key |

Vite compiles both into the JavaScript it emits, which is what the publishable
key is for — it is public by design, and row-level security is what protects
the data. Keeping it as a secret keeps it out of the repository and masks it in
build logs. **The service-role key must never go here**: the build refuses to
run if it finds one, and refuses to publish a bundle containing one.

Set both or neither. One alone would build a site that silently falls back to
device-local accounts, so the build stops and says so.

Supabase also has to be told where the site lives, or confirmation links will
point at the wrong place — **Authentication → URL Configuration**:

- **Site URL**: `https://<user>.github.io/<repo>/`
- **Redirect URLs**: add that same URL

### 2. Sign in with Google

1. Google Cloud Console → **APIs & Services → Credentials** → OAuth client ID (Web).
2. Configure the OAuth consent screen if prompted.
3. In Supabase: **Authentication → Providers → Google**, paste the Client ID and secret.
4. Copy the callback URL Supabase shows you into Google's **Authorised redirect URIs**.

### 3. Sign in with Apple

1. **An Apple Developer Program membership** — paid, roughly £79/$99 a year. There is no free tier for this, and it is the only hard blocker in the list.
2. Create a **Services ID** (not an App ID) and enable "Sign in with Apple".
3. Create a **private key (.p8)**; note its **Key ID** and your **Team ID**.
4. In Supabase: **Authentication → Providers → Apple**, paste the Services ID, Team ID, Key ID and the .p8 contents.
5. Add Supabase's callback URL to the Services ID's **Return URLs**.

Supabase signs Apple's client secret for you, which is why no server of our own
is needed. The .p8 key stays in the Supabase dashboard and never comes near the
app bundle.

### 4. Email confirmation

Supabase enables "Confirm email" by default, so a new account cannot sign in
until the link is clicked. The app says so rather than spinning. To skip it
while testing: **Authentication → Providers → Email → Confirm email → off**.

### What the schema enforces

The policies were run against a real PostgreSQL instance and checked, not
merely written:

- Profiles are a public directory — you must be able to find people to play with — but only the owner can edit their own row.
- Only the person who *received* a friend request can accept it. Without that, anyone could mark their own outgoing request accepted.
- A notification's actor must be the person creating it, so nobody can fill your inbox with messages that appear to come from someone else.
- Matches are private to the player they belong to.
- Handles are lowercase, 2–18 characters, and unique.
- You cannot friend yourself, and follower counts are kept by a trigger rather than trusted from the client.

---

## Run it

```bash
npm install
npm run dev
```

Open the printed URL. **This is designed for a full-screen iPhone app in
portrait**, not for a desktop browser — use your browser's device toolbar (iPhone 15 Pro, or
anything from an SE up to a Pro Max) or open it on a phone. On a wide screen it
renders inside a 393 × 852 frame so what you see is what ships.

Layout is tuned for the **full** screen height, the way a native app gets it.
Opened in mobile Safari the address and tab bars take roughly 190px off that,
so the video is shorter than intended — that is the browser, not the design.
Add it to your home screen and it runs full-screen with the intended
proportions. `npm run build`
produces a static `dist/`.

### Emoji

Emoji are the app's whole visual language, so `Apple Color Emoji` leads both
font stacks — standalone glyphs and ones sitting inline in a sentence. On
iPhone, iPad and Mac that is the real system font and matches Messages exactly.

Every emoji in the source is a plain Unicode codepoint (`😂` is `U+1F602`
everywhere). *Which artwork you see is decided entirely by the font the device
resolves*, so the whole job is getting the font stack right.

Two rules, learned the hard way:

1. **No text font before the emoji font**, in `--font-emoji`. San Francisco
   (`-apple-system`) carries monochrome glyphs for `❤ ✌ ☝ ✍`, so listing it
   ahead of `Apple Color Emoji` hands those characters to SF and renders a flat
   black glyph instead of the Apple emoji.
2. **No emoji font in the *text* stack at all.** Emoji fonts also carry glyphs
   for `0-9`, `#` and `*` — the bases of keycap sequences — so naming one in
   `--font` hands it every digit in the UI the moment the webfont is slow or
   missing. An emoji sitting inside a sentence instead falls through to the
   platform's own emoji font, which on iOS *is* Apple Color Emoji: the right
   glyph by the shortest route.

(An earlier version of this file claimed a generic family like `sans-serif`
ends the fallback chain, and put the emoji families ahead of it to compensate.
That is what caused problem 2. Restricting the families with a `unicode-range`
alias did not reliably prevent it either.)

Characters that default to text presentation (`❤️ ✌️ ⚠️ ▶️ …`) additionally
carry `U+FE0F`. All 22 in the source are checked.

**Verify it yourself on device:** open `/emoji-check.html` on the phone you care
about. It reports which emoji font the browser actually resolved — comparing
rendered pixels rather than `document.fonts.check()`, which returns true for
fonts that are not installed — and renders the app's reaction set at size.

Apple's emoji font ships only with iOS and macOS and cannot legally be
redistributed, so a Linux or Windows machine falls back to its own set. That
affects screenshots taken during development, never the phone this is built
for. Bundling a third-party set (Twemoji, OpenMoji) would make every platform
identical, but none of them *are* Apple's artwork — that is a deliberate
trade-off, not an oversight.

---

## The loop

```
HOME  →  match (solo / duo / trio)  →  LOBBY  →  "🎬 JAKE IS SCROLLING!"
  ↑                                                        ↓
  └──  session wrap: like, add friend  ←  rate feed  ←  10 videos, live reactions
```

1. **Pick a mode.** Solo is 1v1, Duo is 2v2, Trio is 3v3. Or open a private
   lobby and share the code.
2. **One person is picked as the Scroller.** The whole screen takes over to
   announce it.
3. **They scroll their feed. Everyone watches the same thing at the same time.**
   Ten videos. There is a counter, because a round should have a shape.
4. **Everyone reacts.** 😂 💀 😭 ❤️ 🤯 🤨 🔥 👎 float up the screen with the
   name of whoever sent them. Voice is always on; there is a text chat too.
4b. **You can see what you have in common.** Everyone picks hashtags at
   sign-up — `#dogs`, `#brainrot`, whatever they actually watch — and shared
   ones are called out on each person's row in the lobby. "You both like #dogs"
   is a better reason to add someone than a matching category chip.
5. **The round ends and the room rates the feed** — not out of five stars, but
   on FUNNY / CHAOTIC / FIRE / WTF / GOOD FYP.
6. **That becomes a Feed Score**, which follows the profile around and moves
   every time someone else watches their algorithm.
7. **Then it's someone else's turn**, until everyone has scrolled.
8. **At the end you can like people and add them** — the only moment where
   adding a stranger feels natural is right after laughing at their feed for
   ten minutes.

---

## What's built

| | |
|---|---|
| Landing / home | ✅ |
| Account creation | ✅ device-local, no email wall |
| Random matchmaking | ✅ animated, people arrive one at a time |
| Solo / Duo / Trio | ✅ |
| Lobby screen | ✅ members, levels, vibes, scroller order |
| Random Scroller selection | ✅ shuffled per session, full-screen announcement |
| Screen-sharing concept | ✅ simulated — see below |
| Voice chat concept | ✅ mute / volume / leave, live speaking rings |
| Video counter | ✅ `4 / 10` plus a per-clip progress bar |
| Emoji reactions | ✅ eight, as floating tagged bubbles |
| Text / emoji chat | ✅ |
| End-of-round rating | ✅ five categories, five steps each |
| Feed Score | ✅ weighted, persistent, moves over time |
| XP / levels | ✅ six titles, level-up celebration |
| Profile | ✅ level, score, category breakdown, stats, vibes |
| Add friend / like | ✅ end of session, or any time from Friends |
| Find people | ✅ search, and suggestions ranked by mutual friends |
| Friend requests | ✅ send, accept, ignore, with a pending state |
| Activity feed | ✅ bell on the home screen with an unread count |
| Private lobby + invite code | ✅ `FYP-7K2Q` + shareable link |
| Profile photo | ✅ photo or emoji face, cropped and downscaled on device |
| Interest hashtags | ✅ `#dogs` `#brainrot`, suggested or typed |
| Premium | ✅ removes ads, claims the first turn, crown badge |
| Welcome / sign-in | ✅ Apple + Google wired but unconfigured; email works locally |
| Onboarding | ✅ username, display name, photo, bio, interests, intro |
| Tab navigation | ✅ Home · Profile · **PLAY!** · Activity · Settings |
| Match history | ✅ every game is kept and shown in Activity |
| Profile | ✅ photo, display name, bio, followers, following, feed score |

Everything persists to `localStorage`, so your level and Feed Score are still
there when you come back.

---

## Navigation

**Home · Profile · PLAY! · Activity · Settings.**

PLAY sits in the middle and is the loudest thing in the bar, because starting a
game is what the app is *for* — the other four are places you go between games.
It opens the modes as a sheet rather than routing to a screen, so a game can
start from wherever you are.

Activity leads with **your last games** — the scoreboard, who played, what your
feed scored — above friend requests. A match is the unit of play, so it is the
thing worth remembering; sessions used to be discarded the moment they ended.

## About the feeds

**No real TikTok, Reels or Shorts content is fetched, embedded, hosted or
redistributed anywhere in this prototype.** That is a deliberate constraint,
not an oversight — a real build has to solve screen-capture permissions,
platform terms and copyright before it ships, and faking those problems away
would make this prototype dishonest about what it is proving.

What it proves instead is the *experience*: the frame, the chrome, the shared
pacing and the social layer on top.

So each "video" is generated. Every person carries two or three **vibes**
(`Pure Chaos`, `Deep Lore`, `Cozy`, `Gym`…), and their feed is drawn from those
with the first weighted heaviest — because an algorithm has a favourite, and
that is what makes a feed recognisable as *theirs*. Watch @charley twice and
you will start to recognise her feed. That recognition is the thing the real
product would deliver with a genuine screen share.

Friend requests are simulated too: a sent request is accepted a few seconds
later, so the loop closes and the "accepted" notification is real rather than
hypothetical. Two people are already waiting when an account is created, since
an empty inbox cannot show what the bell is for.

Co-viewers are simulated locally too. They react, they talk, and they take the
phone when it is their turn. The shape of the state is the same as it would be
with those events arriving over a socket.

---

## Layout

```
src/
  data/       vibes, cast of people, reactions, level curve, feed generator
  state/      types, reducer store, feed-score maths
  components/ player, reaction bubbles, voice bar, chat, overlays
  screens/    auth, home, matchmaking, lobby, session, rating, results,
              summary, profile, private lobby
  styles/     tokens + component styles
```

A few decisions worth knowing:

**One reducer holds the whole session.** Members, scroller rotation, live
reactions, chat and results all live in one place, so a real transport layer
has exactly one thing to publish into.

**Feed Score is a running tally, not a snapshot.** Every category keeps
`points / votes`, seeded with a soft baseline so a brand-new profile is not a
wall of zeroes. Live reactions count as one extra ballot alongside the explicit
ratings, so a round where everyone spammed 💀 reads as chaotic even before
anyone fills in the form.

**The score is weighted, not averaged.** GOOD FYP counts most, WTF counts
least. A chaotic feed and a cosy feed can both be great; only one category
actually means "I'd watch this again".

**There is no content library, and no solo feed.** SCROLL has no posts, likes
or saves of its own: the only feed in the app is the one a Scroller shares
during a game, and it belongs to them. A viewer for browsing reels alone was
built and then removed — it made watching alone the main event and pushed the
game into a corner, which is the opposite of the point.

**Adding people is a place, not a moment.** It used to be possible only in
the few seconds after a session ended, so if you missed that window the person
was gone. Friends is now a screen you can go to: who is waiting on you, who you
might know, and a search box. Suggestions rank by mutual friends first and
shared hashtags second — mutuals are the strongest signal you actually know
someone, and hashtags carry the ranking on a new account where nobody has any
mutuals yet, which is exactly the list that decides whether the feature feels
useful at all.

**Nothing blocks the first session.** No email, no verification, no permissions
prompt. The fastest way to lose someone is to put a form between them and the
thing they came to try.

**Hashtags feed the algorithm as well as the matching.** A recognised tag maps
to a vibe, so picking `#dogs` also nudges your generated feed towards animals —
ordered behind the vibes you picked deliberately. Tags that match nothing still
count for matching, they just don't steer the feed.

**Profile photos never leave the device.** A picked image is centre-cropped
square and downscaled to 320px JPEG before it is stored, because the profile
lives in `localStorage` and a raw camera shot would blow that budget on its own.
`createImageBitmap` handles EXIF orientation, so a photo taken sideways comes
out the right way up.

**Premium is built as a real absence, not a promise.** Ad slots take the space
an ad would take, so removing them is a visible difference. The "scroll first"
perk moves you to the front of the rotation and leaves everyone else's relative
order intact — a head start, not a reshuffle of someone else's session. Nothing
is charged and no payment details are collected.

---

## Not built yet

The real ones, roughly in order: actual screen capture with the platform
permissions that implies, WebRTC voice, a matchmaking service, moderation and
reporting (a stranger's screen is a stranger's screen), payments behind the
Premium screen, an ad network behind the slots, and accounts that survive a
device.
