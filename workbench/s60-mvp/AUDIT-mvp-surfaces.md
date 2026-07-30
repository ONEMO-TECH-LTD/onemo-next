# Audit — what exists against the three MVP surfaces

Date: 2026-07-30. Scope: `onemo-next` @ 739832a (via `s60-MVP` worktree) and `onemo-theme` @ 60fb664.
Method: direct inspection of routes, modules and line counts. No inference from docs — `onemo-next/README.md` claims a Shopify commerce layer that the code does not contain, so documentation was not treated as evidence.

The three MVP surfaces, per Brief 60.4: **product pages · the two inline controls · checkout.**

---

## Headline

The engine is built. The shop is not.

| | Lines |
|---|---|
| Creation engine (`effect`, `vector-core`, `outline-core`, `shape-library`, `export`) | ~8,400 |
| Shop UI in `onemo-next` (`components/ds`) | 106 (one button) |

The app's front door states the problem in one line — `src/app/page.tsx` redirects to `/effect-creator/grid-lab`. ONEMO's web application currently *is* the editor. There is no shop in front of it.

---

## Surface 1 — Product pages

**Exists:** nothing in `onemo-next`. `src/app/(store)/` holds two 3-line placeholders (`library`, `community`) that render "Coming Soon". No product route, no collection route.

**Exists in `onemo-theme`:** Shopify's default `product.json`, `collection.json`, `list-collections.json` templates and 16 stock sections — i.e. the skeleton's own, not an ONEMO product page. Plus `assets/tokens/tokens.css` (983 lines, DS v2.3) already landed, so the design tokens are in the theme and current.

**Must build:** the ONEMO product page itself, one product per size (D7 — self-sufficient products, no variant selectors), and the browse surface in front of it.

## Surface 2 — The two inline controls

This is where the seven months actually paid off. The capability exists; it is just not attached to a shop.

| Module | Lines | Role in the MVP |
|---|---|---|
| `lib/effect` (incl. `grid-prepared`, `grid`, `grid-client`, `mask`) | 6,025 | grid-lab — magnetic point layout and sizing. Load-bearing for D12. |
| `lib/vector-core` (`paper-kernel`, `path`, `ops`, `fit`) | 1,067 | Path algebra under both controls. |
| `lib/outline-core` (`resolver` 480) | 663 | Magic outline. |
| `lib/shape-library` (`defs`, `baked`) | 457 | Shape presets. |
| `lib/export` (`svg-mm`) | 161 | mm-accurate export — the manufacturing handoff. |
| `lib/cloudinary` | 36 | Signed upload — needed for custom image. |

**Must build:** not the capability — the *packaging*. These are engine modules reached today through the grid-lab editor route. The MVP needs them behind two buttons on a product page (D3, D5), with drag-to-position, and nothing else exposed.

**Owned elsewhere:** the shaper tool in grid-lab is being streamlined by Dan with `@s59-pixel-designer` in Session 59. Session 60 consumes it.

## Surface 3 — Checkout

**Exists:** `lib/shopify/storefront.ts`, 132 lines — `getStorefrontConfig`, `storefrontRequest`, `cartCreate`. Real, thin, and the right shape: `cartCreate` is the route to Shopify's hosted checkout, which means checkout itself does not have to be built.

**Does not exist:** `src/app/api/cart/route.ts` is a stub returning `{ message: "stub" }`. No cart UI, no line-item construction, no way to attach a customised design to a cart line.

**Exists in `onemo-theme`:** `cart.json` template and a prior commit adding line-item property display in `sections/cart.liquid` — which matters, because a customised effect reaches the cart as line-item properties.

**Must build:** design → cart line (with the customisation attached and the manufacturing artefact referenced), then hand to Shopify checkout.

---

## The fork that has to be settled first

Two storefronts exist and only one should be built on.

**`onemo-next`** — Next.js 16, Supabase, Cloudinary, R3F. Holds the entire creation engine. Its `README` claims Shopify Plus via Storefront API, and `cartCreate` backs that up, but no store UI exists.

**`onemo-theme`** — the actual Shopify theme. Liquid. Has product/collection/cart templates, DS v2.3 tokens landed, and cart line-item properties already wired.

Brief 60.2 says the converter transforms Figma designs "to react and liqiud in shopify" — naming both targets, which is why this needs Dan's call rather than an assumption. The options:

**A. Shopify theme is the shop; the creation controls are an embedded React island.** Catalogue, cart, checkout, payments, taxes, email all come free from Shopify. Least to build. The engine ships as a bundle mounted on the product page. Cost: the island has to be built for a Liquid host, and the Next app becomes a development/authoring environment rather than the storefront.

**B. `onemo-next` is the shop; Shopify is headless behind the Storefront API.** Full control of the product page and the creation experience in one codebase, no island boundary. Cost: collection pages, cart, account, and every commerce edge case get built by hand — the work Shopify would otherwise do — and `cartCreate` is currently the only piece of it that exists.

On Brief 60.5 — stop building capability ahead of product — **A is the smaller path to a live shop.** It treats Shopify as the shop it already is and confines new work to the one thing Shopify cannot do, which is the two controls. B is the better long-term platform and the more expensive launch.

This is a product and commerce decision, not a technical preference. It needs Dan.

---

## What this audit does not cover

The React converter's current state, and whether its Liquid output path is exercised. Deliberately out of scope until the fork above is settled — the answer determines whether the Liquid target matters at launch.
