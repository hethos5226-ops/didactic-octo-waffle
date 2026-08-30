# SCROLL — legal readiness checklist

**This is not legal advice, and nothing here is approval to launch.** It is a
checklist of what will need addressing, written by an engineer so that the work
is visible in advance rather than discovered at submission. Several items
genuinely require a lawyer, and those are marked.

Nothing here has been done. Everything is unchecked on purpose.

---

## Status

SCROLL is an unreleased prototype. It is not published to any app store, takes
no payment, and has no users beyond its author. **Most obligations below are
not yet triggered.** They trigger at public launch, and several must be
designed for before then because retrofitting is expensive.

---

## Documents needed before any public launch

- [ ] **Privacy Policy** — published, versioned, dated, reachable without an
      account. [PRIVACY.md](PRIVACY.md) describes what the code does and is the
      raw material; it is not a policy.
- [ ] **Terms of Service** — acceptable use, suspension and appeals, liability,
      governing law (NSW/Australia), dispute resolution.
- [ ] **Community Guidelines** — in-app text exists in Settings; needs review
      against store requirements.
- [ ] **EULA** — Apple provides a standard one; a custom EULA needs review.

The in-app documents are honest descriptions written by an engineer. They are
explicitly labelled as such and must be replaced.

---

## Age

- [ ] **Set a minimum age and enforce it.** Nothing currently asks.
- [ ] **Under-13 (COPPA, US) / under-16 (GDPR, EU).** Both impose heavy
      obligations. Simplest defensible position for a small app: 13+ or 16+
      minimum with an age gate at sign-up.
- [ ] **Australia's under-16 social media restrictions are now in force**
      (10 December 2025). Whether SCROLL is caught turns on the gaming
      exclusion versus its social features, and it is genuinely ambiguous.
      Researched with sources in [LEGAL_AUSTRALIA.md](LEGAL_AUSTRALIA.md) —
      read that first; it is the highest-stakes open question in the project.
- [ ] **Age rating** for both stores. Strangers + user content + chat pushes
      the rating up regardless of intent.

This is the single most consequential item on the list, because SCROLL matches
people with strangers and the audience most drawn to it is young.

---

## User-generated content and moderation

SCROLL currently hosts no user video. It does host handles, display names, bios
and free-text report details, and lobbies have chat.

- [ ] **Notice and takedown** process, with a contact route.
- [ ] **Moderation review** — `reports` exists; the review side does not.
- [ ] **Suspension and appeals.** `profiles.status` supports suspension; no
      process exists.
- [ ] **CSAM obligations.** Non-negotiable and jurisdiction-wide. If SCROLL
      ever accepts image or video upload, scanning and reporting become legal
      requirements — a strong argument for never hosting video.
- [ ] **Australian Online Safety Act 2021** — eSafety Commissioner's Basic
      Online Safety Expectations apply to services like this. Review before
      launch.
- [ ] **Record retention** for reports and moderation decisions.

Implemented already: report a user or video, block a user (private, and
enforced by policy in both directions), account and data deletion.

---

## Australian obligations

- [ ] **Privacy Act 1988 / Australian Privacy Principles.** The under-$3m
      small-business exemption is under active reform and should not be relied
      on. Build to the APPs.
- [ ] **APP 1** — open and transparent management; a clear policy.
- [ ] **APP 5** — notify at collection.
- [ ] **APP 6** — use only for the purpose collected.
- [ ] **APP 8** — cross-border disclosure. **Supabase hosts data in a region
      you choose; confirm which, and disclose it.** If it is not Australia,
      that is an overseas disclosure and must be stated.
- [ ] **APP 11** — security. RLS and the test suite are real work toward this.
- [ ] **APP 12/13** — access and correction rights. Deletion exists; export
      does not.
- [ ] **Notifiable Data Breaches scheme** — a written response plan.
- [ ] **Australian Consumer Law.** Consumer guarantees cannot be excluded.
      Subscription terms must not misrepresent refund rights.
- [ ] **Spam Act 2003** — consent and unsubscribe for any marketing email.
      Transactional email (confirmation, password reset) is fine.

---

## Apple App Store

Required before submission of a native app:

- [ ] **Privacy Policy URL** and **Support URL** — both mandatory.
- [ ] **Privacy Nutrition Labels** — declare every data type collected. SCROLL's
      minimal collection makes this genuinely easy, which is a real benefit of
      the position taken in PRIVACY.md.
- [ ] **Account deletion in-app** — *required* by App Store Review Guideline
      5.1.1(v) for any app with account creation. **Already implemented.**
- [ ] **Sign in with Apple** — required if other third-party sign-in is offered.
      Already wired; needs a paid Apple Developer account (~A$149/year) to
      configure.
- [ ] **Guideline 1.2 (UGC)** — filtering, reporting, blocking, and a way to
      contact the developer. Reporting and blocking exist.
- [ ] **In-app purchase** — digital subscriptions **must** use Apple's IAP.
      Apple takes 15–30%. Bank transfer or Stripe for in-app digital goods
      would be rejected.
- [ ] **Age rating questionnaire**, answered honestly about UGC and contact
      with strangers.
- [ ] **App Privacy Report** obligations.
- [ ] **Camera/microphone/photo usage descriptions** in `Info.plist` if
      reaction recording is ever built — with strings explaining *why*, or
      review will reject.

## Google Play

- [ ] **Privacy Policy URL** and **Data safety form**.
- [ ] **Account deletion** — required, and must also be reachable from a web
      URL, not only in-app.
- [ ] **User-generated content policy** — reporting, blocking, moderation.
- [ ] **Google Play Billing** for digital subscriptions. 15–30%.
- [ ] **Target API level** requirements, which change annually.
- [ ] **Families policy** if the rating allows under-13s. Avoid this.

---

## Subscriptions

- [ ] Price, duration, renewal terms and cancellation shown **before** purchase.
- [ ] Auto-renewal disclosed clearly (both stores enforce this).
- [ ] Restore purchases (Apple requires it).
- [ ] Server-side receipt validation. Architecture is prepared: `entitlements`
      is writable only by the service role.
- [ ] Refund handling consistent with Australian Consumer Law.
- [ ] Tax. App stores handle GST/VAT collection in most jurisdictions —
      confirm.

Nothing is active, so nothing is currently owed.

---

## Advertising

- [ ] Ads clearly labelled — implemented as a required `disclosure` field.
- [ ] No behavioural targeting without consent. SCROLL's ad boundary carries no
      identifier, which avoids most of this entirely.
- [ ] **Do not advertise to children** without meeting the far stricter rules.
- [ ] Australian Association of National Advertisers codes.
- [ ] Disclose any ad SDK in store privacy declarations. Currently none.

---

## Copyright and video

The most legally sensitive area, and the reason the architecture is what it is.

- [ ] **Never scrape.** No scraping of Instagram, TikTok, YouTube or anything
      else. Breaches terms and likely CFAA-equivalent laws.
- [ ] **Never proxy or re-host** third-party video.
- [ ] **Embed only where terms permit**, using the platform's own player.
      `video_sources.rights` records this per source.
- [ ] **YouTube** — IFrame Player API is permitted under YouTube's Terms;
      read them, particularly around ads and modification.
- [ ] **Instagram** — oEmbed requires an approved Meta app. No API returns a
      personal feed.
- [ ] **TikTok** — embed SDK for public videos. No feed access.
- [ ] **DMCA / Australian safe harbour** — a designated agent and takedown
      process if SCROLL ever hosts anything.
- [ ] **Music licensing.** A significant unresolved risk if SCROLL ever hosts
      video, since short-form video is mostly music. Embedding leaves this with
      the platform, which is another argument for embedding.

Current position: SCROLL plays only its own generated content, fetches nothing
from any third party, and hosts nothing.

---

## Third-party sign-in

- [ ] **Google** — OAuth consent screen; verification if sensitive scopes are
      requested (SCROLL requests none). Branding guidelines apply.
- [ ] **Apple** — paid developer account; Sign in with Apple becomes mandatory
      once Google sign-in ships on iOS.
- [ ] Disclose in privacy policy what each provider receives.

---

## Security

- [x] Row-level security on every table, tested by execution rather than
      assumed — 86 assertions in CI.
- [x] No privileged credential in the client; build fails if one appears.
- [x] Server-owned columns that a client cannot escalate.
- [ ] Rate limiting. Supabase provides some at the Auth layer; application-level
      abuse (mass friend requests, report spam) is unaddressed.
- [ ] Penetration test before any significant launch.
- [ ] Breach response plan.
- [ ] Dependency scanning — Dependabot is free and not enabled.

---

## Business

- [ ] Entity — sole trader vs company, if SCROLL takes revenue.
- [ ] ABN, and GST registration above the threshold.
- [ ] Trade mark search on "SCROLL". A common English word is a **hard** mark to
      protect and may already be registered in the relevant class. Worth
      checking early: a rename after launch is far more painful than before.
- [ ] Domain.
- [ ] Insurance if it becomes a real business.

---

## Realistic order when you return

1. Confirm the Australian under-16 position — it could change the product.
2. Age gate at sign-up.
3. Trade mark check on the name.
4. Confirm Supabase data region and disclose it.
5. Have a lawyer draft the Privacy Policy and Terms.
6. Build the moderation review side before inviting strangers.
7. Everything store-related only when a native app is real.

Items 1 and 3 are worth doing early precisely because they can change decisions
that are expensive to reverse.
