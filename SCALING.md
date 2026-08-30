# SCROLL — scaling and cost

What breaks first, what costs money first, and roughly when.

Written for a specific situation: SCROLL currently costs **$0/month** and
should keep costing nothing while it is small. The goal is not to support
100,000 users today. It is to know what would become expensive, and to avoid
decisions that make growth impossible later.

The governing rule: **costs should scale with usage, never with capacity.** A
game server costs the same at 3 players as at 3,000. Supabase Realtime costs
nothing at 3 and something at 3,000. That difference is why the architecture
looks the way it does.

Figures below are order-of-magnitude for Supabase's published tiers as of this
writing. Check current pricing before relying on any of them.

---

## Today's bill

| Service | Plan | Cost |
|---|---|---|
| GitHub Pages | Free (public repo) | $0 |
| GitHub Actions | Free (public repo) | $0 |
| Supabase | Free | $0 |
| Domain | none | $0 |

The Supabase free tier gives roughly 500 MB database, 1 GB file storage, 5 GB
egress, 50,000 monthly active users, 200 concurrent Realtime connections, 2
million Realtime messages, and 500,000 Edge Function invocations. **Projects
pause after 7 days of inactivity** — the single most likely thing to bite after
a few months away. Opening the dashboard restores it.

---

## By scale

### 10 users — where SCROLL is

Nothing is stressed. A profile row is well under 1 kB, so ten users plus the
200-bot roster is a fraction of a megabyte.

Cost: **$0.** Bottleneck: none. The only real risk is the project pausing while
you are on your HSC.

### 100 users

Still nothing. ~100 profiles, a few thousand rows of social graph, a few
hundred avatars at ~50 kB each — call it 5–10 MB of the 1 GB storage.

Concurrent Realtime connections are the first number worth watching, and 100
users does not mean 100 concurrent: expect a small fraction online at once.
Comfortably inside 200.

Cost: **$0.** Bottleneck: none. First thing to notice: unindexed queries, which
will not hurt yet but should be found now while they are cheap to fix.

### 1,000 users

The first real thresholds appear.

- **Database.** Perhaps 50–150 MB with history. Fine.
- **Storage.** ~1,000 avatars ≈ 50 MB. Fine.
- **Realtime.** If 5% are online at once that is 50 concurrent — still inside
  the free 200. If SCROLL gets *popular* rather than merely used, 10–20%
  concurrent puts you at 100–200 and this becomes the first thing to exceed.
- **Egress.** Profile photos are the traffic. 5 GB/month is a lot of 50 kB
  avatars, but this is where a CDN question first appears.

Cost: **$0, or $25/month** if concurrency or egress tips over — Supabase Pro,
which also stops the project pausing.

**Bottleneck: Realtime concurrent connections.**

Do before here: index every foreign key actually queried; cap `matches`
history per user; make sure `cleanup_stale_lobbies` is running often enough
that abandoned lobbies do not accumulate.

### 10,000 users

Architecture starts to matter.

- **Database.** 500 MB–2 GB. Past free; comfortable on Pro (8 GB included).
- **Realtime.** 500–2,000 concurrent. Well past free, and the dominant cost.
  Pro includes 500 concurrent and charges beyond it.
- **Egress.** 50–200 GB/month. Pro includes 250 GB.
- **Auth.** 10,000 MAU is inside Pro's 100,000.

Cost: **$25–100/month.**

**Bottlenecks, in order:**

1. **Realtime connections.** Every open lobby holds sockets. Mitigation:
   subscribe only while a lobby screen is open (not app-wide), unsubscribe
   aggressively, batch reaction messages instead of one per tap.
2. **Matchmaking queries.** Polling for open lobbies from every client is
   quadratic-ish. Move to Realtime notification rather than polling.
3. **The directory.** `searchPeople` uses `ilike`, which does not use a
   standard index. Needs a trigram index or full-text search by here.

### 100,000 users

A different system, and the point of writing this down is to know that in
advance rather than discovering it.

- **Database.** 5–20 GB. Needs read replicas, or aggressive archiving of match
  history.
- **Realtime.** 5,000–20,000 concurrent is the single largest line item and may
  justify a dedicated realtime layer.
- **Egress.** 500 GB–2 TB/month. A CDN in front of avatars becomes obviously
  correct.
- **Auth.** Past Pro's 100,000 MAU.

Cost: **$500–3,000/month**, dominated by Realtime and egress — *if* video is
still referenced rather than hosted. If SCROLL hosts video by then, see below,
because that number changes completely.

**Bottlenecks:** Realtime fan-out; database connection limits (needs
connection pooling — Supabase provides Supavisor); matchmaking as a hot path
that probably wants its own service; moderation, which becomes a staffing cost
rather than a technical one.

---

## Video: the decision that dominates everything

This is the most important cost section and the reason SCROLL's architecture
refuses to own video.

| Approach | Storage | Bandwidth | Legal exposure | Moderation | Cost at 100k |
|---|---|---|---|---|---|
| **Reference only** (store a link, play nothing) | ~0 | ~0 | Minimal | Minimal | ~$0 |
| **Embed where permitted** (provider's player) | ~0 | ~0 — the provider serves it | Low, if terms permit | Provider's | ~$0 |
| **SCROLL-hosted** (upload, store, stream) | Grows forever | Per view | High | Yours entirely | **Thousands/month** |

The arithmetic that matters: a 15-second short-form video is roughly 3–5 MB.
Serving one video to one viewer costs about 4 MB of egress. At $0.09/GB, that
is ~$0.0004 per view — trivial once, ruinous at volume. **1,000 users watching
50 videos a day each is ~200 GB/day, ~6 TB/month, ~$540/month in egress
alone**, before storage, before transcoding.

And it is worse than the number suggests:

- **Storage never shrinks.** Every video uploaded is stored forever unless
  deleted. Cost accrues whether or not anyone watches.
- **Transcoding is not optional.** A phone upload must become multiple
  renditions. Managed services charge per minute of input.
- **Cost scales with popularity, not revenue.** A video going viral is a bill,
  not income.
- **Hosting user video means moderation.** Not a nice-to-have: CSAM scanning,
  copyright takedowns, and a review process are legal requirements, and that is
  a staffing cost.

**Conclusion: reference and embed. Do not host.** This is not a temporary
constraint to grow out of — it is the correct architecture for what SCROLL is.
The shared experience does not require owning the pixels. `video_sources` has
`scroll` declared and disabled precisely so this stays a deliberate decision
rather than a drift.

---

## Cost drivers ranked

What actually costs money, most likely first:

1. **Realtime concurrent connections** — the first thing to exceed a free tier,
   and the dominant cost at every scale after.
2. **Video bandwidth, if SCROLL ever hosts video** — would dwarf everything
   else combined. Currently zero because SCROLL hosts nothing.
3. **Database egress** — profile photos, then query volume.
4. **Database size** — slow-growing; match history is the part that grows
   unboundedly and should be capped.
5. **Storage** — avatars only, and they are downscaled on-device. Small.
6. **Auth MAU** — generous free allowance; unlikely to bind before 100k.
7. **Edge Functions** — 500k free invocations. Account deletion and receipt
   validation are low-frequency.
8. **Bots** — ~144 kB total, no processes. Effectively free at any scale, which
   was the design goal.
9. **Moderation** — becomes a *people* cost long before a technical one.

---

## Things that would be expensive and are deliberately absent

- An always-on game server or websocket service.
- A managed video platform (Mux, Cloudflare Stream) — usage-based, but usage
  means video, and video is the expensive thing.
- A hosted analytics product.
- A managed search service.
- Kubernetes, or any always-on compute.

Each would add fixed monthly cost for capability SCROLL does not need at its
current size.

---

## Do not optimise yet

Things that are wrong but should stay wrong until there is a reason:

- `searchPeople` uses `ilike '%q%'`. Fine at 1,000 profiles. Add a trigram
  index when search feels slow, not before.
- Bots are fetched as one list and cached. Fine at 200. Revisit at 10,000, and
  there will never be 10,000.
- `cleanup_stale_lobbies` is called opportunistically. Fine while lobbies are
  rare. Move to `pg_cron` when they are not.
- The client computes scores. Fine until there is something worth cheating for.

Premature versions of any of these cost time now and save nothing.

---

## If you return to a paused project

Supabase pauses free projects after 7 days of inactivity, so after a few months
away it will be paused. Open the dashboard and restore it; data is retained.
Then run `npm run check:backend` to confirm tables, bucket, RLS and providers
are as expected.
