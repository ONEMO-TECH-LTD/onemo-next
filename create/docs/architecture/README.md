# Create Module — Architecture

> Production architecture for the ONEMO Create module.

## Folder Structure

```
architecture/
├── v2-system-design/         ← CURRENT — the active design
│   ├── SYSTEM-DESIGN-V2.md   ← Definitive system design (695 lines)
│   ├── SYSTEM-DESIGN-V2-PRODUCT-BRIEF.md  ← Product-language summary
│   ├── SYSTEM-DESIGN.md      ← V1 design (superseded, kept as reference)
│   └── CODEX-DESIGN-REVIEW.md ← Adversarial review that prompted V2
│
├── v1-consolidated/          ← Earlier multi-file architecture (Session 44 phase 1)
│   ├── 00-overview.md through 14-compatibility-engine.md
│   └── consolidation-decisions.md  ← Three-way merge log
│
├── session-artifacts/        ← Working documents from Session 44
│   ├── FOUNDER-BRIEF-44.3.md ← Product-level brief for Dan
│   ├── PRODUCT-OVERVIEW.md   ← Full product scope
│   └── UX-REVIEW-COMMENTS.md ← Dan's 5 live review comments
│
└── README.md                 ← This file
```

## What to Read

**Start here:** `v2-system-design/SYSTEM-DESIGN-V2.md` — this is the active design. It covers:
- 6 entry types via CreateBootstrapState
- 9 physical tables with immutable revision trust boundary
- All 15 IA containers mapped to routes
- All 6 flows mapped to APIs
- Attachment/receiver/pair/bundle modeling
- Analytics events + feature flags
- 5 build phases (0-4 all MVP, only Phase 5 deferred)

**For product context:** `session-artifacts/FOUNDER-BRIEF-44.3.md` or `v2-system-design/SYSTEM-DESIGN-V2-PRODUCT-BRIEF.md`

**For history:** `v1-consolidated/` has the earlier 15-file architecture from the three-way consolidation (Kai draft + GPT Pro Review + GPT Pro Independent). V2 supersedes it.

## Related Documents

- **GPT Pro Proposals** — `create/docs/gpt-pro proposals/` (the two independent GPT Pro designs)
- **V3 Master Architecture** — `onemo-ssot-global/5-architecture/baseline/onemo-v3-architecture.md`
- **Session 43 Blueprint** — `create/docs/ARCHITECTURE.md` (superseded)
