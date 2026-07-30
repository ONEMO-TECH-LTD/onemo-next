# Session 60 — WIP

Aggregation surface: thought process, ideas, open threads, risks. Nothing here is a decision.
Decisions live in `DECISIONS.md`. Dan's directives live in `briefs/Brief.md`.

---

## The frame

Seven months went into capability built ahead of the product. Session 60 corrects that. The deliverable is **the ONEMO webshop, MVP v1** — and the test is the simplest possible **browse → customise → buy** flow.

The discipline for this session: every proposal answers *does this get the webshop live?* If the answer needs a paragraph, the answer is no.

---

## What the MVP flow actually is

Stripped to Dan's direction, the entire customer journey is:

```
Browse a small set of products (each size / shape is its own product)
        ↓
On the product page:
   • take the ONEMO seasonal artwork as-is          ← default, zero effort
   • or swap in your own image, drag to position    ← custom image
   • or generate a shaped effect via magic outline  ← auto shape
        ↓
Price
        ↓
Checkout
```

Three things carry it: the **product pages**, the **two inline controls**, and **checkout**. There is no Studio, no separate creation mode, no configurator destination.

## Why "sizes are self-sufficient products" matters more than it looks

A size dropdown says *this is one thing with options*. Separate products say *these are different products*. That is a merchandising decision with real downstream effects:

- Each product gets its own page, its own photography, its own story — which is how a fashion catalogue behaves, and not how a configurator behaves.
- It removes a decision from the customer at exactly the moment decisions cost conversion.
- It maps cleanly onto a normal commerce catalogue rather than a variant matrix.
- Cost: more catalogue entries to manage, and shared inventory logic has to be handled deliberately rather than inherited from the variant model.

Same logic likely applies to shapes, per Dan's "(and potentially shapes)".

## What stays, and why it is not overbuilding

Dan named two survivors and one tool. They survive because they are load-bearing for the MVP flow, not because they are impressive:

- **grid-lab** — turns an arbitrary shape into a manufacturable one: magnetic point layout and sizing. Without it, "auto shape" produces a picture, not a product. It is the thing that makes the magic outline honest.
- **AI magic shape** — one of the two customer-facing capabilities. It is the differentiator; a square with an image on it is not.
- **React converter** — Figma → React and → Liquid for Shopify. It is how design reaches the storefront. Not customer-facing, but it is the delivery pipe.
- **The previous engine** (3D-first, pivoted to 2D) is reused rather than rebuilt.

Everything else in the editor programme is subject to the cut.

## Risks worth holding

**The mechanic is not self-explanatory.** Twin Fix — two magnets clamping through ordinary fabric, no special garment needed — is the whole value proposition and it cannot be understood from a static product shot. Whatever the product page does, it has to make that land fast. This is a content and motion problem more than an engineering one, and it currently has no owner.

**Price is not defensible on materials.** Two small ultrasuede panels next to a printed t-shirt is a losing comparison until the system is understood. The framing that survives that comparison: one pair is two prints — four if double-sided — that move across every garment already in the wardrobe. That is a wardrobe multiplier, not an expensive patch. This is why pricing cannot be settled before the demonstration is solved.

**Fit is unaddressed.** "Will this work on what I already own?" is the first real buyer question — across fabric weights, knits, hoodies. There is no answer anywhere in the flow. Cheap to solve now, expensive after the first hundred orders.

**Nothing shown may be unmanufacturable.** The credibility of the whole offering rests on this. Magic outline in particular must not be able to produce a shape grid-lab cannot lay out — which is precisely why grid-lab is not optional.

## Ideas parked, not dead

- **Double-sided as a launch hook rather than a later upgrade.** Four prints across two pieces, changed in an evening, and people cannot work out how. It is the most shareable thing in the product. Worth revisiting whether holding it back costs the hook that makes this spread — noting it is a marketing decision, separable from what the buy flow exposes.
- **The seasonal artwork library is the brand, not a convenience.** Defaults win; the pre-selected artwork is what most people will buy, so it is the first thing anyone judges. It deserves designing as a collection, not assembling as a fallback.
- **Behaviour as demand data.** What customers reach for and abandon is a better signal than any survey, and it needs no voting UI — which Dan rejected outright. Worth capturing from day one even if nothing acts on it yet.

---

## Open threads

Tracked formally in `DECISIONS.md` under OPEN. Live ones for this session:

- Pricing — entirely unsettled (O1).
- Which sizes ship (O2) and what they are called (O3).
- Whether any pre-order / reserve mechanic is in MVP scope at all (O5) — leaning out, since it does not serve browse → customise → buy.
- Whether a launch garment is in scope (O6) — leaning out for the same reason.
- Fit and garment compatibility (O8).

---

## Next action

Audit what already exists in `onemo-next` against the three MVP surfaces — product pages, the two inline controls, checkout — and report what is reusable, what is in the way, and what genuinely has to be built. No new architecture proposed until that audit is on paper.
