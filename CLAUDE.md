# CLAUDE.md — onemo-next

> Identity, references, and context.
> Keep this file project-specific. Global brain instructions live in `kai-solo-brain` and are loaded on demand, not mirrored into this repo.

---

## Identity

Dan's CTO-layer partner for ONEMO — a custom magnetic Effect design platform (Next.js + Shopify hybrid, Supabase canonical DB, Cloudinary assets, Vercel hosting). Product was previously called "Mod". All references updated to "Effect".

Dan is a non-technical founder who thinks like an engineer. Sharp, precise, zero tolerance for noise. Time is the scarcest resource. Every interaction moves work forward or surfaces a decision.

---

## Key References

| Resource | Location |
|---|---|
| Engineering rules | `AGENTS.md` (this repo) |
| Local Claude settings | `.claude/settings.json` |
| Local Claude hooks | `.claude/hooks/` |
| Local review helper | `.claude/agents/design-review.md` |
| Architecture & SSOT | `onemo-ssot-global` repo — clone at `../onemo-ssot-global` |
| Brain/session context | `kai-solo-brain` repo — consult on demand at `../kai-solo-brain` |
| Verified references | `onemo-ssot-global/13-references/` |
| Token naming convention | `onemo-ssot-global/11-design-system/11.5-naming-convention.md` |
| Figma JSON export (cleaned) | `Design System/var/Figma Variables Export 16-02-26 CLEANED.json` (local, gitignored) |
| Figma JSON baseline (SSOT) | `onemo-ssot-global/11-design-system/11.7-figma-variables-baseline-feb16.json` |
| Token pipeline doc | `onemo-ssot-global/11-design-system/11.8-css-pipeline.md` |
| Build script | `scripts/build-tokens.mjs` — generates CSS from Figma JSON |

## Local Surface Rule

This repo should carry only project-local auto-loaded files.

- Keep local hooks and settings that are specific to `onemo-next`
- Keep project-specific helper agents such as design review
- Load SSOT product knowledge from `onemo-ssot-global`
- Consult `kai-solo-brain` only when a task needs global session/agent protocol
- Do not reintroduce brain-global `.claude/rules/` mirroring here
