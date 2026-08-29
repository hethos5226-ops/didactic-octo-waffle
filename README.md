# SCROLL

**Meet someone. Watch their FYP. Laugh together. Rate their feed.**

A prototype for a social app where you get matched with strangers, one person
shares their short-form feed, and everyone watches and reacts to it together.

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

## Configuring real sign-in

Apple and Google are wired up to the point where **only credentials are
missing**: the buttons, the call, the result handling and the error surface all
exist in `src/auth/providers.ts`. What they deliberately do *not* do is pretend
to succeed — tapping one today opens a sheet listing what is still needed. A
fake "signed in with Apple" would hide the work still to do, and that is the
kind of thing that quietly ships.

Copy `.env.example` to `.env.local` and fill in:

### Sign in with Apple
1. **A paid Apple Developer Program membership** — $99/year. There is no free tier for this.
2. A **Services ID** (not an App ID) with "Sign in with Apple" enabled.
3. A **private key (.p8)**, plus its **Key ID** and your **Team ID**.
4. `VITE_APPLE_CLIENT_ID` and `VITE_APPLE_REDIRECT_URI`.
5. **A server endpoint.** Apple's client secret is a JWT you sign with the .p8
   key. That key can never go in the app — anything bundled into the client is
   readable by anyone who opens the site.

### Sign in with Google
1. A **Google Cloud project** with an OAuth consent screen configured.
2. An **OAuth 2.0 Client ID** (iOS and/or Web).
3. `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_REDIRECT_URI`.
4. Your redirect URI added to that client's allowed list.
5. **A server endpoint** to verify the ID token. Verifying it in the browser
   proves nothing — anyone can send you any token.

Both need the same thing before they are real: a backend. Until then, **email
sign-in works** but is device-local — no verification, no password reset, and
signing out erases it. The UI says so rather than implying otherwise.

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
| Tab navigation | ✅ Home · Discover · Create · Activity · Profile |
| Discover | ✅ search people/tags/videos, trending, suggested creators |
| Reel viewer | ✅ real video, autoplay, tap-pause, mute, like/save/share/follow |
| Profile content | ✅ followers, following, posts / liked / saved grids |

Everything persists to `localStorage`, so your level and Feed Score are still
there when you come back.

---

## About the reels

The six clips in `public/videos/` are **generated for this prototype** with
ffmpeg — animated gradients, nobody's content. They are real H.264/VP9 files
rather than CSS animations on purpose: the player's autoplay, pause, seek, loop
and mute are the browser's own behaviour, so swapping in uploaded video changes
only the URLs.

Each ships as **both MP4/H.264 and WebM/VP9**. That is not belt-and-braces —
Safari and iOS need H.264, while Chromium builds without proprietary codecs
(plain Chromium, many Linux browsers) can only decode VP9. Offering both as
`<source>` elements lets each browser take the one it can play; this was found
by the video silently failing to load in exactly such a browser.

Autoplay only works muted. That is a browser rule, not a preference: an unmuted
`play()` outside a user gesture is rejected, so the feed starts muted and the
first tap on the speaker is what grants sound.

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
