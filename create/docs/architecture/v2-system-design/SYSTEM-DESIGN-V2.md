# Create Module — System Design V2

> The bridge between the V3 Create PRD, the UX package, and implementation.
> Derived from: `3.3-prd-create-v3-delta.md`, `09-flow-state-model.md`, `10-interaction-architecture.md`, `11a-content-models-domain.md`, `10.2-session-37-decisions.md`, `ADR-S37-SHOPIFY-HUB.md`, and the current design review.
> Approved by: [pending Dan's review]

---

## 1. Platform Context

Per locked decisions and source-of-truth documents:

- **DEC S37-MOBILE:** customer-facing Create is mobile-first single-design. The same shell, controls, and action hierarchy must hold on desktop without a separate IA.
- **DEC S37-CONFIGURATOR-FIRST:** `/create` is the canonical configurable surface for customizable products. Configurable catalog entries and stock presets may preload Create via bootstrap context such as `/create?preset=...`.
- **DEC S37-CONFIGURATOR-FIRST (revised):** commerce is an equal loop, not a secondary appendix. Create handles configuration for customizable products; Shop remains a real fashion-retail front door for garments, stock Effects, bundles, and channel-ready goods.
- **ADR S37-SHOPIFY-HUB:** Shopify is the operational hub for inventory, orders, SEO catalog, customer management, analytics/reporting, and admin/moderation workflows. Supabase holds creative/configurator data Shopify cannot own: design sessions, checkpoints, revisions, proof artifacts, share artifacts, and owned Create outcomes.
- **CREATE-FR-012 / CREATE-FR-014 / domain lineage rules:** proof-approved revisions are the only design objects that may cross into share and checkout. Live mutable session state never crosses the trust boundary directly.

### System boundary

```text
Customer enters from one of:
  /create
  /create?preset=...
  configurable catalog entry
  saved draft
  public remix
  /effects/[variantId] (time-sensitive path)

Cloudflare
  → Next.js (Create shell, shared view, collection, post-purchase, time-sensitive surfaces)
  → Bootstrap resolver builds CreateBootstrapState
  → Product context loads from ProductSpec + CatalogEntry + ScenePreset + Shopify variant truth
  → User edits mutable DesignSession
  → Auto-persist writes design_checkpoints
  → Review/proof writes immutable design_revisions + proof_artifacts
  → Share writes share_artifacts from a revision
  → Checkout writes checkout_intents from an approved revision + selected add-ons
  → Shopify Storefront API creates mixed cart / checkout
  → Shopify order + webhook/update path creates owned_effects and updates collections
```

### Architectural consequence

V2 treats Create as a **revisioned custom-product system**, not a single draft row. The mutable workspace, approved proof, public share, and commerce handoff are distinct objects with explicit lineage.

---

## 2. What Exists Today (Prototype Inventory)

### Carry-forward baseline from the current design

| Component | Current reference | What it still gives us |
|-----------|-------------------|------------------------|
| Effect viewer/runtime prototype | `prototype/core/EffectViewer.tsx`, `prototype/core/EffectModel.tsx`, `prototype/core/onemo-loader.ts` | R3F canvas, GLB/runtime loading, material-role logic, artwork projection baseline |
| Prototype UI controls | `prototype/user/Toolbar.tsx`, `prototype/user/ColorPanel.tsx`, `prototype/admin/sceneStore.ts` | Fast shell for early Create interaction scaffolding |
| Creative infrastructure | Supabase creative tables, Cloudinary upload signing, Storefront client, `.onemo` format definitions | Enough baseline plumbing to support the V2 model once the data contracts are corrected |

### Current architecture worktree status

| Artifact | Current state | V2 disposition |
|---------|---------------|----------------|
| `domain/design-session.ts` | Present | Keep, but widen to carry bootstrap/product/compatibility refs and lifecycle linkage |
| `domain/image-source.ts` | Present | Keep; remains the canonical intake contract |
| `domain/preview-render.ts` | Present | Keep; continue as derived/transient preview state only |
| `domain/persistence-checkpoint.ts` | Present | Keep; map directly to `design_checkpoints` |
| `domain/product-variant-context.ts` | Present | Keep, but stop treating it as the only product-context contract |
| `domain/deferred.ts` | Present | Remove. CM-006 through CM-009 are not deferred in V2 |

### Missing in the current design and required now

| Missing capability | Why it is required now |
|--------------------|------------------------|
| `CreateBootstrapState` | CREATE-FR-001 requires catalog, preset, saved-draft, and remix entry before editing begins |
| `design_revisions` + `proof_artifacts` | Proof/share/checkout must consume immutable approved snapshots, not live session state |
| First-class CM-006 to CM-009 | Share, checkout projection, owned effects, and collections are MVP objects |
| Attachment/receiver/pair/bundle modeling | Create must explain receiver need, back-side meaning, pair pathway, and bundle suggestions |
| Mixed-cart-ready checkout intent | Create must pass compatible add-ons and bundle intent into Commerce without mutating the approved design |
| Analytics and flag contracts | PRD explicitly requires measurable entry, preview, attachment, compatibility, bundle, proof, and checkout behavior |

---

## 3. UX → Data Mapping

### Canonical storage model

| Object / contract | Storage / owner | First-class in V2 | Notes |
|-------------------|-----------------|-------------------|------|
| **CreateBootstrapState** | Next.js resolver + persisted snapshot on `design_sessions` | Yes | Architecture contract. Resolves entry type, preset/catalog/remix lineage, and initial product context before interactive editing. |
| **CM-001 DesignSession** | `design_sessions` / Supabase | Yes | Mutable working object only. Never used directly for share or checkout. |
| **CM-002 ImageSource** | `image_sources` + Cloudinary / Supabase | Yes | Source-normalized intake contract; upload live at launch, other source classes preserved in schema now. |
| **CM-003 PreviewRender** | client memory + fallback renderer | Yes | Derived/transient. Used for live preview and local interaction confidence, not for proof truth. |
| **CM-004 PersistenceCheckpoint** | `design_checkpoints` / Supabase | Yes | Explicit save and auto-persist live in one object model via `checkpoint_type`. |
| **CM-005 ProductVariantContext** | Shopify read model | Yes | Owns variant ids, price, inventory, sellability. V2 composes it with product/compatibility context instead of overloading it. |
| **CompatibilityContext** | Next.js/server derived from ProductSpec + CatalogEntry + ScenePreset + CM-005 | Yes | Architecture contract. Carries attachment system, receiver class, article type, presentation style, cap rules, pair metadata, bundle suggestions, and current compatibility outcome. |
| **DesignRevision** | `design_revisions` / Supabase | Yes | Immutable snapshot of canonical design state. Revision lineage object required by proof/share/checkout. |
| **ProofArtifact** | `proof_artifacts` + Cloudinary / Supabase | Yes | Immutable proof output(s) bound to a revision. Includes front/back/detail/fallback captures and approval metadata. |
| **CM-006 ShareArtifact** | `share_artifacts` / Supabase | Yes | Point-in-time public/shareable representation referencing a revision, not the live session row. |
| **CheckoutIntent / CM-007 CartPayload** | `checkout_intents` / Next.js + Shopify | Yes | First-class projection for mixed-cart handoff, retry, approval-validity checks, and analytics. |
| **CM-008 OwnedEffect** | `owned_effects` / Supabase | Yes | Immutable owned Create outcome referencing the purchased approved revision. |
| **CM-009 Collection** | `collections` / Supabase | Yes | One collection per owner identity. `owned_effects` are the members; curation lives here. |
| **CM-010 PublishedProduct** | schema stub only | Deferred | Only post-MVP object in this architecture. |

### Required physical tables

1. `design_sessions`
2. `image_sources`
3. `design_checkpoints`
4. `design_revisions`
5. `proof_artifacts`
6. `share_artifacts`
7. `checkout_intents`
8. `owned_effects`
9. `collections`

### `design_sessions` (mutable workspace)

`design_sessions` stores the live editable object and must include, at minimum:

- `session_id`
- `owner_identity`
- `entry_type` (`direct`, `catalog_entry`, `preset`, `saved_draft`, `public_remix`, `time_sensitive`)
- `catalog_entry_ref`
- `preset_ref`
- `remix_source_share_id`
- `source_session_ref`
- `product_spec_ref`
- `scene_preset_ref`
- `image_source_ref`
- `placement_transform`
- `selected_size`
- `selected_pair_size`
- `selected_face_material`
- `selected_trim_back_colour`
- `selected_finish`
- `selected_attachment_system`
- `receiver_class`
- `article_type`
- `presentation_style`
- `pair_context`
- `compatible_add_on_snapshot`
- `resolved_variant_id`
- `progress_position`
- `lifecycle_state` (`draft`, `configured`, `proofed`, `approved`, `purchased`)
- `latest_checkpoint_id`
- `latest_revision_id`
- `latest_approved_revision_id`
- `created_at`
- `updated_at`

### `design_checkpoints` (resume and continuity)

Each checkpoint row stores a complete restorable snapshot of the session, including:

- bootstrap state
- image reference
- canonical placement values
- all product/attachment selections
- compatibility snapshot
- pending compatible add-ons
- progress position
- proof stage context

Explicit save and auto-persist remain a single object model via `checkpoint_type = explicit | auto`.

### `design_revisions` and `proof_artifacts` (immutable trust boundary)

`design_revisions` is the immutable snapshot layer required by CREATE-FR-012/014 and the platform lineage rules. Each revision includes:

- `revision_id`
- `session_id`
- `revision_number`
- `revision_kind` (`working`, `proof_candidate`, `approved`, `shareable`)
- `canonical_snapshot`
- `compatibility_snapshot`
- `receiver_snapshot`
- `add_on_snapshot`
- `safe_area_status`
- `created_from_checkpoint_id`
- `created_at`

`proof_artifacts` binds one or more authoritative outputs to a revision:

- `proof_id`
- `revision_id`
- `proof_status`
- `front_capture_ref`
- `back_capture_ref`
- `detail_capture_ref`
- `fallback_capture_ref`
- `proof_summary`
- `approval_state`
- `renderer_path` (`live`, `fallback`, `mixed`)
- `created_at`

**Hard rule:** share and checkout reference `revision_id`. They never read mutable session state as authority.

### Attachment / receiver / pair / bundle modeling

V2 adds explicit architecture contracts for the V3 product system:

- `attachment_system` is a customer-visible product dimension on sessions, revisions, proof, share, and checkout.
- `receiver_class` is explicit (`garment_receiver`, `cap_receiver`, `ordinary_fabric_pair_pathway`, later others).
- `presentation_style` is stored independently of attachment system so fashion expression does not silently change compatibility.
- `pair_context` stores pair-specific orientation, polarity, packaging/support, and downstream fulfillment metadata.
- `compatible_add_on_snapshot` stores the suggested compatible garment, pair, or bundle members currently attached or deferred.
- `CompatibilityContext.output_class` uses the canonical output set: `compatible`, `advisory`, `recoverable_block`, `hard_block`, `inactive_track_block`.

### Share, checkout, and owned outcomes

- `share_artifacts.source_revision_id` points to the exact revision the viewer sees.
- `checkout_intents.source_revision_id` points to the approved revision the buyer is purchasing.
- `checkout_intents` also stores mixed-cart line classifications (`custom`, `stock`, `garment`, `pair`, `bundle_member`), bundle grouping metadata, and pair/support metadata.
- `owned_effects` must store both `source_session_id` and `source_revision_id` so the owned object remains tied to the purchased approved state even if the draft changes later.
- `collections` is not a proxy query over sessions. It is its own owned surface with curation metadata.

---

## 4. UX → Route Mapping

### IA container map

| IA Container | Type | Route / surface | MVP in V2 | Notes |
|-------------|------|-----------------|-----------|------|
| IA-01 Create entry | Screen | `/create` | Yes | Entry screen plus bootstrap resolver for direct, catalog, preset, and saved-draft starts |
| IA-02 Creator shell | Shell | `/create/[designId]` | Yes | Owns session lifecycle, auto-persist, compatibility context, proof/share/checkout actions |
| IA-03 Intake mode | Mode | within IA-02 | Yes | Upload-first live intake through canonical `ImageSource` contract |
| IA-04 Configure mode | Mode | within IA-02 | Yes | 3D gesture editing, precision assist, attachment/receiver context, bundle suggestions |
| IA-05 Preview and review mode | Mode | within IA-02 | Yes | Live preview + proof request + approve + share + buy decision stage |
| IA-06 Save draft sheet | Overlay | within IA-02 | Yes | Explicit save writes a `design_checkpoints` row |
| IA-07 Share sheet | Overlay | within IA-02 / IA-08 / IA-09 | Yes | Generates or reuses `share_artifacts` from a revision |
| IA-08 Collection | Screen | `/collection` | Yes | Consumes `collections` + `owned_effects` |
| IA-09 Effect detail | Screen | `/collection/[effectId]` | Yes | Owned outcome detail tied to purchased revision lineage |
| IA-10 Time-sensitive acquisition | Screen | `/effects/[variantId]` | Yes | Separate urgency-mode screen that reuses proof/checkout/owned-outcome contracts |
| IA-11 Post-purchase confirmation | Screen | `/orders/[orderId]` | Yes | Consumes order linkage and creates the owned payoff surface |
| IA-12 Restart dialog | Overlay | within IA-02 | Yes | Clears mutable session only; never deletes prior revisions or owned outcomes |
| IA-13 Shared view | Screen | `/shared/[shareId]` | Yes | Public preview + remix entry source |
| IA-14 Commerce handoff | State | external Shopify checkout | Yes | ONEMO-controlled handoff, Shopify-owned checkout UI |
| IA-15 Publish sheet | Overlay | within IA-02 | No | Post-MVP only with CM-010 |

### Bootstrap entry model

V2 explicitly supports all required Create starts through `CreateBootstrapState`:

```text
Direct blank start          → /create
Preset start                → /create?preset={presetId}
Configurable catalog entry  → /create?entry={catalogEntryId}
Saved draft resume          → /create/[designId]
Public remix                → /shared/[shareId] → Remix CTA → CreateBootstrapState(remix)
Time-sensitive route        → /effects/[variantId]
```

`CreateBootstrapState` resolves:

- `entry_type`
- `catalog_entry_ref`
- `preset_ref`
- `remix_source_share_id`
- `source_session_ref`
- `product_spec_ref`
- `scene_preset_ref`
- initial `attachment_system`
- initial `receiver_class`
- initial `pair_context`
- initial `compatible_add_on_snapshot`

### Mode and surface switching

The shell at `/create/[designId]` still manages mode locally, but V2 adds one more internal lens:

- `mode = intake | configure | preview`
- `surface = front | back | receiver | pair`

`progress_position` chooses the mode on restore. `surface` is transient UI state unless explicitly captured into proof or share artifacts.

---

## 5. UX → API Mapping

V2 stops using `/api/designs` as the umbrella namespace. The live draft, immutable revision, share, checkout, and owned surfaces are different lifecycles and get different routes.

### Bootstrap and session lifecycle

| Use case | Route | Server contract |
|----------|-------|-----------------|
| Resolve entry before editing | `POST /api/create/bootstrap/resolve` | Build `CreateBootstrapState` from direct, preset, catalog, remix, or time-sensitive entry |
| Create new mutable session | `POST /api/design-sessions` | Create `design_sessions` row from `CreateBootstrapState` |
| Load session for resume | `GET /api/design-sessions/[id]` | Return live session + latest checkpoint + latest revision summary |
| Autosave session mutation | `PATCH /api/design-sessions/[id]` | Persist mutable session changes and refresh compatibility snapshot |
| Write explicit save | `POST /api/design-sessions/[id]/checkpoints` | Create explicit checkpoint row |
| List resumable drafts | `GET /api/design-sessions?owner=me&state=draft` | Draft library source for `/create` and `/collection` continuity surfaces |

### Image intake and compatibility

| Use case | Route | Server contract |
|----------|-------|-----------------|
| Create/update image source | `POST /api/design-sessions/[id]/image-sources` | Validate input, create `image_sources`, attach to session |
| Re-evaluate compatibility | `POST /api/design-sessions/[id]/compatibility` | Resolve `CompatibilityContext` using ProductSpec, ScenePreset, CatalogEntry, Shopify variant truth, and current selections |
| Get bundle suggestions | `GET /api/design-sessions/[id]/bundle-suggestions` | Return compatible garment, pair, and bundle suggestions with output class and recovery reason |
| Accept or dismiss add-on suggestion | `POST /api/design-sessions/[id]/add-ons` | Attach/detach advisory compatible lines without mutating the approved design snapshot |

### Review / proof / approval

| Use case | Route | Server contract |
|----------|-------|-----------------|
| Request proof candidate | `POST /api/design-sessions/[id]/proof` | Freeze a `design_revisions` row, create `proof_artifacts`, return proof status |
| Approve proof | `POST /api/design-sessions/[id]/approve` | Promote the latest proof-ready revision to `approved` and mark it as the active checkout/share source |
| Revert to earlier approved or shareable state | `POST /api/design-sessions/[id]/revisions/[revisionId]/restore` | Copy immutable snapshot back into mutable session via a new checkpoint; never mutate the revision row |

### Share / remix

| Use case | Route | Server contract |
|----------|-------|-----------------|
| Create or refresh share state | `POST /api/design-sessions/[id]/share` | Create `share_artifacts` from an approved or share-safe revision |
| Load public share | `GET /api/share-artifacts/[shareId]` | Read public preview, configuration summary, remix eligibility |
| Revoke share | `POST /api/share-artifacts/[shareId]/revoke` | Move public state without deleting lineage |
| Bootstrap remix | `POST /api/share-artifacts/[shareId]/remix` | Resolve remix-safe `CreateBootstrapState` for a new session |

### Checkout / time-sensitive acquisition

| Use case | Route | Server contract |
|----------|-------|-----------------|
| Create checkout intent from approved revision | `POST /api/design-sessions/[id]/checkout-intents` | Materialize CM-007 as `checkout_intents` from `source_revision_id` + compatible add-ons |
| Validate approval validity before handoff | `POST /api/checkout-intents/[intentId]/validate` | Commerce-side approval-expiry / sellability / bundle drift / compatibility re-check |
| Create Shopify cart and redirect | `POST /api/checkout-intents/[intentId]/handoff` | Storefront API cart creation with mixed lines, bundle grouping, pair metadata, and custom attributes |
| Time-sensitive stock/pair acquisition | `POST /api/effects/[variantId]/checkout-intents` | Same contract as above, but seeded from stock/time-sensitive product context rather than a mutable design session |

### Owned surfaces and webhooks

| Use case | Route | Server contract |
|----------|-------|-----------------|
| Shopify order confirmation | `POST /api/webhooks/shopify/orders` | Create `owned_effects`, update `collections`, link order context |
| Load collection | `GET /api/collections/me` | Return collection metadata + owned effect summaries |
| Load owned effect detail | `GET /api/owned-effects/[effectId]` | Return immutable purchased outcome + authorship context + revision lineage |

### Flow mapping

- **FLOW-01** uses bootstrap → session → image intake → compatibility → proof → approve → checkout intent → owned outcome.
- **FLOW-02** uses checkpoints and resumable sessions.
- **FLOW-03** uses share artifacts and remix bootstrap.
- **FLOW-04** uses time-sensitive product context plus the same checkout intent / owned outcome path.
- **FLOW-05** uses collections and owned_effects.
- **FLOW-06** stays post-MVP and is the only flow that remains intentionally deferred.

---

## 6. Existing → New Mapping

### Architecture worktree mapping

| Current artifact | V2 replacement / expansion | Change type |
|------------------|----------------------------|-------------|
| `domain/design-session.ts` | Keep, but expand to carry bootstrap refs, attachment/receiver selections, latest revision pointers, and lifecycle state | Expand |
| `domain/image-source.ts` | Keep as-is conceptually; remains the canonical intake contract | Keep |
| `domain/preview-render.ts` | Keep, but add explicit back-side/detail/fallback capture semantics | Expand |
| `domain/persistence-checkpoint.ts` | Keep and bind directly to `design_checkpoints` | Keep |
| `domain/product-variant-context.ts` | Narrow to Shopify truth only; add separate `compatibility-context.ts` and `product-context.ts` | Split |
| `domain/deferred.ts` | Replace with concrete files: `share-artifact.ts`, `checkout-intent.ts`, `owned-effect.ts`, `collection.ts`, `design-revision.ts`, `proof-artifact.ts`, `create-bootstrap-state.ts`, `compatibility-context.ts` | Remove and replace |

### Prototype/runtime carry-forward

| Baseline component | V2 destination | Change type |
|--------------------|---------------|-------------|
| Effect viewer shell | `create/core/ViewerShell.tsx` | Carry forward |
| Effect renderer | `create/products/effect/EffectRenderer.tsx` | Carry forward |
| Back-side / receiver renderer | `create/products/effect/BacksideRenderer.tsx` | New |
| Pair renderer / orientation helpers | `create/products/effect/PairRenderer.tsx` | New |
| Scene loader | `create/core/ScenePackageLoader.ts` | Carry forward |
| Current toolbar / panels | `create/ui/*` | Expand to include compatibility, receiver education, bundle suggestions, proof actions |
| Current store | `create/state/workspace-store.ts` | Expand to manage mode/surface switching, proof/share/checkout UI state |

### Repository boundary mapping

| Concern | V1-style assumption | V2 rule |
|---------|---------------------|---------|
| Draft + owned state | one `designs` namespace | Split across `design_sessions`, `design_checkpoints`, `design_revisions`, `owned_effects`, `collections` |
| Share + checkout | ephemeral or deferred | First-class persisted projection objects |
| Product context | “Shopify query only” | Shopify truth + ProductSpec / ScenePreset / CatalogEntry / compatibility rules |
| Proof | mutable session row | immutable revision + proof artifact |
| Collection | query drafts by `user_id` | dedicated collection surface over owned outcomes |

---

## 7. State Management

### State categories

| State category | What | Where | Persisted? |
|---------------|------|-------|-----------|
| **Bootstrap state** | entry_type, preset/catalog/remix lineage, initial product context | server resolver + `design_sessions` snapshot | Yes |
| **Mutable session state** | image ref, canonical placement, selected variant axes, attachment system, receiver context, compatible add-ons, progress position | `design_sessions` | Yes |
| **Checkpoint state** | complete restorable snapshot for explicit save and auto-persist | `design_checkpoints` | Yes |
| **Revision / proof state** | immutable canonical snapshot, proof captures, approval status | `design_revisions` + `proof_artifacts` | Yes |
| **Preview runtime** | live R3F render, temporary camera/surface state, gesture draft | client memory / refs | No |
| **Compatibility state** | output class, recovery path, bundle suggestions, cap/pair education | server-derived `CompatibilityContext` + cached client query | Snapshot persisted with checkpoint/revision/checkout intent |
| **Share state** | public/shareable artifact, remix eligibility, revoke state | `share_artifacts` | Yes |
| **Checkout state** | mixed-cart intent, line classifications, bundle grouping, approval-validity result, Shopify cart id/url | `checkout_intents` | Yes |
| **Owned state** | purchased custom outcomes and collection curation | `owned_effects` + `collections` | Yes |
| **Rollout state** | feature flags controlling public visibility and copy/detail intensity | server-derived flag contract | No authoritative persistence in session; only snapshots when needed for analytics/debugging |
| **Analytics state** | typed event emission at entry, preview, attachment view, compatibility, bundle, proof, checkout | analytics emitter | Event stream, not session truth |

### Client state architecture

```text
Server / React Query canonical state
  ├── createBootstrapState
  ├── designSession
  ├── latestCheckpoint
  ├── latestApprovedRevision
  ├── proofArtifact
  ├── compatibilityContext
  ├── bundleSuggestions
  ├── shareArtifact
  ├── checkoutIntent
  ├── collection
  └── ownedEffect

Workspace store (UI-only working state)
  ├── activeMode: 'intake' | 'configure' | 'preview'
  ├── activeSurface: 'front' | 'back' | 'receiver' | 'pair'
  ├── gestureDraft
  ├── precisionAssistDraft
  ├── pendingAddOns
  ├── saveStatus
  ├── proofStatus
  ├── shareStatus
  ├── checkoutStatus
  └── sheet/dialog visibility

Refs / runtime
  ├── canvasRef
  ├── sceneControllerRef
  ├── gestureControllerRef
  └── fallbackRendererRef
```

### Invariants

1. `design_sessions` is the only mutable design object.
2. Every explicit save creates a `design_checkpoints` row.
3. Proof always creates a new immutable `design_revisions` row plus `proof_artifacts`.
4. Share, checkout, and owned outcomes all reference `source_revision_id`.
5. Commerce may invalidate an approved revision for checkout, but it does so as a **validity overlay** on the checkout intent. It does not silently mutate the approved revision itself.
6. Attachment-system meaning must remain consistent across active view, back-side view, proof, share, and buy handoff.

### Analytics contract

Required event names from the PRD become typed events in V2:

| Event | Required payload |
|------|------------------|
| `create_entry_loaded` | `entry_type`, `catalog_entry_ref`, `preset_ref`, `remix_source_share_id`, `owner_state` |
| `image_source_intake_started` | `session_id`, `source_type`, `entry_type` |
| `image_source_intake_completed` | `session_id`, `source_type`, `validation_status` |
| `create_first_preview_ready` | `session_id`, `product_type`, `attachment_system`, `time_to_first_preview_ms` |
| `placement_gesture_started` | `session_id`, `surface_id`, `mode` |
| `placement_gesture_committed` | `session_id`, `surface_id`, `precision_assist_used`, `safe_area_result` |
| `attachment_view_opened` | `session_id`, `attachment_system`, `receiver_class`, `product_type` |
| `compatibility_warning_shown` | `session_id`, `output_class`, `recovery_path_type` |
| `bundle_suggestion_shown` | `session_id`, `suggestion_type`, `bundle_or_product_ref` |
| `bundle_suggestion_accepted` | `session_id`, `suggestion_type`, `bundle_or_product_ref` |
| `proof_requested` | `session_id`, `revision_id`, `product_type` |
| `proof_ready` | `session_id`, `revision_id`, `renderer_path`, `proof_status` |
| `checkout_handoff_started` | `session_id`, `revision_id`, `line_classifications`, `add_on_count` |

### Feature-flag contract

These flags are first-class V2 inputs. They gate public behavior, never the underlying canonical schema.

- `create_catalog_bootstrap_enabled`
- `create_attachment_system_visible`
- `create_backside_view_enabled`
- `create_bundle_suggestions_enabled`
- `create_pair_education_enhanced_copy_enabled`
- `create_prompt_generation_enabled`
- `create_connected_imports_enabled`
- `create_ai_try_on_enabled`
- `create_velcro_public_activation_enabled`

**Rule:** if a flag hides a public pathway, the underlying state dimension still exists in product context, revisions, and checkout validation. Flags simplify exposure; they do not erase canonical meaning.

---

## 8. Directory Structure

```text
create/
├── bootstrap/
│   ├── create-bootstrap-state.ts
│   ├── resolve-bootstrap.ts
│   └── entry-routing.ts
│
├── core/
│   ├── ViewerShell.tsx
│   ├── ScenePackageLoader.ts
│   └── types.ts
│
├── products/
│   ├── registry.ts
│   └── effect/
│       ├── EffectRenderer.tsx
│       ├── BacksideRenderer.tsx
│       ├── PairRenderer.tsx
│       ├── EffectSurfaces.ts
│       └── types.ts
│
├── domain/
│   ├── create-bootstrap-state.ts
│   ├── design-session.ts
│   ├── image-source.ts
│   ├── preview-render.ts
│   ├── persistence-checkpoint.ts
│   ├── product-variant-context.ts
│   ├── compatibility-context.ts
│   ├── design-revision.ts
│   ├── proof-artifact.ts
│   ├── share-artifact.ts
│   ├── checkout-intent.ts
│   ├── owned-effect.ts
│   ├── collection.ts
│   └── index.ts
│
├── server/
│   ├── repositories/
│   │   ├── design-sessions.ts
│   │   ├── image-sources.ts
│   │   ├── design-checkpoints.ts
│   │   ├── design-revisions.ts
│   │   ├── proof-artifacts.ts
│   │   ├── share-artifacts.ts
│   │   ├── checkout-intents.ts
│   │   ├── owned-effects.ts
│   │   └── collections.ts
│   ├── bootstrap/
│   │   └── resolve-create-bootstrap.ts
│   ├── compatibility/
│   │   ├── engine.ts
│   │   ├── receiver-rules.ts
│   │   └── bundle-rules.ts
│   ├── proof/
│   │   ├── create-proof.ts
│   │   ├── approve-proof.ts
│   │   └── capture-proof-artifacts.ts
│   ├── share/
│   │   ├── create-share-artifact.ts
│   │   └── create-remix-bootstrap.ts
│   ├── commerce/
│   │   ├── create-checkout-intent.ts
│   │   ├── validate-approval-validity.ts
│   │   └── create-shopify-cart.ts
│   └── analytics/
│       ├── events.ts
│       └── feature-flags.ts
│
├── state/
│   └── workspace-store.ts
│
├── ui/
│   ├── Toolbar.tsx
│   ├── ColorPanel.tsx
│   ├── MaterialPicker.tsx
│   ├── SizeSelector.tsx
│   ├── BacksideInspector.tsx
│   ├── CompatibilityPanel.tsx
│   ├── BundleSuggestionsSheet.tsx
│   ├── PairEducationCard.tsx
│   ├── ProofActions.tsx
│   └── SaveIndicator.tsx
│
├── page.tsx                      ← /create entry
├── [designId]/
│   ├── page.tsx                  ← creator shell
│   └── _components/
│       ├── IntakeMode.tsx
│       ├── ConfigureMode.tsx
│       └── PreviewMode.tsx
│
├── shared/
│   └── [shareId]/page.tsx
├── collection/
│   ├── page.tsx
│   └── [effectId]/page.tsx
├── effects/
│   └── [variantId]/page.tsx
├── orders/
│   └── [orderId]/page.tsx
│
└── docs/
    └── architecture/
```

---

## 9. Build Sequence

**Important:** the phases below are **delivery order inside MVP**, not scope cuts. Phases 0 through 4 are all MVP. Only Phase 5 is truly deferred.

### Phase 0: Contracts and bootstrap

1. Implement `CreateBootstrapState` and entry resolution for direct, preset, catalog, draft, remix, and time-sensitive starts.
2. Define `CompatibilityContext` as a composition of ProductSpec, CatalogEntry, ScenePreset, and Shopify variant truth.
3. Promote CM-006 through CM-009 to first-class domain files. Add `design-revision.ts`, `proof-artifact.ts`, and `checkout-intent.ts`.
4. Define analytics event types and feature-flag contracts up front.

**Depends on:** Product System grammar, CatalogEntry semantics, ScenePreset lineage, ADR S37 scope decisions.  
**Delivers:** Bootstrap and domain contracts that all later UI and server code can reuse.

### Phase 1: Persistence and rule engine

5. Create repositories and tables for `design_sessions`, `image_sources`, `design_checkpoints`, `design_revisions`, `proof_artifacts`, `share_artifacts`, `checkout_intents`, `owned_effects`, and `collections`.
6. Implement canonical compatibility evaluation using attachment system, receiver class, article type, presentation style, bundle composition, pair orientation/polarity, activation state, and sellability context.
7. Wire approval-validity and bundle-drift checks as shared server utilities.

**Depends on:** Phase 0 contracts.  
**Delivers:** The real backend model. No more one-row draft/owned conflation.

### Phase 2: Viewer, editing, and proofable state

8. Extract viewer/runtime from the prototype into `ViewerShell`, `EffectRenderer`, `BacksideRenderer`, and `PairRenderer`.
9. Implement 3D gesture editing + numeric precision assist with safe-area reconciliation back into canonical placement fields.
10. Integrate fallback rendering and proof-capture pipeline so preview and proof share the same canonical input model.
11. Build shell modes for intake / configure / preview with front/back/receiver/pair surface switching.

**Depends on:** Phase 1 persistence and compatibility context.  
**Delivers:** A proofable Create workspace, not just a mutable canvas.

### Phase 3: Continuity, share, and checkout

12. Implement explicit save + auto-persist checkpoints + restore from latest valid checkpoint.
13. Implement proof creation and approval, producing immutable `design_revisions` and `proof_artifacts`.
14. Implement `share_artifacts` and the public `/shared/[shareId]` surface, including remix bootstrap and revoke lifecycle.
15. Implement `checkout_intents` from approved revisions, including mixed-cart add-ons, bundle grouping, pair metadata, and Storefront cart handoff.

**Depends on:** Phase 2 proofable workspace.  
**Delivers:** The full PRD trust boundary: continuity, proof, share, and buy handoff.

### Phase 4: Owned outcomes, collection, and time-sensitive reuse

16. Implement Shopify order ingestion to create `owned_effects` and update `collections`.
17. Build `/collection` and `/collection/[effectId]` over owned outcomes and curation state.
18. Build `/orders/[orderId]` post-purchase confirmation with authorship framing.
19. Build `/effects/[variantId]` time-sensitive acquisition using the same compatibility, checkout-intent, and owned-outcome contracts.
20. Finish bundle suggestion attach/remove flows and stale bundle recovery messaging.

**Depends on:** Phase 3 share/checkout lineage.  
**Delivers:** Ownership and acquisition surfaces that the UX package already treats as real MVP behavior.

### Phase 5: True post-MVP only

21. `PublishedProduct` / IA-15 creator publication pipeline.
22. Customer-facing prompt-to-image UI.
23. Connected import UIs.
24. AI try-on UI.
25. Advanced bundle discount engines and richer parent-child cart structures beyond launch-simple attach/remove.
26. Embedded checkout activation if the business turns it on later.

### Dependency chain summary

```text
bootstrap/contracts
  → product + compatibility context
  → viewer + safe-area gesture reconciliation
  → session/checkpoint/revision/proof
  → share + checkout intent
  → owned outcomes + collection + time-sensitive reuse
```

This order matches the PRD dependencies: product registry and variant grammar first, compatibility and proof before share/checkout, approved revision before mixed-cart handoff, and owned surfaces after purchase lineage exists.

---

## 10. What This Design Does NOT Cover

Only the following remain intentionally out of scope for MVP V2:

- **CM-010 / IA-15 publication pipeline** for Creator-Seller products
- **Customer-facing prompt generation UI**, while preserving the source-normalized intake contract
- **Connected import UIs** such as Pinterest or wallet import, while preserving the intake abstraction and provenance hooks
- **AI try-on UI**, while preserving generated-media lineage hooks
- **Advanced bundle transforms/discount engines** beyond launch-simple attach/remove and explicit stale-bundle recovery
- **Embedded checkout activation specifics**, beyond the ONEMO-controlled handoff contract required now
- **Operator/admin extension implementation details** inside Shopify Hub
- **Final design-system polish pass**, which belongs to implementation/UI planning rather than system architecture

What is **not** deferred in V2:

- proof
- share/public preview/remix seed state
- checkout handoff
- bundle suggestions
- back-side / attachment understanding
- pair / receiver compatibility modeling
- collections / owned outcomes
- time-sensitive acquisition reuse of the same contracts
