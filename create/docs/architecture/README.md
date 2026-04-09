# Create Module — Architecture

> Production architecture for the ONEMO Create module.
> Each file covers one aspect. Versioned by build phase.
> Consolidated from three proposals: Kai draft + GPT Pro Review Track + GPT Pro Independent Track.
> Merge decisions documented in [consolidation-decisions.md](consolidation-decisions.md).

## Version Roadmap

| Phase | Name | What it delivers | Status |
|-------|------|-----------------|--------|
| **0** | Contract Repair | v4 schemas, `design_revisions` table, `ScenePackageRef`, `CompatibilityEngine`, repo contract tests | **Active** |
| **1** | Shared Runtime | Viewer shell extraction, `ScenePackageLoader`, visual parity harness, fallback stills | Planned |
| **2** | Edit Loop | Effect module, surface discovery, gesture reconciliation, draft shell, autosave, resume | Planned |
| **3** | Proof + Render | Review gate, render pages, Playwright worker, preview captures, fallback stills | Planned |
| **4** | Manufacturing | Method A/B/C compilers, production transforms, immutable packages | Planned |
| **5** | Commerce | `CheckoutIntent`, variant projection, Storefront cart, webhooks, approval-expiry | Planned |
| **6** | Share + Public | Public previews, presentation routes, remix, social share | Planned |
| **7** | AI Sidecars | Intent parser, intake adapters, generated media pipeline | Planned |

Each architecture file marks its sections with `[Phase 0]` through `[Phase 7]` to show which phase introduces that capability.

## File Index

| # | File | Aspect | Primary Phase |
|---|------|--------|---------------|
| 00 | [00-overview.md](00-overview.md) | System context, what Create is, inputs/outputs | 0 |
| 01 | [01-viewer-shell.md](01-viewer-shell.md) | Generic R3F viewer shell contract | 1 |
| 02 | [02-product-modules.md](02-product-modules.md) | ProductFamilyModule interface, Effect module, registry | 2 |
| 03 | [03-domain-schemas.md](03-domain-schemas.md) | v4 Zod schemas for all artifacts + new domain objects | 0 |
| 04 | [04-scene-pipeline.md](04-scene-pipeline.md) | Scene package model, SceneLoader, Studio-to-Create flow | 1 |
| 05 | [05-data-layer.md](05-data-layer.md) | Repository pattern, Supabase/file swap, state ownership | 2 |
| 06 | [06-design-session-lifecycle.md](06-design-session-lifecycle.md) | Draft, save, review, approve, purchase flow | 2 |
| 07 | [07-preview-render-factory.md](07-preview-render-factory.md) | Headless capture, render pages, workers | 3 |
| 08 | [08-manufacturing-pipeline.md](08-manufacturing-pipeline.md) | Compile methods A/B/C, ManufacturingPackage | 4 |
| 09 | [09-commerce-handoff.md](09-commerce-handoff.md) | CheckoutIntent, Shopify, cart, webhooks | 5 |
| 10 | [10-performance-contracts.md](10-performance-contracts.md) | Budgets, fallback ladder, mobile constraints | 1 |
| 11 | [11-gen-ai-hooks.md](11-gen-ai-hooks.md) | Intent parser, intake adapters, generated media | 7 |
| 12 | [12-migration-plan.md](12-migration-plan.md) | Prototype-to-Create migration, file map, phase sequence | 0–7 |
| 13 | [13-state-management.md](13-state-management.md) | Three-class state split, React Query + Zustand + refs | 2 |
| 14 | [14-compatibility-engine.md](14-compatibility-engine.md) | Domain rules, severity model, reason codes, recovery | 0 |
| — | [consolidation-decisions.md](consolidation-decisions.md) | Three-way merge decision log | — |

## Relationship to Other Architecture Documents

- **V3 Master Architecture** (`onemo-ssot-global/5-architecture/baseline/onemo-v3-architecture.md`) — the platform-wide architecture. This folder is the Create module's implementation of that design.
- **V3 Zod Schemas** (`onemo-ssot-global/5-architecture/baseline/onemo-v3-schemas.ts`) — the v3 canonical schema code. This architecture upgrades to v4.
- **V3 Repository Interfaces** (`onemo-ssot-global/5-architecture/baseline/onemo-v3-repositories.ts`) — baseline interfaces. This architecture extends with revision snapshots and split repositories.
- **GPT Pro Proposals** (`create/docs/gpt-pro proposals/`) — the two independent GPT Pro designs that informed this consolidated architecture.
- **Existing ARCHITECTURE.md** (`create/docs/ARCHITECTURE.md`) — the Session 43 blueprint. Superseded by this folder.

## How to Read This

- **Phase 0 (contract repair)?** Read 00, 03, 14, 12 — schemas, compatibility, migration plan.
- **Phase 1 (runtime)?** Add 01, 04, 10 — viewer shell, scene pipeline, performance.
- **Phase 2 (edit loop)?** Add 02, 05, 06, 13 — product modules, data, lifecycle, state.
- **Phase 3 (proof)?** Add 07 — render factory.
- **Phase 4 (manufacturing)?** Add 08 — manufacturing pipeline.
- **Phase 5 (commerce)?** Add 09 — commerce handoff.
- **Phase 7 (AI)?** Add 11 — gen AI hooks.
