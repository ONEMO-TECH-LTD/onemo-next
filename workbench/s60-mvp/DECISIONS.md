# Session 60 — Decisions

Two states only: **LOCKED** (Dan has stated it as direction) and **OPEN** (raised, not settled).
Nothing moves to LOCKED without Dan's words behind it. Source is cited for every entry.

---

## LOCKED

### D0 — The deliverable is the ONEMO webshop, MVP v1
Not a capability programme, not more architecture. Seven months were spent overbuilding ahead of the product; that is the failure mode being corrected. Every proposal is measured against one question: does this get the webshop live?
*Source: Brief 60.5*

### D1 — Priority is the launch, not the platform
Strategic launch with MVP capabilities. The thing being tested is the **simplest browse → customise → buy flow**. Breadth of offering is explicitly not the goal.
*Source: Brief 60.4*

### D2 — Cut the offering to a strategic few pieces
The vast, fully-capable offering is not what launches. A narrow curated set is.
*Source: Brief 60.2*

### D3 — There is no Studio
No separate Studio page, no Studio destination, no Studio tier. "Studio" collapses into two controls that live on the product page: **change image** and **change shape**.
*Source: Brief 60.2*

### D4 — Customer-facing creation is exactly two capabilities
1. **Custom image** — upload, and position by dragging.
2. **Auto shape** — shaped effect via AI magic outline.

Nothing else is exposed to the customer at launch. No materials picker, no colour picker, no advanced geometry, no typography.
*Source: Brief 60.2*

### D5 — All creation happens in the shop, on the product page
Creation is part of browsing, not a separate mode or app. Swap the image, drag to position, generate the shape — inline, in the shop browsing experience.
*Source: Brief 60.2*

### D6 — Seasonal ONEMO artwork library carries the rest
Customers who do not want to create anything are served by a curated library of ONEMO seasonal artwork. Positioning: the art is strong and exclusive, so no creative effort is required of the customer.
*Source: Brief 60.2*

### D7 — Sizes are self-sufficient products, not on-page selectors
Each size is its own product, not a variant dropdown on a shared page. Shapes potentially follow the same rule.
*Source: Brief 60.2*

### D8 — The React converter stays
It transforms Figma designs into React and into Liquid for Shopify. It is on the critical path, not parked.
*Source: Brief 60.2*

### D9 — grid-lab stays
Under-the-hood grid → shape calculation: magnetic point layout and sizing. Not customer-facing; it is what makes an arbitrary shape manufacturable.
*Source: Brief 60.2*

### D10 — The two things that must remain
**grid-lab** and **AI magic shape**. Everything else in the editor programme is subject to the cut.
*Source: Brief 60.2*

### D11 — The previous engine is reused, not rebuilt
The engine originally built 3D-first and pivoted to the 2D editor carries forward.
*Source: Brief 60.2*

### D12 — The outlined shape must sit on the grid
An AI-outlined silhouette is only a product if its magnetic points land on the standardised grid. Magic outline must not be able to produce a shape grid-lab cannot lay out. This is what keeps the offering honest: everything shown is manufacturable (see R2), and a shape that cannot be gridded is not manufacturable.

**In flight elsewhere:** Dan is working with `@s59-pixel-designer` in Session 59 to streamline the shaper tool in grid-lab. Session 60 does not duplicate or dispatch into that work — it consumes the result.
*Source: Dan, 2026-07-30*

### D13 — No 3D at launch
The product pivoted away from 3D. React Three Fiber, three.js, drei and Theatre are out of MVP scope.

Measured containment (2026-07-30) — the 3D surface is six files and none are on the MVP path:
- `src/lib/effect/mesh.ts` and `src/lib/effect/build-mesh.ts` — consumed only by `ShapedModel.tsx` in the dev editor and one test.
- Four files under `src/app/(dev)/effect-creator/v5.3.1/` (`core/`, `core/shaped/`, `core/scene-format/`).

Consequence: three/R3F/drei/Theatre never enter a shipped customisation bundle. The engine's remaining runtime dependencies are clipper2, paper.js, and the ML worker.
*Source: Dan, 2026-07-30 — "react 3 fiber is for 3D we do not have 3d now (pivotted from it)"*

### D14 — The MVP creation surface is two paths off one product page
Both end in the basket:
1. Pick artwork from the carousel (5–6 ONEMO pieces), or upload your own image → add to basket / buy.
2. Upload → press **Magic Shape** → select size → add to basket / buy.

Nothing else. No studio, no editor destination, no second page.
*Source: Brief 60.6*

### D15 — Replicate SKYLRK's shop/carousel logic, styled as ONEMO
Take the interaction and layout structure — not the styling. Confirmed live on skylrk.com 2026-07-30 and mapped element by element in `SPEC-mvp-product-page.md`.

Load-bearing pieces: vertical drag-and-snap main-stage carousel (Embla, column axis) with adjacent slides bleeding off the edges; bottom-left horizontal glass thumbnail strip of six; bottom-right frosted glass info card; one full-width action button with a state-dependent label; mono uppercase bracket labels.

Corroborating fact: SKYLRK runs a **custom classic Shopify Liquid theme** — same family as `onemo-theme` — achieving the whole look in ~70 KB CSS + ~643 KB JS on stock Shopify. Direct evidence for Option A in `AUDIT-mvp-surfaces.md`.
*Source: Brief 60.6; live inspection; s58 teardown @ 354e790*

### D16 — The main-stage carousel swaps vertically between mini and maxi
Not a variant selector — a vertical swap between the size products, consistent with D7 (sizes as self-sufficient products). Subject to O2: if a single size ships, the main stage swaps preset effects instead.
*Source: Brief 60.6*

### D17 — T-shirt pre-order rides the same carousel
Different preset effects carrying ONEMO art, on the same pattern as the effects themselves.
*Source: Brief 60.6*

---

## OPEN

### O1 — All pricing
No price is settled. Figures raised in the transcript were exploratory only: ~£30–40 for a single small effect, ~£60 for a Mini pair, ~£120–140 for a Classic pair, £120+ for bespoke, £120–200 for a launch t-shirt with a £50 deposit. Dan stated explicitly that pricing is still to be discussed, including whether to open premium-narrow or affordable-broad.
*Source: transcript*

### O2 — Which sizes ship at launch
Twin Fix works at ~70 mm and ~115 mm. Dan noted large sizes do not make sense for Twin Fix (clamping a garment with two large pieces would be unwieldy). Whether launch is one size or two is not settled — Brief 60.6 explicitly floats "or we actually keep 1 size".

**This one now has a build consequence.** Per D16 the main-stage carousel swaps vertically between mini and maxi. With a single size there is nothing to swap, and the main stage has to do something else (swap preset effects). It changes what the central surface of the product page is *for*, so it is worth settling before that page is built.
*Source: transcript; Brief 60.6*

### O3 — Naming
"Mini" and "Classic" were landed on warmly in the transcript as a direction — product language rather than tier language or measurements. Not confirmed by Dan as final. Tier words (Basic, Premium, Core, Essential) were all considered and cooled on.
*Source: transcript*

### O4 — Whether double-sided is a launch asset or a later upgrade
The transcript files it as a later premium upgrade. Its value as a launch marketing hook (four prints, two pieces, changed in one evening) has been raised but not decided.
*Source: transcript; raised in WIP*

### O5 — Pre-order / reserve-slot mechanic at launch
"Reserve your slot" with a refundable deposit was adopted in the transcript over voting, which Dan rejected outright. Whether any reserve mechanic ships in the MVP flow was previously leaning out.

**Now leaning in.** Brief 60.6 names t-shirt pre-order riding the same carousel as the effects (D17), which puts it on the product-page surface rather than beside it. Still unconfirmed as launch scope, but it is no longer a separate mechanic to defer — it is a state of the button that already exists.
*Source: transcript; Brief 60.6*

### O6 — Launch garment
A limited launch edition (order of 50 t-shirts, integrated grid) was discussed, possibly with a pocket-sized dense grid. Not confirmed as in scope for launch.
*Source: transcript*

### O7 — Subscriptions and creator tiers
Membership levels and creator commission were raised and explicitly deferred in the transcript. Out of scope for Session 60 unless Dan reopens.
*Source: transcript*

### O8 — Fit and garment compatibility
Not addressed anywhere. How the pair behaves across fabric weights, where it sits on a garment, and what the customer is told about compatibility with what they already own. Raised as a risk, not yet a decision.
*Source: raised in WIP*

---

## REJECTED

### R1 — Voting on unreleased features
Dan rejected this outright. His reasoning: voting signals the brand may not be able to deliver what it is showing, gives the customer no certainty, and is wrong in principle on a platform whose premise is that the customer authors their own piece. Pre-order was adopted in its place.
*Source: transcript*

### R2 — Showing anything that cannot be manufactured
Everything visible must be real and producible. The only open question a customer should ever have is *when*, never *whether*.
*Source: transcript*
