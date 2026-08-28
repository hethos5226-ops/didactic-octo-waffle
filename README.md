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

## Run it

```bash
npm install
npm run dev
```

Open the printed URL. **This is designed for an iPhone held in portrait**, not
for a desktop browser — use your browser's device toolbar (iPhone 15 Pro, or
anything from an SE up to a Pro Max) or open it on a phone. On a wide screen it
renders inside a 393 × 852 frame so what you see is what ships. `npm run build`
produces a static `dist/`.

### Emoji

Emoji are the app's whole visual language, so `Apple Color Emoji` leads both
font stacks — standalone glyphs and ones sitting inline in a sentence. On
iPhone, iPad and Mac that is the real system font and matches Messages exactly.

Every emoji in the source is a plain Unicode codepoint (`😂` is `U+1F602`
everywhere). *Which artwork you see is decided entirely by the font the device
resolves*, so the whole job is getting the font stack right. Two ordering rules
do that, and both are easy to get wrong:

1. **No text font before the emoji font.** San Francisco (`-apple-system`)
   carries monochrome glyphs for `❤ ✌ ☝ ✍`, so listing it ahead of
   `Apple Color Emoji` hands those characters to SF and renders a flat black
   glyph instead of the Apple emoji.
2. **Emoji families before the generic `sans-serif`.** A generic family always
   resolves to something, which can end the fallback chain before the emoji
   families are ever consulted.

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
| Add friend / like | ✅ |
| Private lobby + invite code | ✅ `FYP-7K2Q` + shareable link |
| Profile photo | ✅ photo or emoji face, cropped and downscaled on device |
| Interest hashtags | ✅ `#dogs` `#brainrot`, suggested or typed |
| Premium | ✅ removes ads, claims the first turn, crown badge |

Everything persists to `localStorage`, so your level and Feed Score are still
there when you come back.

---

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
