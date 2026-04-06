# 00 — Overview

> What Create is, where it sits, what flows in, what flows out.

## What Create Is [v1]

Create is the customer-facing 3D product configurator. Customers upload artwork, position it on a 3D Effect, choose colors and materials, and produce a design they can save, share, or buy.

Create is to customers what Studio is to Dan: same renderer, different controls. Studio authors scene templates. Create renders them for customers. The contract between them is the `.onemo` file format — a ZIP containing `scene.glb` + `studio.json` + optional `environment.hdr`.

## Three-Layer System [v1]

ONEMO operates on three layers. Create is primarily Layer 1, with hooks into Layer 2 and Layer 3.

```
Layer 1: 3D Engine (Render Factory)
  - Live configurator preview
  - Product listing images (screenshots from 3D)
  - Library/share/cart previews
  - Manufacturing specs (placement coords from texture transform)

Layer 2: AI Content (Growth Engine)  [v5]
  - Video texture ("image comes alive")
  - AI-assisted configuration (natural language → typed actions)
  - Generative patterns and suggestions

Layer 3: Commerce (Shopify)  [v4]
  - Cart + checkout via Storefront API
  - Line-item properties for fulfillment
  - Webhook-driven order processing
```

Layer 1 is the unlock. Both Layer 2 and Layer 3 depend on it for visual input.

## System Context [v1]

```
                    ┌─────────────────────────────────────────────────┐
                    │                   ONEMO Platform                │
                    │                                                 │
  ┌──────────┐     │  ┌──────────┐    .onemo     ┌──────────────┐   │
  │  Studio   │────▶│  │   CDN    │─────────────▶│    Create     │   │
  │ (author)  │     │  └──────────┘              │  (customer)   │   │
  └──────────┘     │                              └──────┬───────┘   │
                    │                                     │           │
                    │              ┌───────────────────────┼──────┐   │
                    │              ▼                       ▼      │   │
                    │  ┌──────────────────┐  ┌────────────────┐  │   │
                    │  │    Supabase      │  │   Cloudinary   │  │   │
                    │  │  DesignSession   │  │   Artwork +    │  │   │
                    │  │  + lifecycle     │  │   Previews     │  │   │
                    │  └────────┬─────────┘  └────────────────┘  │   │
                    │           │                                 │   │
                    │           ▼                                 │   │
                    │  ┌──────────────────┐  ┌────────────────┐  │   │
                    │  │  Render Worker   │  │    Shopify     │  │   │
                    │  │  (preview gen)   │  │  (commerce)    │  │   │
                    │  └──────────────────┘  └────────────────┘  │   │
                    └─────────────────────────────────────────────────┘
```

## Four Canonical Artifacts [v1]

Every document in this architecture references these four versioned artifacts. They are the domain model.

| Artifact | Authority | Lifecycle | Create's role |
|----------|-----------|-----------|---------------|
| **ProductSpec** | What can physically exist | Versioned, publishable | Reads published spec to configure constraints |
| **ScenePreset** | How the product is rendered | Versioned, publishable | Reads published preset for viewer config |
| **DesignSession** | What the customer chose | Revisioned, mutable until purchase | Writes and owns the design state |
| **ManufacturingPackage** | Immutable production output | Derived, immutable | Triggers compilation on approval |

Artifact schemas live in `create/domain/` (see [03-domain-schemas.md](03-domain-schemas.md)).
Canonical Zod code: `onemo-ssot-global/5-architecture/baseline/onemo-v3-schemas.ts`.

## Inputs and Outputs [v1–v5]

### Inputs to Create

| Input | Source | Format | Phase |
|-------|--------|--------|-------|
| Scene template | Studio → CDN | `.onemo` ZIP (GLB + studio.json + HDR) | v1 |
| Published ProductSpec | Supabase | JSON (Zod-validated) | v1 |
| Published ScenePreset | Supabase (or extracted from .onemo) | JSON (Zod-validated) | v1 |
| Customer artwork | Upload → Cloudinary | Image (signed upload) | v1 |
| Saved DesignSession | Supabase | JSON (resume draft) | v2 |
| AI-generated content | Gen AI pipeline | Video/image assets | v5 |

### Outputs from Create

| Output | Destination | Format | Phase |
|--------|-------------|--------|-------|
| DesignSession | Supabase | JSON (autosave on change) | v2 |
| Applied texture | Cloudinary | Image (normalized, hashed) | v2 |
| Owner preview | Client-captured (continuity only) | Screenshot | v1 |
| Controlled previews | Render worker → Cloudinary | Deterministic screenshots | v3 |
| ManufacturingPackage | Compiler → Supabase | Immutable production artifact | v3 |
| Cart line items | Shopify Storefront API | Line-item properties | v4 |

## Directory Structure [v1]

```
create/
├── core/                     ← Shared viewer shell (product-agnostic)
│   ├── ViewerShell.tsx
│   ├── SceneLoader.ts
│   ├── types.ts
│   └── index.ts
│
├── products/                 ← Product family modules
│   ├── registry.ts
│   └── effect/               ← Effect product family
│       ├── EffectRenderer.tsx
│       ├── EffectSurfaces.ts
│       ├── EffectOverrides.ts
│       ├── types.ts
│       └── index.ts
│
├── domain/                   ← Artifact schemas (Zod)
│   ├── scene-preset.ts
│   ├── design-session.ts
│   ├── product-spec.ts
│   └── manufacturing-package.ts
│
├── CreateShell.tsx            ← Entry: ViewerShell + product module + controls
├── ConfigPanel.tsx            ← Customer controls
├── useScenePreset.ts          ← Load + validate + convert
├── useDesignSession.ts        ← DesignSession lifecycle
├── index.ts
│
└── docs/
    ├── ARCHITECTURE.md        ← Legacy (Session 43 blueprint)
    └── architecture/          ← This folder
```

## Decision References

| Decision | ID | Summary |
|----------|-----|---------|
| Create module location | DEC S43-CREATE | Top-level `create/`, sibling to `studio/` |
| Scene format | DEC S42-SCENE | Three.js scene graph is canonical. No conversion layers. |
| 3D as baseline | Session 37 Summary | 2D editor killed. 3D model IS the editor. R3F + drei. |
| Three equal loops | Brief 37.83 | Customization, commerce, social sharing are equal. Not configurator-first. |
| AI as sidecar | Session 37 Summary | AI = translator (function calling), not primary UI. Config object = source of truth. |
| Architecture derives from requirements | Folder 9 pipeline | Architecture after PRDs + domain model + UX, not before. |
