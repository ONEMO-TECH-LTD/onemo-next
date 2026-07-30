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

---

## OPEN

### O1 — All pricing
No price is settled. Figures raised in the transcript were exploratory only: ~£30–40 for a single small effect, ~£60 for a Mini pair, ~£120–140 for a Classic pair, £120+ for bespoke, £120–200 for a launch t-shirt with a £50 deposit. Dan stated explicitly that pricing is still to be discussed, including whether to open premium-narrow or affordable-broad.
*Source: transcript*

### O2 — Which sizes ship at launch
Twin Fix works at ~70 mm and ~115 mm. Dan noted large sizes do not make sense for Twin Fix (clamping a garment with two large pieces would be unwieldy). Whether launch is one size or two is not settled.
*Source: transcript*

### O3 — Naming
"Mini" and "Classic" were landed on warmly in the transcript as a direction — product language rather than tier language or measurements. Not confirmed by Dan as final. Tier words (Basic, Premium, Core, Essential) were all considered and cooled on.
*Source: transcript*

### O4 — Whether double-sided is a launch asset or a later upgrade
The transcript files it as a later premium upgrade. Its value as a launch marketing hook (four prints, two pieces, changed in one evening) has been raised but not decided.
*Source: transcript; raised in WIP*

### O5 — Pre-order / reserve-slot mechanic at launch
"Reserve your slot" with a refundable deposit was adopted in the transcript over voting, which Dan rejected outright. Whether any reserve mechanic ships in the MVP flow — versus being deferred as out of scope for browse → customise → buy — is not settled.
*Source: transcript*

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
