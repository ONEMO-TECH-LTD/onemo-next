## Overall Assessment

NO. The mutable-draft / immutable-revision boundary is the right core idea. The document is still not ready to build because it loses traceability to the actual UX bundle, diverges from the locked V3 artifact architecture, and leaves manufacturing and checkout lineage too loose.

## Critical Issues (must fix before building)

1. **The UX mapping is not auditable** — In the provided UX docs, `CM-006` is the proof/trust record, `IA-06` is the private share screen, `IA-10` is async action safety, and `FLOW-06` is private share-by-link feedback. V2 reuses those same IDs for different things: `CM-006 = ShareArtifact`, `IA-06 = Save draft sheet`, `IA-10 = Time-sensitive acquisition`, and `FLOW-06 = deferred`. That is not a mapping. It is a rewrite wearing the original IDs. **Why it matters:** you cannot prove coverage, test the right surfaces, or trust the route/data/API tables. **Suggested fix:** freeze one authoritative UX package and add an explicit crosswalk from each authoritative CM / IA / FLOW ID to storage, route, and API. No renumbering, no reinterpretation.

2. **V2 fights the locked V3 architecture instead of extending it** — `v3-architecture.md` keeps the existing `designs` table as the `DesignSession` repository and makes `ProductSpec`, `ScenePreset`, `ManufacturingPackage`, and `job_queue` first-class artifacts/tables. V2 introduces nine new Create tables as the core persistence model and never explains how `designs` survives, how `product_specs` / `scene_presets` / `manufacturing_packages` fit, or how the worker surface survives. **Why it matters:** this is not an iteration. It is a parallel architecture. You will either dual-maintain two systems or do an unplanned rewrite. **Suggested fix:** either formally supersede the V3 architecture with a new ADR, or refactor V2 so revisions/checkpoints/share/checkout are layered on top of the existing artifact model and table strategy.

3. **The canonical schema cannot represent the real product** — V2’s `design_sessions` fields omit `purchase_mode`, subtype, construction method, version pins, transform hash, and production asset linkage. That is not a small miss. `purchase_mode` is a first-class product-system concept, and the V3 architecture explicitly defines `edge_trim`, `plain`, and `tv_retro` subtypes mapped to construction methods A/B/C. Even worse, the founder-facing V2 product brief says the user chooses subtype, but the technical schema has nowhere to store it. **Why it matters:** renderer selection, proof reproducibility, manufacturing, and support all drift. **Suggested fix:** the approved revision must pin `purchase_mode`, subtype, construction method, `product_spec` version, `scene_preset` version, compiler version, texture transform hash, and `production_asset_ref`, or link to an immutable `ManufacturingPackage`.

4. **Share/remix/public state has no governance or provenance gate** — The product/domain docs require lineage from `ImageSource` through rights/provenance into public/share eligibility. V2 has `image_sources` and `share_artifacts`, but no rights attestation object, no provenance-complete state, no share-eligibility gate, and no public/private asset policy. **Why it matters:** “private-first” is not enforceable, remix permissions are fuzzy, and public state can drift away from policy. **Suggested fix:** add a governance/provenance object and explicit eligibility state to the share lifecycle. Share creation must be gated by eligibility, not just by revision approval.

5. **Auth/RLS and anonymous continuity are basically absent** — Launch requires anonymous create and seamless anonymous-to-account continuity. V2 has `owner_identity` on `design_sessions` and then goes quiet. No ownership columns/policies are defined for revisions, proofs, shares, checkout intents, owned effects, or collections. No merge/idempotency model exists. **Why it matters:** anonymous resume, upgrade, privacy, and public access control will break across the first real lifecycle transition. **Suggested fix:** define an ownership/RLS matrix across every table, plus explicit anonymous-to-authenticated merge semantics and idempotent ownership transfer.

6. **Checkout intent is too abstract to trust** — Shopify Storefront carts do support `checkoutUrl`, custom line attributes, and parent relationships in `CartLineInput`; fixed/custom bundles are supported across storefront APIs, and cart presentation/bundle behavior lives in Cart Transform, where some update operations are limited to development stores or Shopify Plus. V2 never turns its `checkout_intents` abstraction into a concrete launch-safe cart projection or a fallback path when the richer cart semantics are unavailable. **Why it matters:** the mixed-cart MVP will be guessed during implementation, which is where line-item integrity dies. **Suggested fix:** define one explicit launch projection: custom shell line + stock/pair/garment lines + bounded attributes + optional parent linkage, with bundle transforms treated as an upgrade path, not as assumed infrastructure. ([shopify.dev](https://shopify.dev/docs/api/storefront/latest/objects/Cart))

## Important Issues (should fix, not blocking)

1. **Half the tables are declared, not designed** — `design_sessions`, `design_checkpoints`, `design_revisions`, and `proof_artifacts` get real field-level treatment. `image_sources`, `share_artifacts`, `checkout_intents`, `owned_effects`, and `collections` do not. **Why it matters:** you cannot write migrations, RLS, indexes, or repository contracts from a noun list. **Suggested fix:** every MVP table gets minimum columns, keys, ownership fields, lifecycle state, and indexing notes.

2. **`CompatibilityContext` is both too fat and too vague** — It mixes canonical product facts, compatibility result, add-on suggestions, receiver education, cap rules, and bundle messaging. **Why it matters:** it will become an untestable blob and every module will start depending on different parts of it. **Suggested fix:** split it into `ResolvedProductContext`, `CompatibilityResult`, and `SuggestedAddOns`.

3. **Bootstrap recovery is underspecified** — The PRD requires stale preset/saved-draft recovery to the closest valid state without losing authored placement unless invalid. V2 says “resolve bootstrap” but never defines requested vs resolved context, fallback rules, or recovery reason. **Why it matters:** drift bugs will land straight in resume and catalog entry flows. **Suggested fix:** bootstrap must return both requested and resolved context plus a deterministic recovery reason.

4. **Failure handling is missing where it matters most** — Cloudinary failure, proof render timeout, stale bundle during handoff, Shopify cart failure, webhook retries, and partial order ingestion are not modeled. **Why it matters:** the first production outage will duplicate records or strand paid orders. **Suggested fix:** add idempotency keys, retry rules, outbox/webhook dedupe, and explicit “current truth vs pending truth” behavior.

5. **The 3D scene brief is not enforced by the architecture** — The scene brief defines fallback stills, cap/pair/back-side scenes, and hard performance budgets. V2 references the views, but not the budgets, render timeouts, or still-first/live-upgrade behavior. **Why it matters:** mobile performance will fail by accident, not by design. **Suggested fix:** add model/texture budget enforcement, render timeout handling, and fallback capture requirements to the build plan.

## Over-Engineering Concerns

1. **Create is swallowing Library, Account, Orders, and Merchandising** — `/collection`, `/collection/[effectId]`, `/orders/[orderId]`, and `/effects/[variantId]` are downstream module surfaces, not core Create surfaces. **What it could be instead:** keep the shared objects (`owned_effects`, checkout lineage) but move the screens to the owning modules.

2. **`collections` is likely unnecessary for launch** — One collection per owner with vague “curation metadata” is not enough reason for a dedicated MVP table and screen. **What it could be instead:** derive the launch collection surface from `owned_effects` plus lightweight account/profile metadata.

3. **The analytics/flag contract is too formal too early** — Event names are fine. Making analytics and a long flag list a Phase 0 architecture deliverable is not. **What it could be instead:** minimal typed event enum, only live flags, and later flags stay as PRD notes until the feature exists.

## Missing Elements

1. **Migration path from existing `designs`** — no dual-read, dual-write, backfill, or cutover plan.
2. **RLS/ownership matrix** — no table-by-table private/public/anonymous/authenticated access model.
3. **Manufacturing lineage** — no `ManufacturingPackage`, compiler job, or production asset integration.
4. **Asset privacy contract** — no signed private asset rules, share preview policy, order preview policy, or cleanup lifecycle.
5. **Rate limiting / abuse prevention** — nothing on upload throttling, proof-job limits, remix/share abuse, or cart-intent spam.
6. **Webhook idempotency / reconciliation** — nothing preventing duplicate owned outcomes or partial order linkage.
7. **Contract tests** — no golden fixtures for bootstrap resolution, compatibility matrix, revision immutability, or checkout projection.

## Build Sequence Feedback

The phase ordering is wrong because it starts from V2’s invented contracts instead of the locked artifacts and authoritative UX source pack. First, freeze the actual source of truth: either the prompt’s 10/15/6 package or the zip’s 14/11/9 package. Then resolve the architecture conflict with `designs`, `ProductSpec`, `ScenePreset`, and manufacturing lineage. After that, build contract tests for bootstrap resolution, compatibility, revision immutability, and checkout projection. Only then build the viewer/editor. After that, do proof/approval and the one-custom-effect checkout path. Share/remix comes next. Owned surfaces, collection, order reflection, and time-sensitive reuse come after that, not before.

Phase 0–1 can be validated without a UI, but only with fixtures and contract tests. As written, V2 does not provide that.

Phase 4 is not necessary for the minimum viable launch. The minimum subset that lets a customer buy one custom Effect is smaller: direct/preset/catalog bootstrap, anonymous upload, canonical 3D placement with safe-area enforcement, immutable proof/approval, concrete Storefront cart projection, checkout redirect, and webhook/order reconciliation.

## Questions for the Founder

1. Which source pack is actually authoritative: the prompt’s “10 CM / 15 IA / 6 flows” version or the zip you provided, which is a different package?
2. Is the V3 architecture’s `designs` table + four-artifact model still locked, or are you willing to formally replace it?
3. Is launch really “buy one custom Effect,” or are private share/remix and owned surfaces hard launch blockers?
4. Should Create own `/collection`, `/orders`, and time-sensitive acquisition, or should those live in Library / Account / Commerce with shared read models?
5. Are you willing to ship simple line-based mixed-cart semantics first and stage richer bundle transforms behind explicit commerce capability?
