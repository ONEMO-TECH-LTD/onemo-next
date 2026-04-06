# 00 — Overview

> What Create is, where it sits, what flows in, what flows out.
> Consolidation: Phase 0 inserted (U6). CheckoutIntent separated (U4).

## What Create Is [Phase 0]

Create is the customer-facing 3D product configurator. Customers upload artwork, position it on a 3D Effect, choose colors and materials, and produce a design they can save, share, or buy.

Create is to customers what Studio is to Dan: same renderer, different controls. Studio authors scene templates. Create renders them for customers. The contract between them is the `.onemo` file format — a ZIP containing `scene.glb` + `studio.json` + optional `environment.hdr`.

## Three-Layer System [Phase 0]

ONEMO operates on three layers. Create is primarily Layer 1, with hooks into Layer 2 and Layer 3.

```
Layer 1: 3D Engine (Render Factory)
  - Live configurator preview
  - Product listing images (screenshots from 3D)
  - Library/share/cart previews
  - Manufacturing specs (placement coords from texture transform)

Layer 2: AI Content (Growth Engine)  [Phase 7]
  - Video texture ("image comes alive")
  - AI-assisted configuration (natural language → typed actions)
  - Generative patterns and suggestions

Layer 3: Commerce (Shopify)  [Phase 5]
  - CheckoutIntent → Shopify Storefront API
  - Line-item properties for fulfillment
  - Webhook-driven order processing
```

Layer 1 is the unlock. Both Layer 2 and Layer 3 depend on it for visual input.

## System Context [Phase 0]

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                     ONEMO Platform                      │
                    │                                                          │
  ┌──────────┐     │  ┌──────────┐    .onemo     ┌───────────────────┐        │
  │  Studio   │────▶│  │   CDN    │─────────────▶│      Create       │        │
  │ (author)  │     │  └──────────┘              │   (customer)      │        │
  └──────────┘     │                              └───────┬───────────┘        │
                    │                                     │                    │
                    │              ┌───────────────────────┼──────────────┐    │
                    │              ▼                       ▼              │    │
                    │  ┌──────────────────┐  ┌────────────────────────┐  │    │
                    │  │    Supabase      │  │      Cloudinary        │  │    │
                    │  │  DesignHead      │  │   Artwork + Previews   │  │    │
                    │  │  + Revisions     │  │                        │  │    │
                    │  │  + CheckoutIntent│  └────────────────────────┘  │    │
                    │  └────────┬─────────┘                              │    │
                    │           │                                         │    │
                    │           ▼                                         │    │
                    │  ┌──────────────────┐  ┌────────────────────────┐  │    │
                    │  │  Render Worker   │  │       Shopify          │  │    │
                    │  │  (preview gen)   │  │  (commerce projection) │  │    │
                    │  └──────────────────┘  └────────────────────────┘  │    │
                    └──────────────────────────────────────────────────────────┘
```

## Five Canonical Domain Objects [Phase 0]

Every document in this architecture references these domain objects. They are the domain model.

| Object | Authority | Lifecycle | Create's role |
|--------|-----------|-----------|---------------|
| **ProductSpec** | What can physically exist | Versioned, publishable | Reads published spec to configure constraints |
| **ScenePreset** | How the product is rendered | Versioned, publishable. Contains `scene_package_ref` for .onemo delivery. | Reads published preset for viewer config |
| **DesignSession** | What the customer chose (mutable head) | Revisioned, mutable until purchase | Writes and owns the design state |
| **DesignRevisionSnapshot** | Immutable point-in-time snapshot | Append-only, immutable | Proof, commerce, manufacturing, share all reference snapshots |
| **CheckoutIntent** | What the customer wants to buy | Derived from approved revision + add-ons | Commerce state separate from design truth |
| **ManufacturingPackage** | Immutable production output | Derived from snapshot, immutable | Triggers compilation on approval |

Artifact schemas live in `create/domain/` (see [03-domain-schemas.md](03-domain-schemas.md)).
Canonical v4 Zod code defined in the Create architecture.

### Key Separation (U4: CheckoutIntent)

Design truth (what the customer made) stays in `DesignSession`. Commerce state (what they want to buy, with what add-ons, in what bundle configuration) lives in `CheckoutIntent`. Bundles, add-on garments, pair grouping, and mixed-cart logic do not belong in the design artifact.

### Immutable Revision Snapshots (U1)

The mutable head row (`designs` table) stays for fast resume. On every save, an immutable snapshot is appended to `design_revisions`. Proof, commerce, manufacturing, and share always reference a specific immutable revision number — never the mutable head.

## Inputs and Outputs [Phase 0–7]

### Inputs to Create

| Input | Source | Format | Phase |
|-------|--------|--------|-------|
| Scene package | Studio → CDN | `.onemo` ZIP (GLB + studio.json + HDR), content-addressed | Phase 1 |
| Published ProductSpec | Supabase | JSON (v4 Zod-validated) | Phase 0 |
| Published ScenePreset | Supabase (with `scene_package_ref`) | JSON (v4 Zod-validated) | Phase 0 |
| Customer artwork | Upload → Cloudinary | Image (signed upload) | Phase 2 |
| AI-generated content | Gen AI pipeline → Cloudinary | Image/video (GeneratedMedia) | Phase 7 |
| Saved DesignSession | Supabase `designs` head | JSON (resume draft) | Phase 2 |

### Outputs from Create

| Output | Destination | Format | Phase |
|--------|-------------|--------|-------|
| DesignSession head | Supabase `designs` | JSON (autosave on change) | Phase 2 |
| DesignRevisionSnapshot | Supabase `design_revisions` | Immutable JSON (appended per save) | Phase 2 |
| Applied texture | Cloudinary | Image (normalized, hashed) | Phase 2 |
| Controlled previews | Render worker → Cloudinary | Deterministic screenshots from revision | Phase 3 |
| ManufacturingPackage | Compiler → Supabase | Immutable production artifact from revision | Phase 4 |
| CheckoutIntent | Supabase `checkout_intents` | Commerce object (approved revision + add-ons) | Phase 5 |
| Cart line items | Shopify Storefront API | Line-item properties from CheckoutIntent | Phase 5 |
| CompatibilityResult[] | CompatibilityEngine (pure domain) | Typed severity + reason codes + recovery actions | Phase 0 |

## Directory Structure [Phase 0]

```
create/
├── core/                     ← Shared viewer shell (product-agnostic) [Phase 1]
│   ├── ViewerShell.tsx
│   ├── ScenePackageLoader.ts
│   ├── ProjectionFallbackCanvas.tsx
│   ├── types.ts
│   └── index.ts
│
├── products/                 ← Product family modules [Phase 2]
│   ├── registry.ts
│   └── effect/
│       ├── EffectRenderer.tsx
│       ├── EffectSurfaces.ts
│       ├── EffectOverrides.ts
│       ├── types.ts
│       └── index.ts
│
├── domain/                   ← v4 Zod schemas [Phase 0]
│   ├── scene-preset.ts
│   ├── design-session.ts
│   ├── design-revision.ts
│   ├── product-spec.ts
│   ├── checkout-intent.ts
│   ├── compatibility.ts
│   ├── image-source.ts
│   ├── generated-media.ts
│   ├── manufacturing-package.ts
│   └── onemo-scene-bundle.ts
│
├── domain/rules/             ← Pure domain logic [Phase 0]
│   └── compatibility.ts      ← CompatibilityEngine
│
├── application/              ← Domain-oriented use cases [Phase 2+]
│   ├── bootstrap/
│   ├── design-session/
│   ├── review/
│   ├── preview/
│   ├── commerce/
│   └── manufacturing/
│
├── CreateShell.tsx            ← Entry: ViewerShell + product module + controls [Phase 2]
├── ConfigPanel.tsx            ← Customer controls [Phase 2]
├── index.ts
│
└── docs/
    ├── ARCHITECTURE.md        ← Legacy (Session 43 blueprint)
    └── architecture/          ← This folder
```

## Phase Roadmap

| Phase | Name | What it delivers |
|-------|------|-----------------|
| **0** | Contract Repair | v4 schemas, `design_revisions` table, `ScenePackageRef`, `CompatibilityEngine`, repo contract tests |
| **1** | Shared Runtime | Viewer shell extraction, `ScenePackageLoader`, visual parity harness, fallback stills |
| **2** | Edit Loop | Effect module, surface discovery, gesture reconciliation, draft shell, autosave, resume |
| **3** | Proof + Render | Review gate, render pages, Playwright worker, preview captures, fallback stills |
| **4** | Manufacturing | Method A/B/C compilers, production transforms, immutable packages |
| **5** | Commerce | `CheckoutIntent`, variant projection, Storefront cart, webhooks, approval-expiry |
| **6** | Share + Public | Public previews, presentation routes, remix, social share |
| **7** | AI Sidecars | Intent parser, intake adapters, generated media pipeline |

## Decision References

| Decision | ID | Summary |
|----------|-----|---------|
| Create module location | DEC S43-CREATE | Top-level `create/`, sibling to `studio/` |
| Scene format | DEC S42-SCENE | Three.js scene graph is canonical. No conversion layers. |
| 3D as baseline | Session 37 Summary | 2D editor killed. 3D model IS the editor. R3F + drei. |
| Three equal loops | Brief 37.83 | Customization, commerce, social sharing are equal. Not configurator-first. |
| AI as sidecar | Session 37 Summary | AI = translator (function calling), not primary UI. Config object = source of truth. |
| Immutable revisions | U1 | Mutable head + append-only snapshots. Proof/commerce/manufacturing reference snapshots. |
| .onemo is delivery, not artifact | U2 | ScenePreset is canonical DB artifact. .onemo is the content-addressed delivery bundle. |
| Client textures are derivatives | U3 | Canonical truth = original asset + placement + policy. Manufacturing reproduces from canonical. |
| Separate design from commerce | U4 | CheckoutIntent owns commerce state. DesignSession owns design truth. |
| Centralized compatibility | U5 | CompatibilityEngine in domain/rules. One engine, one set of rules. |
| Phase 0 first | U6 | Contract repair before any UI. Correct schemas prevent rework. |
| Fallback ladder | U7 | Still-first → live-upgrade → projection fallback → still-only. No revived 2D editor. |
| Still-first pattern | U8 | Poster still immediately. Live WebGL upgrades when ready. |
