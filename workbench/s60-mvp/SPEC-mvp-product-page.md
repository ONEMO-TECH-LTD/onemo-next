# MVP product page — spec from Dan's cut + SKYLRK pattern

Date: 2026-07-30. Source: Brief 60.6 (Dan) + live inspection of skylrk.com and its PDP, cross-read against the s58 teardown `onemo-ssot-global` @ 354e790 `_research/2026-06-29-skylrk-shop-dissection.md` (128 lines, read in full).

---

## The whole MVP, in Dan's terms

Two paths off one product page, both ending in the basket:

```
Product page
  ├─ pick artwork from the carousel (5–6 ONEMO pieces)   → add to basket / buy
  ├─ or upload your own image                             → add to basket / buy
  └─ or upload + press MAGIC SHAPE → pick size            → add to basket / buy
```

Plus, on the same carousel pattern: **t-shirt pre-order** with preset effects carrying ONEMO art.

That is the entire surface. No studio, no editor destination, no second page.

## What was verified live on skylrk.com (2026-07-30)

The teardown is a month old, so the PDP was re-checked directly. It holds. Observed on `/products/painter-pant-copper`:

- **Adaptive surface** — the full-screen grain surface takes the product's colourway. The copper PDP renders a copper field. Confirmed live.
- **Product floats centred**, no card, no border, no frame.
- **Vertical carousel on the main stage** — adjacent slides visible bleeding off the top and bottom edges. Mouse scroll does *not* page the carousel; it is drag-and-snap on a column axis (Embla, per the teardown). The neighbouring options are always partly visible, which is what makes the vertical swap legible without a control.
- **Bottom-left: horizontal glass thumbnail strip, six items.** Currently selected item is outlined.
- **Bottom-right: frosted glass info card** — title, short description, then `COLOR [ COPPER ]` with swatch dots, `SIZE [ 28 ]` with six size chips, and a sizing-info link.
- **Full-width action button** below the card. On this product it read `OUT OF STOCK - NOTIFY ME` — i.e. one primary action, always in the same place, state-dependent label.
- **Mono uppercase labels with bracket notation** throughout.
- **No 3D.** Flat front-view cutouts. Consistent with D13.

## The mapping

SKYLRK's layout logic transfers almost 1:1. Structure and interaction only — styling is ONEMO's.

| SKYLRK element | ONEMO MVP role |
|---|---|
| Vertical main-stage carousel, drag + snap | **mini ⇄ maxi** swap between the size products |
| Bottom-left glass thumbnail strip, 6 items | **artwork library** — 5–6 ONEMO seasonal pieces, plus upload |
| Bottom-right glass info card | effect name, **MAGIC SHAPE** action, size readout |
| `COLOR [ COPPER ]` / `SIZE [ 28 ]` bracket labels | ONEMO's label system, same mono-bracket treatment |
| Single full-width action button | **ADD TO BASKET** — or **PRE-ORDER** on the t-shirt |
| Surface hue adapts to product colourway | surface adapts to **the artwork's** dominant colour |

That last row is worth more to ONEMO than to SKYLRK. Their surface reacts to a fixed colourway; ours would react to whatever the customer just uploaded. The stage responds to the customer's own image — a free differentiator that falls out of the pattern rather than being bolted on.

## Why this validates the architecture

The teardown establishes, and the live check confirms, that SKYLRK runs a **custom classic Shopify Liquid theme** — same family as `onemo-theme`. Not Hydrogen, not React, not a headless storefront. Their entire look ships as one CSS bundle (~70 KB) and one JS bundle (~643 KB) on top of stock Shopify.

So the aesthetic ONEMO is aiming for is proven achievable on the exact stack `onemo-theme` already sits on, at a cost measured in two bundles. This is direct evidence for Option A in `AUDIT-mvp-surfaces.md` — Shopify carries commerce, ONEMO's creation controls mount into the product page.

Their carousel is Embla. It is a small, dependency-light library and the correct choice here rather than anything hand-rolled.

## Consequences for the open questions

- **O2 (which sizes ship)** — Dan raised keeping a single size. If one size ships, the vertical carousel has nothing to swap between and its role changes to swapping *preset effects* instead. The pattern survives either way, but the decision changes what the main stage is for. Still open.
- **O5 (pre-order in MVP scope)** — moves toward in-scope, since the t-shirt pre-order is now named as riding the same carousel. Not yet confirmed as launch scope.

## Note on the source research

The s58 teardown closes by recommending ONEMO differentiate via "real 3D Studio" with a live configurable product. That recommendation is superseded — D3 killed the studio and D13 killed 3D. The technical findings in that document remain sound and were used here; only its closing strategic recommendation is stale. The document lives on an unmerged branch and has not been edited.
