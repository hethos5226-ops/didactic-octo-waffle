# SCROLL — Australian legal and regulatory position

**This is not legal advice.** It is engineering research, compiled to make the
open questions visible before development pauses. Where something is a
confirmed statutory requirement it is cited. Where it turns on judgement about
what SCROLL actually is, it is flagged as a question for a lawyer — and the
most important question on this page is one of those.

Compiled 30 August 2026. Regulation in this area is moving quickly; verify
against the primary sources before relying on any of it.

> **A caveat on sourcing.** The research environment could not reach
> `legislation.gov.au`, `esafety.gov.au` or `austlii.edu.au` directly, so the
> statements below come from those bodies' published pages as surfaced in
> search, and from law-firm analyses. Every item should be checked against the
> primary source before you act on it. Links are given for exactly that.

---

## 1. The question that matters most

**Is SCROLL an "age-restricted social media platform"?**

If it is, and it launches publicly, it must take reasonable steps to stop
anyone under 16 holding an account — and the audience most likely to want
SCROLL is the audience the law is about.

### What is confirmed

Australia's social media minimum age obligation is **in force since
10 December 2025**, under Part 4A of the *Online Safety Act 2021*, inserted by
the *Online Safety Amendment (Social Media Minimum Age) Act 2024*. Providers of
age-restricted platforms must take reasonable steps to prevent Australians
under 16 from creating or keeping an account. Civil penalties reach 150,000
penalty units for a corporation — reported as approximately **A$54.6 million**.
([eSafety — Social media age restrictions](https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions))

Section 63C defines an age-restricted social media platform by these limbs:

1. the sole or a **significant purpose** is to enable online social interaction
   between two or more end-users;
2. the service allows end-users to **link to, or interact with**, other
   end-users;
3. the service allows end-users to **post material**; and
4. any further conditions in the legislative rules.

Advertising purposes are disregarded when assessing limb 1.
([Online Safety Act 2021 s 63C, via AustLII](https://classic.austlii.edu.au/au/legis/cth/consol_act/osa2021154/s63c.html))

**The onus is on the provider to self-assess.** eSafety does not pre-approve
services; a provider must work out whether the obligation applies to it.
([Department of Infrastructure — Social media minimum age](https://www.infrastructure.gov.au/media-communications/internet/online-safety/social-media-minimum-age))

**Exclusions include online gaming**, along with messaging, voice and video
calling, and services whose primary purpose is education, health support or
professional development. Services publicly identified as excluded include
Discord, Messenger, Pinterest, YouTube Kids, **Roblox**, **Steam** and WhatsApp.
The platforms named as age-restricted from 10 December 2025 are Facebook,
Instagram, Kick, Reddit, Snapchat, Threads, TikTok, Twitch, X and YouTube.
([eSafety — Which platforms are age-restricted](https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions/which-platforms-are-age-restricted))

### Why SCROLL is genuinely ambiguous

SCROLL has an argument on both sides, which is precisely why this needs advice
rather than a decision by its developer.

**Points toward being caught:**

- Friends, friend requests, follows and a public profile directory — limb 2 is
  plainly met.
- Profiles, bios, handles and in-lobby chat are user-posted material — limb 3
  is met.
- Matching strangers to interact socially is arguably the significant purpose.
  SCROLL's own tagline is "meet someone".

**Points toward the gaming exclusion:**

- The unit of play is a session with rounds, scoring, XP and levels. The tab is
  literally PLAY.
- Roblox and Steam are excluded and both carry substantial social features —
  friends, chat, profiles — so social features alone do not defeat the
  exclusion.

**The trend is against complacency.** A May 2026 analysis is titled *"the net
widens, enforcement begins, and gaming platforms in the frame"*, indicating the
gaming exclusion is being read narrowly and game-like social services are under
active scrutiny.
([Clayton Utz, May 2026](https://www.claytonutz.com/insights/2026/may/social-media-minimum-age-restrictions-the-net-widens-enforcement-begins-and-gaming-platforms-in-the-frame))

> **Lawyer question 1 — the highest-stakes item in this repository.** Is SCROLL,
> as built, an age-restricted social media platform? The answer changes the
> product: compliance requires age assurance infrastructure that SCROLL has
> none of, and the realistic alternative is a 16+ minimum with real enforcement.

### If it is caught, what "reasonable steps" means

eSafety published regulatory guidance on **16 September 2025**. Reported
expectations:

- A **"successive validation" or "waterfall"** approach to age assurance.
- **Self-declaration alone is not sufficient** — a birthday field does not
  discharge the obligation.
- Deactivate or remove existing under-16 accounts, and prevent immediate
  re-creation.
- Actively mitigate circumvention.

Critically, **compliance is not "reasonable" unless privacy obligations are
also met** — Part 4A privacy rules, the Privacy Act and the APPs, with OAIC
guidance of its own.
([eSafety regulatory guidance](https://www.esafety.gov.au/industry/regulatory-guidance) ·
[OAIC — Social Media Minimum Age](https://www.oaic.gov.au/privacy/your-privacy-rights/social-media-minimum-age) ·
[DLA Piper analysis, Feb 2026](https://privacymatters.dlapiper.com/2026/02/australias-social-media-ban-and-the-esafety-commissioners-social-media-minimum-age-regulatory-guidance/))

This creates a real tension for a project whose stated principle is minimum
necessary data: robust age assurance means collecting more about a person, and
the privacy rules require not keeping it. Any implementation should use a
third-party age-assurance provider that returns a yes/no, and store the
**result** rather than the evidence.

> **Lawyer question 2.** If age assurance is required, what may be collected,
> what must be destroyed, and how soon?

---

## 2. Privacy

### Confirmed

- The **statutory tort for serious invasion of privacy commenced 10 June 2025**.
  A claimant must show a reasonable expectation of privacy, that the invasion
  was serious, and that the privacy interest outweighs countervailing public
  interest. **Financial loss need not be proven.** This matters more than the
  exemption below, because the tort is not limited to APP entities.
  ([BAL Lawyers — Privacy Act reforms](https://ballawyers.com.au/essential-guide/essential-guide-privacy-act-reforms/))

- The **small business exemption (under A$3 million turnover) has not been
  repealed.** Removing it is a proposed second-tranche reform that the
  Government supports in principle; as of mid-2026 no second-tranche Bill has
  passed and no commencement date is fixed.
  ([ComplianceKit — OAIC small business exemption status 2026](https://compliancekit.co/blog/oaic-small-business-exemption-removed))

- The **Children's Online Privacy Code** is in exposure draft and **must be
  registered by 10 December 2026** — during or just after your HSC break.
  Commencement and transition are not yet confirmed. It applies to APP entities
  providing a social media service, relevant electronic service or designated
  internet service that is **likely to be accessed by children**.
  ([OAIC — Children's Online Privacy Code](https://www.oaic.gov.au/privacy/privacy-registers/privacy-codes/childrens-online-privacy-code) ·
  [Bird & Bird analysis](https://www.twobirds.com/en/insights/2026/australia/designed-for-kids-regulated-for-all))

### What this means for SCROLL

SCROLL is very likely under the turnover threshold today, so the APPs may not
bind it *yet*. Relying on that would be a mistake for three reasons: the
exemption is under active reform; the privacy tort applies regardless; and the
minimum-age guidance ties "reasonable steps" to meeting privacy obligations
anyway.

Building to the APPs now is cheap. SCROLL already collects very little, stores
reactions as counts rather than events, keeps no viewing history, processes
photos on-device, and offers working account deletion.

**One APP 8 item needs an answer before launch:** Supabase hosts data in a
region chosen at project creation. If SCROLL's project is not in Australia,
that is an overseas disclosure and must be disclosed in the privacy policy.
**Confirm the region in the Supabase dashboard.** This is a five-minute check
and a required disclosure.

> **Lawyer question 3.** Is SCROLL an APP entity now? Should it act as one
> regardless? And does the Children's Online Privacy Code apply once registered?

---

## 3. User-generated content, moderation and safety

### Confirmed

The *Online Safety Act 2021* is administered by the eSafety Commissioner, whose
scheme includes Basic Online Safety Expectations and industry codes, with
powers to require information and issue removal notices.
([eSafety — Regulatory guidance](https://www.esafety.gov.au/industry/regulatory-guidance))

### What SCROLL already has

Reporting (nine reasons, subject-scoped, immutable status), blocking that is
private to the blocker and enforced by database policy in both directions,
account suspension state, working account and data deletion, and community
guidelines in Settings.

### What is missing

A moderation review process, an appeals path, a published contact route, and a
retention policy for moderation records. None of it matters at zero users; all
of it matters before strangers are matched with each other.

> **Lawyer question 4.** What obligations attach at launch, and does the size of
> the service change them?

---

## 4. Advertising

Nothing is active. If SCROLL ever advertises, the confirmed constraints are the
Australian Consumer Law's prohibitions on misleading conduct, the AANA codes,
and materially stricter rules for advertising to children. SCROLL's ad boundary
carries no user identifier at all, which avoids most consent questions by
construction.

> **Lawyer question 5.** If any users are minors, what advertising is permitted?

---

## 5. Subscriptions and consumer law

Nothing is active. Confirmed constraints when it is: consumer guarantees under
the ACL cannot be excluded; automatic renewal must be clearly disclosed; and
both app stores require their own billing for digital subscriptions, taking
15–30%. SCROLL's entitlement architecture already assumes store billing.

---

## 6. The name "SCROLL" — trademark risk

**I could not confirm the status of any Australian trade mark for "SCROLL", and
this document does not claim one way or the other.** What follows is the
framework and what must actually be searched.

### Why the risk is real

"Scroll" is an ordinary English word, and in a social-media context it is close
to descriptive of what users do. Australian examiners assess whether other
traders would legitimately want to use the sign; a mark that is descriptive or
lacking inherent adaptation to distinguish faces objection under s 41 of the
*Trade Marks Act 1995*, and may need evidence of acquired distinctiveness —
which a pre-launch app cannot have.
([IP Australia — searching existing trade marks](https://www.ipaustralia.gov.au/trade-marks/search-existing-trade-marks))

Two distinct risks, often confused:

1. **You cannot register it** — likely, on descriptiveness grounds alone, for a
   plain word mark in the relevant classes.
2. **Someone else already has it** — which could force a rename after launch.

The second is far more damaging, and it is cheap to check now.

### What to search, before launch

Use [Australian Trade Mark Search](https://www.ipaustralia.gov.au/trade-marks/search-existing-trade-marks)
(free) for "SCROLL" and near-identical marks in:

- **Class 9** — software and mobile applications
- **Class 38** — telecommunications and streaming
- **Class 41** — entertainment services
- **Class 42** — SaaS and platform services

Also check: business name availability (ASIC Connect), `scroll.com.au` and
`.app` domain availability, and app-store name collisions, since Apple and
Google both refuse duplicate names regardless of trade mark status.

### Practical mitigation

A composite or stylised mark, or a distinctive pairing ("SCROLL Together", a
logo lockup), is far more registrable than the bare word, and gives protection
the plain word would not. Deciding this **before** any marketing spend or
account creation is much cheaper than after.

> **Lawyer question 6.** Is "SCROLL" registrable in the relevant classes, is it
> already taken, and is a rename advisable before launch? A trade mark attorney
> answers this in one consultation, and it is the cheapest question on this page.

---

## 7. Priority order

1. **Age restriction self-assessment** (lawyer question 1). Could change the
   product; everything else is downstream.
2. **Trademark search** (question 6). Cheapest to fix now, most expensive after
   launch.
3. **Confirm the Supabase data region.** Five minutes; required disclosure.
4. **Watch the Children's Online Privacy Code** — registration due 10 December
   2026.
5. **Privacy Policy and Terms drafted properly** before any public launch.
6. **Moderation review process** before strangers are matched.

Items 1 and 2 are worth resolving before writing more code, because both can
invalidate work done in the meantime.

---

## Sources

- [eSafety — Social media age restrictions](https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions)
- [eSafety — Which platforms are age-restricted](https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions/which-platforms-are-age-restricted)
- [eSafety — Regulatory guidance](https://www.esafety.gov.au/industry/regulatory-guidance)
- [eSafety — SMMA Regulatory Guidance (PDF, Sept 2025)](https://www.esafety.gov.au/sites/default/files/2025-09/eSafety-SMMA-Regulatory-Guidance.pdf)
- [Department of Infrastructure — Social media minimum age](https://www.infrastructure.gov.au/media-communications/internet/online-safety/social-media-minimum-age)
- [Online Safety Act 2021 s 63C (AustLII)](https://classic.austlii.edu.au/au/legis/cth/consol_act/osa2021154/s63c.html)
- [OAIC — Social Media Minimum Age](https://www.oaic.gov.au/privacy/your-privacy-rights/social-media-minimum-age)
- [OAIC — Privacy Guidance on Part 4A (PDF)](https://www.oaic.gov.au/__data/assets/pdf_file/0025/257146/OAIC-SMMA-Privacy-Guidance.pdf)
- [OAIC — Children's Online Privacy Code](https://www.oaic.gov.au/privacy/privacy-registers/privacy-codes/childrens-online-privacy-code)
- [Clayton Utz — the net widens, enforcement begins (May 2026)](https://www.claytonutz.com/insights/2026/may/social-media-minimum-age-restrictions-the-net-widens-enforcement-begins-and-gaming-platforms-in-the-frame)
- [DLA Piper — eSafety SMMA regulatory guidance (Feb 2026)](https://privacymatters.dlapiper.com/2026/02/australias-social-media-ban-and-the-esafety-commissioners-social-media-minimum-age-regulatory-guidance/)
- [Bird & Bird — Australia's draft Children's Online Privacy Code](https://www.twobirds.com/en/insights/2026/australia/designed-for-kids-regulated-for-all)
- [BAL Lawyers — Privacy Act reforms guide](https://ballawyers.com.au/essential-guide/essential-guide-privacy-act-reforms/)
- [ComplianceKit — small business exemption status 2026](https://compliancekit.co/blog/oaic-small-business-exemption-removed)
- [IP Australia — search existing trade marks](https://www.ipaustralia.gov.au/trade-marks/search-existing-trade-marks)
