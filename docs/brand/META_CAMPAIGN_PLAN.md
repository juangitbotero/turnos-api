# Turnos — Meta campaign plan (worker waiting list)

Goal: the maximum number of **activatable** Lisbon workers on the waiting list,
at the lowest cost per qualified signup — and a clear read on whether supply is
dense enough to set a launch date.

Assets: 47 statics in `docs/brand/ad-campaign/`, two videos (16s and 41s).
Placements: Instagram Reels, Stories and Feed, plus Facebook.

> Numbers marked **(assumption)** are planning figures, not benchmarks. Replace
> every one of them with your own week-1 data. Nothing here is based on Turnos
> performance history, because there isn't any yet.

---

## 0. Cut one audience before you spend anything

**Do not target tourists.** This is not a preference, it is arithmetic.

`calculateProfileQualityScore()` awards **NIF 30 points** and **IBAN 20 points**,
and a worker must reach **≥80 of 100** to enter `PENDING_REVIEW`. Without a
Portuguese NIF and IBAN the ceiling is 50 — **a tourist cannot be activated, no
matter how motivated they are.** On top of that, MCD is a Portuguese employment
contract requiring a Social Security number, and the compliance engine files an
SS Direta notification before every shift.

Every tourist signup is a lead you pay for, that pollutes your list, that
inflates your waiting-list number, and that can never work a shift. It would
also make your launch-readiness signal read high when it isn't — the most
expensive kind of wrong.

The rest of your instinct is right: **students, athletes, artists, expats** are
all people whose real constraint is *schedule*, which is exactly what Turnos
sells. Keep them; just add the residency filter (§4).

---

## 1. The decision that matters most: where the click lands

You asked whether to send people straight to the Kit form or via the landing
page. There is a third option that usually beats both, and the honest answer is
that this should be a **structured test**, not a guess — it is the single
highest-leverage variable in the whole plan.

| Route | Friction | Intent quality | Needs |
|---|---|---|---|
| **A · Meta Instant Form** | Lowest — never leaves the app, name/email pre-filled | Lowest, unless you add qualifying questions | Leads objective + Kit sync |
| **B · Landing page → form** | Highest — page load, scroll, then type | Highest — they read what Turnos is first | Pixel + a Lead event |
| **C · Instant Form + 2 qualifying questions** | Low | **High** — the questions do the filtering | Leads objective + Kit sync |

**Recommendation: run C as your primary, B as a 30% test.**

C wins because your problem is not *volume of clicks*, it is *volume of people
who can actually be activated*. A qualifying question inside the form removes
the unqualified lead **before you pay for a landing-page visit**, and Meta's
lead-optimisation then learns to find more people who answer the way you want.

The two questions to ask — both are the activation gate in disguise:

1. **"Do you have a Portuguese NIF?"** — Yes / Not yet
2. **"Which best describes you?"** — Student · Working part-time · Between jobs ·
   Freelancer/artist · Other

Do **not** ask for a phone number in the form. It measurably depresses
completion, and the app collects it at OTP signup anyway.

Keep the **"Read more"** secondary action pointing at the landing page. It costs
nothing, and the people who click it are your highest-intent segment — build a
custom audience from them (§7).

### If you send traffic to the landing page

`turnos.systeme.io/en/turnos` is English-only and the form sits at the **bottom
of a long page**. Two fixes before you spend on route B:

- **Add an anchor link** so the ad's CTA lands on the form, not the top of the
  page. Every scroll is drop-off.
- **Check mobile load time.** Over 90% of Meta traffic is mobile, and systeme.io
  pages can be heavy. If it takes more than ~3s on 4G, route B loses to route C
  before the creative gets a chance.

---

## 2. Prerequisites — do these before the first euro

Skipping any one of these makes the campaign unmeasurable, which is worse than
not running it.

| # | Task | Why it blocks |
|---|---|---|
| 1 | **Meta Pixel on the systeme.io landing page**, firing a `Lead` event on form submit | Without it, route B cannot be optimised or even compared. systeme.io supports pixel injection in settings |
| 2 | **Kit ↔ Meta Instant Form sync** (native integration or Zapier/Make) | Otherwise leads sit in Ads Manager and you download CSVs by hand, and nobody does that consistently |
| 3 | **A Lisbon-only check on the Kit form** | Someone in Porto signing up is not bad, but must be tagged separately or your launch signal is wrong |
| 4 | **Decide the Special Ad Category answer** — see below | Wrong answer = rejected ads or a wasted targeting setup |
| 5 | **UTM tags on every destination URL** | `utm_source=meta&utm_campaign=waitlist&utm_content={{ad.name}}` |

### How the Kit form and Meta actually connect — they don't, directly

A common and expensive misunderstanding. **A Meta Instant Form is not your Kit
form.** They are two different destinations and you pick one:

| `Destino` setting | What happens |
|---|---|
| **Formulario instantáneo** | Meta shows *its own* form inside the app. Leads land in Meta's Lead Center. Your Kit form is not involved |
| **Sitio web** | Meta sends the click to your landing page, where your Kit form does the work as normal |

You cannot embed a Kit form inside an Instant Form. With route C (Instant Form)
the "connection" to Kit is a **one-way sync that runs after the lead is
captured**, and it has to be built before launch.

#### Building the form (`Crear formulario`)

| Setting | Choose | Why |
|---|---|---|
| Form type | **Más volumen** | The qualifying questions do the filtering. `Más intención` adds a review step on top — hold it in reserve if lead quality disappoints |
| Fields | **Email + full name only** | No phone. It measurably depresses completion and the app collects it at OTP signup anyway |
| Custom question 1 | *"Do you have a Portuguese NIF?"* — Yes / Not yet | This is the activation gate (§0) asked up front |
| Custom question 2 | *"Which best describes you?"* — Student · Working part-time · Between jobs · Freelancer/artist · Other | Segments the list and tells you which creative angle to lean into |
| **Privacy policy URL** | **Required — Meta will not publish the form without one** | See the blocker below |
| Completion screen | Thank-you + button to the landing page | Recovers the "read more" behaviour the Instant Form otherwise loses |

⚠️ **Blocker: the privacy policy URL is mandatory.** Meta rejects any Instant
Form without one, and collecting emails from EU residents needs it regardless of
Meta. Confirm `turnos.systeme.io` has a reachable privacy policy that covers
waiting-list email collection before building the form, or the campaign stops
here.

#### Getting the leads into Kit

Three routes, in order of reliability:

1. **Zapier or Make** — trigger *New Lead in Facebook Lead Ads*, action *Add
   Subscriber in Kit*. The standard route and the one to plan for.
2. **A native Kit integration**, if one exists for Meta Lead Ads in your plan —
   check Kit's integrations page first, since it removes a moving part.
3. **CSV export from Meta Lead Center** — works, but it is manual and nobody
   does it consistently. Fallback only.

Two things that have to happen for any of them:

- **Grant Lead Access at the Page level.** Instant Forms belong to the Facebook
  **Page**, not the ad account. In Business Suite → Page settings → *Lead
  Access*, give the CRM/integration access. Missing this is the usual reason a
  correctly-built Zap receives nothing.
- **Turn the sync on BEFORE the ads go live.** Zapier only picks up leads
  created *after* the Zap is switched on. Leads captured before it exists are
  recoverable only by CSV.

#### Runbook — connecting a campaign that is already running

Order matters. Done in the wrong order you either send a broken first email to
your whole early list, or send nothing at all.

1. **Grant Lead Access** on the Page (above). Nothing works without it.
2. **Build the sync.** Trigger *New Lead in Facebook Lead Ads* → action *Add
   Subscriber* in Kit. Map email, name, and both custom answers.
3. **Write and finish the email**, and build the Kit automation that sends it
   (trigger: tag added). Finish this *before* anything can fire it.
4. **Test with Meta's Lead Ads Testing Tool** — submit a fake lead and follow it
   all the way to an email in your own inbox. Delete the test subscriber after.
5. **Import ONE real lead** from the CSV backlog. Confirm the email arrives and
   reads correctly.
6. **Import the remaining backlog.** Only now.
7. **Reconcile daily for the first week** — lead count in Meta against subscriber
   count in Kit. Silent sync breakage is common and invisible.

⚠️ Step 5 exists because an import into a live automation **sends immediately**.
Importing the whole backlog before testing means any mistake in the email
reaches every early lead at once, and those are the most valuable addresses on
the list.

#### The two ways an import silently sends nothing

Both were hit in practice on 2026-09-05, and neither reports an error.

1. **A form's confirmation email fires on form submission, not on import.** It
   belongs to the opt-in flow. Importing a subscriber never submits a form, so
   that email is simply not part of the path.
2. **Visual Automations do not fire retroactively.** A "subscriber added to
   tag" trigger fires on the *event* of the tag being applied. A subscriber who
   already carries the tag from before the automation existed will never enter
   it — so building the automation after importing reaches nobody already in.

**Therefore the backlog and the flow need different mechanisms:**

| For | Use | Why |
|---|---|---|
| Leads already sitting in Kit | **Broadcast**, filtered by tag | One-off send, fires on demand, gives open/click reporting |
| Every lead from now on | **Visual Automation** on tag-added | Fires per subscriber as the sync creates them |

Also confirm the imported subscribers show as **Confirmed / Active**, not
*Unconfirmed*. Kit will not send a broadcast to unconfirmed addresses, which is
a third way to send nothing without seeing an error.

⚠️ **Kit's "Import subscribers from ActiveCampaign" is not this.** It migrates a
list from ActiveCampaign, a rival email platform, and asks for *that* tool's API
URL and key. Meta has no equivalent credential and nothing pasted there will
work. Kit's importers are for moving between email platforms; Meta leads arrive
by CSV or by an automation, never by an importer.

#### Task volume — check the pricing tier before choosing

Every lead consumes one task/operation. At ~10 leads/day that is roughly **300
per month**, which exceeds Zapier's free tier (100 tasks). Make's free tier is
considerably larger. Check current limits before committing — this is a
recurring cost decision, not a one-off.

#### Test it before you spend

Meta's **Lead Ads Testing Tool** (`developers.facebook.com/tools/lead-ads-testing`)
submits a fake lead against your live form. Use it to confirm the whole chain —
form → sync → Kit subscriber, with the right tags — before a single euro of
delivery. A broken sync discovered on day 3 costs you every lead from days 1–3.

#### Tag on the way in

Map both custom answers to Kit tags: `nif-yes` / `nif-not-yet`, and
`student` / `part-time` / `between-jobs` / `freelancer`. The NIF tag is what
makes the **"% leads with a NIF"** metric in §8 measurable — without it you have
a subscriber count and no idea how much of it is real.

#### Skip `Prueba de formulario` at launch

The form A/B test compares up to five forms, and splitting an already-small
volume across variants means none of them reaches significance. Revisit once you
have a stable baseline CPL.

### ⚠️ Special Ad Category — check this in Ads Manager first

Meta requires ads for **employment** opportunities to be declared as a Special
Ad Category, which **removes detailed-interest targeting, age and gender
targeting, and forces a minimum radius**. If that declaration is required for
you, §4's entire interest list becomes unusable and you go broad by necessity.

The argument that it should *not* apply: Turnos is not advertising a specific
job vacancy — it is a waiting list for a platform. But Meta's classifier is
automated and errs toward flagging. **Create the campaign, look at what the
declaration step asks, and find out before you build audiences.** If it is
required, skip to §4's "broad" plan, which is the fallback anyway.

---

## 3. Campaign structure

Keep it deliberately small. The most common failure at this budget is
fragmenting spend across too many ad sets, so none of them ever exits the
learning phase.

```
Campaign: TURNOS · Waitlist · Lisbon          objective: LEADS
  budget: Advantage campaign budget (CBO), daily
  │
  ├── Ad set 1 · Broad Lisbon            70% of spend   → Instant Form (route C)
  ├── Ad set 2 · Interest stack          30% of spend   → Instant Form (route C)
  └── Ad set 3 · Landing page test       (week 2+)      → landing page (route B)
```

**Objective: Leads.** Not Traffic — traffic optimises for clicks, and clicks are
not the thing you need. Not Conversions unless prerequisite #1 is done and the
pixel has fired enough `Lead` events to learn from.

### Budget and the learning phase

Meta needs roughly **50 optimisation events per ad set per week** to exit the
learning phase and stabilise. That single fact should drive your budget, not
the other way round.

At an **assumed €3–6 per lead** for an Instant Form in Portugal *(assumption —
Portugal is a cheap market and Instant Forms are the cheapest lead route, but
treat this as a hypothesis)*, 50 leads/week costs €150–300/week per ad set.

| Tier | Daily | What it buys |
|---|---|---|
| **Minimum viable** | €15/day | One ad set only. Fragmenting at this level guarantees permanent learning phase |
| **Recommended start** | €30/day | Two ad sets can both stabilise. This is the plan above |
| **Scale** | €60+/day | Only after CPL is stable for 7+ days. Raise by ~20–30% at a time; bigger jumps reset learning |

Run for a **minimum of 14 days** before judging anything. Seven days is noise.

---

## 4. Audiences

### The honest framing first

Meta has spent years making detailed interest targeting less necessary and less
effective. **Creative is now the primary targeting mechanism** — the algorithm
reads who responds to which asset and finds more of them. In a geography the
size of Lisbon, over-narrowing actively hurts: you shrink the pool below what
the algorithm needs and CPMs rise.

So: **broad gets 70% of budget** and the interest stack is the challenger, not
the default. If broad wins — and it often does — believe it.

### Ad set 1 — Broad Lisbon

```
Location   Lisbon + 25km  ·  "People living in this location" (NOT "recently in")
Age        18–44
Language   English, Portuguese
Detailed   none
Advantage+ audience: ON
```

⚠️ **"People living in this location" is the setting that excludes tourists.**
The default includes people *recently* in the area. Change it.

### Ad set 2 — Interest stack

Same geo and age. Layer interests as a single broad OR-pool — do **not** use
narrowing ("AND") layers, which would collapse an already small audience.

| Cluster | Interests to search for |
|---|---|
| **Students** | Universidade de Lisboa · ISCTE · Universidade Nova de Lisboa · Erasmus Programme · Student · College life |
| **Flexible-schedule / gig** | Uber Eats · Glovo · Bolt Food · Freelancer · Part-time · Gig economy · TooGoodToGo |
| **Hospitality trade** | Bartending · Barista · Restaurant · Catering · Waiting tables · Hospitality industry · Event management |
| **Athletes** | Fitness and wellness · Gym · CrossFit · Surfing · Running · Yoga |
| **Artists / creatives** | Musician · Performing arts · Photography · Acting · Freelance creative |
| **Expats** | Expatriate · InterNations · Erasmus · Living abroad — *combine with English language setting* |

**Layer behaviours, not just interests**, where available: *Frequent
travellers*, *New to Lisbon*, and engagement with food-delivery apps are better
proxies for "wants flexible income" than any job-title interest.

### Ad set 3 — Landing-page test (week 2+)

Identical audience to whichever of 1 or 2 is winning, pointed at the landing
page. Purpose is to answer one question: **does route B produce better-quality
leads at a tolerable CPL premium?** Judge on activated workers, not on CPL.

### What you are *not* targeting, and why

- **Tourists** — cannot be activated. §0.
- **Under 18** — MCD contracts and Social Security registration make this a
  compliance problem, not an opportunity.
- **Porto and elsewhere** — beta is Lisbon. Signups from other cities are fine
  to collect but must be tagged and excluded from the launch-readiness number.

---

## 5. Creative plan

### Which asset goes where

| Placement | Format | Assets |
|---|---|---|
| **IG Reels + Stories** | 9:16 `1080×1920` | The **16s video** first. Then story versions of `A-nobody-told-you`, `C-passed-around`, `T-on-the-map`, `Z-find-take-show` |
| **IG + FB Feed** | 4:5 `1080×1350` preferred, 1:1 acceptable | `S-before-you-apply`, `P-pay-on-every-shift`, `G-we-take-nothing`, `B-free-always` |
| **FB Feed / longer attention** | 1:1 + video | The **41s video** |

**4:5 is worth generating** — it occupies more vertical feed space than 1:1 and
typically wins on cost per result. Run `node build.js` after adding
`{ w: 1080, h: 1350 }` to `SIZES`; the layout distributes automatically.

### Video

- **16s → Reels and Stories.** Right length for the placement. Make sure the
  hook lands in the **first 2 seconds** — that is where the scroll decision
  happens.
- **41s → Feed and retargeting.** Too long for cold Reels traffic. It earns its
  length with people who already know who you are.
- **Captions burned in, always.** The overwhelming majority of Meta video is
  watched muted.

### Which direction to lead with — a real test, not a preference

The three directions are different *arguments*, not just different looks:

| Direction | The argument | Hypothesis |
|---|---|---|
| **Quiet Signal** | "There is work near you that you can't see" | Best hook, weakest proof |
| **Drawn** | "This is what the deal is" | Best for the free/no-cut message |
| **In Hand** | "It exists, here is the screen" | Best for credibility — the usual blocker for an unlaunched brand |

Launch with **one asset from each** in the same ad set and let delivery decide.
Do not pre-judge. My guess is In Hand wins on an unknown brand, and that guess
is worth exactly nothing against two weeks of data.

### Volume and rotation

- **5–7 ads per ad set** at launch. Fewer starves the algorithm of options;
  more splits delivery so thinly that nothing learns.
- **Refresh when frequency passes ~2.5.** In a city-sized audience this arrives
  fast — expect to swap creative every 10–14 days. You have 47 statics, so
  this is a scheduling job, not a production one.

---

## 6. Copy

Full approved set in [`COPY_BANK.md`](./COPY_BANK.md) — 24 headlines by angle,
plus the rejected lines and why. Ad-specific structure:

**Primary text** — first line is the whole game; everything after "See more" is
a bonus.

```
There are cafés on your street that need someone this week. Nobody's told you.

Turnos is a shift app for Lisbon. See the place, the hours and the pay before
you apply — and keep every cent of it. We take no commission, ever.

Free for workers. Launching soon in Lisbon.
```

```
Work Thursday. Skip Friday. Nobody asks why.

Short shifts in bars, kitchens, events and retail across Lisbon. You pick what
fits your week. The company hires you and pays you directly — Turnos takes no
cut of your pay.

Join the waiting list for early access.
```

```
You receive the full gross.

No signup fee. No commission. No cut per shift — not now, not later. Turnos
never holds your wages; the company pays you directly.

Free for workers. Always.
```

**Headlines (short field):** *Free for workers. Always.* · *Shifts near you in
Lisbon* · *Know the pay before you apply* · *Get early access*

**CTA button:** `Sign Up` for the Instant Form. Not `Learn More` — it
under-promises and attracts browsers.

⚠️ **Copy compliance carries over.** No payment-speed claims, no invented
statistics, nothing positioning Turnos as an agency. §6 of
[`CAMPAIGN_SYSTEM.md`](./CAMPAIGN_SYSTEM.md) is the rule set, and it applies to
ad copy exactly as it applies to the creative.

---

## 6b. What happens after the lead — the confirmation email

An Instant Form lead never left Instagram. They did not read the landing page,
did not see the product, and gave you an address Meta pre-filled for them. The
"thanks" screen inside the form is not a relationship. **Send a real email
within minutes of signup**, for four reasons that are not about manners:

1. **They will not remember signing up.** If the first email from Turnos arrives
   at launch, weeks later, it reads as spam to the recipient — and gets marked
   as such, which damages deliverability for everyone else on the list.
2. **It validates the address.** Meta pre-fills, so typos and dead accounts get
   through. Bounces surface immediately instead of at launch.
3. **It is the moment of maximum intent.** Nothing you send later will be opened
   at this rate. Spend it on something useful, not on "thanks".
4. **Replies are the cheapest research you will ever get**, and they train the
   inbox provider that Turnos is wanted mail.

### Before writing the email: are the leads even reaching Kit?

If the Zapier/Make sync was not switched on before the ads went live, the leads
exist **only in Meta's Lead Center** and nothing downstream has them. Check
first, then:

- **Export the existing leads as CSV** from Lead Center and import to Kit,
  tagging them to match what the sync will apply.
- ⚠️ **Meta retains leads for 90 days.** After that they are gone from the Lead
  Center. This is not a "get to it eventually" task.
- Switch the sync on now so it is automatic from the next lead onward.

### ⚠️ Two silent failure modes in Kit

- **Double opt-in.** If the Kit form/sequence requires confirmation, imported
  leads receive a "confirm your subscription" mail and **nothing else until they
  click it**. Most will not. The Meta form already captured consent with a
  privacy policy, so single opt-in is defensible here — but check the setting
  rather than assume it, or the whole nurture silently does nothing.
- **Domain authentication.** Sending from a fresh domain without SPF and DKIM
  configured in Kit puts the mail in spam, where it will also never bounce
  visibly. Authenticate before the first send.

### What the email should do

Confirm, set expectations, and **pre-qualify** — the NIF/IBAN requirement is the
activation gate (§0), and telling people now is far cheaper than discovering at
launch that a third of the list cannot work. Frame it as "what to have ready",
never as a hurdle.

Ask one question and invite a reply. At this stage the founder reading fifty
replies is worth more than any dashboard.

### Cadence between now and launch

One email is not a nurture. A list that hears nothing for two months is a cold
list at launch, regardless of how it was built.

| When | Content |
|---|---|
| Immediately | Confirmation + what to have ready + one question |
| ~Day 4 | The problem Turnos exists to fix — the chat-group chaos angle |
| ~Day 14 | Progress note: how many people are on the list, which trades |
| Monthly | Short update. Keep it honest; "still building" is fine |
| Launch | Access link, sent to this list before anyone else |

Reuse the campaign copy — [`COPY_BANK.md`](./COPY_BANK.md) angles map directly
onto these emails, and the **41s video** belongs in one of the first two.

## 7. Retargeting (from week 2)

You will have built audiences by then whether you plan for them or not — plan
for them.

| Audience | Serve |
|---|---|
| Video viewers ≥50% (16s or 41s), 30 days | The 41s video, or `S-before-you-apply` |
| Landing-page visitors who did **not** submit, 30 days | `G-we-take-nothing` — objection-handling, straight to the form |
| Clicked "Read more" | Highest intent you have. Direct Instant Form |
| **Lookalike 1% of submitted leads** | Only once you have **≥300 leads**. Below that the seed is too small to be meaningful |

Exclude everyone who already converted, from every prospecting ad set. Paying
twice for the same person is the most common quiet waste in Meta accounts.

---

## 8. What to watch, and when to act

| Metric | Healthy *(assumption)* | If it's wrong |
|---|---|---|
| **CPL (Instant Form)** | €3–6 | >€10 after 14 days → creative problem before an audience problem |
| **CPL (landing page)** | €6–12 | Compare on *qualified* leads, not raw CPL |
| Hook rate (3s views / impressions) | >25% | Below → your first 2 seconds are wrong |
| CTR (link) | >1.0% | Below → offer or creative, not targeting |
| Frequency | <2.5 | Above → refresh creative |
| **% leads with a NIF** | **>70%** | **The number that actually matters.** Below → your targeting is reaching people who cannot be activated |

**Rules for yourself, set now while you're calm:**

- Change **one variable at a time**, and wait 3–4 days between changes.
- Do not touch an ad set in its first 3 days. Early CPL is noise.
- Kill an ad at **<0.5% CTR after 2,000 impressions**. Kill an ad set at
  **2× target CPL after 14 days**.
- Scale by **+20–30%**, never by doubling. Bigger jumps reset learning.

---

## 9. The launch decision

You said the campaign result decides when to launch. Then define it now, before
the data can be argued with.

**A waiting-list number is not a launch signal.** Turnos is a two-sided
marketplace and this campaign only fills one side. What matters is whether
there is enough *activatable, Lisbon-based* supply to make the first employer's
shifts fill — because an employer whose first shift gets no applicants does not
come back.

### The model, with its assumptions on the table

| Input | Value | Basis |
|---|---|---|
| Shifts needing cover in beta month 1 | 40 | ~10 employers × 4 shifts *(assumption)* |
| Applicants for a shift to feel healthy | 5 | *(assumption — Shifty markets a 98% fill rate; below ~5 you are one cancellation from an empty shift)* |
| Applications needed / month | 200 | 40 × 5 |
| Applications per active worker / month | 4 | *(assumption)* |
| **Active workers needed** | **50** | 200 ÷ 4 |
| Waiting list → active conversion | 15% | *(assumption — waiting lists decay hard between signup and activation, and the 80-point profile gate is real friction)* |
| **Lisbon waiting-list signups needed** | **≈330** | 50 ÷ 0.15 |

**Launch signal: ~350 Lisbon signups with a NIF**, plus a stable CPL you can
afford to keep paying.

Two things that should stop a launch even if you hit the number:

- **Skill concentration.** 350 people who all want bar work will not cover
  kitchen and events shifts. Check the spread across `SHIFT_CATEGORIES`, not
  just the total.
- **The employer side is not ready.** Per `docs/web-admin-handoff.md`, **no
  shift has ever completed in production** and the settings endpoints are
  untested. Worker supply cannot fix that, and launching into it wastes the
  supply you just paid for.

### Re-run the model with your real numbers

Every 15%-conversion assumption above is doing a lot of work. Once you have
100 signups, measure the actual conversion to a completed 80-point profile and
recompute. If it is 8%, the target is 625, not 330 — better to learn that at
100 signups than at 350.

---

## 10. Week-by-week

**Week 0 — setup.** Prerequisites §2. Build the Instant Form with both
qualifying questions. Generate 4:5. Assemble 6 ads: 2 video, 4 static, one from
each direction. Confirm the Special Ad Category answer.

**Week 1 — learn.** €30/day, ad sets 1 and 2 live. **Change nothing.** Watch
hook rate and NIF percentage, not CPL.

**Week 2 — cut and add.** Kill the bottom 2 ads. Add ad set 3 (landing page).
Build retargeting audiences. First read on which direction is winning.

**Week 3 — decide.** Route C vs route B on *qualified* leads. Scale the winner
+25%. Refresh creative if frequency >2.5.

**Week 4 — recompute.** Re-run §9 with real conversion data. You should now
know both your true cost per activatable Lisbon worker and how many weeks of
spend the launch threshold actually needs.
