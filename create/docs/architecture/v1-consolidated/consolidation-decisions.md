# Consolidation Decisions — Three-Way Architecture Merge

> Formal decision log for merging three architecture proposals into the final Create module architecture.
> Every divergence resolved here. Every choice has rationale.
>
> **Date:** 2026-04-06
> **Author:** Kai (Claude Opus 4.6) — CTO role
> **Sources:**
> - **Kai draft** — `create/docs/architecture/` (14 files, 3122 lines)
> - **P1 (GPT Pro Review Track)** — `create/docs/gpt-pro proposals/proposal 1 - review and spec/` (1231 lines)
> - **P2 (GPT Pro Independent Track)** — `create/docs/gpt-pro proposals/proposal 2 - design/` (1320 lines)

---

## Unanimous Decisions (all three converge — adopted without debate)

### U1. Immutable revision snapshots

**What:** Add `design_revisions` table. Mutable head row stays for fast resume. Proof, commerce, manufacturing, share all reference immutable snapshots.

**Why all three agree:** Without snapshots, "buy the exact approved revision" is fake. Order replay, manufacturing reproducibility, and share integrity all require an immutable revision ledger.

**Impact:** New table `design_revisions`. New `DesignRevisionRepository`. Head row writes also append a snapshot. Review/approve/share always reference a specific revision number.

### U2. `.onemo` is a scene exchange package, not an artifact

**What:** `.onemo` is an immutable, content-addressed bundle produced from a published `ScenePreset`. ScenePreset is the canonical DB artifact. `.onemo` is the delivery format.

**Why all three agree:** Treating `.onemo` as canonical creates two sources of truth. ScenePreset already owns the runtime config. The bundle is a packaging concern.

**Impact:** Add `scene_package_ref` with `package_id`, `scene_hash`, `mesh_manifest_hash` to ScenePreset. SceneLoader fetches the bundle by ref, validates hash on load.

### U3. Client textures are derivatives, not truth

**What:** Canonical design truth is: original asset ref + placement values + texture policy. Applied textures on the client are a derived rendering cache.

**Why all three agree:** Manufacturing must reproduce the exact result from original asset + canonical placement, not from a lossy client-cached texture. Client textures can be stale, different DPR, wrong color space.

**Impact:** Manufacturing compiler loads original asset + applies canonical placement at production DPI. `transform_hash` validates freshness but the hash inputs are canonical fields, not the texture blob.

### U4. Separate design truth from commerce intent

**What:** Add `CheckoutIntent` as a domain object. Design state (what the customer made) stays in `DesignSession`. Commerce state (what they want to buy, with what add-ons) lives in `CheckoutIntent`.

**Why all three agree:** Bundles, add-on garments, pair grouping, and mixed-cart logic don't belong in the design artifact. If they do, design revision purity is compromised.

**Impact:** New `CheckoutIntent` schema in domain. New `checkout_intents` table. Cart use case builds intent from approved revision + add-ons. Shopify gateway consumes intent, not raw design.

### U5. Compatibility as a first-class domain service

**What:** `CompatibilityEngine` in `domain/rules/`. Evaluates attachment-system matching, receiver requirements, pair prerequisites, variant availability, approval freshness. Returns typed `CompatibilityResult` with severity + reason code + recovery actions.

**Why all three agree:** Compatibility logic was scattered across UI components and Shopify mapping code. It needs to be centralized, testable, and reusable across review, proof, checkout, and ops surfaces.

**Impact:** New `domain/rules/compatibility.ts`. New `CompatibilityResultSchema` with severity enum and reason codes. Review, checkout, and ops all call the same engine.

### U6. Phase 0 = contract repair before any UI

**What:** Ship corrected schemas (v4), revision snapshot table, scene package ref model, and compatibility reason codes BEFORE extracting the viewer or building any UI.

**Why all three agree:** Every later phase depends on correct contracts. Building UI on v3 schemas then migrating to v4 creates unnecessary rework.

**Impact:** Phase sequence becomes: 0 (contracts) → 1 (runtime) → 2 (edit loop) → 3 (proof/render) → 4 (manufacturing) → 5 (commerce) → 6 (AI).

### U7. Fallback strategy ladder (4 levels)

**What:** Still-first → live-upgrade → projection fallback → still-only review. React-Konva stays dead. The projection fallback is a bounded failure mode, not a second editor.

**Why all three agree:** WebGL on mobile Safari is not 100% reliable. Stranding users in a broken canvas with no edit path is reckless. But reviving a full 2D editor is wrong — a bounded projection fallback is the correct middle ground.

**Impact:** New `ProjectionFallbackCanvas` component in `create/core/`. Fallback stills required at publish time. Create shell detects WebGL health and switches modes.

### U8. Still-first live-upgrade pattern

**What:** Every Create entry shows a deterministic poster still immediately. Live WebGL upgrades when ready. User never stares at an empty frame.

**Why all three agree:** Scene startup can take seconds on mobile. The emotional impact of seeing their artwork on the product must happen fast, even if the live 3D isn't ready yet.

**Impact:** Published ScenePreset must include `fallback_stills[]`. Create shell renders still as poster, crossfades to live canvas on `onRenderReady`.

---

## Divergence Decisions (CTO calls)

### D1. Application layer directory structure

| P1 | P2 | Decision |
|---|---|---|
| `application/bootstrap/`, `application/design-session/`, `application/review/`, `application/preview/`, `application/commerce/`, `application/manufacturing/` | `application/use-cases/`, `application/services/`, `application/policies/`, `application/jobs/` | **P1** |

**Rationale:** Domain-oriented directory names (`bootstrap/`, `review/`, `commerce/`) are more navigable than generic structural names (`use-cases/`, `services/`). When a developer needs to find the review flow, `application/review/` is immediately obvious. `application/use-cases/reviewDesign.ts` requires knowing the function name.

### D2. State management model

| P1 | P2 | Decision |
|---|---|---|
| React Query + Zustand `WorkspaceStore` + `AutosaveController` | Three explicit classes: canonical server state, working client state, interaction runtime state (refs only) | **P2's model with P1's tools** |

**Rationale:** P2's three-class split is architecturally cleaner — it makes the boundary between server truth, optimistic client edits, and raw gesture deltas explicit. But the implementation tools are P1's: React Query for canonical (server-backed), Zustand for working (optimistic edits, panel mode), and plain refs for interaction (drag deltas, hover state, camera pose — never in reactive state).

### D3. Render routes

| P1 | P2 | Decision |
|---|---|---|
| `/render/design/[designId]/[revision]/[role]` | Same + `/render/fallback/[scenePresetId]/[context]` | **Merge: P1 routes + P2 fallback route** |

**Rationale:** P1 correctly adds `[revision]` to the path — immutable capture must reference a specific revision, not the mutable head. P2 adds a fallback route for generating poster stills at publish time, which is needed for U8 (still-first pattern). Both are correct.

### D4. Scene package model

| P1 | P2 | Decision |
|---|---|---|
| `ScenePackageRef` with `package_id`, `package_hash`, `url`, `environment_url`, `mesh_manifest_hash` | `OnemoSceneBundle` schema with `scene_hash`, `files`, `exported_at`, `studio_version` | **Merge: P1's ref fields + P2's bundle schema** |

**Rationale:** The ref (P1) is what ScenePreset stores — a pointer to the immutable bundle with hashes for validation. The bundle schema (P2) is what the `.onemo` file itself contains as metadata. Both are needed: ScenePreset has a ref, the bundle has a self-describing schema.

### D5. Commerce handoff object

| P1 | P2 | Decision |
|---|---|---|
| `CheckoutIntent` with `primary_line`, `add_on_lines[]`, `compatibility_snapshot`, `expires_at` | `CartIntent` with `custom_lines[]`, `stock_lines[]`, `grouped_context[]` (bundle/pair/receiver) | **P1 naming + P2 grouping** |

**Rationale:** `CheckoutIntent` is the better name — it represents the intent to check out, not just a cart. But P2's `grouped_context` array for expressing bundle/pair/receiver relationships between lines is more expressive than P1's flat add-on array. Merge: use `CheckoutIntent` with P2's grouped context.

### D6. AI command schema

| P1 | P2 | Decision |
|---|---|---|
| Typed actions array with severity + recovery actions per result | `AiCreateCommandSchema` as Zod discriminated union | **P2** |

**Rationale:** Discriminated unions are more type-safe for the action set. TypeScript can narrow the type in switch statements, the schema self-validates per action type, and it's the standard Zod pattern for heterogeneous command sets.

### D7. Fallback canvas implementation

| P1 | P2 | Decision |
|---|---|---|
| "Still-assisted edit mode" (conceptual) | `ProjectionFallbackCanvas` — face-only projected compose preview from canonical print area, numeric controls available, three-quarter/back use stills | **P2** |

**Rationale:** P2 is more concrete about what the fallback actually does. It's not just "show stills" — it's a real component that projects the face artwork onto a 2D representation of the print area, allows numeric editing, and uses stills for non-face views. This is implementable; P1's description is aspirational.

### D8. Repository split for designs

| P1 | P2 | Decision |
|---|---|---|
| Separate `DesignHeadRepository` + `DesignRevisionRepository` | Single `DesignSessionRepository` with `createRevisionSnapshot()` method | **P1** |

**Rationale:** The mutable head and immutable revisions are fundamentally different data access patterns. The head is read/write (autosave, resume). Revisions are write-once/read-many (proof, commerce, manufacturing). Separate interfaces make this boundary explicit and testable. A combined repository muddles the mutability contract.

---

## Schema Version Decision

| Source | Schema version |
|---|---|
| SSOT baseline | v3 (`onemo-v3-schemas.ts`) |
| Kai draft | v3 with informal extensions |
| P1 | v4 (explicit) |
| P2 | v4 (explicit) |

**Decision:** Ship as **v4** schemas. Key deltas from v3:
- `DesignSession` adds: `image_source`, `create_context`, `purchase_mode`, `attachment_system`, `pair_context`, `compatibility_snapshot`, `scene_package_hash`
- `ScenePreset` adds: `scene_package_ref`, `fallback_stills[]`, `gesture_profiles[]`, `presentation_contexts[]`
- New: `DesignRevisionSnapshot`, `CheckoutIntent`, `CompatibilityResult`, `OnemoSceneBundle`, `ImageSource`
- `ManufacturingPackage` adds: `design_ref` (replaces flat `design_id` + `design_revision`), `product_spec_ref`, `scene_preset_ref`

---

## Phase Sequence (consolidated)

| Phase | Name | Key outputs |
|---|---|---|
| **0** | Contract repair | v4 schemas, `design_revisions` table, `ScenePackageRef`, `CompatibilityEngine`, repository contract tests |
| **1** | Shared runtime | `create/core/` extraction, `ViewerShell`, `ScenePackageLoader`, visual parity harness |
| **2** | Effect module + edit loop | `products/effect/`, surface discovery, gesture reconciliation, draft shell, autosave, resume |
| **3** | Proof + render factory | Review gate, render pages, Playwright worker, preview captures, fallback stills |
| **4** | Manufacturing | Method A/B/C compilers, production transforms, immutable packages |
| **5** | Commerce | `CheckoutIntent`, variant projection, Storefront cart, webhooks, approval-expiry |
| **6** | Share + public | Public previews, presentation routes, remix, social share |
| **7** | AI sidecars | Intent parser, intake adapters, generated media pipeline |

**Key change from Kai's original:** Phase 0 inserted before runtime extraction. Commerce moved after manufacturing (P1 and P2 both put it later than Kai did). Share separated from commerce.

---

## New Architecture Files Needed

| File | Content | Source |
|---|---|---|
| `13-state-management.md` | Three-class state split, React Query + Zustand + refs | P2 model, P1 tools |
| `14-compatibility-engine.md` | Domain rules, severity model, reason codes, recovery actions | Both P1 and P2 |

---

## Files Requiring Major Updates

| File | What changes |
|---|---|
| `00-overview.md` | Add Phase 0, update system context with CheckoutIntent, update phase table |
| `03-domain-schemas.md` | Upgrade to v4, add DesignRevisionSnapshot, CheckoutIntent, CompatibilityResult, ImageSource, OnemoSceneBundle |
| `04-scene-pipeline.md` | Add ScenePackageRef model, hash validation, still-first pattern |
| `05-data-layer.md` | Add DesignHeadRepository + DesignRevisionRepository split, design_revisions table, checkout_intents table |
| `06-design-session-lifecycle.md` | Add revision snapshot on every save, update review to use snapshots, add resume from snapshot |
| `07-preview-render-factory.md` | Add revision to render routes, add fallback route, add RenderSnapshot contract |
| `09-commerce-handoff.md` | Replace raw cart with CheckoutIntent, add grouped context, add approval-expiry revalidation |
| `10-performance-contracts.md` | Add fallback ladder (4 levels), add route budget (2.5s shell, 6s first preview), add UX budgets |
| `11-gen-ai-hooks.md` | Use discriminated union schema, add intake adapters, clarify video texture is GeneratedMedia subtype |
| `12-migration-plan.md` | Insert Phase 0, reorder phases, add contract repair as prerequisite |
| `README.md` | Update phase table to 0-7, add new files 13-14 |
