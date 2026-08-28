# SCROLL

**Meet someone. Watch their FYP. Laugh together. Rate their feed.**

A prototype for a social app where you get matched with strangers, one person
shares their short-form feed, and everyone watches and reacts to it together.

The content is not the product — **the reaction to someone else's algorithm
is**. Watching what the internet has decided a stranger in Osaka is like, with
that stranger listening to you laugh at it, is the whole idea.

---

## Run it

```bash
npm install
npm run dev
```

Open the printed URL. It is built mobile-first — use a narrow window or your
browser's device toolbar. `npm run build` produces a static `dist/`.

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

---

## Not built yet

The real ones, roughly in order: actual screen capture with the platform
permissions that implies, WebRTC voice, a matchmaking service, moderation and
reporting (a stranger's screen is a stranger's screen), and accounts that
survive a device.
