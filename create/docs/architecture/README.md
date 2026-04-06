# Create Module — Architecture

> Production architecture for the ONEMO Create module.
> Each file covers one aspect. Versioned by build phase.

## Version Roadmap

| Version | Phase | What it adds | Status |
|---------|-------|-------------|--------|
| **v1** | Foundation | Viewer shell, product module, domain schemas, scene pipeline, migration from prototype | **Active** |
| **v2** | Data Layer | Repository pattern, Supabase/file swap, DesignSession lifecycle, state ownership | Scaffolded |
| **v3** | Render Factory | Preview generation workers, render pages, manufacturing compilers A/B/C | Scaffolded |
| **v4** | Commerce | Shopify integration, cart, checkout, webhooks, variant projection | Scaffolded |
| **v5** | Intelligence | Gen AI hooks, video texture, content pipeline, AI intent parsing, new product families | Scaffolded |

Each architecture file marks its sections with `[v1]` through `[v5]` to show which phase introduces that capability.

## File Index

| # | File | Aspect | Primary Phase |
|---|------|--------|---------------|
| 00 | [00-overview.md](00-overview.md) | System context, what Create is, inputs/outputs | v1 |
| 01 | [01-viewer-shell.md](01-viewer-shell.md) | Generic R3F viewer shell contract | v1 |
| 02 | [02-product-modules.md](02-product-modules.md) | ProductFamilyModule interface, Effect module, registry | v1 |
| 03 | [03-domain-schemas.md](03-domain-schemas.md) | Zod schemas for all 4 artifacts | v1 |
| 04 | [04-scene-pipeline.md](04-scene-pipeline.md) | .onemo format, SceneLoader, Studio-to-Create flow | v1 |
| 05 | [05-data-layer.md](05-data-layer.md) | Repository pattern, Supabase/file swap, state ownership | v2 |
| 06 | [06-design-session-lifecycle.md](06-design-session-lifecycle.md) | Draft, save, review, approve, purchase flow | v2 |
| 07 | [07-preview-render-factory.md](07-preview-render-factory.md) | Headless capture, render pages, workers | v3 |
| 08 | [08-manufacturing-pipeline.md](08-manufacturing-pipeline.md) | Compile methods A/B/C, ManufacturingPackage | v3 |
| 09 | [09-commerce-handoff.md](09-commerce-handoff.md) | Shopify integration, cart, checkout, webhooks | v4 |
| 10 | [10-performance-contracts.md](10-performance-contracts.md) | Budgets, fallbacks, mobile constraints | v1 |
| 11 | [11-gen-ai-hooks.md](11-gen-ai-hooks.md) | Video texture, content pipeline, AI intent parsing | v5 |
| 12 | [12-migration-plan.md](12-migration-plan.md) | Prototype-to-Create migration, file map, phase sequence | v1 |

## Relationship to Other Architecture Documents

- **V3 Master Architecture** (`onemo-ssot-global/5-architecture/baseline/onemo-v3-architecture.md`) — the platform-wide architecture. This folder is the Create module's implementation of that design.
- **Existing ARCHITECTURE.md** (`create/docs/ARCHITECTURE.md`) — the Session 43 blueprint. Superseded by this folder but preserved as reference.
- **onemo-format.ts** (`studio/src/editor/adapter/onemo-format.ts`) — the live ScenePreset type definitions. Domain schemas here formalize those with Zod.
- **V3 Zod Schemas** (`onemo-ssot-global/5-architecture/baseline/onemo-v3-schemas.ts`) — the canonical schema code. Domain schemas here are the Create module's usable subset.

## How to Read This

- **Building Phase 1?** Read 00, 01, 02, 03, 04, 10, 12 — all `[v1]` sections.
- **Adding data persistence?** Add 05, 06 — `[v2]` sections.
- **Adding preview/manufacturing?** Add 07, 08 — `[v3]` sections.
- **Wiring commerce?** Add 09 — `[v4]` sections.
- **Adding AI features?** Add 11 — `[v5]` sections.
